import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

/**
 * Small vector icon set - replaces all emoji usage in the UI.
 * Icons are stroke-based, 24x24 viewBox, color/size via props.
 */

export interface IconProps {
  color?: string;
  size?: number;
}

const S = { fill: 'none' as const, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function IconBall({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} stroke={color} {...S} />
      <Polygon points="12,8.2 15.6,10.8 14.2,15 9.8,15 8.4,10.8" stroke={color} fill={color} strokeWidth={1} />
      <Line x1={12} y1={3} x2={12} y2={8.2} stroke={color} {...S} strokeWidth={1.4} />
      <Line x1={20.5} y1={9.5} x2={15.6} y2={10.8} stroke={color} {...S} strokeWidth={1.4} />
      <Line x1={17.5} y1={19} x2={14.2} y2={15} stroke={color} {...S} strokeWidth={1.4} />
      <Line x1={6.5} y1={19} x2={9.8} y2={15} stroke={color} {...S} strokeWidth={1.4} />
      <Line x1={3.5} y1={9.5} x2={8.4} y2={10.8} stroke={color} {...S} strokeWidth={1.4} />
    </Svg>
  );
}

export function IconMap({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M 12 21 C 12 21 5 14.5 5 9.5 A 7 7 0 1 1 19 9.5 C 19 14.5 12 21 12 21 Z" stroke={color} {...S} />
      <Circle cx={12} cy={9.5} r={2.6} stroke={color} {...S} />
    </Svg>
  );
}

export function IconSquad({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={9} cy={8} r={3.2} stroke={color} {...S} />
      <Path d="M 3.5 20 Q 3.5 14.5 9 14.5 Q 14.5 14.5 14.5 20" stroke={color} {...S} />
      <Circle cx={16.5} cy={9} r={2.6} stroke={color} {...S} />
      <Path d="M 15.5 14.8 Q 20.5 14.8 20.5 19.5" stroke={color} {...S} />
    </Svg>
  );
}

export function IconTrophy({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M 7 4 H 17 V 10 A 5 5 0 0 1 7 10 Z" stroke={color} {...S} />
      <Path d="M 7 5.5 H 4 Q 4 10.5 7 10.5" stroke={color} {...S} />
      <Path d="M 17 5.5 H 20 Q 20 10.5 17 10.5" stroke={color} {...S} />
      <Line x1={12} y1={15} x2={12} y2={18} stroke={color} {...S} />
      <Path d="M 8.5 20.5 H 15.5" stroke={color} {...S} />
      <Path d="M 10 18 H 14" stroke={color} {...S} />
    </Svg>
  );
}

export function IconPack({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4} y={8} width={16} height={12} rx={1.5} stroke={color} {...S} />
      <Line x1={4} y1={12} x2={20} y2={12} stroke={color} {...S} />
      <Line x1={12} y1={8} x2={12} y2={20} stroke={color} {...S} />
      <Path d="M 12 8 Q 8.5 8 8.5 5.8 Q 8.5 4 10.2 4 Q 12 4 12 8 Z" stroke={color} {...S} />
      <Path d="M 12 8 Q 15.5 8 15.5 5.8 Q 15.5 4 13.8 4 Q 12 4 12 8 Z" stroke={color} {...S} />
    </Svg>
  );
}

export function IconProfile({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8.5} r={3.6} stroke={color} {...S} />
      <Path d="M 4.5 20.5 Q 4.5 14 12 14 Q 19.5 14 19.5 20.5" stroke={color} {...S} />
    </Svg>
  );
}

export function IconCoin({ color = '#8A6D00', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} stroke={color} fill="#F5C518" strokeWidth={2} />
      <Circle cx={12} cy={12} r={5.2} stroke={color} strokeWidth={1.4} fill="none" />
      <Path d="M 12 8.8 V 15.2 M 10 10.4 H 14 M 10 13.6 H 14" stroke={color} {...S} strokeWidth={1.6} />
    </Svg>
  );
}

export function IconLocate({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={5.5} stroke={color} {...S} />
      <Circle cx={12} cy={12} r={1.6} fill={color} />
      <Line x1={12} y1={2.5} x2={12} y2={6.5} stroke={color} {...S} />
      <Line x1={12} y1={17.5} x2={12} y2={21.5} stroke={color} {...S} />
      <Line x1={2.5} y1={12} x2={6.5} y2={12} stroke={color} {...S} />
      <Line x1={17.5} y1={12} x2={21.5} y2={12} stroke={color} {...S} />
    </Svg>
  );
}

export function IconRefresh({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M 19.5 12 A 7.5 7.5 0 1 1 17 6.4" stroke={color} {...S} />
      <Polyline points="17.5,2.5 17.5,6.8 13.2,6.8" stroke={color} {...S} />
    </Svg>
  );
}

export function IconFlash({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon points="13,2.5 5.5,13.5 11,13.5 9.8,21.5 18.5,10 13,10" stroke={color} {...S} />
    </Svg>
  );
}

export function IconFlag({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={6} y1={3} x2={6} y2={21} stroke={color} {...S} />
      <Path d="M 6 4 H 18 L 14.5 8 L 18 12 H 6" stroke={color} {...S} />
    </Svg>
  );
}

export function IconCard({ color = '#B58900', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={7} y={4} width={10} height={16} rx={1.5} stroke={color} fill={color} fillOpacity={0.25} strokeWidth={2} />
    </Svg>
  );
}

export function IconWhistle({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M 3 10 H 13 L 13 8.5 Q 13 7 14.5 7 H 16 Q 17.5 7 17.5 8.5 V 10.2 A 5.4 5.4 0 1 1 8 15.2 Z" stroke={color} {...S} />
      <Circle cx={13.2} cy={14.6} r={1.4} fill={color} />
      <Line x1={19.5} y1={4.5} x2={17.8} y2={6.2} stroke={color} {...S} strokeWidth={1.6} />
      <Line x1={21.5} y1={8.5} x2={19.3} y2={9} stroke={color} {...S} strokeWidth={1.6} />
    </Svg>
  );
}

export function IconPause({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={9} y1={5} x2={9} y2={19} stroke={color} {...S} strokeWidth={3} />
      <Line x1={15} y1={5} x2={15} y2={19} stroke={color} {...S} strokeWidth={3} />
    </Svg>
  );
}

export function IconStar({ color = '#E8B923', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon
        points="12,2.8 14.8,8.6 21.2,9.5 16.6,14 17.7,20.4 12,17.4 6.3,20.4 7.4,14 2.8,9.5 9.2,8.6"
        stroke={color}
        fill={color}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconCheck({ color = '#2E7D32', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polyline points="4.5,12.5 9.5,17.5 19.5,6.5" stroke={color} {...S} strokeWidth={3} />
    </Svg>
  );
}

export function IconCross({ color = '#C62828', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} {...S} strokeWidth={3} />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} {...S} strokeWidth={3} />
    </Svg>
  );
}

export function IconMinus({ color = '#5C6E5C', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={6} y1={12} x2={18} y2={12} stroke={color} {...S} strokeWidth={3} />
    </Svg>
  );
}

export function IconClock({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} stroke={color} {...S} />
      <Polyline points="12,7 12,12 15.5,14" stroke={color} {...S} />
    </Svg>
  );
}

export function IconPin({ color = '#E65100', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={12} y1={13} x2={12} y2={21} stroke={color} {...S} />
      <Path
        d="M 12 3 L 17 5.5 L 12 8 L 7 5.5 Z M 12 8 V 13"
        stroke={color}
        fill={color}
        fillOpacity={0.3}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconSwap({ color = '#1A2E1A', size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polyline points="16,4 20,8 16,12" stroke={color} {...S} />
      <Line x1={20} y1={8} x2={5} y2={8} stroke={color} {...S} />
      <Polyline points="8,12 4,16 8,20" stroke={color} {...S} />
      <Line x1={4} y1={16} x2={19} y2={16} stroke={color} {...S} />
    </Svg>
  );
}
