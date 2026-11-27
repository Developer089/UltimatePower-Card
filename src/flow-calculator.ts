import type { BatteryConfig, HassLike, ResolvedState, UltimatePowerCardConfig } from './types';

/** Power of an entity in watts; 0 when it is missing or not numeric. */
export const readPower = (hass: HassLike, entity?: string): number => {
  if (!entity) return 0;
  const s = hass.states?.[entity];
  if (!s) return 0;
  const v = parseFloat(s.state);
  if (isNaN(v)) return 0;
  const unit = (s.attributes?.unit_of_measurement || '').toLowerCase();
  return unit === 'kw' ? v * 1000 : v;
};

/** Battery power in watts, positive = discharging. */
export const readBattery = (hass: HassLike, b: BatteryConfig): number =>
  readPower(hass, b.power_entity) * (b.invert ? -1 : 1);

export const resolveState = (
  hass: HassLike,
  config: UltimatePowerCardConfig,
): ResolvedState => {
  const pv_total_w = Math.max(
    0,
    config.pv_total_entity
      ? readPower(hass, config.pv_total_entity)
      : (config.pv_strings ?? []).reduce((sum, s) => sum + readPower(hass, s.power_entity), 0),
  );

  const battery_total_w = config.battery_total_entity
    ? readPower(hass, config.battery_total_entity) * (config.battery_invert ? -1 : 1)
    : (config.batteries ?? []).reduce((sum, b) => sum + readBattery(hass, b), 0);

  const grid_w = config.grid_export_entity
    ? readPower(hass, config.grid_entity) - readPower(hass, config.grid_export_entity)
    : readPower(hass, config.grid_entity) * (config.grid_invert ? -1 : 1);

  // The house load is never read from a sensor; it follows from the energy
  // balance: everything produced, imported and discharged that is not exported
  // or stored is consumed. Clamped at 0 because sensors update out of sync.
  const house_w = Math.max(0, pv_total_w + grid_w + battery_total_w);

  return { pv_total_w, grid_w, house_w, battery_total_w };
};
