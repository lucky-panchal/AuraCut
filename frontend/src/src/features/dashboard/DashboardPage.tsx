import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useProjectStore from '../../store/useProjectStore';
import useAuthStore from '../../store/useAuthStore';
import ProjectCard from './ProjectCard';
import './dashboard.css';

export default function DashboardPage() {
  const navigate = useNavigate();

  const projects      = useProjectStore((s) => s.projects);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const createProject = useProjectStore((s) => s.createProject);

  const user   = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [loading,  setLoading]  = useState(true);
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

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const sorted = [...projects].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  const initials = user?.display_name
    ? user.display_name.slice(0, 2).toUpperCase()
    : (user?.username?.slice(0, 2).toUpperCase() ?? '?');

  return (
    <div className="dashboard">

      {/* ── Top nav ── */}
      <nav className="dashboard__nav">
        <div className="dashboard__nav-logo">
          <div className="dashboard__nav-logo-icon">✂</div>
          <span>Auracut</span>
        </div>

        <div className="dashboard__nav-actions">
          <button
            className="btn btn--primary"
            onClick={handleNewProject}
            disabled={creating}
            id="new-project-btn"
          >
            {creating ? '…' : '＋ New Project'}
          </button>

          <button
            className="dashboard__nav-user"
            onClick={() => navigate('/profile')}
            title="View profile"
          >
            <div className="dashboard__nav-avatar">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="avatar" />
                : initials}
            </div>
            <span>{user?.display_name || user?.username || 'Account'}</span>
          </button>

          <button
            className="btn btn--ghost"
            onClick={handleLogout}
            title="Sign out"
            style={{ fontSize: 18, padding: '6px 10px' }}
          >
            ↩
          </button>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className="dashboard__body">
        <div className="dashboard__header">
          <div>
            <h1 className="dashboard__title">My Projects</h1>
            <p className="dashboard__count">
              {loading
                ? 'Loading…'
                : `${sorted.length} project${sorted.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="dashboard__loading">
            <span className="spinner" />
            Loading projects…
          </div>
        ) : sorted.length === 0 ? (
          <div className="dashboard__empty">
            <div className="dashboard__empty-icon">🎬</div>
            <p className="dashboard__empty-text">No projects yet. Create one to get started.</p>
            <button
              className="btn btn--primary"
              onClick={handleNewProject}
              disabled={creating}
              style={{ marginTop: 8 }}
            >
              ＋ Create your first project
            </button>
          </div>
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
    </div>
  );
}
