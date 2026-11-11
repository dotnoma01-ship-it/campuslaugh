import { EventEmitter } from 'node:events';

export const chatEvents = new EventEmitter();
chatEvents.setMaxListeners(0);
