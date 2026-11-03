import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import DodoPayments from 'dodopayments';
import { createPaymentsApi, entitlementFromUser, getUserEntitlement, requirePaidEntitlement, paymentConfig, supportedEvents, reserveProjectAccess, requireProjectAccess, trialFromUser } from '../server/payments.mjs';
import { billingFirestore, firebaseAdmin, verifyFirebaseToken } from '../server/firebase-admin.mjs';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getApps, deleteApp } from 'firebase-admin/app';
import checkoutRoute from '../api/checkout.mjs';
import entitlementRoute from '../api/entitlement.mjs';
import webhookRoute from '../api/webhooks/dodo.mjs';
import { createStorageApi } from '../server/storage.mjs';
import express from 'express';

// The provider boundary is stubbed; signature verification uses the official SDK.
// Transactions serialize to exercise concurrent duplicate delivery atomically.
class MemoryFirestore {
  records = new Map();
  tail = Promise.resolve();
  doc(path) {
    return { path, get: async () => this.snapshot(path), set: async (data, options) => this.write(path, data, options) };
  }
  snapshot(path) { const value = this.records.get(path); return { exists: value !== undefined, data: () => value }; }
  write(path, data, options) { this.records.set(path, options?.merge ? { ...this.records.get(path), ...data } : data); }
  async runTransaction(callback) {
    const previous = this.tail;
    let release;
    this.tail = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      const writes = [];
      const result = await callback({ get: async ref => { assert.equal(writes.length, 0, 'All transaction reads precede writes'); return this.snapshot(ref.path); }, set: (ref, data, options) => writes.push([ref.path, data, options]) });
      writes.forEach(args => this.write(...args)); return result;
    } finally { release(); }
  }
}
if (process.env.FIRESTORE_EMULATOR_HOST) process.env.FIREBASE_PROJECT_ID = 'demo-svgforge';
const db = process.env.FIRESTORE_EMULATOR_HOST ? billingFirestore() : new MemoryFirestore();
const secret = `whsec_${randomBytes(32).toString('base64')}`;
const configuration = { environment: 'test_mode', products: { pro: 'test-pro', lifetime: 'test-lifetime' }, bearerToken: 'test-only', webhookKey: secret };
const sdk = new DodoPayments({ bearerToken: 'test-only', environment: 'test_mode', webhookKey: secret });
const signer = new Webhook(secret);
const checkouts = [];
const subscriptions = new Map();
const client = {
  webhooks: sdk.webhooks,
  checkoutSessions: { create: async request => { checkouts.push(request); return { session_id: `test-session-${checkouts.length}`, checkout_url: 'https://checkout.dodopayments.com/test-only' }; } },
  subscriptions: { retrieve: async id => { if (!subscriptions.has(id)) throw new Error('Unknown test subscription'); return subscriptions.get(id); } },
};
const verify = async token => { if (!['alice', 'bob', 'unpaid', 'trial-user'].includes(token)) throw new Error('Invalid token'); return { uid: token, email: `${token}@example.com`, name: token }; };
const app = createPaymentsApi({ db, client, configuration, verify });
app.use('/api/storage', createStorageApi({ verify, requirePaid: uid => requirePaidEntitlement(uid, db), bucket: 'test', authorizeProject: async () => {} }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const checkout = (plan, user = 'alice', extra = {}) => fetch(`${origin}/api/checkout`, { method: 'POST', headers: { Authorization: `Bearer ${user}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, ...extra }) });
const deliver = async (event, id, changes = {}, timestamp = new Date(), body = JSON.stringify(event)) => {
  return fetch(`${origin}/api/webhooks/dodo`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)), 'webhook-signature': signer.sign(id, timestamp, body), ...changes }, body });
};
let sequence = 0;
const subscriptionEvent = (type, status, metadata, id = 'sub-alice') => {
  const data = { subscription_id: id, status, product_id: configuration.products.pro, customer: { customer_id: 'cus-alice' }, metadata, next_billing_date: '2026-11-05T00:00:00Z', cancel_at_next_billing_date: false };
  subscriptions.set(id, data);
  return { type, timestamp: new Date(Date.UTC(2026, 9, 5, 0, 0, sequence++)).toISOString(), data };
};
try {

  const trialPost = body => fetch(`${origin}/api/trial`, {method:'POST',headers:{Authorization:'Bearer trial-user','Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await fetch(`${origin}/api/trial`,{method:'POST'})).status,401);
  assert.equal((await trialPost({action:'reserve',projectId:'one'})).status,402);
  assert.equal((await trialPost({action:'start'})).status,200);
  const allocations=await Promise.all(['one','two','three','four','five'].map(projectId=>trialPost({action:'reserve',projectId})));
  assert.equal(allocations.filter(r=>r.status===200).length,3,'Concurrent requests cannot exceed three projects');
  assert.equal(allocations.filter(r=>r.status===402).length,2);
  const accepted=['one','two','three','four','five'].filter((_,i)=>allocations[i].status===200);
  assert.equal((await trialPost({action:'reserve',projectId:accepted[0]})).status,200,'Same project retry never consumes another trial');
  await requireProjectAccess('trial-user',accepted[0],db);
  await assert.rejects(requireProjectAccess('trial-user','other',db),{status:402});
  await assert.rejects(requireProjectAccess('bob',accepted[0],db),{status:402});
  await trialPost({action:'start'});
  assert.equal(trialFromUser((await db.doc('users/trial-user').get()).data()).used,3,'Starting again cannot reset trial counter');
  assert.equal((await trialPost({action:'reserve',projectId:'new-after-delete'})).status,402);
  await assert.rejects(reserveProjectAccess('trial-user','../escape',db),{status:400});
  const trialResponse=await (await fetch(`${origin}/api/entitlement`,{headers:{Authorization:'Bearer trial-user'}})).json();
  assert.equal(trialResponse.entitlement,null,'Free access never fabricates a paid plan');
  assert.deepEqual(trialResponse.trial,{enabled:true,used:3,remaining:0,limit:3});
  console.log('PASS free project trials: authentication, concurrency, idempotent retry, exhaustion, account isolation and paid entitlement separation');

  for (const route of [checkoutRoute, entitlementRoute, webhookRoute]) assert.equal(typeof route, 'function');
  assert.equal((await fetch(`${origin}/api/checkout`, { method: 'POST' })).status, 401);
  assert.equal((await checkout('pro', 'invalid')).status, 401);
  assert.equal((await checkout('other')).status, 400);
  assert.equal((await checkout('pro', 'alice', { product_id: 'arbitrary' })).status, 400);
  assert.equal((await checkout('pro', 'alice', { uid: 'bob' })).status, 400);
  assert.equal((await checkout('pro', 'alice', { price: 1 })).status, 400);
  await db.doc('users/alice').set({ displayName: 'Preserved', customSetting: { hello: 'world' } });
  assert.equal(await getUserEntitlement('alice', db), null);
  assert.equal((await checkout('pro')).status, 200);
  const pro = checkouts.at(-1);
  assert.deepEqual(pro.product_cart, [{ product_id: 'test-pro', quantity: 1 }]);
  assert.equal(pro.customer.email, 'alice@example.com');
  assert.equal(pro.metadata.firebase_uid, 'alice');
  assert.equal(pro.return_url, 'https://www.vekto.website/dashboard?checkout=processing&checkout_plan=pro');
  assert.equal(await getUserEntitlement('alice', db), null, 'Checkout never activates access');
  const active = subscriptionEvent('subscription.active', 'active', pro.metadata);
  assert.equal((await deliver(active, 'invalid-signature', { 'webhook-signature': 'v1,invalid' })).status, 401);
  assert.equal(await getUserEntitlement('alice', db), null);
  assert.equal((await fetch(`${origin}/api/webhooks/dodo`, { method: 'POST', body: JSON.stringify(active) })).status, 401);
  assert.equal((await deliver(active, 'expired-signature', {}, new Date(Date.now() - 600000))).status, 401);
  const ignored = { type: 'payment.processing', timestamp: active.timestamp, data: {} };
  assert.equal((await deliver(ignored, 'signed-whitespace', {}, new Date(), JSON.stringify(ignored, null, 2))).status, 200, 'Signatures use the unmodified raw body including whitespace');
  const duplicates = await Promise.all([deliver(active, 'active-event'), deliver(active, 'active-event')]);
  assert.ok(duplicates.every(result => result.status === 200));
  assert.equal((await Promise.all(duplicates.map(result => result.json()))).filter(result => result.duplicate).length, 1);
  assert.deepEqual(await getUserEntitlement('alice', db), { plan: 'pro', active: true, lifetime: false, subscriptionStatus: 'active' });
  assert.equal((await checkout('pro')).status, 409);
  for (const [type, status] of [
    ['subscription.renewed', 'active'], ['subscription.cancelled', 'cancelled'], ['subscription.expired', 'expired'],
    ['subscription.failed', 'failed'], ['subscription.on_hold', 'on_hold'], ['subscription.past_due', 'past_due'],
    ['subscription.paused', 'paused'], ['subscription.unpaused', 'active'], ['subscription.updated', 'active'], ['subscription.plan_changed', 'active'],
  ]) {
    assert.equal((await deliver(subscriptionEvent(type, status, pro.metadata), type)).status, 200, type);
    assert.equal((await getUserEntitlement('alice', db)).active, status === 'active', type);
  }
  const cancelled = subscriptionEvent('subscription.cancelled', 'cancelled', pro.metadata);
  assert.equal((await deliver(cancelled, 'cancel-latest')).status, 200);
  assert.equal((await deliver(active, 'late-active')).status, 200);
  assert.equal((await getUserEntitlement('alice', db)).active, false, 'Delayed activation cannot revive cancellation');
  const changed = subscriptionEvent('subscription.plan_changed', 'active', pro.metadata);
  changed.data.product_id = 'unrelated-product';
  assert.equal((await deliver(changed, 'unknown-product')).status, 200);
  assert.equal((await getUserEntitlement('alice', db)).active, false);
  const resumed = subscriptionEvent('subscription.unpaused', 'active', pro.metadata);
  assert.equal((await deliver(resumed, 'resume')).status, 200);
  const second = subscriptionEvent('subscription.active', 'active', pro.metadata, 'second-sub');
  assert.equal((await deliver(second, 'second')).status, 200);
  assert.equal((await deliver(subscriptionEvent('subscription.expired', 'expired', pro.metadata), 'old-sub-expires')).status, 200);
  assert.equal((await getUserEntitlement('alice', db)).active, true, 'One expired subscription cannot revoke another active subscription');
  assert.equal((await checkout('lifetime')).status, 200);
  const lifetime = checkouts.at(-1);
  assert.deepEqual(lifetime.product_cart, [{ product_id: 'test-lifetime', quantity: 1 }]);
  const payment = { type: 'payment.succeeded', timestamp: '2026-10-05T01:00:00Z', data: { payment_id: 'pay-alice', status: 'succeeded', customer: { customer_id: 'cus-alice' }, metadata: lifetime.metadata, product_cart: [{ product_id: 'test-lifetime', quantity: 1 }] } };
  const mismatch = { ...payment, data: { ...payment.data, product_cart: [{ product_id: 'wrong', quantity: 1 }] } };
  assert.equal((await deliver(mismatch, 'wrong-payment-product')).status, 400);
  assert.equal((await deliver(payment, 'lifetime-payment')).status, 200);
  assert.deepEqual(await getUserEntitlement('alice', db), { plan: 'lifetime', active: true, lifetime: true });
  for (const event of supportedEvents) {
    if (!event.startsWith('subscription.')) continue;
    assert.equal((await deliver(subscriptionEvent(event, 'expired', pro.metadata), `lifetime-${event}`)).status, 200);
    assert.equal((await getUserEntitlement('alice', db)).plan, 'lifetime');
  }
  for (const type of ['payment.failed', 'payment.cancelled']) {
    assert.equal((await deliver({ ...payment, type, data: { ...payment.data, payment_id: type, status: type.split('.')[1] } }, type)).status, 200);
    assert.equal((await getUserEntitlement('alice', db)).active, true);
  }
  const owner = (await db.doc('users/alice').get()).data();
  assert.equal(owner.displayName, 'Preserved'); assert.deepEqual(owner.customSetting, { hello: 'world' });
  assert.equal(owner.dodoLifetimePaymentId, 'pay-alice');
  assert.equal((await checkout('lifetime')).status, 409);
  assert.equal((await checkout('pro')).status, 409);
  const missing = { ...payment, data: { ...payment.data, metadata: {} } };
  assert.equal((await deliver(missing, 'missing-binding')).status, 400);
  const spoof = { ...payment, data: { ...payment.data, metadata: { ...lifetime.metadata, firebase_uid: 'bob' } } };
  assert.equal((await deliver(spoof, 'spoof-owner')).status, 400);
  assert.equal(await getUserEntitlement('bob', db), null);
  assert.equal((await fetch(`${origin}/api/entitlement`, { headers: { Authorization: 'Bearer alice' } })).status, 200);
  assert.equal((await fetch(`${origin}/api/entitlement`)).status, 401);
  const denied = await fetch(`${origin}/api/storage/example?path=source/logo.svg`, { method: 'PUT', headers: { Authorization: 'Bearer unpaid' }, body: '<svg/>' });
  assert.equal(denied.status, 402, 'Paid cloud uploads require actual server entitlement');
  await assert.rejects(requirePaidEntitlement('unpaid', db), { status: 402 });
  assert.equal(entitlementFromUser({ plan: 'lifetime', lifetime: false }), null);
  assert.deepEqual(entitlementFromUser({ plan: 'pro', subscriptionStatus: 'past_due' }), { plan: 'pro', active: false, lifetime: false, subscriptionStatus: 'past_due' });
  assert.throws(() => paymentConfig({}), /configured/);
  assert.throws(() => paymentConfig({ DODO_PAYMENTS_ENVIRONMENT: 'production' }), /configured/);
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const firebase = await import('firebase/app');
    const authModule = await import('firebase/auth');
    const firestore = await import('firebase/firestore');
    const clientApp = firebase.initializeApp({ projectId: 'demo-svgforge', apiKey: 'emulator-only', appId: 'billing-rules-test' }, 'billing-rules-client');
    const auth = authModule.getAuth(clientApp);
    authModule.connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    const clientDb = firestore.getFirestore(clientApp);
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    firestore.connectFirestoreEmulator(clientDb, host, Number(port));
    try {
      const { user } = await authModule.signInWithCredential(auth, authModule.GoogleAuthProvider.credential(JSON.stringify({ sub: 'billing-rules-owner', email: 'billing-rules@example.test' })));
      await db.doc(`users/${user.uid}`).set({ plan: 'pro', subscriptionStatus: 'active', lifetime: false });
      assert.equal((await firestore.getDoc(firestore.doc(clientDb, 'users', user.uid))).data().plan, 'pro');
      await assert.rejects(firestore.setDoc(firestore.doc(clientDb, 'users', user.uid), { plan: 'lifetime', lifetime: true }), { code: 'permission-denied' });
      await assert.rejects(firestore.getDoc(firestore.doc(clientDb, 'users', 'alice')), { code: 'permission-denied' });
      await assert.rejects(firestore.setDoc(firestore.doc(clientDb, 'dodoWebhookEvents', 'fake'), { processedAt: 1 }), { code: 'permission-denied' });
      await assert.rejects(firestore.getDoc(firestore.doc(clientDb, 'dodoCheckouts', pro.metadata.vekto_checkout)), { code: 'permission-denied' });
      const projectRef=firestore.doc(clientDb,'users',user.uid,'projects','paid-rule-project');
      const projectData={projectId:'paid-rule-project',ownerId:user.uid,createdAt:1,name:'Existing project'};
      await firestore.setDoc(projectRef,projectData);
      await db.doc(`users/${user.uid}`).set({plan:'pro',subscriptionStatus:'cancelled',lifetime:false});
      await assert.rejects(firestore.updateDoc(projectRef,{name:'Console bypass'}),{code:'permission-denied'});
      await assert.rejects(firestore.setDoc(firestore.doc(clientDb,'users',user.uid,'projects','unpaid-new'),{...projectData,projectId:'unpaid-new'}),{code:'permission-denied'});
      await db.doc(`users/${user.uid}`).set({plan:'lifetime',lifetime:true,subscriptionStatus:'active'});
      await firestore.updateDoc(projectRef,{name:'Same UID restored access'});
      assert.equal((await firestore.getDoc(projectRef)).data().ownerId,user.uid);
      for(const field of ['subscriptionStatus','lifetime','dodoCustomerId','dodoSubscriptionId','dodoLifetimePaymentId','dodoLastPaymentId','dodoLastPaymentStatus'])await assert.rejects(firestore.updateDoc(firestore.doc(clientDb,'users',user.uid),{[field]:'spoof'}),{code:'permission-denied'});
      for(const collection of ['dodoCheckouts','dodoBillingObjects','dodoWebhookEvents'])await assert.rejects(firestore.setDoc(firestore.doc(clientDb,collection,'client-bypass'),{uid:user.uid,plan:'lifetime'}),{code:'permission-denied'});
      await db.doc(`users/${user.uid}`).set({freeTrialEnabled:true,freeProjectsUsed:0});
      const grantPath=`users/${user.uid}/trialProjects/trial-rule-project`;
      await assert.rejects(firestore.setDoc(firestore.doc(clientDb,grantPath),{projectId:'trial-rule-project'}),{code:'permission-denied'});
      await assert.rejects(firestore.updateDoc(firestore.doc(clientDb,'users',user.uid),{freeProjectsUsed:0}),{code:'permission-denied'});
      await reserveProjectAccess(user.uid,'trial-rule-project',db);
      const trialRef=firestore.doc(clientDb,'users',user.uid,'projects','trial-rule-project');
      await firestore.setDoc(trialRef,{...projectData,projectId:'trial-rule-project'});
      await firestore.updateDoc(trialRef,{name:'Free editing works'});
      await assert.rejects(firestore.setDoc(firestore.doc(clientDb,'users',user.uid,'projects','unreserved'),{...projectData,projectId:'unreserved'}),{code:'permission-denied'});
      await firestore.deleteDoc(trialRef);
      assert.equal(trialFromUser((await db.doc(`users/${user.uid}`).get()).data()).used,1,'Deleting a project does not restore its trial');
      const verifiedToken = await user.getIdToken();
      assert.equal((await verifyFirebaseToken(verifiedToken)).uid,user.uid);
      await adminAuth(firebaseAdmin()).updateUser(user.uid,{disabled:true});
      await assert.rejects(verifyFirebaseToken(verifiedToken),{code:'auth/user-disabled'});
      await adminAuth(firebaseAdmin()).updateUser(user.uid,{disabled:false});
      console.log('PASS shared Admin verification accepts the real emulator user and rejects disabled-user tokens');
      console.log('PASS real Firestore rules: owner billing read, denied client entitlement writes, denied other-user reads and private webhook/checkout records');
    } finally { await firestore.terminate(clientDb); await firebase.deleteApp(clientApp); }
  }
  console.log('PASS checkout authentication/mapping, official SDK signatures, transactional duplicate events, all configured lifecycle events, out-of-order events, multiple subscriptions, Lifetime protection, preserved user fields and server paid-access guard');
} finally {
  await new Promise(resolve => server.close(resolve));
  if (process.env.FIRESTORE_EMULATOR_HOST) await Promise.all(getApps().map(deleteApp));
}
