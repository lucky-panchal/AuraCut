import { useState, type FormEvent } from 'react';
import useTimelineStore from '../../../store/useTimelineStore';

interface Props {
  clipId: string;
}

export default function TextOverlayForm({ clipId }: Props) {
  const addEffect = useTimelineStore((s) => s.addEffect);

  const [content, setContent] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const [fill, setFill] = useState('#ffffff');
  const [left, setLeft] = useState(50);
  const [top, setTop] = useState(50);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    addEffect(clipId, {
      type: 'text',
      params: { content, fontSize, fill, left, top },
    });
    setContent('');
  }

  return (
    <form className="effects-form" onSubmit={handleSubmit}>
      <label>
        Text
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Enter text…" />
      </label>
      <label>
        Font size
        <input type="number" min={8} max={200} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
      </label>
      <label>
        Color
        <input type="color" value={fill} onChange={(e) => setFill(e.target.value)} />
      </label>
      <label>
        X position
        <input type="number" value={left} onChange={(e) => setLeft(Number(e.target.value))} />
      </label>
      <label>
        Y position
        <input type="number" value={top} onChange={(e) => setTop(Number(e.target.value))} />
      </label>
      <button type="submit">Add text overlay</button>
    </form>
  );
}
