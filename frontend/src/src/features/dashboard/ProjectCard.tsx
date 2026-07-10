import { useState, type KeyboardEvent } from 'react';
import type { Project } from '../../types';
import useProjectStore from '../../store/useProjectStore';
import toast from 'react-hot-toast';

interface Props {
  project: Project;
  onOpen: (id: string) => void;
}

export default function ProjectCard({ project, onOpen }: Props) {
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function commitRename() {
    const trimmed = name.trim();
    if (!trimmed) { setName(project.name); setEditing(false); return; }
    if (trimmed === project.name) { setEditing(false); return; }
    try {
      await updateProject(project.id, trimmed);
      toast.success('Renamed');
    } catch {
      toast.error('Rename failed');
      setName(project.name);
    }
    setEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') { setName(project.name); setEditing(false); }
  }

  async function handleDelete() {
    try {
      await deleteProject(project.id);
      toast.success('Project deleted');
    } catch {
      toast.error('Delete failed');
    }
    setConfirmDelete(false);
  }

  const lastModified = new Date(project.updated_at).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div className="project-card" onClick={() => !editing && onOpen(project.id)}>
      <div className="project-card__thumb">
        {project.thumbnail_url
          ? <img src={project.thumbnail_url} alt={project.name} />
          : <span className="project-card__thumb-placeholder">🎬</span>}
      </div>

      <div className="project-card__info" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <input
            className="project-card__rename-input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span
            className="project-card__name"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to rename"
          >
            {project.name}
          </span>
        )}
        <span className="project-card__date">{lastModified}</span>
      </div>

      <div className="project-card__actions" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setEditing(true)} title="Rename">✏️</button>
        <button onClick={() => setConfirmDelete(true)} title="Delete">🗑️</button>
      </div>

      {confirmDelete && (
        <div className="project-card__confirm" onClick={(e) => e.stopPropagation()}>
          <p>Delete "{project.name}"?</p>
          <button onClick={handleDelete}>Yes, delete</button>
          <button onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
