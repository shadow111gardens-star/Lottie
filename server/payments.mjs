import express from 'express';
import { randomUUID, createHash } from 'node:crypto';
import DodoPayments from 'dodopayments';
import { FieldValue } from 'firebase-admin/firestore';
import { billingFirestore, verifyFirebaseToken } from './firebase-admin.mjs';

export const supportedEvents = new Set([
  'payment.succeeded', 'payment.failed', 'payment.cancelled',
  'subscription.active', 'subscription.renewed', 'subscription.cancelled',
  'subscription.expired', 'subscription.failed', 'subscription.on_hold',
  'subscription.past_due', 'subscription.paused', 'subscription.plan_changed',
  'subscription.unpaused', 'subscription.updated',
]);
const error = (status, message) => Object.assign(new Error(message), { status });
const hash = value => createHash('sha256').update(value).digest('hex');
export function paymentConfig(env = process.env) {
  const environment = env.DODO_PAYMENTS_ENVIRONMENT;
  if (!['live_mode', 'test_mode'].includes(environment)) throw error(503, 'Payments are not configured.');
  const products = { pro: env.DODO_PRO_PRODUCT_ID, lifetime: env.DODO_LIFETIME_PRODUCT_ID };
  if (!env.DODO_PAYMENTS_API_KEY || !env.DODO_PAYMENTS_WEBHOOK_SECRET || !products.pro || !products.lifetime || products.pro === products.lifetime) throw error(503, 'Payments are not configured.');
  return { environment, products, bearerToken: env.DODO_PAYMENTS_API_KEY, webhookKey: env.DODO_PAYMENTS_WEBHOOK_SECRET };
}
export function entitlementFromUser(user) {
  if (user?.plan === 'lifetime' && user.lifetime === true) return { plan: 'lifetime', active: true, lifetime: true };
  if (user?.plan === 'pro') return { plan: 'pro', active: user.subscriptionStatus === 'active', lifetime: false };
  return null;
}
export async function getUserEntitlement(uid, db = billingFirestore()) {
  return entitlementFromUser((await db.doc(`users/${uid}`).get()).data());
}
export async function requirePaidEntitlement(uid, db) {
  const entitlement = await getUserEntitlement(uid, db);
  if (!entitlement?.active) throw error(402, 'Choose Pro or Lifetime to use paid features.');
  return entitlement;
}

// Only called after SDK raw-body signature verification. Binding metadata is created
// on our server, never taken from the checkout request or a redirect query string.
export async function processDodoEvent(event, eventId, { db, client, configuration }) {
  if (!eventId || eventId.length > 512 || !event || typeof event.type !== 'string') throw error(400, 'Invalid payment event.');
  const marker = db.doc(`dodoWebhookEvents/${hash(eventId)}`);
  if ((await marker.get()).exists) return { duplicate: true };
  if (!supportedEvents.has(event.type)) {
    await db.runTransaction(async tx => { if (!(await tx.get(marker)).exists) tx.set(marker, { type: event.type, ignored: true, processedAt: FieldValue.serverTimestamp() }); });
    return { ignored: true };
  }
  const data = event.data;
  const subscriptionEvent = event.type.startsWith('subscription.');
  if (!data || typeof data !== 'object') throw error(400, 'Missing event data.');
  // Dodo payloads carry the latest state, even on retries. Read current subscription
  // state as well so an old active/renewed delivery cannot revive a cancelled plan.
  const sid = subscriptionEvent ? data.subscription_id : data.subscription_id || data.subscription_ids?.[0];
  const subscription = sid ? await client.subscriptions.retrieve(sid) : null;
  const metadata = subscription?.metadata?.vekto_checkout ? subscription.metadata : data.metadata;
  const bindingId = metadata?.vekto_checkout;
  if (typeof bindingId !== 'string' || !/^[a-f0-9-]{36}$/.test(bindingId)) throw error(400, 'Missing Vekto checkout association.');
  const bindingRef = db.doc(`dodoCheckouts/${bindingId}`);
  const bindingSnapshot = await bindingRef.get();
  if (!bindingSnapshot.exists) throw error(400, 'Unknown checkout association.');
  const binding = bindingSnapshot.data();
  if (binding.uid !== metadata.firebase_uid || binding.plan !== metadata.plan || binding.environment !== configuration.environment) throw error(400, 'Checkout association mismatch.');
  const customerId = (subscription || data).customer?.customer_id;
  if (typeof customerId !== 'string' || !customerId) throw error(400, 'Missing customer identifier.');
  const expectedProduct = binding.productId;
  const productMatches = subscription ? subscription.product_id === expectedProduct : data.product_cart?.some(item => item.product_id === expectedProduct && item.quantity === 1);
  // Plan changes to another product must disable this Pro subscription, not grant
  // access to an unrelated product. One-time payments must match exactly.
  if (!subscription && !productMatches) throw error(400, 'Payment product mismatch.');
  if (subscription && binding.plan !== 'pro') throw error(400, 'Invalid subscription plan.');
  const occurredAt = Date.parse(event.timestamp);
  if (!Number.isFinite(occurredAt)) throw error(400, 'Invalid event timestamp.');
  const objectId = subscription ? sid : data.payment_id;
  if (typeof objectId !== 'string' || !objectId) throw error(400, 'Missing payment identifier.');
  const objectRef = db.doc(`dodoBillingObjects/${hash(`${subscription ? 'subscription' : 'payment'}:${objectId}`)}`);
  const userRef = db.doc(`users/${binding.uid}`);
  return db.runTransaction(async tx => {
    const [seen, checkout, object, userSnapshot] = await Promise.all([tx.get(marker), tx.get(bindingRef), tx.get(objectRef), tx.get(userRef)]);
    if (seen.exists) return { duplicate: true };
    if (!checkout.exists || checkout.data().uid !== binding.uid) throw error(400, 'Invalid checkout binding.');
    const prior = object.data();
    if (prior?.uid && prior.uid !== binding.uid) throw error(400, 'Billing object owner mismatch.');
    const user = userSnapshot.data() || {};
    const stale = prior && prior.occurredAt > occurredAt;
    const now = FieldValue.serverTimestamp();
    if (!stale) {
      const status = subscription ? (productMatches ? subscription.status : 'cancelled') : data.status;
      if (subscription && !['pending', 'active', 'on_hold', 'paused', 'cancelled', 'failed', 'expired', 'past_due'].includes(status)) throw error(400, 'Invalid subscription status.');
      tx.set(objectRef, { uid: binding.uid, objectId, occurredAt, status: status || event.type.split('.')[1], productId: expectedProduct, updatedAt: now }, { merge: true });
      tx.set(bindingRef, { lastEvent: event.type, lastEventAt: occurredAt, updatedAt: now }, { merge: true });
      const patch = { updatedAt: now };
      if (!subscriptionEvent) {
        if (typeof data.payment_id !== 'string') throw error(400, 'Missing payment identifier.');
        patch.dodoLastPaymentId = data.payment_id;
        patch.dodoLastPaymentStatus = data.status || event.type.split('.')[1];
      }
      const lifetime = user.plan === 'lifetime' && user.lifetime === true;
      if (!subscription && binding.plan === 'lifetime' && event.type === 'payment.succeeded' && data.status === 'succeeded') {
        Object.assign(patch, { plan: 'lifetime', lifetime: true, subscriptionStatus: 'active', dodoCustomerId: customerId, dodoLifetimePaymentId: data.payment_id });
      } else if (subscription && !lifetime) {
        const subscriptions = { ...user.dodoSubscriptions, [sid]: { status, customerId, productId: subscription.product_id, occurredAt, nextBillingDate: subscription.next_billing_date || null, cancelAtNextBillingDate: subscription.cancel_at_next_billing_date === true } };
        patch.dodoSubscriptions = subscriptions;
        const active = Object.entries(subscriptions).filter(([, entry]) => entry.status === 'active').sort((a, b) => b[1].occurredAt - a[1].occurredAt)[0];
        if (active) Object.assign(patch, { plan: 'pro', subscriptionStatus: 'active', lifetime: false, dodoSubscriptionId: active[0], dodoCustomerId: active[1].customerId });
        else if (!user.dodoSubscriptionId || user.dodoSubscriptionId === sid || subscriptions[user.dodoSubscriptionId]) Object.assign(patch, { plan: 'pro', subscriptionStatus: status, lifetime: false, dodoSubscriptionId: sid, dodoCustomerId: customerId });
      }
      // Failed/cancelled payments record attempts without revoking an existing plan.
      tx.set(userRef, patch, { merge: true });
    }
    tx.set(marker, { type: event.type, uid: binding.uid, occurredAt, stale: !!stale, processedAt: now });
    return { received: true };
  });
}

export function createPaymentsApi(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  let sdk;
  const config = () => options.configuration || paymentConfig();
  const client = () => options.client || (sdk ??= new DodoPayments({ ...config(), timeout: 15000, maxRetries: 1 }));
  const db = () => options.db || billingFirestore();
  const authenticate = async (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
    try { req.identity = await (options.verify || verifyFirebaseToken)(token); }
    catch { return res.status(401).json({ error: 'Your sign-in session has expired. Sign in again.' }); }
    next();
  };
  app.post('/api/webhooks/dodo', express.raw({ type: () => true, limit: '1mb' }), async (req, res, next) => {
    try {
      const configuration = config();
      let event;
      try {
        if (!Buffer.isBuffer(req.body)) throw new Error('Raw body required');
        const headers = Object.fromEntries(['webhook-id', 'webhook-timestamp', 'webhook-signature'].map(name => [name, req.get(name) || '']));
        event = client().webhooks.unwrap(req.body.toString('utf8'), { headers, key: configuration.webhookKey });
      } catch { throw error(401, 'Invalid webhook signature.'); }
      const result = await processDodoEvent(event, req.get('webhook-id'), { db: db(), client: client(), configuration });
      res.json(result);
    } catch (cause) { next(cause); }
  });
  app.post('/api/checkout', authenticate, express.json({ limit: '2kb' }), async (req, res, next) => {
    try {
      const plan = req.body?.plan;
      if (!req.body || Object.keys(req.body).length !== 1 || !['pro', 'lifetime'].includes(plan)) throw error(400, 'Select Pro or Lifetime.');
      if (!req.identity.email) throw error(400, 'Your account needs an authenticated email address.');
      const configuration = config();
      const existing = await getUserEntitlement(req.identity.uid, db());
      if (existing?.lifetime || (existing?.active && plan === 'pro')) throw error(409, 'This plan is already active on your account.');
      const checkoutId = randomUUID();
      const ref = db().doc(`dodoCheckouts/${checkoutId}`);
      await ref.set({ uid: req.identity.uid, plan, productId: configuration.products[plan], environment: configuration.environment, createdAt: FieldValue.serverTimestamp() });
      const session = await client().checkoutSessions.create({
        product_cart: [{ product_id: configuration.products[plan], quantity: 1 }],
        customer: { email: req.identity.email, name: req.identity.name || req.identity.email },
        metadata: { firebase_uid: req.identity.uid, plan, vekto_checkout: checkoutId },
        return_url: `https://www.vekto.website/dashboard?checkout=processing&checkout_plan=${plan}`,
      });
      if (!session.checkout_url || new URL(session.checkout_url).protocol !== 'https:') throw error(502, 'Checkout could not be created. Please try again.');
      await ref.set({ sessionId: session.session_id }, { merge: true });
      res.json({ checkoutUrl: session.checkout_url });
    } catch (cause) { next(cause); }
  });
  app.get('/api/entitlement', authenticate, async (req, res, next) => {
    try { res.json({ entitlement: await getUserEntitlement(req.identity.uid, db()) }); } catch (cause) { next(cause); }
  });
  app.use((cause, _req, res, _next) => {
    const providerError = cause instanceof DodoPayments.APIError;
    const status = providerError ? 502 : cause.status >= 400 && cause.status < 500 ? cause.status : cause.status === 503 ? 503 : 500;
    // SDK errors can contain request credentials; never log the exception object.
    console.error('Vekto billing request failed', { status, category: cause.name || 'Error' });
    res.status(status).json({ error: status < 500 ? cause.message : 'Payments are temporarily unavailable. Please try again.' });
  });
  return app;
}
