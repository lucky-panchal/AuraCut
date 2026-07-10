import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useProjectStore from '../../store/useProjectStore';
import ProjectCard from './ProjectCard';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { projects, fetchProjects, createProject } = useProjectStore((s) => ({
    projects: s.projects,
    fetchProjects: s.fetchProjects,
    createProject: s.createProject,
  }));

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects().finally(() => setLoading(false));
  }, [fetchProjects]);

  async function handleNewProject() {
    setCreating(true);
    try {
      const project = await createProject('Untitled Project');
      navigate(`/editor/${project.id}`);
    } catch {
      toast.error('Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  const sorted = [...projects].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1>My Projects</h1>
        <button onClick={handleNewProject} disabled={creating}>
          {creating ? 'Creating…' : '+ New Project'}
        </button>
      </header>

      {loading ? (
        <p className="dashboard__loading">Loading projects…</p>
      ) : sorted.length === 0 ? (
        <p className="dashboard__empty">No projects yet. Create one to get started.</p>
      ) : (
        <div className="dashboard__grid">
          {sorted.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={(id) => navigate(`/editor/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
