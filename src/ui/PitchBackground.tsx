import React from 'react';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

/**
 * Drawn football pitch (vertical, goal at top and bottom).
 * Used as the start screen background and for the squad formation view.
 */

interface Props {
  width: number;
  height: number;
  /** darker night-green variant for the start screen */
  variant?: 'day' | 'deep';
}

export function PitchBackground({ width, height, variant = 'day' }: Props) {
  const grass = variant === 'deep' ? '#1B5E20' : '#2E7D32';
  const stripe = variant === 'deep' ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.07)';
  const line = variant === 'deep' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.85)';
  const w = 100;
  const h = 150;
  const stripeCount = 8;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice">
      <Rect x={0} y={0} width={w} height={h} fill={grass} />
      {Array.from({ length: stripeCount }, (_, i) =>
        i % 2 === 0 ? (
          <Rect key={i} x={0} y={(h / stripeCount) * i} width={w} height={h / stripeCount} fill={stripe} />
        ) : null,
      )}
      {/* outline */}
      <Rect x={4} y={6} width={w - 8} height={h - 12} fill="none" stroke={line} strokeWidth={1} />
      {/* halfway line + center circle */}
      <Line x1={4} y1={h / 2} x2={w - 4} y2={h / 2} stroke={line} strokeWidth={1} />
      <Circle cx={w / 2} cy={h / 2} r={12} fill="none" stroke={line} strokeWidth={1} />
      <Circle cx={w / 2} cy={h / 2} r={1.4} fill={line} />
      {/* penalty boxes */}
      <Rect x={26} y={6} width={48} height={20} fill="none" stroke={line} strokeWidth={1} />
      <Rect x={38} y={6} width={24} height={8} fill="none" stroke={line} strokeWidth={1} />
      <Rect x={26} y={h - 26} width={48} height={20} fill="none" stroke={line} strokeWidth={1} />
      <Rect x={38} y={h - 14} width={24} height={8} fill="none" stroke={line} strokeWidth={1} />
      {/* penalty spots */}
      <Circle cx={w / 2} cy={20} r={1.2} fill={line} />
      <Circle cx={w / 2} cy={h - 20} r={1.2} fill={line} />
    </Svg>
  );
}
