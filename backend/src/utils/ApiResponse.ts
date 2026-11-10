export interface ApiResponse<T> { success: true; data: T; message?: string; }
export const ok = <T>(data: T, message?: string): ApiResponse<T> => ({ success: true, data, ...(message ? { message } : {}) });
