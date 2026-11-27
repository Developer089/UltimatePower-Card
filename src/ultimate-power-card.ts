import { LitElement, html, svg, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { fireEvent, type HomeAssistant } from 'custom-card-helpers';

import { cardStyles } from './styles';
import { formatPower, resolveState } from './flow-calculator';
import type {
  ApplianceConfig,
  BatteryConfig,
  PVStringConfig,
  ResolvedState,
  UltimatePowerCardConfig,
} from './types';

const VERSION = '0.1.0';

const DEFAULTS = {
  threshold_in_k: 1, // switch to kW above 1 000 W
  animation_speed: 1,
  appliance_layout: 'fan' as const,
  pv_icon: 'mdi:solar-panel',
  grid_icon: 'mdi:transmission-tower',
  house_icon: 'mdi:home',
  battery_icon: 'mdi:battery',
  appliance_icon: 'mdi:power-plug',
};

@customElement('ultimate-power-card')
export class UltimatePowerCard extends LitElement {
  static styles = cardStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: UltimatePowerCardConfig;

  public setConfig(config: UltimatePowerCardConfig): void {
    if (!config.grid_entity) {
      throw new Error('grid_entity je povinná.');
    }
    this._config = { ...config };
  }

  public getCardSize(): number {
    return 5;
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this._config || !this.hass) return nothing;

    const cfg = this._config;
    const state = resolveState(this.hass, cfg);
    const showW = !!cfg.show_w_not_kw;
    const thr = cfg.threshold_in_k ?? DEFAULTS.threshold_in_k;

    return html`
      <ha-card>
        ${cfg.name ? html`<div class="title">${cfg.name}</div>` : nothing}
        ${this._renderPVRow(cfg.pv_strings ?? [], showW, thr)}
        ${this._renderMainCross(cfg, state, showW, thr)}
        ${this._renderBatteryRow(cfg.batteries ?? [], showW, thr)}
        <div style="font-size:10px;color:var(--up-muted);text-align:right;margin-top:8px;">
          v${VERSION}
        </div>
      </ha-card>
    `;
  }

  private _renderPVRow(
    strings: PVStringConfig[],
    showW: boolean,
    thr: number,
  ): TemplateResult {
    if (!strings.length) {
      return html`<div class="row"></div>`;
    }
    return html`
      <div class="row">
        ${strings.map((s) => {
          const w = this._w(s.power_entity);
          const daily = s.daily_energy_entity
            ? this.hass?.states?.[s.daily_energy_entity]?.state
            : undefined;
          const inactive = w < 5;
          return html`
            <div
              class="bubble pv size-m ${inactive ? 'inactive' : ''}"
              @click=${() => this._moreInfo(s.power_entity)}
            >
              <ha-icon icon=${s.icon ?? DEFAULTS.pv_icon}></ha-icon>
              ${daily
                ? html`<div class="extra">${daily} kWh</div>`
                : s.name
                ? html`<div class="extra">${s.name}</div>`
                : nothing}
              <div class="val">${formatPower(w, showW, thr)}</div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderMainCross(
    cfg: UltimatePowerCardConfig,
    s: ResolvedState,
    showW: boolean,
    thr: number,
  ): TemplateResult {
    const gridImport = s.grid_w >= 0;
    const gridLabel = `${gridImport ? '↓' : '↑'} ${formatPower(
      Math.abs(s.grid_w),
      showW,
      thr,
    )}`;
    return html`
      <div class="main-cross">
        <div
          class="bubble grid size-l ${Math.abs(s.grid_w) < 5 ? 'inactive' : ''}"
          @click=${() => this._moreInfo(cfg.grid_entity)}
        >
          <ha-icon icon=${cfg.grid_icon ?? DEFAULTS.grid_icon}></ha-icon>
          <div class="val">${gridLabel}</div>
        </div>
        <div></div>
        <div class="house-cluster">
          <div class="bubble house size-l">
            <ha-icon icon=${cfg.house_icon ?? DEFAULTS.house_icon}></ha-icon>
            <div class="val">${formatPower(s.house_w, showW, thr)}</div>
          </div>
          ${this._renderApplianceFan(cfg.appliances ?? [], showW, thr)}
        </div>
        ${this._renderFlowOverlay(s)}
      </div>
    `;
  }

  private _renderApplianceFan(
    apps: ApplianceConfig[],
    showW: boolean,
    thr: number,
  ): TemplateResult {
    if (!apps.length) return html``;
    const radiusPct = 50;
    const startDeg = -90; // top
    const sweep = apps.length === 1 ? 0 : 300; // 300° fan, leaves room on the inner side
    const step = apps.length === 1 ? 0 : sweep / (apps.length - 1);
    return html`
      <div class="appliance-fan">
        ${apps.map((a, i) => {
          const angle = ((startDeg + i * step) * Math.PI) / 180;
          const cx = 50 + radiusPct * Math.cos(angle);
          const cy = 50 + radiusPct * Math.sin(angle);
          const w = this._w(a.power_entity);
          const inactive = w < (a.on_threshold_w ?? 3);
          return html`
            <div
              class="bubble appliance size-s ${inactive ? 'inactive' : ''}"
              style=${`top:${cy}%; left:${cx}%; transform:translate(-50%,-50%);`}
              @click=${() => this._moreInfo(a.power_entity)}
            >
              <ha-icon icon=${a.icon ?? DEFAULTS.appliance_icon}></ha-icon>
              <div class="extra">${a.name}</div>
              <div class="val">${formatPower(w, showW, thr)}</div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderBatteryRow(
    bats: BatteryConfig[],
    showW: boolean,
    thr: number,
  ): TemplateResult {
    if (!bats.length) return html`<div class="row"></div>`;
    return html`
      <div class="row">
        ${bats.map((b) => {
          const w = this._w(b.power_entity);
          const soc = this._w(b.soc_entity); // 0-100
          const inactive = Math.abs(w) < 5;
          const dirArrow = w > 0 ? '↑' : w < 0 ? '↓' : '·';
          const circumference = 2 * Math.PI * 46;
          const offset = circumference * (1 - Math.max(0, Math.min(100, soc)) / 100);
          return html`
            <div
              class="bubble battery size-m ${inactive ? 'inactive' : ''}"
              @click=${() => this._moreInfo(b.power_entity)}
            >
              ${svg`
                <svg class="soc-ring" viewBox="0 0 100 100">
                  <circle class="track" cx="50" cy="50" r="46"></circle>
                  <circle class="progress" cx="50" cy="50" r="46"
                          stroke-dasharray=${circumference}
                          stroke-dashoffset=${offset}></circle>
                </svg>
              `}
              <ha-icon icon=${b.icon ?? DEFAULTS.battery_icon}></ha-icon>
              <div class="extra">
                ${b.name ? `${b.name} · ` : ''}${Math.round(soc)} %
              </div>
              <div class="val">
                ${dirArrow} ${formatPower(Math.abs(w), showW, thr)}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderFlowOverlay(s: ResolvedState): TemplateResult {
    const speed = (this._config?.animation_speed ?? DEFAULTS.animation_speed) * 1;
    const dur = (k: number) => `${(2.5 / Math.max(0.1, speed) / Math.max(0.1, k)).toFixed(2)}s`;
    const active = (v: number) => v > 5;

    return html`
      ${svg`
      <svg class="flows" viewBox="0 0 720 220" preserveAspectRatio="none">
        <path id="up-grid-house" class="flow-line grid"
          d="M180 110 L 540 110" />
        <path id="up-pv-house" class="flow-line pv"
          d="M360 0 C 360 60, 540 100, 540 110" />
        <path id="up-pv-bat" class="flow-line pv"
          d="M360 0 C 360 80, 360 160, 360 220" />
        <path id="up-bat-house" class="flow-line battery"
          d="M360 220 C 540 220, 540 130, 540 110" />

        ${active(s.flows.grid_to_house) ? svg`
          <circle class="flow-dot grid" r="3.5">
            <animateMotion dur=${dur(s.flows.grid_to_house / 1000)} repeatCount="indefinite">
              <mpath href="#up-grid-house"/>
            </animateMotion>
          </circle>
        ` : ''}
        ${active(s.flows.pv_to_house) ? svg`
          <circle class="flow-dot pv" r="3.5">
            <animateMotion dur=${dur(s.flows.pv_to_house / 1000)} repeatCount="indefinite">
              <mpath href="#up-pv-house"/>
            </animateMotion>
          </circle>
        ` : ''}
        ${active(s.flows.pv_to_battery) ? svg`
          <circle class="flow-dot pv" r="3.5">
            <animateMotion dur=${dur(s.flows.pv_to_battery / 1000)} repeatCount="indefinite">
              <mpath href="#up-pv-bat"/>
            </animateMotion>
          </circle>
        ` : ''}
        ${active(s.flows.battery_to_house) ? svg`
          <circle class="flow-dot battery" r="3.5">
            <animateMotion dur=${dur(s.flows.battery_to_house / 1000)} repeatCount="indefinite">
              <mpath href="#up-bat-house"/>
            </animateMotion>
          </circle>
        ` : ''}
      </svg>
      `}
    `;
  }

  private _w(entity?: string): number {
    if (!entity || !this.hass) return 0;
    const st = this.hass.states?.[entity];
    if (!st) return 0;
    const v = parseFloat(st.state);
    if (isNaN(v)) return 0;
    const unit = (st.attributes?.unit_of_measurement || '').toLowerCase();
    return unit === 'kw' ? v * 1000 : v;
  }

  private _moreInfo(entity?: string): void {
    if (!entity) return;
    fireEvent(this, 'hass-more-info', { entityId: entity });
  }
}

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'ultimate-power-card',
  name: 'UltimatePower Card',
  description:
    'Tesla-style power flow card with multi-PV, multi-battery and multi-appliance support.',
  preview: false,
});

console.info(
  `%c UltimatePower-Card %c v${VERSION} `,
  'color:#3ddc97;background:#0d0d12;font-weight:bold',
  'color:#ff9b1f;background:#0d0d12',
);
