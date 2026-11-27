import type { HassLike, ResolvedFlow, ResolvedState, UltimatePowerCardConfig } from './types';

const num = (hass: HassLike, entity?: string): number => {
  if (!entity) return 0;
  const s = hass.states?.[entity];
  if (!s) return 0;
  const v = parseFloat(s.state);
  if (isNaN(v)) return 0;
  const unit = (s.attributes?.unit_of_measurement || '').toLowerCase();
  return unit === 'kw' ? v * 1000 : v;
};

export const resolveState = (
  hass: HassLike,
  config: UltimatePowerCardConfig,
): ResolvedState => {
  const pvFromStrings = (config.pv_strings ?? []).reduce(
    (sum, s) => sum + num(hass, s.power_entity),
    0,
  );
  const pv_total_w = config.pv_total_entity
    ? num(hass, config.pv_total_entity)
    : pvFromStrings;

  const batteryFromArr = (config.batteries ?? []).reduce(
    (sum, b) => sum + num(hass, b.power_entity),
    0,
  );
  const battery_total_w = config.battery_total_entity
    ? num(hass, config.battery_total_entity)
    : batteryFromArr;

  const batSocs = (config.batteries ?? [])
    .map((b) => num(hass, b.soc_entity))
    .filter((v) => v > 0);
  const battery_avg_soc = config.battery_total_soc_entity
    ? num(hass, config.battery_total_soc_entity)
    : batSocs.length
    ? batSocs.reduce((s, v) => s + v, 0) / batSocs.length
    : 0;

  const grid_import = num(hass, config.grid_entity);
  const grid_export = num(hass, config.grid_export_entity);
  const grid_w = config.grid_export_entity
    ? grid_import - grid_export
    : grid_import; // signed: + import / - export
  // The house load is never read from a sensor; it follows from the energy
  // balance: everything produced, imported and discharged that is not exported
  // or stored is consumed. Clamped at 0 because sensors update out of sync.
  const house_w = Math.max(0, pv_total_w + grid_w + battery_total_w);

  const flows = computeFlows({
    pv: pv_total_w,
    grid: grid_w,
    battery: battery_total_w,
    house: house_w,
  });

  return { pv_total_w, grid_w, house_w, battery_total_w, battery_avg_soc, flows };
};

const computeFlows = ({
  pv,
  grid,
  battery,
  house,
}: {
  pv: number;
  grid: number;
  battery: number;
  house: number;
}): ResolvedFlow => {
  const battery_charging = Math.max(0, -battery);
  const battery_discharging = Math.max(0, battery);
  const grid_import = Math.max(0, grid);
  const grid_export = Math.max(0, -grid);

  const pv_to_house = Math.max(0, Math.min(pv, house));
  const pv_remainder_after_house = Math.max(0, pv - pv_to_house);
  const pv_to_battery = Math.min(pv_remainder_after_house, battery_charging);
  const pv_to_grid = Math.max(0, pv_remainder_after_house - pv_to_battery);

  const house_remainder = Math.max(0, house - pv_to_house);
  const battery_to_house = Math.min(battery_discharging, house_remainder);
  const grid_to_house = Math.max(0, house_remainder - battery_to_house);

  const grid_remaining_after_house = Math.max(0, grid_import - grid_to_house);
  const grid_to_battery = Math.min(
    grid_remaining_after_house,
    Math.max(0, battery_charging - pv_to_battery),
  );

  const battery_to_grid = Math.max(
    0,
    Math.min(
      Math.max(0, battery_discharging - battery_to_house),
      grid_export - pv_to_grid,
    ),
  );

  return {
    pv_to_house,
    pv_to_battery,
    pv_to_grid,
    grid_to_house,
    grid_to_battery,
    battery_to_house,
    battery_to_grid,
  };
};

export const formatPower = (
  watts: number,
  showW: boolean,
  thresholdK: number,
): string => {
  const abs = Math.abs(watts);
  if (showW || abs < thresholdK * 1000) {
    return `${Math.round(watts)} W`;
  }
  return `${(watts / 1000).toFixed(2)} kW`;
};
