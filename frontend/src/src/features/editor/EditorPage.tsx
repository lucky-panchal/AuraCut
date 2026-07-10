import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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

const SAVE_STATUS_LABEL: Record<string, string> = {
  saved: '✓ Saved',
  unsaved: '● Unsaved',
  saving: '↑ Saving…',
  error: '⚠ Save failed',
};

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { setCurrentProject, saveStatus } = useProjectStore((s) => ({
    setCurrentProject: s.setCurrentProject,
    saveStatus: s.saveStatus,
  }));

  const { loadTimeline, undo, redo, splitClip, deleteClip, playhead_position, isDirty, markClean } =
    useTimelineStore((s) => ({
      loadTimeline: s.loadTimeline,
      undo: s.undo,
      redo: s.redo,
      splitClip: s.splitClip,
      deleteClip: s.deleteClip,
      playhead_position: s.playhead_position,
      isDirty: s.isDirty,
      markClean: s.markClean,
    }));

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
        <span className="editor__project-name">{projectName}</span>
        <span className={`editor__save-status editor__save-status--${saveStatus}`}>
          {SAVE_STATUS_LABEL[saveStatus]}
        </span>
        <div className="editor__topbar-actions">
          <button onClick={undo} title="Undo (Ctrl+Z)">↩</button>
          <button onClick={redo} title="Redo (Ctrl+Y)">↪</button>
          <button className="btn btn--primary" onClick={() => setExportOpen(true)}>Export</button>
        </div>
      </header>

      {/* Main grid */}
      <div className="editor__grid">
        <aside className="editor__media">
          <MediaPanel projectId={projectId!} />
        </aside>

        <main className="editor__preview">
          <PreviewPanel projectId={projectId!} />
        </main>

        <aside className="editor__effects">
          <EffectsPanel selectedClipId={selectedClipId} />
        </aside>

        <section className="editor__timeline">
          <Timeline />
        </section>
      </div>

      <ExportModal
        projectId={projectId!}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}
