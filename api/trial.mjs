import { createPaymentsApi } from '../server/payments.mjs';
const app = createPaymentsApi();
export default function handler(req, res) { return app(req, res); }
