import React from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Polygon, Rect } from 'react-native-svg';

/**
 * Drawn club crest templates (chapter 3.5: selectable from templates).
 * A crest is stored as a string id like "crest-3". Unknown/legacy values
 * (e.g. old emoji crests) fall back to template 0.
 */

export interface CrestTemplate {
  id: string;
  primary: string;
  secondary: string;
  pattern: 'plain' | 'stripes' | 'half' | 'chevron' | 'ball';
}

export const CREST_TEMPLATES: CrestTemplate[] = [
  { id: 'crest-0', primary: '#2E7D32', secondary: '#FFFFFF', pattern: 'ball' },
  { id: 'crest-1', primary: '#C62828', secondary: '#FFFFFF', pattern: 'stripes' },
  { id: 'crest-2', primary: '#1565C0', secondary: '#FFD54F', pattern: 'chevron' },
  { id: 'crest-3', primary: '#F9A825', secondary: '#1A1A1A', pattern: 'half' },
  { id: 'crest-4', primary: '#6A1B9A', secondary: '#FFFFFF', pattern: 'plain' },
  { id: 'crest-5', primary: '#00695C', secondary: '#FFAB40', pattern: 'stripes' },
  { id: 'crest-6', primary: '#37474F', secondary: '#80DEEA', pattern: 'chevron' },
  { id: 'crest-7', primary: '#AD1457', secondary: '#FFFFFF', pattern: 'half' },
  { id: 'crest-8', primary: '#4E342E', secondary: '#FFCC80', pattern: 'ball' },
  { id: 'crest-9', primary: '#0D47A1', secondary: '#FFFFFF', pattern: 'plain' },
];

export function crestTemplate(id: string | undefined | null): CrestTemplate {
  return CREST_TEMPLATES.find((t) => t.id === id) ?? CREST_TEMPLATES[0];
}

const SHIELD_PATH = 'M 32 4 L 56 12 V 32 Q 56 50 32 60 Q 8 50 8 32 V 12 Z';

export function Crest({ crestId, size = 48 }: { crestId: string | undefined | null; size?: number }) {
  const t = crestTemplate(crestId);
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <ClipPath id="shield">
          <Path d={SHIELD_PATH} />
        </ClipPath>
      </Defs>
      <Path d={SHIELD_PATH} fill={t.primary} />
      <G clipPath="url(#shield)">
        {t.pattern === 'stripes' && (
          <>
            <Rect x={20} y={4} width={8} height={56} fill={t.secondary} opacity={0.9} />
            <Rect x={36} y={4} width={8} height={56} fill={t.secondary} opacity={0.9} />
          </>
        )}
        {t.pattern === 'half' && (
          <Rect x={32} y={0} width={32} height={64} fill={t.secondary} opacity={0.9} />
        )}
        {t.pattern === 'chevron' && (
          <Polygon points="8,22 32,34 56,22 56,32 32,44 8,32" fill={t.secondary} opacity={0.95} />
        )}
        {t.pattern === 'ball' && (
          <>
            <Circle cx={32} cy={30} r={11} fill={t.secondary} />
            <Polygon points="32,25 36.7,28.4 34.9,33.9 29.1,33.9 27.3,28.4" fill={t.primary} />
          </>
        )}
      </G>
      <Path d={SHIELD_PATH} fill="none" stroke="#1A2E1A" strokeWidth={2.5} />
    </Svg>
  );
}
