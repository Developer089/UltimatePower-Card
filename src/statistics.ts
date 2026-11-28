import type { HomeAssistant } from 'custom-card-helpers';
import type { UltimatePowerCardConfig } from './types';

export type PeriodKind = 'day' | 'week' | 'month' | 'year';

export interface StatIds {
  pv: string[];
  gridIn: string[];
  gridOut: string[];
  batIn: string[];   // energy charged into the battery
  batOut: string[];  // energy discharged from the battery
}

export interface StatsResult {
  title: string;
  labels: string[];
  pv: number[];
  cons: number[];
  imp: number[];
  exp: number[];
  /** Number of implausible jumps (counter glitches) left out of the sums. */
  skipped: number;
}

interface StatRow {
  start: number | string;
  change?: number | null;
}

const list = (v?: string | string[]): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

/**
 * Statistic ids for the balance section: the card config wins, otherwise the
 * sensors configured in the Home Assistant Energy dashboard are used.
 */
export const resolveStatIds = async (
  hass: HomeAssistant,
  cfg: UltimatePowerCardConfig,
): Promise<StatIds | null> => {
  const ids: StatIds = { pv: [], gridIn: [], gridOut: [], batIn: [], batOut: [] };
  const s = cfg.statistics;
  // `statistics` may hold only max_power_kw; the sensors then still come from
  // the Energy dashboard.
  const own = !!s && [s.pv, s.grid_import, s.grid_export, s.battery_charge, s.battery_discharge].some((v) => list(v).length);
  if (s && own) {
    ids.pv = list(s.pv);
    ids.gridIn = list(s.grid_import);
    ids.gridOut = list(s.grid_export);
    ids.batIn = list(s.battery_charge);
    ids.batOut = list(s.battery_discharge);
  } else {
    try {
      const prefs = await hass.callWS<any>({ type: 'energy/get_prefs' });
      for (const src of prefs?.energy_sources ?? []) {
        if (src.type === 'solar' && src.stat_energy_from) ids.pv.push(src.stat_energy_from);
        if (src.type === 'battery') {
          if (src.stat_energy_from) ids.batOut.push(src.stat_energy_from);
          if (src.stat_energy_to) ids.batIn.push(src.stat_energy_to);
        }
        if (src.type === 'grid') {
          // Older Home Assistant nests the sensors in flow_from / flow_to lists,
          // newer versions keep them directly on the grid source.
          for (const f of src.flow_from ?? []) if (f.stat_energy_from) ids.gridIn.push(f.stat_energy_from);
          for (const f of src.flow_to ?? []) if (f.stat_energy_to) ids.gridOut.push(f.stat_energy_to);
          if (src.stat_energy_from) ids.gridIn.push(src.stat_energy_from);
          if (src.stat_energy_to) ids.gridOut.push(src.stat_energy_to);
        }
      }
    } catch {
      return null;
    }
  }
  return ids.pv.length || ids.gridIn.length ? ids : null;
};

interface Range {
  start: Date;
  end: Date;
  bucket: 'hour' | 'day' | 'month';
  labels: string[];
  title: string;
  index: (t: Date) => number;
}

const DAY = 86400000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const periodRange = (
  kind: PeriodKind,
  offset: number,
  lang: string,
  words: { today: string; yesterday: string; thisWeek: string; lastWeek: string },
): Range => {
  const today = midnight(new Date());
  const dayIndex = (start: Date) => (t: Date) =>
    Math.round((midnight(t).getTime() - start.getTime()) / DAY);
  const dm = (d: Date) => d.toLocaleDateString(lang, { day: 'numeric', month: 'numeric' });

  if (kind === 'day') {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    return {
      start,
      end,
      bucket: 'hour',
      labels: Array.from({ length: 24 }, (_, h) => `${h}:00`),
      title:
        offset === 0
          ? words.today
          : offset === 1
          ? words.yesterday
          : start.toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'numeric' }),
      index: (t) => Math.floor((t.getTime() - start.getTime()) / 3600000),
    };
  }
  if (kind === 'week') {
    const monday = today.getDate() - ((today.getDay() + 6) % 7) - 7 * offset;
    const start = new Date(today.getFullYear(), today.getMonth(), monday);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const last = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return {
      start,
      end,
      bucket: 'day',
      labels: Array.from({ length: 7 }, (_, i) =>
        new Date(start.getFullYear(), start.getMonth(), start.getDate() + i).toLocaleDateString(
          lang,
          { weekday: 'short' },
        ),
      ),
      title: offset === 0 ? words.thisWeek : offset === 1 ? words.lastWeek : `${dm(start)} – ${dm(last)}`,
      index: dayIndex(start),
    };
  }
  if (kind === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const n = Math.round((end.getTime() - start.getTime()) / DAY);
    return {
      start,
      end,
      bucket: 'day',
      labels: Array.from({ length: n }, (_, i) => `${i + 1}.`),
      title: start.toLocaleDateString(lang, { month: 'long', year: 'numeric' }),
      index: dayIndex(start),
    };
  }
  const start = new Date(today.getFullYear() - offset, 0, 1);
  const end = new Date(start.getFullYear() + 1, 0, 1);
  return {
    start,
    end,
    bucket: 'month',
    labels: Array.from({ length: 12 }, (_, i) =>
      new Date(start.getFullYear(), i, 1).toLocaleDateString(lang, { month: 'short' }),
    ),
    title: String(start.getFullYear()),
    index: (t) => (t.getFullYear() === start.getFullYear() ? t.getMonth() : -1),
  };
};

/**
 * Statistics are fetched one step finer than they are shown (hours for day,
 * week and month, days for a year) so that a single bad row can be told apart
 * from real energy. A meter that drops to zero and comes back makes Home
 * Assistant book its whole lifetime reading as one hour of energy; any row
 * above what `maxKw` (the highest real power, e.g. the main breaker of the
 * house) could deliver in the time it covers is such a glitch and is skipped.
 */
export const fetchStats = async (
  hass: HomeAssistant,
  ids: StatIds,
  kind: PeriodKind,
  offset: number,
  lang: string,
  words: { today: string; yesterday: string; thisWeek: string; lastWeek: string },
  maxKw = 100,
): Promise<StatsResult> => {
  const range = periodRange(kind, offset, lang, words);
  const n = range.labels.length;
  const fine = kind === 'year' ? 'day' : 'hour';
  const limit = maxKw * (fine === 'day' ? 24 : 1);
  const stepMs = (fine === 'day' ? 24 : 1) * 3600000;
  let skipped = 0;
  const all = [...new Set([...ids.pv, ...ids.gridIn, ...ids.gridOut, ...ids.batIn, ...ids.batOut])];

  const rows = await hass.callWS<Record<string, StatRow[]>>({
    type: 'recorder/statistics_during_period',
    start_time: range.start.toISOString(),
    end_time: range.end.toISOString(),
    statistic_ids: all,
    period: fine,
    types: ['change'],
    units: { energy: 'kWh' },
  });

  const bucket = (statIds: string[]): number[] => {
    const out = new Array<number>(n).fill(0);
    for (const id of statIds) {
      let previous: number | null = null;
      for (const row of rows?.[id] ?? []) {
        // After an outage there are no rows and the first one back holds all the
        // energy measured meanwhile, so it may hold the limit for every step missed.
        const at = new Date(row.start).getTime();
        const steps = previous === null ? 1 : Math.max(1, (at - previous) / stepMs);
        previous = at;
        const i = range.index(new Date(row.start));
        if (i < 0 || i >= n || typeof row.change !== 'number') continue;
        if (row.change > limit * steps) skipped++;
        else out[i] += Math.max(0, row.change);
      }
    }
    return out;
  };

  const pv = bucket(ids.pv);
  const imp = bucket(ids.gridIn);
  const exp = bucket(ids.gridOut);
  const batIn = bucket(ids.batIn);
  const batOut = bucket(ids.batOut);
  // Same energy balance as the live house load, per bucket.
  const cons = pv.map((p, i) => Math.max(0, p + imp[i] + batOut[i] - exp[i] - batIn[i]));

  return { title: range.title, labels: range.labels, pv, cons, imp, exp, skipped };
};
