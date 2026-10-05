import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import DodoPayments from 'dodopayments';
import { paymentConfig } from '../server/payments.mjs';

// Read-only: never creates a checkout, payment, subscription or webhook.
const config = paymentConfig();
const client = new DodoPayments({ ...config, timeout: 10000, maxRetries: 0 });
let failed = false;
for (const [plan, productId] of Object.entries(config.products)) {
  try {
    const product = await client.products.retrieve(productId);
    assert.equal(product.price.currency, 'USD');
    assert.equal(product.price.price, plan === 'pro' ? 500 : 2900);
    assert.equal(product.price.type, plan === 'pro' ? 'recurring_price' : 'one_time_price');
    if (plan === 'pro') {
      assert.equal(product.price.payment_frequency_count, 1);
      assert.equal(product.price.payment_frequency_interval, 'Month');
    }
    console.log(`PASS ${plan}: configured product and price in ${config.environment}`);
  } catch (cause) {
    failed = true;
    console.log(`FAIL ${plan}: product verification${cause.status ? ` (HTTP ${cause.status})` : ''}`);
  }
}
const html = await readFile('dist/index.html', 'utf8');
for (const name of ['DODO_PAYMENTS_API_KEY', 'DODO_PAYMENTS_WEBHOOK_SECRET', 'FIREBASE_ADMIN_SERVICE_ACCOUNT']) {
  assert.ok(!html.includes(name), `Server-only variable name must not be bundled: ${name}`);
  const secret = process.env[name];
  if (secret) assert.ok(!html.includes(secret), `Server secret must not be bundled: ${name}`);
}
assert.ok(!html.includes('firebase-admin'), 'Firebase Admin must not enter browser bundle');
console.log('PASS production browser bundle contains no Dodo/Firebase Admin secrets or Admin imports');
if (!process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIRESTORE_EMULATOR_HOST) {
  console.log('NOTE configure Firebase Admin service account or Google Application Default Credentials for server Firestore writes');
}
process.exitCode = failed ? 1 : 0;
