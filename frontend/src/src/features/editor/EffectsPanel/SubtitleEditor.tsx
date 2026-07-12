import { useState, type ChangeEvent } from 'react';
import useTimelineStore from '../../../store/useTimelineStore';

interface SubtitleEntry {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface Props {
  clipId: string;
}

function parseSrt(raw: string): SubtitleEntry[] {
  const blocks = raw.trim().split(/\n\s*\n/);
  return blocks.flatMap((block) => {
    const lines = block.trim().split('\n');
    if (lines.length < 3) return [];
    const timeLine = lines[1];
    const match = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/,
    );
    if (!match) return [];
    const toSec = (h: string, m: string, s: string, ms: string) =>
      Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
    return [{
      id: crypto.randomUUID(),
      start: toSec(match[1], match[2], match[3], match[4]),
      end: toSec(match[5], match[6], match[7], match[8]),
      text: lines.slice(2).join(' '),
    }];
  });
}

function parseVtt(raw: string): SubtitleEntry[] {
  return parseSrt(raw.replace('WEBVTT', '').replace(/(\d{2}:\d{2}\.\d{3})/g, '00:$1'));
}

export default function SubtitleEditor({ clipId }: Props) {
  const addEffect = useTimelineStore((s) => s.addEffect);
  const [entries, setEntries] = useState<SubtitleEntry[]>([]);

  function applyEntries(list: SubtitleEntry[]) {
    setEntries(list);
    list.forEach((entry) => {
      addEffect(clipId, { type: 'subtitle', params: entry as unknown as Record<string, unknown> });
    });
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = file.name.endsWith('.vtt') ? parseVtt(text) : parseSrt(text);
      applyEntries(parsed);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function addRow() {
    setEntries((prev) => [...prev, { id: crypto.randomUUID(), start: 0, end: 1, text: '' }]);
  }

  function updateRow(id: string, key: keyof SubtitleEntry, value: string | number) {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, [key]: value } : e));
  }

  function removeRow(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function handleApply() {
    applyEntries(entries);
  }

  return (
    <div className="effects-form">
      <div className="subtitle-editor__toolbar">
        <label className="btn btn--secondary">
          Import SRT / VTT
          <input type="file" accept=".srt,.vtt" style={{ display: 'none' }} onChange={handleFile} />
        </label>
        <button type="button" onClick={addRow}>+ Add row</button>
        <button type="button" onClick={handleApply}>Apply</button>
      </div>

      {entries.length > 0 && (
        <table className="subtitle-editor__table">
          <thead>
            <tr><th>Start (s)</th><th>End (s)</th><th>Text</th><th></th></tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    value={entry.start}
                    onChange={(e) => updateRow(entry.id, 'start', Number(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    value={entry.end}
                    onChange={(e) => updateRow(entry.id, 'end', Number(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    value={entry.text}
                    onChange={(e) => updateRow(entry.id, 'text', e.target.value)}
                  />
                </td>
                <td>
                  <button type="button" onClick={() => removeRow(entry.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
