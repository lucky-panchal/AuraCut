import { useState } from 'react';
import useTimelineStore from '../../../store/useTimelineStore';
import type { Transition } from '../../../types';
import TextOverlayForm from './TextOverlayForm';
import ColorFilterSliders from './ColorFilterSliders';
import SubtitleEditor from './SubtitleEditor';

type Tab = 'text' | 'color' | 'subtitles' | 'transition';

interface Props {
  selectedClipId: string | null;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'color', label: 'Color' },
  { id: 'subtitles', label: 'Subtitles' },
  { id: 'transition', label: 'Transition' },
];

export default function EffectsPanel({ selectedClipId }: Props) {
  const addTransition = useTimelineStore((s) => s.addTransition);
  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [transitionType, setTransitionType] = useState<Transition['type']>('cut');
  const [transitionDuration, setTransitionDuration] = useState(0.5);

  function applyTransition(side: 'in' | 'out') {
    if (!selectedClipId) return;
    addTransition(selectedClipId, side, { type: transitionType, duration: transitionDuration });
  }

  if (!selectedClipId) {
    return (
      <div className="effects-panel effects-panel--empty">
        <p>Select a clip to edit effects</p>
      </div>
    );
  }

  return (
    <div className="effects-panel">
      <div className="effects-panel__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={['effects-panel__tab', activeTab === tab.id ? 'effects-panel__tab--active' : ''].filter(Boolean).join(' ')}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="effects-panel__body">
        {activeTab === 'text' && <TextOverlayForm clipId={selectedClipId} />}
        {activeTab === 'color' && <ColorFilterSliders clipId={selectedClipId} />}
        {activeTab === 'subtitles' && <SubtitleEditor clipId={selectedClipId} />}
        {activeTab === 'transition' && (
          <div className="effects-form">
            <label>
              Type
              <select
                value={transitionType}
                onChange={(e) => setTransitionType(e.target.value as Transition['type'])}
              >
                <option value="cut">Cut</option>
                <option value="fade">Fade</option>
                <option value="dissolve">Dissolve</option>
              </select>
            </label>
            <label>
              Duration (s)
              <input
                type="number"
                min={0.1}
                max={5}
                step={0.1}
                value={transitionDuration}
                onChange={(e) => setTransitionDuration(Number(e.target.value))}
              />
            </label>
            <div className="effects-form__row">
              <button type="button" onClick={() => applyTransition('in')}>Apply to In</button>
              <button type="button" onClick={() => applyTransition('out')}>Apply to Out</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
