import { create } from 'zustand';
import type { Project } from '../types';
import * as projectsApi from '../api/projects';

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  saveStatus: SaveStatus;
  fetchProjects: () => Promise<void>;
  createProject: (name: string) => Promise<Project>;
  updateProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  setSaveStatus: (status: SaveStatus) => void;
}

const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  saveStatus: 'saved',

  fetchProjects: async () => {
    const { data } = await projectsApi.listProjects();
    set({ projects: data });
  },

  createProject: async (name) => {
    const { data } = await projectsApi.createProject({ name });
    set((s) => ({ projects: [data, ...s.projects] }));
    return data;
  },

  updateProject: async (id, name) => {
    const { data } = await projectsApi.updateProject(id, { name });
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? data : p)),
      currentProject: s.currentProject?.id === id ? data : s.currentProject,
    }));
  },

  deleteProject: async (id) => {
    await projectsApi.deleteProject(id);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      currentProject: s.currentProject?.id === id ? null : s.currentProject,
    }));
  },

  setCurrentProject: (project) => set({ currentProject: project }),

  setSaveStatus: (status) => set({ saveStatus: status }),
}));

export default useProjectStore;
