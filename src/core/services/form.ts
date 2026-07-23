import type { MatchEvent } from '../domain/types';
import * as metaRepo from '../db/repositories/metaRepo';

/**
 * Spielerform (V7.2): jeder Spieler hat einen Form-Wert 0–100 (Start 50),
 * gespeichert nach Namen in meta 'playerForm'. Die Form steigt durch Tore/
 * Vorlagen und Siege, sinkt bei Niederlagen und auf der Bank. Sie wirkt sich
 * moderat auf die Team-Stärke aus (±4 %) und ist im Squad sichtbar.
 * Karrierespezifisch – beim Neustart wird sie zurückgesetzt.
 */

export const FORM_START = 50;

export async function loadForm(): Promise<Record<string, number>> {
  const raw = await metaRepo.getMeta('playerForm');
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

async function saveForm(form: Record<string, number>): Promise<void> {
  await metaRepo.setMeta('playerForm', JSON.stringify(form));
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Form eines einzelnen Spielers (Default 50, falls noch nicht gesetzt). */
export function formOf(form: Record<string, number>, name: string): number {
  return form[name] ?? FORM_START;
}

/**
 * Form 0–100 auf 5 Stufen abbilden (0 = sehr schlecht … 4 = top).
 * Für die farbige Anzeige im Squad.
 */
export function formStage(value: number): 0 | 1 | 2 | 3 | 4 {
  if (value >= 80) return 4;
  if (value >= 62) return 3;
  if (value >= 40) return 2;
  if (value >= 22) return 1;
  return 0;
}

/** Stärke-Faktor aus der Durchschnittsform der Elf (±4 % bei moderatem Effekt). */
export function formFactor(avgForm: number): number {
  return 1 + ((avgForm - FORM_START) / FORM_START) * 0.04;
}

/** Durchschnittsform einer Namensliste. */
export function averageForm(form: Record<string, number>, names: string[]): number {
  if (names.length === 0) return FORM_START;
  return names.reduce((sum, n) => sum + formOf(form, n), 0) / names.length;
}

/**
 * Form nach einem Ligaspiel fortschreiben. lineupNames = Aufgestellte des
 * Nutzers, benchNames = Bank. extraMalus (z. B. Rivalen-Niederlage) trifft
 * zusätzlich alle Aufgestellten.
 */
export async function updateFormAfterMatch(opts: {
  events: MatchEvent[];
  userSide: 'home' | 'away';
  lineupNames: string[];
  benchNames: string[];
  result: 'win' | 'draw' | 'loss';
  extraMalus?: number;
}): Promise<void> {
  const form = await loadForm();
  const base = opts.result === 'win' ? 5 : opts.result === 'loss' ? -8 : 0;

  for (const name of opts.lineupNames) {
    let delta = base - (opts.extraMalus ?? 0);
    const goals = opts.events.filter(
      (e) => e.type === 'tor' && e.team === opts.userSide && e.player === name,
    ).length;
    const assists = opts.events.filter(
      (e) => e.type === 'tor' && e.team === opts.userSide && e.assist === name,
    ).length;
    delta += goals * 12 + assists * 8;
    form[name] = clamp(formOf(form, name) + delta);
  }
  // Bank: Form verfällt leicht (Spielpraxis fehlt)
  for (const name of opts.benchNames) {
    form[name] = clamp(formOf(form, name) - 2);
  }
  await saveForm(form);
}
