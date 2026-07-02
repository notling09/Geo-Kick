/**
 * Farbwelt (Kapitel 3.6): kräftig, freundlich, Comic-Stil –
 * Fußballplatz-Grün als Hauptakzentfarbe.
 */
export const colors = {
  pitch: '#2E7D32',
  pitchDark: '#1B5E20',
  pitchLight: '#66BB6A',
  grass: '#E8F5E9',
  background: '#F4FBF4',
  card: '#FFFFFF',
  ink: '#1A2E1A',
  inkSoft: '#5C6E5C',
  accent: '#FF8F00',
  accentDark: '#E65100',
  danger: '#C62828',
  sky: '#1976D2',
  line: '#D7E5D7',
  gold: '#E8B923',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  round: 999,
} as const;

export const font = {
  title: 28,
  h1: 22,
  h2: 18,
  body: 15,
  small: 12,
} as const;
