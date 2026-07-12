import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useProjectStore from '../../store/useProjectStore';
import useTimelineStore from '../../store/useTimelineStore';
import useAutoSave from '../../hooks/useAutoSave';
import { getProject, getTimelineState, saveTimelineState } from '../../api/projects';
import MediaPanel from './MediaPanel/MediaPanel';
import PreviewPanel from './PreviewPanel/PreviewPanel';
import EffectsPanel from './EffectsPanel/EffectsPanel';
import Timeline from './Timeline/Timeline';
import ExportModal from './ExportModal/ExportModal';

// Import CSS resources
import './editor.css';
import './MediaPanel/media-panel.css';
import './PreviewPanel/preview-panel.css';
import './Timeline/timeline.css';

const SAVE_STATUS_LABEL: Record<string, string> = {
  saved: '✓ Saved',
  unsaved: '● Unsaved',
  saving: '↑ Saving…',
  error: '⚠ Save failed',
};

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const saveStatus = useProjectStore((s) => s.saveStatus);

  const loadTimeline = useTimelineStore((s) => s.loadTimeline);
  const undo = useTimelineStore((s) => s.undo);
  const redo = useTimelineStore((s) => s.redo);
  const splitClip = useTimelineStore((s) => s.splitClip);
  const deleteClip = useTimelineStore((s) => s.deleteClip);
  const playhead_position = useTimelineStore((s) => s.playhead_position);
  const isDirty = useTimelineStore((s) => s.isDirty);
  const markClean = useTimelineStore((s) => s.markClean);

  const pastLength = useTimelineStore((s) => s.past.length);
  const futureLength = useTimelineStore((s) => s.future.length);

  // Auto-save hook
  useAutoSave(projectId!);

  // Load project + timeline on mount
  useEffect(() => {
    if (!projectId) return;
    Promise.all([getProject(projectId), getTimelineState(projectId)])
      .then(([projectRes, timelineRes]) => {
        setCurrentProject(projectRes.data);
        if (timelineRes.data) loadTimeline(timelineRes.data);
      })
      .catch(() => toast.error('Failed to load project'))
      .finally(() => setLoading(false));
  }, [projectId, setCurrentProject, loadTimeline]);

  // Manual save — Ctrl+S
  const handleManualSave = useCallback(async () => {
    if (!projectId || !isDirty) return;
    const snap = useTimelineStore.getState();
    try {
      await saveTimelineState(projectId, {
        tracks: snap.tracks,
        playhead_position: snap.playhead_position,
        zoom: snap.zoom,
        duration: snap.duration,
      });
      markClean();
      useProjectStore.getState().setSaveStatus('saved');
      toast.success('Saved');
    } catch {
      toast.error('Save failed');
    }
  }, [projectId, isDirty, markClean]);

  // Global keyboard shortcuts — 19.2
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT' ||
          (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleManualSave(); }
      if (e.key === 'Delete' && selectedClipId) { deleteClip(selectedClipId); setSelectedClipId(null); }
      if (e.key === 's' && !e.ctrlKey && selectedClipId) { splitClip(selectedClipId, playhead_position); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, handleManualSave, deleteClip, splitClip, selectedClipId, playhead_position]);

  const projectName = useProjectStore((s) => s.currentProject?.name ?? 'Untitled');

  if (loading) {
    return (
      <div className="editor-loading">
        <span>Loading project…</span>
      </div>
    );
  }

  return (
    <div className="editor">
      {/* Top bar */}
      <header className="editor__topbar">
        <button className="editor__back-btn" onClick={() => navigate('/')}>
          <span>←</span> Dashboard
        </button>
        <div className="editor__divider" />
        <span className="editor__project-name">{projectName}</span>
        <span className={`editor__save-status editor__save-status--${saveStatus}`}>
          {SAVE_STATUS_LABEL[saveStatus]}
        </span>
        <div className="editor__topbar-spacer" />
        <div className="editor__topbar-actions">
          <button
            className="editor__icon-btn"
            onClick={undo}
            title="Undo (Ctrl+Z)"
            disabled={pastLength === 0}
          >
            ⤺
          </button>
          <button
            className="editor__icon-btn"
            onClick={redo}
            title="Redo (Ctrl+Y)"
            disabled={futureLength === 0}
          >
            ⤻
          </button>
          <button className="editor__export-btn" onClick={() => setExportOpen(true)}>
            📤 Export
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="editor__main">
        {/* Left Panel: Media */}
        <div className="editor__panel">
          <div className="editor__panel-header">
            <span className="editor__panel-title">Media Assets</span>
          </div>
          <div className="editor__panel-body">
            <MediaPanel projectId={projectId!} />
          </div>
        </div>

        {/* Center Panel: Preview */}
        <div className="editor__panel">
          <div className="editor__panel-header">
            <span className="editor__panel-title">Video Preview</span>
          </div>
          <div className="editor__panel-body">
            <PreviewPanel projectId={projectId!} />
          </div>
        </div>

        {/* Right Panel: Effects */}
        <div className="editor__panel">
          <div className="editor__panel-header">
            <span className="editor__panel-title">Properties & Effects</span>
          </div>
          <div className="editor__panel-body">
            <EffectsPanel selectedClipId={selectedClipId} />
          </div>
        </div>
      </div>

      {/* Timeline row */}
      <section className="editor__timeline">
        <Timeline selectedClipId={selectedClipId} onSelectClip={setSelectedClipId} />
      </section>

      <ExportModal
        projectId={projectId!}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}
