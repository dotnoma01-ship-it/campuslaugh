import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL, getAccessToken } from '@/services/http';

export function connectChatSocket(): Socket | null {
  const token = getAccessToken();
  if (!token) return null;
  const origin = new URL(API_BASE_URL).origin;
  return io(origin, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true, timeout: 10000 });
}
