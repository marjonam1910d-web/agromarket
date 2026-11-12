import { useId } from 'react';
import { motion } from 'framer-motion';
import { cx } from '@/utils/format';

export interface SealData {
  code: string;
  title: string;
  subtitle?: string | null;
  color: string;
}

/**
 * Shaxsiy elektron muhr — dumaloq shtamp: aylana bo'ylab nom, markazda muhr raqami.
 * `pressed` bo'lsa "bosilish" animatsiyasi bilan paydo bo'ladi.
 */
export function Seal({ seal, size = 132, pressed, className }: { seal: SealData; size?: number; pressed?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '');
  const title = `${seal.title.toUpperCase()} ★ AGROMARKET ★ `;
  const svg = (
    <svg viewBox="0 0 160 160" width={size} height={size} className={cx('select-none', className)} style={{ color: seal.color }} aria-label={`Muhr ${seal.code}`}>
      <defs>
        <path id={`c${id}`} d="M80,80 m-58,0 a58,58 0 1,1 116,0 a58,58 0 1,1 -116,0" />
        <filter id={`ink${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
        </filter>
      </defs>
      <g filter={`url(#ink${id})`} fill="none" stroke="currentColor" opacity="0.9">
        <circle cx="80" cy="80" r="76" strokeWidth="3.5" />
        <circle cx="80" cy="80" r="70" strokeWidth="1.2" />
        <circle cx="80" cy="80" r="44" strokeWidth="1.6" />
        <text fill="currentColor" stroke="none" fontSize="11.5" fontWeight="800" letterSpacing="1.4" fontFamily="Manrope, Arial, sans-serif">
          <textPath href={`#c${id}`} startOffset="0" textLength="356" lengthAdjust="spacingAndGlyphs">{title}</textPath>
        </text>
        <path d="M80 72c0-10 0-15 10-21-1 10-4 15-10 21z M80 72c0-9-1-13-10-18 1 9 4 13 10 18z" fill="currentColor" stroke="none" />
        <text x="80" y="90" textAnchor="middle" fill="currentColor" stroke="none" fontSize="10.5" fontWeight="900" letterSpacing="0.6" fontFamily="ui-monospace, monospace">{seal.code}</text>
        {seal.subtitle && (
          <text x="80" y="104" textAnchor="middle" fill="currentColor" stroke="none" fontSize="7.5" fontWeight="700" fontFamily="Manrope, Arial, sans-serif">{seal.subtitle.slice(0, 26)}</text>
        )}
      </g>
    </svg>
  );
  if (!pressed) return <span className="inline-block -rotate-[8deg]">{svg}</span>;
  return (
    <motion.span
      className="inline-block"
      initial={{ scale: 1.9, opacity: 0, rotate: -22 }}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      transition={{ type: 'spring', damping: 10, stiffness: 160 }}
    >
      {svg}
    </motion.span>
  );
}
