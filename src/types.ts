import type { HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';

export interface PVStringConfig {
  power_entity: string;
  daily_energy_entity?: string;
  name?: string;
  icon?: string;
  color?: string;
}

export interface BatteryConfig {
  power_entity: string;
  soc_entity: string;
  charge_entity?: string;
  discharge_entity?: string;
  capacity_kwh?: number;
  name?: string;
  icon?: string;
  color?: string;
}

export interface ApplianceConfig {
  power_entity: string;
  name: string;
  icon?: string;
  on_threshold_w?: number;
  color?: string;
}

export interface UltimatePowerCardConfig extends LovelaceCardConfig {
  type: string;
  name?: string;

  // Hubs
  grid_entity: string;
  grid_export_entity?: string;
  pv_total_entity?: string;
  battery_total_entity?: string;
  battery_total_soc_entity?: string;

  // Multi-arrays
  pv_strings?: PVStringConfig[];
  batteries?: BatteryConfig[];
  appliances?: ApplianceConfig[];

  // Visual options
  show_w_not_kw?: boolean;
  threshold_in_k?: number;
  animation_speed?: number;
  hide_inactive_lines?: boolean;
  appliance_layout?: 'fan' | 'grid' | 'list';

  // Icons
  grid_icon?: string;
  house_icon?: string;
  pv_icon?: string;
  battery_icon?: string;
}

export interface ResolvedFlow {
  pv_to_house: number;
  pv_to_battery: number;
  pv_to_grid: number;
  grid_to_house: number;
  grid_to_battery: number;
  battery_to_house: number;
  battery_to_grid: number;
}

export interface ResolvedState {
  pv_total_w: number;
  grid_w: number;          // positive = import, negative = export
  house_w: number;
  battery_total_w: number; // positive = discharging, negative = charging
  battery_avg_soc: number;
  flows: ResolvedFlow;
}

export type HassLike = HomeAssistant;
