# Rešerše alternativ + návrh designu „UltimatePower Card“

> **Datum:** 2026-04-29
> **Vstup:** uživatelský náčrtek (`research/sketch-user.png` — popis viz §1)
> **Výstup:** vyhodnocení existujících karet vs. požadavky + design vlastní karty

---

## 1. Co uživatel chce (z náčrtku)

| Prvek | Barva | Pozice v náčrtku | Počet | Význam |
|---|---|---|---|---|
| PV / Solar | **oranžová** | nahoře (1 hlavní + 1 prázdná) | **N (≥1)** | jednotlivé stringy/měniče FVE, hodnota v kW + denní výroba (`93.115t` = 93,115 kWh) |
| Baterie | **zelená** | spodek (3 prázdné + 1 s daty „10 % / 0 W“) | **N (≥1)** | každý bateriový modul zvlášť — SoC + výkon nabíjení/vybíjení |
| Grid | **bílá** | levý střed | 1 | odběr/dodávka do sítě |
| House (hlavní) | **modrá** | pravý střed (9,2 kW) | 1 | celková spotřeba domu |
| Spotřebiče (větve domu) | **modré, menší/poloviční** | radiálně kolem House | **N (≥1)** | jednotlivé okruhy (boiler 1,1 kW, klima, wallbox, FVE řízení, …) |

### Klíčové požadavky odlišné od Tesla-style karty
1. **Více baterií současně** (Tesla card: 1).
2. **Neomezený počet podspotřebičů** kolem domu (Tesla card: 2; power-flow-card-plus: 4).
3. **Více PV stringů/měničů** (Tesla card: 1 generation).
4. Vzhled ve stylu Tesla — neon outlined kruhy, animované toky.

---

## 2. Vyhodnocení existujících karet

| Karta | Multi-battery | Multi-appliance | Multi-PV | Aktivní vývoj | Verdikt |
|---|---|---|---|---|---|
| **reptilex/tesla-style-solar-power-card** | ❌ 1 | ⚠️ 2 | ❌ 1 | 🟡 v1.4 (06/2024) | Nestačí |
| **flixlix/power-flow-card-plus** | ❌ 1 | ⚠️ 4 | ⚠️ 1 (ext. items) | 🟢 aktivní | Nestačí |
| **flixlix/energy-flow-card-plus** | ❌ 1 | ⚠️ 4 | ⚠️ 1 | 🟢 aktivní | Nestačí (energy ne power) |
| **jayjojayson/power-flux-card** | ❌ 1 | ⚠️ 3-5 | ❌ 1 | 🟢 v2.5 (03/2026) | Nestačí, ale pěkná animace |
| **sameeraman/ha-modern-solar-energy-card** | ❌ 1 | ❌ 0 | ❌ 1 | 🟡 | Nestačí |
| **Energy Sankey** | ✅ ano | ✅ ano | ✅ ano | 🟢 | Sankey diagram, ne bublinový styl |

### Závěr
**Žádná existující karta** nesplňuje kombinaci **multi-battery + multi-appliance + Tesla bublinový styl**. Energy Sankey podporuje vše, ale jiný vizuální paradigma (proudy, ne bubliny).

→ Nutno vytvořit **vlastní kartu**. Tesla-style-solar-power-card slouží jako vizuální inspirace, ne základ pro fork (datový model je rigidní).

---

## 3. Návrh designu — „UltimatePower Card“

### 3.1 Layout (responsive grid)

```
┌─────────────────────────────────────────────────────────┐
│  TOP — ŘADA ORANŽOVÝCH PV BUBLIN (1..N)                 │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                     │
│  │ PV1 │  │ PV2 │  │ PV3 │  │ ... │                     │
│  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘                     │
│     └─────┬──┴────────┴────────┘                        │
│           ▼ (souhrnný flow do hubu)                     │
│                                                         │
│  STŘED — kříž hlavních hubů                             │
│       ┌───────────────┐                                 │
│       │   ☀ PV TOTAL  │  (volitelný souhrn všech PV)    │
│       └───────┬───────┘                                 │
│  ┌────────┐   │   ┌──────────┐    ┌───┐                 │
│  │  GRID  │◄──┼──►│   HOUSE  │◄──►│A1 │ (appliance 1)   │
│  └────────┘   │   └────┬─────┘    └───┘                 │
│               │        ▼ ▲              \  radiálně     │
│       ┌───────▼────────┐               ┌──┐  ┌──┐  ┌──┐ │
│       │  🔋 BAT TOTAL  │               │A2│  │A3│  │..│ │
│       └────────────────┘               └──┘  └──┘  └──┘ │
│                                                         │
│  BOTTOM — ŘADA ZELENÝCH BATERIÍ (1..N)                  │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                     │
│  │BAT1 │  │BAT2 │  │BAT3 │  │ ... │                     │
│  │ 95% │  │ 87% │  │ 91% │  │     │                     │
│  └─────┘  └─────┘  └─────┘  └─────┘                     │
│      └───────┴────────┴────────┘ → BAT TOTAL            │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Datový model (interní)

```ts
interface UltimatePowerCardConfig {
  // Středové huby (volitelné — pokud chybí, agreguje se z polí)
  pv_total_entity?: string;        // souhrn FVE výkonu
  battery_total_entity?: string;   // souhrn baterií
  battery_total_soc_entity?: string;
  grid_entity: string;             // odběr ze sítě (kladně = import)
  grid_export_entity?: string;     // dodávka (kladně = export)
  house_entity: string;            // celková spotřeba domu

  // Pole jednotlivců — neomezený počet
  pv_strings: PVConfig[];          // 1..N panelů/měničů/stringů
  batteries: BatteryConfig[];      // 1..N baterií
  appliances: ApplianceConfig[];   // 1..N podspotřebičů

  // Vzhled
  theme?: { pv: string; grid: string; battery: string; house: string };
  animation_speed?: number;
  layout_mode?: 'compact' | 'expanded';
  appliance_layout?: 'fan' | 'grid' | 'list';
}

interface PVConfig {
  power_entity: string;            // aktuální výkon (W/kW)
  daily_energy_entity?: string;    // dnešní výroba (kWh)
  name?: string;
  icon?: string;
}

interface BatteryConfig {
  power_entity: string;            // ± výkon (kladně = vybíjení / záporně = nabíjení, nebo separátně)
  charge_entity?: string;
  discharge_entity?: string;
  soc_entity: string;              // 0-100 %
  capacity_kwh?: number;           // volitelné — pro výpočet runtime
  name?: string;
}

interface ApplianceConfig {
  power_entity: string;            // aktuální spotřeba (W/kW)
  name: string;
  icon?: string;
  on_threshold_w?: number;         // práh "spotřebič běží"
  color?: string;                  // override default modré
}
```

### 3.3 Toky energie (animované) — odvozené, nikoliv konfigurované

Tesla-style card vyžaduje, aby uživatel definoval **každý ze 7 toků zvlášť**. To je opruz. **Náš model bude toky dopočítávat:**

| Tok | Výpočet |
|---|---|
| PV → House | `min(pv_total, house)` (po odečtení nabíjení baterie) |
| PV → Battery | `max(0, pv_total - house)` omezeno na `battery.charging` |
| PV → Grid | `max(0, pv_total - house - battery_charge)` |
| Grid → House | pokud `pv_total < house` |
| Grid → Battery | pokud `grid_import > 0 ∧ battery.charging > 0 ∧ pv < charge` |
| Battery → House | pokud `battery.discharging > 0` |
| Battery → Grid | (vzácný) pokud `discharging > house` |

→ uživatel zadá **jen měřené entity** (PV výkon, grid bilanci, baterie ±, house total) a karta toky odvodí.

### 3.4 Vizuální specifikace

| Aspekt | Hodnota |
|---|---|
| Pozadí | `#0d0d12` (téměř černá) |
| Border bublin | 3 px stroke, barva podle typu |
| Výplň bublin | průhledná, jen ikona + text |
| Velikost hlavní bubliny | 96 px |
| Velikost vedlejší (PV/BAT v řadě) | 72 px |
| Velikost appliance bubliny | 56 px (poloviční) |
| Font | Inter / system, 12-14 px |
| Ikona | Material Design Icons (`mdi:`) |
| Animace toku | SVG `<circle>` puntíky podél `<path>`, anim 1-3 s podle `speed_factor` |
| Tloušťka čáry | proporcionální výkonu (volitelné `flow_diagram_mode`) |
| Aktivní/neaktivní | neaktivní = 30 % opacity, žádné puntíky |
| SoC indikace | radiální progress kolem battery bubliny |
| Hover | `more-info` dialog z HA |

### 3.5 Barevná paleta

```css
--up-pv:        #ff9b1f;  /* oranžová */
--up-pv-glow:   rgba(255,155,31,0.35);
--up-grid:      #e8e8ee;  /* bílá */
--up-grid-glow: rgba(232,232,238,0.25);
--up-battery:   #3ddc97;  /* zelená */
--up-battery-glow:  rgba(61,220,151,0.35);
--up-house:     #4ea8ff;  /* modrá */
--up-house-glow: rgba(78,168,255,0.30);
--up-appliance: #6ec5ff;  /* světlejší modrá pro spotřebiče */
--up-bg:        #0d0d12;
--up-text:      #f5f5fa;
--up-muted:     #6a6a78;
```

---

## 4. Technická volba

| Otázka | Volba | Důvod |
|---|---|---|
| Framework | **LitElement + TypeScript** | standard pro HA custom cards, malý bundle |
| Bundling | **Rollup** (kompatibilní s reptilex) nebo **Vite** | Vite rychlejší dev, Rollup běžný |
| SVG vs. Canvas | **SVG** | rozumný počet prvků (<100), DOM manipulace, snadná animace přes CSS |
| Animace | **CSS `@keyframes` + SVG `<animateMotion>`** kombinace | žádné JS rAF — šetří CPU |
| Layout strategie | **CSS Grid pro vrstvy + SVG overlay pro flow lines** | bubliny jsou DOM, čáry jsou SVG nad nimi |
| Distribuce | HACS kompatibilita (`hacs.json`, single JS bundle) | snadná instalace |

---

## 5. Vstupy do dalšího kroku

1. **Mockup HTML** (`design/mockup.html`) — statický náhled UI s figurálními daty (přiloženo).
2. **Wireframe variant** — kompaktní vs. expanded vs. „energy diagram“ mód.
3. **Konfigurace na cílovém HA** — sken existujících entit přes SSH na `192.168.254.122`:
   ```bash
   ssh root@192.168.254.122 "ha core api /api/states | jq '.[] | select(.attributes.device_class==\"power\") | .entity_id'"
   ```
4. **Repo struktura** (návrh):
   ```
   UltimatePower-Card/
   ├── src/
   │   ├── ultimate-power-card.ts
   │   ├── components/
   │   │   ├── pv-bubble.ts
   │   │   ├── battery-bubble.ts
   │   │   ├── house-bubble.ts
   │   │   ├── grid-bubble.ts
   │   │   ├── appliance-bubble.ts
   │   │   └── flow-line.ts
   │   ├── flow-calculator.ts
   │   ├── types.ts
   │   └── styles.ts
   ├── design/
   │   └── mockup.html        ← vizuální mockup
   ├── research/              ← rešerše (zde)
   ├── rollup.config.js
   ├── hacs.json
   └── package.json
   ```

---

## 6. Otevřené otázky pro uživatele

1. **Souhrnný PV/BAT hub** uprostřed — chcete ho navíc, nebo stačí jen řada jednotlivých?
2. **Layout spotřebičů**: vějíř (radial), grid 2D, nebo seznam?
3. **Limitní počty**: má cena řešit i 20+ baterií / 30+ spotřebičů, nebo cílit max ~10 každého?
4. **Měření přepočtu**: máte všude **kladné** entity, nebo budou potřeba template senzory?
5. **Doplňky**: forecast, runtime baterie, dynamická cena el. — chcete v této kartě, nebo jako separátní?

---

## 7. Zdroje

- power-flow-card-plus: <https://github.com/flixlix/power-flow-card-plus>
- energy-flow-card-plus: <https://github.com/flixlix/energy-flow-card-plus>
- power-flux-card: <https://github.com/jayjojayson/power-flux-card>
- ha-modern-solar-energy-card: <https://github.com/sameeraman/ha-modern-solar-energy-card>
- Energy Sankey HA Community: <https://community.home-assistant.io/t/energy-power-flow-with-generation-and-battery-monitoring-live-sankey-charts/863230>
- Diskuze multiple individuals: <https://community.home-assistant.io/t/power-flow-card-plus-multiple-individual-items/674451>
- Issue „více než 4 individuals“: <https://github.com/flixlix/power-flow-card-plus/issues/805>
