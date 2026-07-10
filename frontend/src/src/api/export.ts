import client from './client';
import type { ExportJob } from '../types';

export interface CreateExportPayload {
  resolution: '480p' | '720p' | '1080p';
  format: 'mp4' | 'webm';
  bitrate: 'low' | 'medium' | 'high';
  fps: 24 | 30 | 60;
  subtitle_burn_in: boolean;
}

export const createExportJob = (projectId: string, payload: CreateExportPayload) =>
  client.post<{ job_id: string }>(`/api/projects/${projectId}/export/`, payload);

export const getExportJob = (jobId: string) =>
  client.get<ExportJob>(`/api/export/${jobId}/`);
