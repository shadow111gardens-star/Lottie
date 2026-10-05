import type { IncomingMessage, ServerResponse } from 'node:http';
export function createPaymentsApi(): (req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void) => void;
