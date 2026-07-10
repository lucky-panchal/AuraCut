import { useEffect, useRef } from 'react';
import { Canvas, FabricImage, FabricText } from 'fabric';
import usePreviewStore from '../../../store/usePreviewStore';
import useTimelineStore from '../../../store/useTimelineStore';

const CANVAS_W = 1280;
const CANVAS_H = 720;
const FPS = 30;

export default function PreviewCanvas() {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const isPlaying = usePreviewStore((s) => s.isPlaying);
  const currentFrame = usePreviewStore((s) => s.currentFrame);
  const lastServerFrame = usePreviewStore((s) => s.lastServerFrame);
  const setCurrentFrame = usePreviewStore((s) => s.setCurrentFrame);

  const duration = useTimelineStore((s) => s.duration);
  const tracks = useTimelineStore((s) => s.tracks);

  // Init Fabric canvas
  useEffect(() => {
    if (!canvasElRef.current) return;
    const fc = new Canvas(canvasElRef.current, {
      width: CANVAS_W,
      height: CANVAS_H,
      selection: false,
      backgroundColor: '#000',
    });
    fabricRef.current = fc;
    return () => { fc.dispose(); fabricRef.current = null; };
  }, []);

  // Draw server frame when available
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc || !lastServerFrame) return;
    FabricImage.fromURL(`data:image/jpeg;base64,${lastServerFrame}`).then((img) => {
      img.scaleToWidth(CANVAS_W);
      fc.backgroundImage = img;
      fc.renderAll();
    });
  }, [lastServerFrame]);

  // Draw client-side text overlays for current frame
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.remove(...fc.getObjects());

    const activeClips = tracks
      .flatMap((t) => t.clips)
      .filter((c) => c.timeline_start <= currentFrame && c.timeline_end > currentFrame);

    for (const clip of activeClips) {
      for (const effect of clip.effects) {
        if (effect.type === 'text') {
          const p = effect.params as { content?: string; fontSize?: number; fill?: string; left?: number; top?: number };
          const txt = new FabricText(p.content ?? '', {
            left: p.left ?? 50,
            top: p.top ?? 50,
            fontSize: p.fontSize ?? 32,
            fill: p.fill ?? '#ffffff',
            selectable: false,
          });
          fc.add(txt);
        }
        if (effect.type === 'watermark') {
          const p = effect.params as { url?: string };
          if (p.url) {
            FabricImage.fromURL(p.url).then((img) => {
              img.set({ left: CANVAS_W - 120, top: CANVAS_H - 60, opacity: 0.5, selectable: false });
              img.scaleToWidth(100);
              fc.add(img);
              fc.renderAll();
            });
          }
        }
      }
    }
    fc.renderAll();
  }, [currentFrame, tracks]);

  // rAF playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = (now: number) => {
      const elapsed = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      const next = currentFrame + elapsed;
      if (next >= duration) {
        usePreviewStore.getState().stop();
        return;
      }
      setCurrentFrame(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    lastTickRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Sync playhead with currentFrame
  useEffect(() => {
    useTimelineStore.getState().setPlayhead(currentFrame);
  }, [currentFrame]);

  return (
    <canvas
      ref={canvasElRef}
      style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
    />
  );
}

export { FPS };
