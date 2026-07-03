import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { RARITY_COLOR } from '../core/domain/constants';
import type { PoolPlayer, Position } from '../core/domain/types';

/**
 * Drawn cartoon player avatar (chapter 3.6): every player gets an
 * individual, slightly exaggerated look derived deterministically from his
 * pool id - skin tone, hair style/color and kit vary; the ring color shows
 * rarity, the kit color the position group.
 */

const SKIN_TONES = ['#FFD3B6', '#F2B380', '#D99860', '#A9714B', '#8A5A3B', '#6B4226'];
const HAIR_COLORS = ['#2B1B12', '#5A3825', '#8C5A2B', '#C98A3D', '#E8C46A', '#1A1A1A', '#6E6E6E', '#B23A2E'];

const POSITION_KIT: Record<Position, string> = {
  TW: '#F9A825', // goalkeeper amber
  ABW: '#1565C0', // defence blue
  MF: '#2E7D32', // midfield green
  ST: '#C62828', // attack red
};

/** Small deterministic hash so the same player always looks the same. */
function hash(seed: number, salt: number): number {
  let h = (seed * 2654435761 + salt * 40503) >>> 0;
  h ^= h >> 13;
  h = (h * 0x5bd1e995) >>> 0;
  return h;
}

interface Props {
  player: Pick<PoolPlayer, 'id' | 'position' | 'rarity'>;
  size?: number;
}

export function PlayerAvatar({ player, size = 48 }: Props) {
  const skin = SKIN_TONES[hash(player.id, 1) % SKIN_TONES.length];
  const hairColor = HAIR_COLORS[hash(player.id, 2) % HAIR_COLORS.length];
  const hairStyle = hash(player.id, 3) % 4;
  const kit = POSITION_KIT[player.position];
  const ring = RARITY_COLOR[player.rarity];
  const legendary = player.rarity === 'legendaer';

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* rarity ring + soft background */}
      <Circle cx={32} cy={32} r={31} fill={ring} />
      <Circle cx={32} cy={32} r={27} fill="#F4FBF4" />

      {/* jersey */}
      <Path d="M 14 64 Q 14 44 32 44 Q 50 44 50 64 Z" fill={kit} />
      {legendary && (
        <>
          <Path d="M 20 64 Q 20 48 24 46 L 24 64 Z" fill="rgba(255,255,255,0.55)" />
          <Path d="M 40 46 Q 44 48 44 64 L 40 64 Z" fill="rgba(255,255,255,0.55)" />
        </>
      )}
      {/* collar */}
      <Path d="M 27 45 L 32 50 L 37 45" stroke="#FFFFFF" strokeWidth={2.4} fill="none" strokeLinecap="round" />

      {/* head */}
      <Circle cx={32} cy={28} r={13} fill={skin} />
      {/* ears */}
      <Circle cx={19.5} cy={28} r={2.6} fill={skin} />
      <Circle cx={44.5} cy={28} r={2.6} fill={skin} />

      {/* hair styles */}
      {hairStyle === 0 && (
        <Path d="M 19 27 Q 20 14 32 14 Q 44 14 45 27 Q 40 19 32 19 Q 24 19 19 27 Z" fill={hairColor} />
      )}
      {hairStyle === 1 && (
        <>
          <Path d="M 19 26 Q 21 13 32 13 Q 43 13 45 26 Q 38 17 32 17 Q 26 17 19 26 Z" fill={hairColor} />
          <Ellipse cx={32} cy={13.5} rx={7} ry={4.5} fill={hairColor} />
        </>
      )}
      {hairStyle === 2 && (
        <Path d="M 18.5 28 Q 18.5 12 32 12 Q 45.5 12 45.5 28 Q 45.5 20 40 18 Q 43 24 38 20 Q 40 26 33 19 Q 34 24 28 19 Q 28 24 24 20 Q 25 25 18.5 28 Z" fill={hairColor} />
      )}
      {/* style 3 = shaved head: only a shadow line */}
      {hairStyle === 3 && (
        <Path d="M 21 22 Q 26 16 43 21" stroke={hairColor} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.5} />
      )}

      {/* face */}
      <Circle cx={27.5} cy={28} r={1.8} fill="#22301F" />
      <Circle cx={36.5} cy={28} r={1.8} fill="#22301F" />
      <Path d="M 27 34.5 Q 32 38.5 37 34.5" stroke="#22301F" strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* cheeky eyebrows for the exaggerated comic look */}
      <Path d="M 24.5 24 Q 27.5 22.4 30 24" stroke={hairColor} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Path d="M 34 24 Q 36.5 22.4 39.5 24" stroke={hairColor} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export { POSITION_KIT };
