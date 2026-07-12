import { useState } from 'react';
import useTimelineStore from '../../../store/useTimelineStore';

interface Props {
  clipId: string;
}

interface ColorFilter {
  brightness: number;
  contrast: number;
  saturation: number;
}

const DEFAULTS: ColorFilter = { brightness: 0, contrast: 0, saturation: 0 };

export default function ColorFilterSliders({ clipId }: Props) {
  const addEffect = useTimelineStore((s) => s.addEffect);
  const [filter, setFilter] = useState<ColorFilter>(DEFAULTS);

  function update(key: keyof ColorFilter, value: number) {
    const next = { ...filter, [key]: value };
    setFilter(next);
    addEffect(clipId, { type: 'color_filter', params: next as unknown as Record<string, unknown> });
  }

  return (
    <div className="effects-form">
      {(['brightness', 'contrast', 'saturation'] as const).map((key) => (
        <label key={key}>
          {key.charAt(0).toUpperCase() + key.slice(1)} ({filter[key] > 0 ? '+' : ''}{filter[key]})
          <input
            type="range"
            min={-100}
            max={100}
            value={filter[key]}
            onChange={(e) => update(key, Number(e.target.value))}
          />
        </label>
      ))}
      <button
        type="button"
        onClick={() => { setFilter(DEFAULTS); addEffect(clipId, { type: 'color_filter', params: DEFAULTS as unknown as Record<string, unknown> }); }}
      >
        Reset
      </button>
    </div>
  );
}
