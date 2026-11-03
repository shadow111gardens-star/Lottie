import type { IncomingMessage, ServerResponse } from 'node:http';
export function createAiAnimatorApi(): (req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void) => void;
