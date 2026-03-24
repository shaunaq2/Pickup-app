import { Game } from "../types";
import { BookingRecord, USER_HISTORY } from "../data/history";

export interface ScoredGame {
  game: Game;
  score: number;
  reasons: string[];
}

const API_URL = "http://localhost:8000/recommend";

// ─── Helpers ──────────────────────────────────────────────

function dayOfWeekFromDate(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getDay();
}

function hourFromTime(timeStr: string): number {
  return parseInt(timeStr.split(":")[0]);
}

function freq<T>(history: T[], value: T): number {
  if (history.length === 0) return 0;
  return history.filter((h) => h === value).length / history.length;
}

function uniqueRatio<T>(arr: T[]): number {
  if (arr.length === 0) return 0;
  return new Set(arr).size / arr.length;
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.map((n) => (n - mean) ** 2).reduce((a, b) => a + b, 0) / nums.length;
  return Math.sqrt(variance);
}

function hourCloseness(histHours: number[], gameHour: number): number {
  if (histHours.length === 0) return 0;
  const avg = histHours.reduce((a, b) => a + b, 0) / histHours.length;
  return Math.max(0, 1 - Math.abs(avg - gameHour) / 6);
}

// ─── Adaptive weight computation ──────────────────────────
//
// For each dimension we measure how "consistent" the user is.
// Consistency = low uniqueRatio or low stdDev = they have a strong preference.
// We boost weights for dimensions where they're consistent,
// and reduce weights where they're all over the place.
// Final weights are always normalised to sum to 1.0.

interface Weights {
  sport: number;
  host: number;
  location: number;
  dayOfWeek: number;
  hourOfDay: number;
  skillLevel: number;
}

function computeAdaptiveWeights(history: BookingRecord[]): Weights {
  if (history.length < 3) {
    // Not enough data — use sensible defaults
    return { sport: 0.30, host: 0.20, location: 0.18, dayOfWeek: 0.14, hourOfDay: 0.10, skillLevel: 0.08 };
  }

  const histSports    = history.map((h) => h.sport);
  const histHosts     = history.map((h) => h.host);
  const histLocations = history.map((h) => h.location);
  const histDays      = history.map((h) => h.dayOfWeek);
  const histHours     = history.map((h) => h.hourOfDay);
  const histSkills    = history.map((h) => h.skillLevel);

  // Consistency scores: 1 = very consistent (always same value), 0 = totally random
  const sportConsistency    = 1 - uniqueRatio(histSports);
  const hostConsistency     = 1 - uniqueRatio(histHosts);
  const locationConsistency = 1 - uniqueRatio(histLocations);
  const dayConsistency      = 1 - Math.min(stdDev(histDays) / 3.5, 1);
  const hourConsistency     = 1 - Math.min(stdDev(histHours) / 4.0, 1);
  const skillConsistency    = 1 - uniqueRatio(histSkills);

  // Base weights (minimum floor so nothing drops to 0)
  const BASE = { sport: 0.10, host: 0.06, location: 0.06, dayOfWeek: 0.06, hourOfDay: 0.06, skillLevel: 0.04 };

  // Raw adaptive weight = base + consistency bonus
  const raw = {
    sport:     BASE.sport     + sportConsistency    * 0.30,
    host:      BASE.host      + hostConsistency     * 0.24,
    location:  BASE.location  + locationConsistency * 0.20,
    dayOfWeek: BASE.dayOfWeek + dayConsistency      * 0.16,
    hourOfDay: BASE.hourOfDay + hourConsistency     * 0.14,
    skillLevel: BASE.skillLevel + skillConsistency  * 0.10,
  };

  // Normalise so weights always sum to 1
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  return {
    sport:     raw.sport     / total,
    host:      raw.host      / total,
    location:  raw.location  / total,
    dayOfWeek: raw.dayOfWeek / total,
    hourOfDay: raw.hourOfDay / total,
    skillLevel: raw.skillLevel / total,
  };
}

// ─── Reason generation ────────────────────────────────────
// Reasons are also adaptive — we only mention dimensions
// that are both consistent AND matched for this game.

function buildAdaptiveReasons(
  weights: Weights,
  game: Game,
  sportFreq: number,
  hostFreq: number,
  locationFreq: number,
  dayFreq: number,
  hourScore: number,
  skillFreq: number,
  gameDay: number
): string[] {
  const candidates: { weight: number; text: string }[] = [];

  if (sportFreq >= 0.3)
    candidates.push({ weight: weights.sport * sportFreq, text: `You often play ${game.sport}` });

  if (hostFreq >= 0.2)
    candidates.push({ weight: weights.host * hostFreq, text: `You've played with ${game.host} before` });

  if (locationFreq >= 0.15)
    candidates.push({ weight: weights.location * locationFreq, text: `You like playing at ${game.location}` });

  if (dayFreq >= 0.25) {
    const days = ["Sundays","Mondays","Tuesdays","Wednesdays","Thursdays","Fridays","Saturdays"];
    candidates.push({ weight: weights.dayOfWeek * dayFreq, text: `You usually play on ${days[gameDay]}` });
  }

  if (hourScore >= 0.6)
    candidates.push({ weight: weights.hourOfDay * hourScore, text: `Matches your preferred time` });

  if (skillFreq >= 0.25)
    candidates.push({ weight: weights.skillLevel * skillFreq, text: `${game.skillLevel} level suits you` });

  // Return the top 2 reasons by weight — most important signals first
  return candidates
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((c) => c.text);
}

// ─── Local adaptive scoring ───────────────────────────────

function localScore(history: BookingRecord[], game: Game): { score: number; reasons: string[] } {
  const weights = computeAdaptiveWeights(history);

  const histSports    = history.map((h) => h.sport);
  const histHosts     = history.map((h) => h.host);
  const histLocations = history.map((h) => h.location);
  const histDays      = history.map((h) => h.dayOfWeek);
  const histHours     = history.map((h) => h.hourOfDay);
  const histSkills    = history.map((h) => h.skillLevel);

  const gameDay      = dayOfWeekFromDate(game.date);
  const gameHour     = hourFromTime(game.time);

  const sportFreq    = freq(histSports,    game.sport);
  const hostFreq     = freq(histHosts,     game.host);
  const locationFreq = freq(histLocations, game.location);
  const dayFreq      = freq(histDays,      gameDay);
  const hourScore    = hourCloseness(histHours, gameHour);
  const skillFreq    = freq(histSkills,    game.skillLevel);

  const score =
    weights.sport      * sportFreq +
    weights.host       * hostFreq +
    weights.location   * locationFreq +
    weights.dayOfWeek  * dayFreq +
    weights.hourOfDay  * hourScore +
    weights.skillLevel * skillFreq;

  return {
    score,
    reasons: buildAdaptiveReasons(
      weights, game,
      sportFreq, hostFreq, locationFreq,
      dayFreq, hourScore, skillFreq, gameDay
    ),
  };
}

// ─── Exports ──────────────────────────────────────────────

export function gameToBookingRecord(game: Game): BookingRecord {
  return {
    gameId:       game.id,
    sport:        game.sport,
    host:         game.host,
    location:     game.location,
    city:         game.city,
    neighborhood: game.location.split(" ")[0],
    dayOfWeek:    dayOfWeekFromDate(game.date),
    hourOfDay:    hourFromTime(game.time),
    skillLevel:   game.skillLevel,
  };
}

export async function scoreGamesAsync(
  username: string,
  games: Game[],
  joinedIds: Set<number>,
  liveHistory: BookingRecord[]
): Promise<ScoredGame[]> {
  const seedHistory = USER_HISTORY[username.toLowerCase()] ?? [];
  const history     = [...seedHistory, ...liveHistory];

  if (history.length === 0) return [];

  const candidates = games.filter((g) => !joinedIds.has(g.id));
  if (candidates.length === 0) return [];

  try {
    const res = await fetch(API_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: history.map((h) => ({ ...h, costPerPlayer: 0 })),
        candidates: candidates.map((g) => ({
          id:            g.id,
          sport:         g.sport,
          host:          g.host,
          location:      g.location,
          city:          g.city,
          neighborhood:  g.location.split(" ")[0],
          dayOfWeek:     dayOfWeekFromDate(g.date),
          hourOfDay:     hourFromTime(g.time),
          skillLevel:    g.skillLevel,
          costPerPlayer: g.costPerPlayer,
          distKm:        0,
        })),
      }),
    });

    if (!res.ok) throw new Error("API error");

    const data = await res.json();

    return data.results
      .filter((r: { score: number }) => r.score > 0.02)
      .map((r: { id: number; score: number; reasons: string[] }) => {
        const game = candidates.find((g) => g.id === r.id)!;
        return { game, score: r.score, reasons: r.reasons };
      });

  } catch {
    // API not running — fall back to local adaptive scoring
    return candidates
      .map((game) => {
        const { score, reasons } = localScore(history, game);
        return { game, score, reasons };
      })
      .filter((s) => s.score > 0.03)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }
}

export function scoreGames(
  username: string,
  games: Game[],
  joinedIds: Set<number>,
  liveHistory: BookingRecord[]
): ScoredGame[] {
  const seedHistory = USER_HISTORY[username.toLowerCase()] ?? [];
  const history     = [...seedHistory, ...liveHistory];
  if (history.length === 0) return [];

  return games
    .filter((g) => !joinedIds.has(g.id))
    .map((game) => {
      const { score, reasons } = localScore(history, game);
      return { game, score, reasons };
    })
    .filter((s) => s.score > 0.03)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}
