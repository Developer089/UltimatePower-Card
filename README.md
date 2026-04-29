# UltimatePower Card

A Home Assistant Lovelace custom card that visualises real-time power flow between **multiple PV strings**, **multiple batteries**, the grid, and the home — with a Tesla-style bubble layout and animated flows.

> **Status:** 🚧 early development (v0.x). API may change before the first stable release.

## Why another power card?

Existing cards (`tesla-style-solar-power-card`, `power-flow-card-plus`, `power-flux-card`, …) all assume **one** battery and a small fixed number of consumers. UltimatePower Card targets larger residential / small-commercial setups where you have:

- 🟧 **N PV strings / inverters** — see each one separately
- 🟩 **N batteries side by side** — every module's SoC + power visible at a glance
- 🟦 **One main house bubble** + **N appliance branches** (boiler, EV, heat-pump, kitchen circuits, server rack, …)
- ⬜ Grid (import / export)

## Features (planned for v0.1.0)

- [ ] Render N PV bubbles in a top row (orange)
- [ ] Render N battery bubbles in a bottom row (green) with radial SoC progress
- [ ] Render house bubble with radial fan of N appliances (blue)
- [ ] Grid bubble (white) with import/export direction
- [ ] Auto-derived flow lines between hubs (no need to wire each of the 7 flows manually)
- [ ] Animated flow particles (SVG `animateMotion`)
- [ ] Configurable thresholds, colours, icons
- [ ] Click-through to HA `more-info` dialog
- [ ] Visual config editor

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
house_entity: sensor.house_consumption

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

Full options reference will live in [`docs/configuration.md`](docs/configuration.md) once the v0.1 schema is locked.

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
