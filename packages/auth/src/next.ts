import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from './index.js';

export const authHandlers = toNextJsHandler(auth);
