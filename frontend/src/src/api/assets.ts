import client from './client';
import type { MediaAsset } from '../types';

export const listAssets = (projectId: string) =>
  client.get<MediaAsset[]>(`/api/projects/${projectId}/assets/`);

export const uploadAsset = (
  projectId: string,
  file: File,
  onUploadProgress?: (percent: number) => void,
) => {
  const form = new FormData();
  form.append('file', file);
  return client.post<MediaAsset>(`/api/projects/${projectId}/assets/`, form, {
    onUploadProgress: (e) => {
      if (onUploadProgress && e.total) {
        onUploadProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
};

export const getAsset = (assetId: string) =>
  client.get<MediaAsset>(`/api/assets/${assetId}/`);

export const deleteAsset = (assetId: string) =>
  client.delete(`/api/assets/${assetId}/`);
