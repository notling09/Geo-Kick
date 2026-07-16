/**
 * Farbwelt (Kapitel 3.6): kräftig, freundlich, Comic-Stil –
 * Fußballplatz-Grün als Hauptakzentfarbe.
 *
 * V6.1: Light- und Dark-Palette. Das colors-Objekt wird beim App-Start
 * (vor dem Laden der Screens) per applyTheme auf den gespeicherten Modus
 * gesetzt; ein Wechsel in den Einstellungen greift beim nächsten Start,
 * weil die StyleSheets der Screens die Werte beim Laden einfrieren.
 */

const light = {
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
};

const dark: typeof light = {
  pitch: '#2E7D32',
  // Dient im Dark Mode als TEXT-Grün (Titel usw.); dunkle Vollflächen
  // (Live-Ticker, Pack-Öffnung) nutzen bewusst feste Literale.
  pitchDark: '#85CE88',
  pitchLight: '#66BB6A',
  grass: '#1C2B1D',
  background: '#101812',
  card: '#1A241B',
  ink: '#E7F0E7',
  inkSoft: '#9BAD9B',
  accent: '#FF8F00',
  accentDark: '#FFB74D',
  danger: '#EF5350',
  sky: '#64B5F6',
  line: '#2C3A2C',
  gold: '#E8B923',
};

export type ThemeMode = 'light' | 'dark';

export const colors: typeof light = { ...light };

export function applyTheme(mode: ThemeMode): void {
  Object.assign(colors, mode === 'dark' ? dark : light);
}

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
