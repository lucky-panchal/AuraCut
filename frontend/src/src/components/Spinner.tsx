interface Props {
  size?: number;
}

export default function Spinner({ size = 24 }: Props) {
  return (
    <span
      className="spinner"
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
    />
  );
}
