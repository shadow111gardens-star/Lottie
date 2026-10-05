import { createPaymentsApi } from '../../server/payments.mjs';
export const config = { api: { bodyParser: false } };
export default createPaymentsApi();
