import { useId } from 'react';

/**
 * The ALRAM Bet mark: a coin (the betting side) with a table-tennis paddle
 * and ball inside it (the tournament side) - one glyph for both halves of
 * what the app actually does. Used in the header and mirrors public/favicon.svg.
 */
export function Logo({ size = 32 }: { size?: number }) {
  const gradId = useId();

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="10%" y1="5%" x2="90%" y2="95%">
          <stop offset="0" stopColor="#3fe3ab" />
          <stop offset="1" stopColor="#0a5f44" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${gradId})`} stroke="#e7b74a" strokeWidth="3" />
      <g transform="translate(22 35) rotate(-24)">
        <rect x="-3.6" y="2" width="7.2" height="19" rx="3.6" fill="#f7f1e1" />
        <circle cx="0" cy="-10" r="15" fill="#f7f1e1" />
      </g>
      <circle cx="46" cy="16" r="7.5" fill="#e7b74a" />
    </svg>
  );
}
