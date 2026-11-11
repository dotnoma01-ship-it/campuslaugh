import { API_BASE_URL, getAccessToken, refreshAccessToken } from '@/services/http';

export interface UploadedMedia {
  url: string;
  publicId: string;
  resourceType: string;
  bytes: number;
  format: string;
  assetId: string;
}

function uploadOnce(file: File, onProgress?: (percent: number) => void, options?: { context?: string; conversationId?: string }): Promise<UploadedMedia> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);
    if (options?.context) form.append('context', options.context);
    if (options?.conversationId) form.append('conversationId', options.conversationId);
    xhr.open('POST', new URL('/api/uploads', new URL(API_BASE_URL).origin));
    xhr.withCredentials = true;
    const token = getAccessToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)); };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || '{}') as Partial<UploadedMedia> & { message?: string };
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(body.message ?? `Upload failed (${xhr.status}).`));
      if (!body.url || !body.publicId || !body.assetId) return reject(new Error('The upload service returned an invalid response.'));
      resolve(body as UploadedMedia);
    };
    xhr.send(form);
  });
}

export async function uploadMedia(file: File, onProgress?: (percent: number) => void, options?: { context?: string; conversationId?: string }) {
  try {
    return await uploadOnce(file, onProgress, options);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('(401)')) throw error;
    await refreshAccessToken();
    return uploadOnce(file, onProgress, options);
  }
}
