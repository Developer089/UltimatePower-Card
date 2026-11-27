# UltimatePower Card

A Home Assistant Lovelace custom card that visualises real-time power flow between **multiple PV strings**, **multiple batteries**, the grid, and the home — with a Tesla-style bubble layout and animated flows.

> **Status:** 🚧 early development (v0.x). API may change before the first stable release.

## Why another power card?

Existing cards (`tesla-style-solar-power-card`, `power-flow-card-plus`, `power-flux-card`, …) all assume **one** battery and a small fixed number of consumers. UltimatePower Card targets larger residential / small-commercial setups where you have:

- 🟧 **N PV strings / inverters** — see each one separately
- 🟩 **N batteries side by side** — every module's SoC + power visible at a glance
- 🟦 **One main house bubble** + **N appliance branches** (boiler, EV, heat-pump, kitchen circuits, server rack, …)
- ⬜ Grid (import / export)

## Features (v0.2)

- Four main nodes in a cross around a central hub: production, consumption, battery and grid. The card fits one dashboard column.
- N PV strings in a row above production; N batteries (with a state-of-charge ring) and N appliances as chains below their node.
- Green marks own energy (production, battery, export), orange marks consumption and grid import. Idle nodes turn grey.
- Animated flow: dots run from the source to the consumer and speed up steeply with power. A node that supplies energy pulses outwards, a node that draws energy pulses inwards.
- House load is computed from PV, grid and battery; the remainder not covered by appliances is shown as "Other".
- Optional statistics: production, consumption, grid import/export, self-sufficiency and self-consumption per day, week, month or year, with paging into the past (arrows or swipe on the chart).
- Click-through to the HA `more-info` dialog. Czech and English labels, light and dark theme.

Not yet: visual config editor, custom colours and icons.

## Installation

### Via HACS (recommended once published)

1. HACS → Frontend → **⋮** → Custom repositories → add `Developer089/UltimatePower-Card` (type: Lovelace)
2. Install **UltimatePower Card**
3. Add the resource (HACS does this automatically) and refresh

### Manual

1. Download `ultimate-power-card.js` from the [latest release](https://github.com/Developer089/UltimatePower-Card/releases)
2. Copy to `/config/www/community/ultimate-power-card/`
3. Add a Lovelace resource: `/local/community/ultimate-power-card/ultimate-power-card.js` (type: `module`)

## Configuration

Minimal example:

```yaml
type: custom:ultimate-power-card
name: My Power
grid_entity: sensor.grid_power

pv_strings:
  - { power_entity: sensor.pv_east, name: East }
  - { power_entity: sensor.pv_west, name: West }

batteries:
  - { power_entity: sensor.bat1_power, soc_entity: sensor.bat1_soc, name: BMS-1 }
  - { power_entity: sensor.bat2_power, soc_entity: sensor.bat2_soc, name: BMS-2 }
  - { power_entity: sensor.bat3_power, soc_entity: sensor.bat3_soc, name: BMS-3 }

appliances:
  - { power_entity: sensor.boiler_power,    name: Boiler,  icon: mdi:water-boiler }
  - { power_entity: sensor.ev_charger,      name: EV,      icon: mdi:car-electric }
  - { power_entity: sensor.heatpump_power,  name: HP,      icon: mdi:heat-pump }
  - { power_entity: sensor.kitchen_circuit, name: Kuchyň,  icon: mdi:silverware-fork-knife }
```

There is no house sensor to configure. The card derives the house load from the energy balance: `PV + grid + battery`, where grid is positive on import and battery is positive on discharge. On the consumption side you only list the individual appliances.

### Options

| Option | Default | Meaning |
|---|---|---|
| `grid_entity` | required | Grid power. Positive = import, negative = export. |
| `grid_export_entity` | – | Only when import and export are two separate, always-positive sensors. |
| `grid_invert` | `false` | Set when the grid sensor reports export as positive. |
| `pv_strings[]` | – | `power_entity`, optional `name`. |
| `pv_total_entity` | sum of strings | Total PV power, if you have a dedicated sensor. |
| `batteries[]` | – | `power_entity` (positive = discharging), `soc_entity`, optional `name`, `invert`. |
| `battery_total_entity`, `battery_invert` | sum of batteries | Total battery power and its sign switch. |
| `appliances[]` | – | `power_entity`, `name`, optional `on_threshold_w`. |
| `show_other` | `true` | Show the computed remainder of the house load. |
| `animation` | `auto` | `auto` follows the system "reduce motion" setting, `always` ignores it, `off` never animates. |
| `animation_speed` | `1` | Multiplier for the flow speed. |
| `max_power` | `10000` | Power (W) at which the flow reaches full speed. |
| `show_w_not_kw` | `false` | Always show watts. |
| `show_statistics` | `true` | Show the balance section. |
| `statistics` | Energy dashboard | Override the energy sensors: `pv`, `grid_import`, `grid_export`, `battery_charge`, `battery_discharge` (one id or a list each). |

Statistics read Home Assistant long-term statistics, so the energy sensors must be in kWh with `state_class: total_increasing`. Without the `statistics` option the card uses the sensors configured in the Energy dashboard.

## Development

```bash
npm install
npm run watch     # rebuilds on save into dist/
```

Then symlink (or copy) `dist/ultimate-power-card.js` into `/config/www/` of your dev Home Assistant.

## Roadmap

- v0.1 — visual MVP (this milestone)
- v0.2 — visual config editor
- v0.3 — `flow_diagram_mode` (line thickness ∝ power), forecast overlay
- v0.4 — battery runtime / autonomy estimate, dynamic-pricing tint

## License

Apache License 2.0 — see [LICENSE](LICENSE). Visual inspiration from the Tesla Powerwall app and from the `tesla-style-solar-power-card` project (also Apache-2.0).
