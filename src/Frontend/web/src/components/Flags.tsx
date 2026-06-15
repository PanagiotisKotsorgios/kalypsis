interface FlagProps {
  /** Flag width in px (height follows the official aspect ratio) */
  size?: number;
}

const baseStyle: React.CSSProperties = {
  display: "block",
  borderRadius: 2,
  boxShadow: "0 0 0 0.5px rgba(0,0,0,0.15)",
  flexShrink: 0
};

/** Greek flag (3:2 ratio, 9 stripes, blue canton with white cross) */
export function GreekFlag({ size = 22 }: FlagProps) {
  const w = size;
  const h = (size * 2) / 3;
  return (
    <svg
      viewBox="0 0 27 18"
      width={w}
      height={h}
      style={baseStyle}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="27" height="18" fill="#0d5eaf" />
      <rect y="2" width="27" height="2" fill="#fff" />
      <rect y="6" width="27" height="2" fill="#fff" />
      <rect y="10" width="27" height="2" fill="#fff" />
      <rect y="14" width="27" height="2" fill="#fff" />
      <rect width="10" height="10" fill="#0d5eaf" />
      <rect x="4" width="2" height="10" fill="#fff" />
      <rect y="4" width="10" height="2" fill="#fff" />
    </svg>
  );
}

/** US flag (19:10 ratio, 13 stripes, plain blue canton — stars omitted at this size) */
export function AmericanFlag({ size = 22 }: FlagProps) {
  const w = size;
  const h = (size * 10) / 19;
  return (
    <svg
      viewBox="0 0 19 10"
      width={w}
      height={h}
      style={baseStyle}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="19" height="10" fill="#b22234" />
      <rect y="0.77" width="19" height="0.77" fill="#fff" />
      <rect y="2.31" width="19" height="0.77" fill="#fff" />
      <rect y="3.85" width="19" height="0.77" fill="#fff" />
      <rect y="5.38" width="19" height="0.77" fill="#fff" />
      <rect y="6.92" width="19" height="0.77" fill="#fff" />
      <rect y="8.46" width="19" height="0.77" fill="#fff" />
      <rect width="7.6" height="5.38" fill="#3c3b6e" />
    </svg>
  );
}
