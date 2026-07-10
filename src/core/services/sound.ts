import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * Zentrale Soundeffekte (V3). Aktuell einfache Platzhalter-Toene
 * (scripts/gen-placeholder-sounds.ps1) - echte Sounds ersetzen einfach die
 * gleichnamigen Dateien in assets/sounds/.
 *
 * playSound ist bewusst fire-and-forget und schluckt Fehler: ein kaputter
 * Sound darf nie das Spiel blockieren.
 */

const SOURCES = {
  /** Eigenes Tor im Live-Ticker */
  goal: require('../../../assets/sounds/goal.wav'),
  /** Abpfiff (Spielende) */
  fulltime: require('../../../assets/sounds/fulltime.wav'),
  /** Meister-Feier (Pokal + Konfetti) */
  champion: require('../../../assets/sounds/champion.wav'),
  /** Pack wird aufgerissen */
  packOpen: require('../../../assets/sounds/pack-open.wav'),
  /** Reveal-Animationen je Seltenheit */
  revealSilver: require('../../../assets/sounds/reveal-silver.wav'),
  revealGold: require('../../../assets/sounds/reveal-gold.wav'),
  revealLegendary: require('../../../assets/sounds/reveal-legendary.wav'),
  revealMystery: require('../../../assets/sounds/reveal-mystery.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};

export function playSound(name: SoundName): void {
  try {
    let player = players[name];
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      players[name] = player;
    }
    player.seekTo(0);
    player.play();
  } catch (e) {
    console.warn('[sound]', name, e);
  }
}
