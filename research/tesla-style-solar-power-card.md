# Tesla-Style Solar Power Card — Rešerše integrace do Home Assistant

> **Datum rešerše:** 2026-04-29

---

## 1. O projektu

**Tesla-Style Solar Power Card** je custom Lovelace karta pro Home Assistant, která vizualizuje toky energie (grid ↔ solar ↔ baterie ↔ dům) ve stylu aplikace Tesla Powerwall — bubliny s ikonami a animovanými proudícími body mezi nimi.

### 1.1 Repozitáře
| Verze | URL | Poznámka |
|---|---|---|
| **Hlavní (udržovaná)** | https://github.com/reptilex/tesla-style-solar-power-card | Originální autor reptilex |
| Fork | https://github.com/riddik14/tesla-style-solar-power-card | Starší fork |

### 1.2 Metadata hlavního repa
- **Poslední release:** v1.4 — *„Corrected sizing for HA 2024.6.x“* (23. 6. 2024)
- **Licence:** Apache License 2.0
- **Jazyk:** TypeScript (98,2 %)
- **Hvězdičky:** ~249, **forky:** ~63, **otevřené issues:** ~59
- **Build:** Rollup, registrace v `hacs.json`

### 1.3 Inspirace
- Bessarabov's animated consumption card
- Boilerplate card framework
- Power-wheel-card

---

## 2. Architektura — toky energie

Karta sleduje **7 hlavních toků** + 4 hlavní bubliny + 2 volitelné spotřebiče:

```
                ┌─────────┐
                │   PV    │ (generation)
                └────┬────┘
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
   ┌─────┐       ┌─────┐       ┌──────┐
   │ GRID│◄─────►│HOUSE│◄─────►│BATTERY│
   └─────┘       └─────┘       └──────┘
                  │   │
              app1│   │app2  (volitelné: EV, topení, …)
```

### 2.1 Sedm primárních toků (entity)
1. `generation_to_grid_entity` — PV → síť (export)
2. `generation_to_battery_entity` — PV → baterie
3. `generation_to_house_entity` — PV → dům (vlastní spotřeba)
4. `grid_to_battery_entity` — síť → baterie
5. `grid_to_house_entity` — síť → dům (import)
6. `battery_to_grid_entity` — baterie → síť
7. `battery_to_house_entity` — baterie → dům

> **KRITICKÉ:** *„You have to define the FLOWS AGAIN!! Without defining each flow no line will show.“*
> Pokud nedefinujete daný tok, animovaná čára pro něj se vůbec nezobrazí — i kdyby existovaly bublinové entity.

---

## 3. Instalace

### 3.1 Přes HACS (doporučeno)
1. Mít nainstalovaný HACS.
2. HACS → Frontend → *Explore & Add Repositories*.
3. Hledat `tesla style`.
4. Vybrat *tesla-style-solar-power-card* → **Download**.
5. Refresh Home Assistantu (občas nutný restart + clear cache prohlížeče).

### 3.2 Manuální instalace
1. Stáhnout `tesla-style-solar-power-card.js` z release.
2. Nahrát do `/config/www/` (nebo `/config/www/community/tesla-style-solar-power-card/`).
3. V Lovelace `Resources` přidat:
   ```yaml
   url: /local/tesla-style-solar-power-card.js
   type: module
   ```
   *(Resources jsou viditelné jen s povoleným Advanced Mode v profilu uživatele.)*
4. Restart HA + vyčistit cache.

### 3.3 Instalace přes SSH (manuální deploy)
```bash
ssh <user>@<ha-host>
cd /config/www
mkdir -p community/tesla-style-solar-power-card
curl -L -o community/tesla-style-solar-power-card/tesla-style-solar-power-card.js \
    https://github.com/reptilex/tesla-style-solar-power-card/releases/latest/download/tesla-style-solar-power-card.js
# následně přidat resource v UI Lovelace
```

---

## 4. Konfigurace

### 4.1 Minimální YAML
```yaml
type: 'custom:tesla-style-solar-power-card'
grid_consumption_entity: sensor.grid_consumption
house_consumption_entity: sensor.house_consumption
grid_to_house_entity: sensor.grid_consumption
```

### 4.2 Plná YAML šablona
```yaml
type: 'custom:tesla-style-solar-power-card'
name: My Flows

# === 7 primárních toků ===
grid_to_house_entity: sensor.grid_consumption
grid_to_battery_entity: sensor.grid_battery_charge
generation_to_grid_entity: sensor.grid_feed_in
generation_to_battery_entity: sensor.battery_charging
generation_to_house_entity: sensor.solar_consumption
battery_to_house_entity: sensor.battery_consumption
battery_to_grid_entity: sensor.battery_to_grid

# === Hodnoty zobrazené v bublinách (clickable) ===
grid_entity: sensor.grid_consumption
house_entity: sensor.house_consumption
generation_entity: sensor.solar_yield
battery_entity: sensor.battery_consumption

# === Doplňková informace nad ikonou ===
battery_extra_entity: sensor.battery_charge          # SoC %
house_extra_entity: sensor.current_temperature
generation_extra_entity: sensor.percent_cloud_coverage
grid_extra_entity: sensor.monthly_feed_in

# === Volitelné spotřebiče ===
appliance1_consumption_entity: sensor.car_consumption
appliance1_extra_entity: sensor.car_battery_soc
appliance2_consumption_entity: sensor.heating_consumption
appliance2_extra_entity: sensor.heating_operation
```

### 4.3 Behaviorální parametry
| Parametr | Účel | Default |
|---|---|---|
| `name` | Nadpis karty | — |
| `show_w_not_kw` | Vynutit zobrazení ve Wattech | `false` |
| `threshold_in_k` | Práh (W) pro přepnutí na kW (např. `5` = 5000 W) | — |
| `speed_factor` | Rychlost animace toků | `0.04` |
| `hide_inactive_lines` | Skrýt neaktivní linky | `false` |
| `show_gap` | Mezery v linkách (styl HA Energy panelu) | `false` |
| `change_house_bubble_color_with_flow` | Dynamická barva bubliny domu | `false` |
| `energy_flow_diagram` | Místo bodů použít čáry s tloušťkou dle toku | `false` |
| `energy_flow_diagram_line_factor` | Multiplikátor tloušťky čar | `2` |
| `house_without_appliances_values` | Odečíst spotřebiče od domácí spotřeby | `false` |

### 4.4 Vlastní ikony
```yaml
grid_icon: 'mdi:transmission-tower'
generation_icon: 'mdi:solar-panel-large'
house_icon: 'mdi:home'
battery_icon: 'mdi:battery'
appliance1_icon: 'mdi:car-sports'
appliance2_icon: 'mdi:radiator'
```

> **Tip:** pokud `battery_extra_entity` obsahuje SoC v procentech, ikona baterie se automaticky překresluje podle nabití — přebíjí pak statickou volbu `battery_icon`.

---

## 5. Kritické zacházení s hodnotami

### 5.1 Pouze KLADNÉ hodnoty
**Karta nezvládá záporné hodnoty.** Senzory musí být v jednotném tvaru (W *nebo* kW pro všechny — karta automaticky přepočte).

Mnoho integrací (Tesla Powerwall, SolarEdge Modbus apod.) ale produkuje senzory, jejichž znaménko vypovídá o směru toku. Pro takové případy nutno vytvořit **template senzory** rozdělující jeden vstup na separátní toky.

### 5.2 Příklad template senzoru (oddělení směru)
```yaml
template:
  - sensor:
      - name: "Battery Consumption Positive"
        device_class: power
        unit_of_measurement: W
        state: >
          {% set batt = states('sensor.powerwall_battery') | int(0) %}
          {{ batt if batt > 0 else 0 }}

      - name: "Battery Charging Positive"
        device_class: power
        unit_of_measurement: W
        state: >
          {% set batt = states('sensor.powerwall_battery') | int(0) %}
          {{ (-batt) if batt < 0 else 0 }}
```

---

## 6. Tesla Powerwall — speciální setup

Pro Powerwall integraci se v komunitě používá set tzv. **APF (Animated Power Flow)** template senzorů:
- `sensor.apf_grid_entity` (invertovaný site power)
- `sensor.apf_real_house_load`
- `sensor.apf_generation_entity`
- `sensor.apf_battery_entity`
- `sensor.apf_grid2house`, `apf_grid2batt`, `apf_solar2grid`, `apf_solar2house`, `apf_solar2batt`, `apf_batt2house`, `apf_batt2grid`

Tyto se mapují přímo na entity karty — viz README originálního repozitáře.

---

## 7. Známá omezení / problémy

- **Údržba:** poslední release v1.4 v červnu 2024 — projekt udržován jen pomalu, ~59 otevřených issues.
- **HA verze:** od 2024.6.x došlo ke změnám v sizingu (řešeno právě v1.4).
- **Záporné hodnoty:** vyžaduje template senzory (boilerplate při použití s Powerwallem).
- **Cache prohlížeče:** po updatu karty často nutné tvrdé obnovení.
- **Existují alternativy** s aktivnějším vývojem:
  - `power-flow-card-plus` (flin2/ulic75 — populárnější)
  - `sameeraman/ha-modern-solar-energy-card` (Tesla-like, novější)

---

## 8. Užitečné odkazy

- Hlavní repo: <https://github.com/reptilex/tesla-style-solar-power-card>
- README: <https://github.com/reptilex/tesla-style-solar-power-card/blob/master/README.md>
- Releases: <https://github.com/reptilex/tesla-style-solar-power-card/releases>
- HA Community (původní topic): <https://community.home-assistant.io/t/custom-solar-power-card-the-tesla-style-almost/220705>
- HA Community (rewrite topic): <https://community.home-assistant.io/t/rewritten-tesla-style-solar-power-card/294466>
- Power Flow Cards přehled: <https://www.speaktothegeek.co.uk/2022/10/power-flow-cards-for-home-assistant/>

---

## 9. Doporučený postup pro „UltimatePower Card“ (návazný projekt)

1. **Klon a build** originálního repa lokálně, ověřit, že rollup build funguje.
2. **Audit konfigurace** stávajícího HA na `192.168.254.122` — vypsat existující `sensor.*` pro PV/baterii/grid/dům přes SSH (`cat /config/configuration.yaml`, `ha core info`, REST API `/api/states`).
3. **Mapování entit** na 7 toků + bubliny.
4. **Template senzory** pro záporné hodnoty (pokud relevantní pro instalovanou střídači).
5. **Iterace UI:** rozhodnout, zda fork-and-extend reptilex repa, nebo greenfield card stavěný na lit-element / ha-card API.
6. **Deploy** přes SSH (`scp` JS do `/config/www/community/...` + Lovelace resource).

