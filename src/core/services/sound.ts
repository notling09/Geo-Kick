import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * Zentrale Soundeffekte (V3). Die Dateien in assets/sounds/ stammen vom
 * Nutzer; zum Austauschen Datei ersetzen (und ggf. Endung hier anpassen),
 * danach die APK neu bauen.
 *
 * playSound ist bewusst fire-and-forget und schluckt Fehler: ein kaputter
 * Sound darf nie das Spiel blockieren.
 */

const SOURCES = {
  /** Eigenes Tor im Live-Ticker */
  goal: require('../../../assets/sounds/goal.m4a'),
  /** Gegentor im Live-Ticker */
  goalConceded: require('../../../assets/sounds/goal-conceded.mp3'),
  /** Abpfiff (Spielende) */
  fulltime: require('../../../assets/sounds/fulltime.mp3'),
  /** Meister-Feier (Pokal + Konfetti, ~7 s) */
  champion: require('../../../assets/sounds/champion.mp3'),
  /** Pack wird aufgerissen */
  packOpen: require('../../../assets/sounds/pack-open.mp4'),
  /** Reveal-Animationen je Seltenheit */
  revealSilver: require('../../../assets/sounds/reveal-silver.mp3'),
  revealGold: require('../../../assets/sounds/reveal-gold.mp3'),
  revealLegendary: require('../../../assets/sounds/reveal-legendary.mp3'),
  revealMystery: require('../../../assets/sounds/reveal-mystery.mp3'),
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
