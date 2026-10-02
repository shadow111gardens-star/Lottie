import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import http from 'node:http';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import storage from '../api/storage.mjs';

// Run with --no-experimental-require-module to reproduce the failing host.
const require = createRequire(import.meta.url);
const jwksClient = require('jwks-rsa');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'runtime-test', alg: 'RS256', use: 'sig' };
const keys = http.createServer((_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ keys: [jwk] }));
}).listen(0, '127.0.0.1');
await new Promise(resolve => keys.once('listening', resolve));
const api = http.createServer(storage).listen(0, '127.0.0.1');
await new Promise(resolve => api.once('listening', resolve));
const app = initializeApp({ projectId: 'runtime-test' }, 'runtime-signature-test');
try {
  const client = jwksClient({ jwksUri: `http://127.0.0.1:${keys.address().port}/jwks` });
  const pem = (await client.getSigningKey(jwk.kid)).getPublicKey();
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud: 'runtime-test', iss: 'https://securetoken.google.com/runtime-test', sub: 'test-owner', iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: 'google.com' } };
  const tokenFor = payload => {
    const input = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode(payload)}`;
    return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
  };
  const token = tokenFor(claims);
  assert.ok(verify('RSA-SHA256', Buffer.from(token.split('.').slice(0, 2).join('.')), pem, Buffer.from(token.split('.')[2], 'base64url')));
  const auth = getAuth(app);
  // Test-only public certificate source; Firebase's real claims and signature
  // validation remains enabled. No credentials or production token are needed.
  auth.idTokenVerifier.signatureVerifier.keyFetcher.fetchPublicKeys = async () => ({ [jwk.kid]: pem });
  assert.equal((await auth.verifyIdToken(token)).uid, 'test-owner');
  await assert.rejects(auth.verifyIdToken(tokenFor({ ...claims, aud: 'another-project' })));
  await assert.rejects(auth.verifyIdToken(tokenFor({ ...claims, exp: now - 10 })));
  const altered = `${token.split('.')[0]}.${encode({ ...claims, sub: 'attacker' })}.${token.split('.')[2]}`;
  await assert.rejects(auth.verifyIdToken(altered));
  const origin = `http://127.0.0.1:${api.address().port}/api/storage/test-project?path=project/test/scene.svg`;
  assert.equal((await fetch(origin)).status, 401);
  const invalid = await fetch(origin, { headers: { Authorization: 'Bearer invalid-token' } });
  assert.equal(invalid.status, 401);
  assert.equal((await invalid.json()).code, 'AUTH_INVALID');
  console.log('PASS CommonJS JWKS key conversion, Firebase signed-token verification, invalid/expired/wrong-project rejection and ESM Vercel API startup');
} finally {
  await deleteApp(app);
  await Promise.all([new Promise(resolve => keys.close(resolve)), new Promise(resolve => api.close(resolve))]);
}
