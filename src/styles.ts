import { css } from 'lit';

export const cardStyles = css`
  :host {
    --up-pv: #ff9b1f;
    --up-pv-glow: rgba(255, 155, 31, 0.45);
    --up-grid: #e8e8ee;
    --up-grid-glow: rgba(232, 232, 238, 0.3);
    --up-battery: #3ddc97;
    --up-battery-glow: rgba(61, 220, 151, 0.4);
    --up-house: #4ea8ff;
    --up-house-glow: rgba(78, 168, 255, 0.4);
    --up-appliance: #6ec5ff;
    --up-bg: var(--card-background-color, #15151c);
    --up-text: var(--primary-text-color, #f5f5fa);
    --up-muted: var(--secondary-text-color, #6a6a78);
  }

  ha-card {
    background: var(--up-bg);
    color: var(--up-text);
    padding: 24px;
    border-radius: 16px;
  }

  .title {
    font-size: 16px;
    font-weight: 500;
    margin: 0 0 12px;
  }

  .row {
    display: flex;
    justify-content: center;
    gap: 24px;
    padding: 18px 0;
    flex-wrap: wrap;
  }

  .main-cross {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    align-items: center;
    justify-items: center;
    min-height: 220px;
    position: relative;
  }

  .bubble {
    position: relative;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.15s, filter 0.15s;
    background: transparent;
  }
  .bubble:hover {
    transform: scale(1.05);
    filter: brightness(1.15);
  }
  .bubble.size-l {
    width: 96px;
    height: 96px;
    border: 3px solid;
  }
  .bubble.size-m {
    width: 76px;
    height: 76px;
    border: 2.5px solid;
  }
  .bubble.size-s {
    width: 56px;
    height: 56px;
    border: 2px solid;
  }
  .bubble ha-icon,
  .bubble svg.icon {
    --mdc-icon-size: 28px;
    color: currentColor;
  }
  .bubble.size-s ha-icon {
    --mdc-icon-size: 22px;
  }
  .bubble .val {
    position: absolute;
    top: calc(100% + 4px);
    font-size: 12px;
    color: currentColor;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .bubble .extra {
    position: absolute;
    bottom: calc(100% + 4px);
    font-size: 11px;
    color: var(--up-muted);
    white-space: nowrap;
  }
  .bubble.pv {
    color: var(--up-pv);
    box-shadow: 0 0 18px var(--up-pv-glow) inset, 0 0 12px var(--up-pv-glow);
  }
  .bubble.grid {
    color: var(--up-grid);
    box-shadow: 0 0 18px var(--up-grid-glow) inset, 0 0 10px var(--up-grid-glow);
  }
  .bubble.battery {
    color: var(--up-battery);
    box-shadow: 0 0 18px var(--up-battery-glow) inset,
      0 0 12px var(--up-battery-glow);
  }
  .bubble.house {
    color: var(--up-house);
    box-shadow: 0 0 22px var(--up-house-glow) inset,
      0 0 14px var(--up-house-glow);
  }
  .bubble.appliance {
    color: var(--up-appliance);
    box-shadow: 0 0 10px rgba(110, 197, 255, 0.25);
  }
  .bubble.inactive {
    opacity: 0.35;
  }

  .house-cluster {
    position: relative;
    width: 220px;
    height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .appliance-fan {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .appliance-fan .bubble {
    position: absolute;
    pointer-events: auto;
  }

  .soc-ring {
    position: absolute;
    inset: -6px;
    transform: rotate(-90deg);
    pointer-events: none;
  }
  .soc-ring circle {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
  }
  .soc-ring .track {
    stroke: rgba(255, 255, 255, 0.06);
  }
  .soc-ring .progress {
    stroke: var(--up-battery);
  }

  .flows {
    position: absolute;
    inset: 0;
    pointer-events: none;
    width: 100%;
    height: 100%;
  }
  .flow-line {
    fill: none;
    stroke-width: 1.5;
    opacity: 0.5;
  }
  .flow-line.pv {
    stroke: var(--up-pv);
  }
  .flow-line.grid {
    stroke: var(--up-grid);
  }
  .flow-line.battery {
    stroke: var(--up-battery);
  }
  .flow-line.house {
    stroke: var(--up-house);
  }

  .flow-dot {
    r: 3.5;
  }
  .flow-dot.pv {
    fill: var(--up-pv);
    filter: drop-shadow(0 0 4px var(--up-pv));
  }
  .flow-dot.grid {
    fill: var(--up-grid);
    filter: drop-shadow(0 0 4px var(--up-grid));
  }
  .flow-dot.battery {
    fill: var(--up-battery);
    filter: drop-shadow(0 0 4px var(--up-battery));
  }
`;
