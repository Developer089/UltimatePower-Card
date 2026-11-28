import {
  LitElement,
  html,
  svg,
  nothing,
  type PropertyValues,
  type SVGTemplateResult,
  type TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { fireEvent, type HomeAssistant } from 'custom-card-helpers';

import { cardStyles } from './styles';
import { readBattery, readPower, resolveState } from './flow-calculator';
import {
  fetchStats,
  resolveStatIds,
  type PeriodKind,
  type StatIds,
  type StatsResult,
} from './statistics';
import type { UltimatePowerCardConfig } from './types';

const VERSION = '0.2.2';

type Pt = [number, number];
type Tone = 'pos' | 'neg';
type NodeState = Tone | 'idle';

/** Below this power (W) a node counts as idle and its flow is not animated. */
const IDLE_W = 5;
const MAX_OFFSET = 120;
/** Distance between the small flow dots (px); must match --p of .stream in the styles. */
const DOT_GAP = 24;
/** Fastest flow (px/s): about a seventh of DOT_GAP per frame on a 60 Hz screen. */
const MAX_SPEED = 200;
const PERIODS: PeriodKind[] = ['day', 'week', 'month', 'year'];

const ICONS = {
  pv: 'M5 13h14l2 7H3z M9 13l-1 7 M15 13l1 7 M4 16.5h16 M8.5 10a3.5 3.5 0 0 1 7 0 M12 3v1.5 M6.5 5.5l1 1 M17.5 5.5l-1 1',
  house: 'M4 11l8-7 8 7v9H4z M10 20v-5h4v5',
  bat: 'M3 8h16v8H3z M21 10.5v3 M6.5 10.5v3 M9.5 10.5v3 M12.5 10.5v3',
  grid: 'M12 3L8 21 M12 3l4 18 M7 9h10 M5.5 9l1.5-3h10l1.5 3 M9.3 15h5.4 M10 12l4 3 M14 12l-4 3',
};

const WORDS = {
  cs: {
    production: 'Výroba', consumption: 'Spotřeba', battery: 'Baterie', grid: 'Síť',
    import: 'odběr', export: 'dodávka', charging: 'nabíjí', discharging: 'vybíjí', idle: 'v klidu',
    other: 'Ostatní', day: 'Den', week: 'Týden', month: 'Měsíc', year: 'Rok',
    today: 'Dnes', yesterday: 'Včera', thisWeek: 'Tento týden', lastWeek: 'Minulý týden',
    pvEnergy: 'Výroba FVE', houseEnergy: 'Spotřeba domu', gridIn: 'Odběr ze sítě', gridOut: 'Dodávka do sítě',
    selfSufficiency: 'Soběstačnost', selfConsumption: 'Vlastní spotřeba',
    prev: 'Předchozí období', next: 'Další období', loading: 'Načítám statistiky…',
    noStats: 'Statistiky nejsou k dispozici. Nastav panel Energie v Home Assistantu nebo volbu statistics v kartě.',
    statsError: 'Statistiky se nepodařilo načíst.',
    skipped: 'Vynechané chybné skoky počítadla: {n}. Oprav je v Nástroje pro vývojáře → Statistiky.',
  },
  en: {
    production: 'Production', consumption: 'Consumption', battery: 'Battery', grid: 'Grid',
    import: 'import', export: 'export', charging: 'charging', discharging: 'discharging', idle: 'idle',
    other: 'Other', day: 'Day', week: 'Week', month: 'Month', year: 'Year',
    today: 'Today', yesterday: 'Yesterday', thisWeek: 'This week', lastWeek: 'Last week',
    pvEnergy: 'Solar production', houseEnergy: 'Home consumption', gridIn: 'Grid import', gridOut: 'Grid export',
    selfSufficiency: 'Self-sufficiency', selfConsumption: 'Self-consumption',
    prev: 'Previous period', next: 'Next period', loading: 'Loading statistics…',
    noStats: 'No statistics available. Set up the Energy dashboard in Home Assistant or the statistics option of the card.',
    statsError: 'Statistics could not be loaded.',
    skipped: 'Meter glitches left out: {n}. Fix them in Developer tools → Statistics.',
  },
};

const sum = (a: number[]): number => a.reduce((s, v) => s + v, 0);

@customElement('ultimate-power-card')
export class UltimatePowerCard extends LitElement {
  static styles = cardStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: UltimatePowerCardConfig;
  @state() private _period: PeriodKind = 'day';
  @state() private _offset = 0;
  @state() private _stats?: StatsResult;
  @state() private _statsState: 'idle' | 'loading' | 'ready' | 'none' | 'error' = 'idle';
  @state() private _tip: number | null = null;

  private _statIds?: StatIds | null;
  private _request = 0;
  private _timer?: number;
  private _swipeX: number | null = null;
  private _lastRender = 0;
  private _pending?: number;

  public static getStubConfig(): Partial<UltimatePowerCardConfig> {
    return { grid_entity: 'sensor.grid_power' };
  }

  public setConfig(config: UltimatePowerCardConfig): void {
    if (!config.grid_entity) {
      throw new Error('grid_entity je povinná.');
    }
    this._config = { ...config };
    this._statIds = undefined;
    this._stats = undefined;
    this._statsState = 'idle';
  }

  public getCardSize(): number {
    return this._config?.show_statistics === false ? 8 : 14;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    // The current period keeps growing, so refresh it now and then.
    this._timer = window.setInterval(() => {
      if (this._offset === 0 && this._statsState === 'ready') this._loadStats();
    }, 5 * 60 * 1000);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this._timer);
    window.clearTimeout(this._pending);
    this._pending = undefined;
  }

  /** Home Assistant replaces `hass` on every state change; only our entities matter. */
  protected shouldUpdate(changed: PropertyValues): boolean {
    if (changed.size > 1 || !changed.has('hass')) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    if (!old || !this.hass || !this._config) return true;
    if ((old.themes as any)?.darkMode !== (this.hass.themes as any)?.darkMode) return true;
    if (!this._entities().some((e) => old.states[e] !== this.hass!.states[e])) return false;
    // Redraw at most once per update_interval; a change that arrives sooner is
    // picked up by the timer, which renders whatever hass holds by then.
    const wait = this._lastRender + this._interval() - Date.now();
    if (wait <= 0) return true;
    if (this._pending === undefined) {
      this._pending = window.setTimeout(() => {
        this._pending = undefined;
        this.requestUpdate();
      }, wait);
    }
    return false;
  }

  /** Redraw interval in ms, from update_interval (1–20 s, default 1). */
  private _interval(): number {
    const s = Number(this._config?.update_interval ?? 1);
    return Math.max(1, Math.min(20, isNaN(s) ? 1 : s)) * 1000;
  }

  protected updated(): void {
    this._lastRender = Date.now();
    // The flow speed is set through the playback rate: unlike a changed
    // animation-duration it keeps the dots where they are, so they do not jump
    // every time the power changes.
    this.renderRoot.querySelectorAll<SVGElement>('[data-rate]').forEach((el) => {
      const rate = Number(el.dataset.rate);
      for (const a of el.getAnimations?.() ?? []) {
        if (rate > 0 && Math.abs(a.playbackRate - rate) > 0.001) a.updatePlaybackRate(rate);
      }
    });
    if (this._statsState === 'idle' && this.hass && this._config?.show_statistics !== false) {
      this._loadStats();
    }
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this._config || !this.hass) return nothing;
    const dark = !!(this.hass.themes as any)?.darkMode;
    return html`
      <ha-card class="${dark ? 'dark' : ''} anim-${this._config.animation ?? 'auto'}">
        ${this._config.name ? html`<div class="title">${this._config.name}</div>` : nothing}
        ${this._renderFlow()}
        ${this._config.show_statistics === false ? nothing : this._renderStats()}
        <div class="version">v${VERSION}</div>
      </ha-card>
    `;
  }

  // ------------------------------------------------------------------ helpers

  private get _w() {
    return (this.hass?.language ?? 'en').startsWith('cs') ? WORDS.cs : WORDS.en;
  }

  private _entities(): string[] {
    const c = this._config!;
    return [
      c.grid_entity,
      c.grid_export_entity,
      c.pv_total_entity,
      c.battery_total_entity,
      c.battery_charge_entity,
      c.battery_discharge_entity,
      ...(c.pv_strings ?? []).map((s) => s.power_entity),
      ...(c.batteries ?? []).flatMap((b) => [b.power_entity, b.charge_entity, b.discharge_entity, b.soc_entity]),
      ...(c.appliances ?? []).map((a) => a.power_entity),
    ].filter((e): e is string => !!e);
  }

  private _num(v: number, digits: number): string {
    return v.toLocaleString(this.hass?.language, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  private _power(w: number): string {
    const a = Math.abs(w);
    if (this._config?.show_w_not_kw || a < 1000) return `${Math.round(a)} W`;
    return `${this._num(a / 1000, 1)} kW`;
  }

  private _energy(kwh: number): [string, string] {
    return kwh >= 1000 ? [this._num(kwh / 1000, 2), 'MWh'] : [this._num(kwh, 1), 'kWh'];
  }

  private _moreInfo(entity?: string): void {
    if (entity) fireEvent(this, 'hass-more-info', { entityId: entity });
  }

  /**
   * Dot speed in px/s. Grows steeply with power so that the difference is
   * obvious, but stays capped: the dots repeat every DOT_GAP px, and once they
   * travel a large part of that gap per screen frame the eye no longer sees
   * movement, only a still, denser dotted line.
   */
  private _speed(w: number): number {
    const max = this._config?.max_power ?? 10000;
    const k = Math.min(w, max) / max;
    const speed = (8 + 132 * Math.pow(k, 0.8)) * Math.max(0.1, this._config?.animation_speed ?? 1);
    return Math.min(speed, MAX_SPEED);
  }

  // ------------------------------------------------------------- flow diagram

  /** Line from a to b. Energy runs a → b, or b → a when `reverse` is set. */
  private _wire(a: Pt, b: Pt, w: number, tone: Tone, main: boolean, reverse = false): SVGTemplateResult {
    const d = `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`;
    if (w <= IDLE_W) return svg`<path class="wire" d=${d}></path>`;
    const speed = this._speed(w);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const rev = reverse ? 'rev' : '';
    return svg`
      <path class="wire on" d=${d}></path>
      <path class="stream ${tone} ${main ? 'main' : ''} ${rev}" d=${d}
        data-rate=${(speed / DOT_GAP).toFixed(3)}></path>
      ${main
        ? svg`<path class="lead ${tone} ${rev}" d=${d} data-rate=${(speed / 100).toFixed(3)}
            style=${`--p:${len};stroke-dasharray:0.1 ${len};animation-duration:${(len / 100).toFixed(2)}s`}></path>`
        : nothing}
    `;
  }

  private _text(x: number, y: number, cls: string, size: number, s: string, anchor = 'middle'): SVGTemplateResult {
    return svg`<text x=${x} y=${y} class=${cls} font-size=${size} text-anchor=${anchor}>${s}</text>`;
  }

  private _mainNode(
    p: Pt,
    st: NodeState,
    icon: keyof typeof ICONS,
    pulse: 'out' | 'in' | null,
    entity?: string,
  ): SVGTemplateResult {
    return svg`
      <g class="n ${st} ${entity ? 'click' : ''}" @click=${() => this._moreInfo(entity)}>
        ${pulse ? svg`<circle class="pulse ${pulse}" cx=${p[0]} cy=${p[1]} r="37"></circle>` : nothing}
        <circle class="echo" cx=${p[0] + 8} cy=${p[1]} r="36"></circle>
        <circle class="body" cx=${p[0]} cy=${p[1]} r="36" stroke-width="3"></circle>
        <path class="ic" transform=${`translate(${p[0] - 16} ${p[1] - 16}) scale(1.3333)`} d=${ICONS[icon]}></path>
      </g>
    `;
  }

  private _smallNode(p: Pt, st: NodeState, label: string, entity?: string): SVGTemplateResult {
    return svg`
      <g class="n ${st} ${entity ? 'click' : ''}" @click=${() => this._moreInfo(entity)}>
        <circle class="body" cx=${p[0]} cy=${p[1]} r="22" stroke-width="2"></circle>
        ${this._text(p[0], p[1] + 4, 't-v', 10.5, label)}
      </g>
    `;
  }

  private _renderFlow(): TemplateResult {
    const cfg = this._config!;
    const hass = this.hass!;
    const t = this._w;
    const s = resolveState(hass, cfg);

    const strings = cfg.pv_strings ?? [];
    const bats = cfg.batteries ?? [];
    const hasPv = strings.length > 0 || !!cfg.pv_total_entity;
    const hasBat =
      bats.length > 0 || !!(cfg.battery_total_entity || cfg.battery_charge_entity || cfg.battery_discharge_entity);

    const pvW = strings.map((x) => Math.max(0, readPower(hass, x.power_entity)));
    const batW = bats.map((b) => readBattery(hass, b));
    const apps = (cfg.appliances ?? []).map((a) => ({
      name: a.name,
      w: Math.max(0, readPower(hass, a.power_entity)),
      entity: a.power_entity as string | undefined,
      threshold: a.on_threshold_w ?? IDLE_W,
    }));
    if (apps.length && cfg.show_other !== false) {
      apps.push({
        name: t.other,
        w: Math.max(0, s.house_w - sum(apps.map((a) => a.w))),
        entity: undefined,
        threshold: IDLE_W,
      });
    }

    // ---- layout: 480 units wide, height follows the longest column
    const prodY = strings.length ? 150 : 56;
    const hubY = hasPv ? prodY + 120 : 96;
    const HUB: Pt = [240, hubY];
    const PROD: Pt = [240, prodY];
    const HOUSE: Pt = [100, hubY];
    const BAT: Pt = [380, hubY];
    const GRID: Pt = [240, hubY + 120];
    const pvStep = Math.min(110, 400 / Math.max(1, strings.length));
    const pvPos: Pt[] = strings.map((_, i) => [240 + (i - (strings.length - 1) / 2) * pvStep, 50]);
    const appPos: Pt[] = apps.map((_, i) => [100, hubY + 90 + i * 50]);
    const batPos: Pt[] = bats.map((_, i) => [380, hubY + 92 + i * 56]);
    const height = Math.max(
      hubY + 216,
      apps.length ? appPos[apps.length - 1][1] + 36 : 0,
      bats.length ? batPos[bats.length - 1][1] + 40 : 0,
    );

    const on = (w: number) => Math.abs(w) > IDLE_W;
    const grid = s.grid_w;
    const bat = s.battery_total_w;

    const wires: SVGTemplateResult[] = [];
    if (hasPv) wires.push(this._wire(PROD, HUB, s.pv_total_w, 'pos', true));
    wires.push(this._wire(HUB, HOUSE, s.house_w, 'neg', true));
    wires.push(this._wire(GRID, HUB, Math.abs(grid), grid >= 0 ? 'neg' : 'pos', true, grid < 0));
    if (hasBat) wires.push(this._wire(BAT, HUB, Math.abs(bat), 'pos', true, bat < 0));
    strings.forEach((_, i) => wires.push(this._wire(pvPos[i], PROD, pvW[i], 'pos', false)));
    // Appliances and batteries hang below their node as a chain; each segment
    // carries the sum of everything further down.
    apps.forEach((_, i) =>
      wires.push(
        this._wire(i ? appPos[i - 1] : HOUSE, appPos[i], sum(apps.slice(i).map((a) => a.w)), 'neg', false),
      ),
    );
    bats.forEach((_, i) => {
      const rest = sum(batW.slice(i));
      wires.push(this._wire(i ? batPos[i - 1] : BAT, batPos[i], Math.abs(rest), 'pos', false, rest >= 0));
    });

    const batWord = bat > IDLE_W ? t.discharging : bat < -IDLE_W ? t.charging : t.idle;
    const gridWord = grid > IDLE_W ? t.import : grid < -IDLE_W ? t.export : t.idle;
    const ring = 2 * Math.PI * 24;

    return html`
      <svg class="flow" viewBox="0 0 480 ${height}" role="img">
        ${wires}
        <circle class="hub" cx=${HUB[0]} cy=${HUB[1]} r="7"></circle>

        ${hasPv
          ? svg`
            ${this._mainNode(PROD, on(s.pv_total_w) ? 'pos' : 'idle', 'pv', on(s.pv_total_w) ? 'out' : null, cfg.pv_total_entity)}
            ${this._text(292, prodY - 3, 't-v', 15, this._power(s.pv_total_w), 'start')}
            ${this._text(292, prodY + 15, 't-n', 13, t.production, 'start')}
            ${strings.map(
              (x, i) => svg`
                ${this._smallNode(pvPos[i], on(pvW[i]) ? 'pos' : 'idle', this._power(pvW[i]), x.power_entity)}
                ${x.name ? this._text(pvPos[i][0], 18, 't-n', 11, x.name) : nothing}
              `,
            )}`
          : nothing}

        ${this._mainNode(HOUSE, on(s.house_w) ? 'neg' : 'idle', 'house', on(s.house_w) ? 'in' : null)}
        ${this._text(100, hubY - 66, 't-v', 15, this._power(s.house_w))}
        ${this._text(100, hubY - 48, 't-n', 13, t.consumption)}
        ${apps.map(
          (a, i) => svg`
            ${this._smallNode(appPos[i], a.w > a.threshold ? 'neg' : 'idle', this._power(a.w), a.entity)}
            ${this._text(130, appPos[i][1] + 4, 't-n', 11, a.name, 'start')}
          `,
        )}

        ${hasBat
          ? svg`
            ${this._mainNode(BAT, on(bat) ? 'pos' : 'idle', 'bat', bat > IDLE_W ? 'out' : bat < -IDLE_W ? 'in' : null, cfg.battery_total_entity)}
            ${this._text(380, hubY - 66, 't-v', 15, this._power(bat))}
            ${this._text(380, hubY - 48, 't-n', 13, `${t.battery} · ${batWord}`)}
            ${bats.map((b, i) => {
              const p = batPos[i];
              const soc = Math.max(0, Math.min(100, parseFloat(hass.states?.[b.soc_entity]?.state ?? '') || 0));
              const sign = batW[i] > IDLE_W ? '−' : batW[i] < -IDLE_W ? '+' : '';
              return svg`
                <g class="n click" @click=${() => this._moreInfo(b.power_entity ?? b.soc_entity)}>
                  <circle class="ring-track" cx=${p[0]} cy=${p[1]} r="24"></circle>
                  <circle class="ring" cx=${p[0]} cy=${p[1]} r="24"
                    stroke-dasharray=${ring.toFixed(1)}
                    stroke-dashoffset=${(ring * (1 - soc / 100)).toFixed(1)}
                    transform=${`rotate(-90 ${p[0]} ${p[1]})`}></circle>
                  ${this._text(p[0], p[1] + 4, 't-v', 11, `${Math.round(soc)} %`)}
                </g>
                ${b.name ? this._text(346, p[1] - 2, 't-n', 11, b.name, 'end') : nothing}
                ${this._text(346, p[1] + (b.name ? 13 : 4), 't-v', 11, sign + this._power(batW[i]), 'end')}
              `;
            })}`
          : nothing}

        ${this._mainNode(
          GRID,
          grid > IDLE_W ? 'neg' : grid < -IDLE_W ? 'pos' : 'idle',
          'grid',
          grid > IDLE_W ? 'out' : grid < -IDLE_W ? 'in' : null,
          cfg.grid_entity,
        )}
        ${this._text(240, hubY + 180, 't-n', 13, `${t.grid} · ${gridWord}`)}
        ${this._text(240, hubY + 200, 't-v', 15, this._power(grid))}
      </svg>
    `;
  }

  // --------------------------------------------------------------- statistics

  private async _loadStats(): Promise<void> {
    const hass = this.hass;
    const cfg = this._config;
    if (!hass || !cfg) return;
    const request = ++this._request;
    if (this._statsState !== 'ready') this._statsState = 'loading';
    try {
      if (this._statIds === undefined) this._statIds = await resolveStatIds(hass, cfg);
      if (request !== this._request) return;
      if (!this._statIds) {
        this._statsState = 'none';
        return;
      }
      const stats = await fetchStats(
        hass, this._statIds, this._period, this._offset, hass.language ?? 'en', this._w,
        Number(cfg.statistics?.max_power_kw) > 0 ? Number(cfg.statistics!.max_power_kw) : 100,
      );
      if (request !== this._request) return;
      this._stats = stats;
      this._statsState = 'ready';
    } catch (err) {
      if (request !== this._request) return;
      console.error('UltimatePower Card: statistics failed', err);
      this._statsState = 'error';
    }
  }

  private _setPeriod(kind: PeriodKind): void {
    if (kind === this._period) return;
    this._period = kind;
    this._offset = 0;
    this._tip = null;
    this._loadStats();
  }

  /** dir +1 = older period, −1 = newer. */
  private _page(dir: number): void {
    const next = Math.max(0, Math.min(MAX_OFFSET, this._offset + dir));
    if (next === this._offset) return;
    this._offset = next;
    this._tip = null;
    this._loadStats();
  }

  private _onPointerMove(e: PointerEvent): void {
    const i = (e.target as Element | null)?.getAttribute?.('data-i');
    this._tip = i === null || i === undefined ? null : Number(i);
  }

  private _onPointerUp(e: PointerEvent): void {
    if (this._swipeX === null) return;
    const dx = e.clientX - this._swipeX;
    this._swipeX = null;
    if (Math.abs(dx) > 50) this._page(dx > 0 ? 1 : -1);
  }

  private _renderStats(): TemplateResult {
    const t = this._w;
    const st = this._stats;
    return html`
      <div class="stats">
        <div class="seg" role="group">
          ${PERIODS.map(
            (p) => html`<button type="button" aria-pressed=${p === this._period ? 'true' : 'false'}
              @click=${() => this._setPeriod(p)}>${t[p]}</button>`,
          )}
        </div>
        ${this._statsState === 'none'
          ? html`<div class="note">${t.noStats}</div>`
          : this._statsState === 'error'
          ? html`<div class="note">${t.statsError}</div>`
          : !st
          ? html`<div class="note">${t.loading}</div>`
          : html`
              <div class="pager">
                <button type="button" aria-label=${t.prev} ?disabled=${this._offset >= MAX_OFFSET}
                  @click=${() => this._page(1)}>‹</button>
                <div class="pg-title">${st.title}</div>
                <button type="button" aria-label=${t.next} ?disabled=${this._offset === 0}
                  @click=${() => this._page(-1)}>›</button>
              </div>
              ${this._renderKpis(st)}
              <div class="legend">
                <span><i style="background:var(--up-chart-pos)"></i>${t.pvEnergy}</span>
                <span><i style="background:var(--up-chart-neg)"></i>${t.houseEnergy}</span>
                <span>kWh</span>
              </div>
              ${this._renderChart(st)}
              ${st.skipped ? html`<div class="note">${t.skipped.replace('{n}', String(st.skipped))}</div>` : nothing}
            `}
      </div>
    `;
  }

  private _renderKpis(st: StatsResult): TemplateResult {
    const t = this._w;
    const pv = sum(st.pv);
    const cons = sum(st.cons);
    const imp = sum(st.imp);
    const exp = sum(st.exp);
    const pct = (part: number, whole: number): [string, string] =>
      whole > 0 ? [this._num(Math.max(0, Math.min(100, (part / whole) * 100)), 0), '%'] : ['–', ''];
    const tiles: [string, [string, string], string][] = [
      [t.pvEnergy, this._energy(pv), 'var(--up-pos)'],
      [t.houseEnergy, this._energy(cons), 'var(--up-neg)'],
      [t.gridIn, this._energy(imp), 'var(--up-neg)'],
      [t.gridOut, this._energy(exp), 'var(--up-pos)'],
      [t.selfSufficiency, pct(cons - imp, cons), 'var(--up-pos)'],
      [t.selfConsumption, pct(pv - exp, pv), 'var(--up-pos)'],
    ];
    return html`
      <div class="kpis">
        ${tiles.map(
          ([label, [value, unit], color]) => html`
            <div class="kpi">
              <div class="k"><i style=${`background:${color}`}></i>${label}</div>
              <div class="val">${value}<small>${unit}</small></div>
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderChart(st: StatsResult): TemplateResult {
    const t = this._w;
    const W = 440;
    const H = 200;
    const m = { l: 36, r: 4, t: 8, b: 22 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const n = st.labels.length;
    const band = pw / n;

    const peak = Math.max(0.1, ...st.pv, ...st.cons);
    const raw = peak / 4;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const mant = raw / pow;
    const step = (mant <= 1 ? 1 : mant <= 2 ? 2 : mant <= 5 ? 5 : 10) * pow;
    const top = Math.ceil(peak / step) * step;
    const y = (v: number) => m.t + ph - (v / top) * ph;

    const bw = Math.max(2, Math.min(14, (band - 2) * 0.4));
    const gap = band > 12 ? 2 : 1;
    const bar = (x: number, v: number): string => {
      const h = y(0) - y(v);
      if (h <= 0) return '';
      const r = Math.min(4, bw / 2, h);
      const yy = y(v);
      return `M${x},${yy + h}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bw - r}Q${x + bw},${yy} ${x + bw},${yy + r}V${yy + h}Z`;
    };
    // Label every bar when they fit, otherwise every 3rd hour / 5th day.
    const tick = (i: number) => (n <= 12 ? true : n === 24 ? i % 3 === 0 : i === 0 || (i + 1) % 5 === 0);
    const ticks: number[] = [];
    for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);

    const tip = this._tip !== null && this._tip < n ? this._tip : null;
    const tipX = tip === null ? 0 : ((m.l + band * (tip + 0.5)) / W) * 100;

    return html`
      <div class="chart"
        @pointermove=${this._onPointerMove}
        @pointerdown=${(e: PointerEvent) => { this._swipeX = e.clientX; this._onPointerMove(e); }}
        @pointerup=${this._onPointerUp}
        @pointercancel=${() => { this._swipeX = null; }}
        @pointerleave=${() => { this._tip = null; }}>
        <svg viewBox="0 0 ${W} ${H}" role="img">
          ${ticks.map(
            (v) => svg`
              <line class="gl" x1=${m.l} x2=${W - m.r} y1=${y(v)} y2=${y(v)}></line>
              <text class="ax" x=${m.l - 6} y=${y(v) + 4} text-anchor="end">${this._num(v, step < 1 ? 1 : 0)}</text>
            `,
          )}
          ${st.labels.map((label, i) => {
            const cx = m.l + band * (i + 0.5);
            return svg`
              <path class="bar-pos" d=${bar(cx - gap / 2 - bw, st.pv[i])}></path>
              <path class="bar-neg" d=${bar(cx + gap / 2, st.cons[i])}></path>
              ${tick(i)
                ? svg`<text class="ax" x=${cx} y=${H - 6} text-anchor="middle">${label.replace(':00', '')}</text>`
                : nothing}
              <rect class="hit ${tip === i ? 'active' : ''}" data-i=${i}
                x=${m.l + band * i} y=${m.t} width=${band} height=${ph}></rect>
            `;
          })}
        </svg>
        ${tip === null
          ? nothing
          : html`
              <div class="tip ${tipX > 55 ? 'flip' : ''}" style=${`left:${tipX}%`}>
                <b>${st.labels[tip]}</b>
                <div><i style="background:var(--up-chart-pos)"></i>${t.pvEnergy}<span>${this._num(st.pv[tip], 1)} kWh</span></div>
                <div><i style="background:var(--up-chart-neg)"></i>${t.houseEnergy}<span>${this._num(st.cons[tip], 1)} kWh</span></div>
              </div>
            `}
      </div>
    `;
  }
}

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'ultimate-power-card',
  name: 'UltimatePower Card',
  description:
    'Power flow between solar, grid, batteries and the home, with multiple strings, batteries and appliances, plus energy statistics.',
  preview: false,
});

console.info(
  `%c UltimatePower-Card %c v${VERSION} `,
  'color:#8fe36a;background:#111112;font-weight:bold',
  'color:#ff7d33;background:#111112',
);
