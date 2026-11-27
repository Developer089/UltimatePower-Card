import type { HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';

export interface PVStringConfig {
  power_entity: string;
  name?: string;
}

export interface BatteryConfig {
  power_entity: string;
  soc_entity: string;
  name?: string;
  /** Set when the sensor reports charging as a positive value. */
  invert?: boolean;
}

export interface ApplianceConfig {
  power_entity: string;
  name: string;
  on_threshold_w?: number;
}

/** Energy (kWh) statistics used by the balance section. Each may be one id or a list. */
export interface StatisticsConfig {
  pv?: string | string[];
  grid_import?: string | string[];
  grid_export?: string | string[];
  battery_charge?: string | string[];
  battery_discharge?: string | string[];
}

export interface UltimatePowerCardConfig extends LovelaceCardConfig {
  type: string;
  name?: string;

  // Hubs
  /** Grid power. Positive = import, negative = export. */
  grid_entity: string;
  /** Only when import and export are two separate, always-positive sensors. */
  grid_export_entity?: string;
  /** Set when the grid sensor reports export as a positive value. */
  grid_invert?: boolean;
  pv_total_entity?: string;
  battery_total_entity?: string;
  /** Set when battery_total_entity reports charging as a positive value. */
  battery_invert?: boolean;

  // Multi-arrays
  pv_strings?: PVStringConfig[];
  batteries?: BatteryConfig[];
  appliances?: ApplianceConfig[];

  // Visual options
  show_w_not_kw?: boolean;
  /**
   * auto (default) follows the system "reduce motion" setting, always animates
   * regardless of it, off never animates.
   */
  animation?: 'auto' | 'always' | 'off';
  /** Multiplier for the flow animation speed. Default 1. */
  animation_speed?: number;
  /** Power (W) at which the flow animation reaches full speed. Default 10000. */
  max_power?: number;
  /** Show the computed remainder of the house load as an extra appliance. Default true. */
  show_other?: boolean;

  // Statistics
  /** Show the balance section with paging. Default true. */
  show_statistics?: boolean;
  /** Overrides the sensors taken from the Home Assistant Energy dashboard. */
  statistics?: StatisticsConfig;
}

export interface ResolvedState {
  pv_total_w: number;
  grid_w: number;          // positive = import, negative = export
  house_w: number;
  battery_total_w: number; // positive = discharging, negative = charging
}

export type HassLike = HomeAssistant;
