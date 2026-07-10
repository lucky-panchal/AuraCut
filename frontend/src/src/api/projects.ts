import client from './client';
import type { Project, TimelineState } from '../types';

export interface CreateProjectPayload {
  name: string;
}

export interface UpdateProjectPayload {
  name?: string;
}

export const listProjects = () =>
  client.get<Project[]>('/api/projects/');

export const createProject = (payload: CreateProjectPayload) =>
  client.post<Project>('/api/projects/', payload);

export const getProject = (id: string) =>
  client.get<Project>(`/api/projects/${id}/`);

export const updateProject = (id: string, payload: UpdateProjectPayload) =>
  client.patch<Project>(`/api/projects/${id}/`, payload);

export const deleteProject = (id: string) =>
  client.delete(`/api/projects/${id}/`);

export const getTimelineState = (id: string) =>
  client.get<TimelineState>(`/api/projects/${id}/timeline/`);

export const saveTimelineState = (id: string, state: TimelineState) =>
  client.patch<TimelineState>(`/api/projects/${id}/timeline/`, state);
