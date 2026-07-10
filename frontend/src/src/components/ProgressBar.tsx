interface Props {
  value: number; // 0-100
  label?: string;
}

export default function ProgressBar({ value, label }: Props) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="progress-bar" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-bar__fill" style={{ width: `${clamped}%` }} />
      {label && <span className="progress-bar__label">{label}</span>}
    </div>
  );
}
