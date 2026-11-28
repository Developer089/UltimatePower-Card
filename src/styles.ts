import { css } from 'lit';

export const cardStyles = css`
  :host {
    display: block;
  }
  ha-card {
    /* light theme values; .dark below swaps them */
    --up-pos: #2c9631;        /* own energy: production, battery, export */
    --up-neg: #e0661a;        /* consumption and grid import */
    --up-chart-pos: #1f7a2c;
    --up-chart-neg: #f08a2a;
    --up-wire: #9a9e9a;
    --up-text: var(--primary-text-color, #161716);
    --up-muted: var(--secondary-text-color, #5c605c);
    --up-line: var(--divider-color, rgba(127, 127, 127, 0.3));
    --up-inset: var(--secondary-background-color, rgba(127, 127, 127, 0.12));
    --up-node: var(--card-background-color, #ffffff);
    padding: 12px 14px 14px;
    overflow: hidden;
    color: var(--up-text);
  }
  ha-card.dark {
    --up-pos: #8fe36a;
    --up-neg: #ff7d33;
    --up-chart-pos: #5fb347;
    --up-chart-neg: #d9541a;
    --up-wire: #7b7b84;
  }

  .title {
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 4px;
  }

  /* ---------- flow diagram ---------- */
  svg.flow {
    display: block;
    width: 100%;
    height: auto;
  }
  .wire {
    fill: none;
    stroke: var(--up-wire);
    stroke-width: 1.5;
    stroke-linecap: round;
    opacity: 0.35;
  }
  .wire.on {
    opacity: 1;
  }
  .hub {
    fill: var(--up-wire);
  }

  /* A stream of small dots; .lead is one large dot per main arm. Both move
     from the start of the path to its end, .rev flips the direction. */
  .stream,
  .lead {
    fill: none;
    stroke-linecap: round;
    animation: up-flow linear infinite;
  }
  /* Base speeds: the stream covers its 16 px period in 1 s, the lead dot runs
     100 px/s. The card scales both through the animation playback rate. */
  .stream {
    --p: 16;
    animation-duration: 1s;
    stroke-width: 3;
    stroke-dasharray: 0.1 15.9;
    opacity: 0.8;
  }
  .stream.main {
    stroke-width: 4;
  }
  .lead {
    /* no CSS filter here: a filter on a straight line (zero-area bounding box) hides it */
    stroke-width: 9;
  }
  .pos {
    color: var(--up-pos);
    stroke: var(--up-pos);
  }
  .neg {
    color: var(--up-neg);
    stroke: var(--up-neg);
  }
  .rev {
    animation-direction: reverse;
  }
  @keyframes up-flow {
    from {
      stroke-dashoffset: var(--p);
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  .n.pos {
    color: var(--up-pos);
    stroke: none;
  }
  .n.neg {
    color: var(--up-neg);
    stroke: none;
  }
  .n.idle {
    color: var(--up-wire);
  }
  .n.click {
    cursor: pointer;
  }
  .n .body {
    fill: var(--up-node);
    stroke: currentColor;
  }
  .n .echo {
    fill: none;
    stroke: var(--up-wire);
    stroke-width: 2;
    opacity: 0.55;
  }
  .n .ic {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .n .ring-track {
    fill: var(--up-node);
    stroke: var(--up-line);
    stroke-width: 3;
  }
  .n .ring {
    fill: none;
    stroke: var(--up-pos);
    stroke-width: 3;
    stroke-linecap: round;
  }
  /* ring moving outwards = the node supplies energy, inwards = it draws energy */
  .pulse {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    transform-box: fill-box;
    transform-origin: center;
    animation: up-pulse 1.8s ease-out infinite;
  }
  .pulse.in {
    animation-direction: reverse;
  }
  @keyframes up-pulse {
    from {
      transform: scale(1);
      opacity: 0.65;
    }
    to {
      transform: scale(1.32);
      opacity: 0;
    }
  }
  .t-v {
    fill: var(--up-text);
    stroke: none;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .t-n {
    fill: var(--up-muted);
    stroke: none;
  }

  /* animation: auto follows the system "reduce motion" setting,
     always ignores it, off never animates */
  @media (prefers-reduced-motion: reduce) {
    ha-card:not(.anim-always) .stream,
    ha-card:not(.anim-always) .lead,
    ha-card:not(.anim-always) .pulse {
      animation: none;
    }
    ha-card:not(.anim-always) .lead,
    ha-card:not(.anim-always) .pulse {
      display: none;
    }
  }
  ha-card.anim-off .stream,
  ha-card.anim-off .lead,
  ha-card.anim-off .pulse {
    animation: none;
  }
  ha-card.anim-off .lead,
  ha-card.anim-off .pulse {
    display: none;
  }

  /* ---------- statistics ---------- */
  .stats {
    border-top: 1px solid var(--up-line);
    margin-top: 6px;
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .seg {
    display: flex;
    background: var(--up-inset);
    border-radius: 9px;
    padding: 2px;
    gap: 2px;
  }
  .seg button {
    flex: 1;
    font: inherit;
    font-size: 13px;
    color: var(--up-muted);
    background: transparent;
    border: 0;
    padding: 5px 4px;
    border-radius: 7px;
    cursor: pointer;
  }
  .seg button[aria-pressed='true'] {
    background: var(--up-node);
    color: var(--up-text);
    font-weight: 500;
    box-shadow: 0 0 0 1px var(--up-line);
  }
  .pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .pager button {
    font: inherit;
    font-size: 20px;
    line-height: 1;
    width: 36px;
    height: 30px;
    color: var(--up-text);
    background: var(--up-inset);
    border: 0;
    border-radius: 8px;
    cursor: pointer;
  }
  .pager button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .pager .pg-title {
    font-weight: 600;
    font-size: 15px;
    text-align: center;
    min-width: 0;
  }
  .seg button:focus-visible,
  .pager button:focus-visible {
    outline: 2px solid var(--up-pos);
    outline-offset: 1px;
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .kpi {
    background: var(--up-inset);
    border-radius: 10px;
    padding: 8px 10px;
    min-width: 0;
  }
  .kpi .k {
    color: var(--up-muted);
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kpi .k i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
  }
  .kpi .val {
    font-size: 18px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .kpi .val small {
    font-size: 11px;
    font-weight: 400;
    color: var(--up-muted);
    margin-left: 3px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    font-size: 12px;
    color: var(--up-muted);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }
  .chart {
    position: relative;
    touch-action: pan-y;
  }
  .chart svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .chart .gl {
    stroke: var(--up-line);
    stroke-width: 1;
  }
  .chart .ax {
    fill: var(--up-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .chart .bar-pos {
    fill: var(--up-chart-pos);
  }
  .chart .bar-neg {
    fill: var(--up-chart-neg);
  }
  .chart .hit {
    fill: transparent;
  }
  .chart .hit.active {
    fill: var(--up-text);
    opacity: 0.07;
  }
  .tip {
    position: absolute;
    top: 2px;
    pointer-events: none;
    background: var(--up-node);
    border: 1px solid var(--up-line);
    border-radius: 8px;
    padding: 6px 9px;
    font-size: 12px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
    transform: translateX(10px);
    z-index: 1;
  }
  .tip.flip {
    transform: translateX(calc(-100% - 10px));
  }
  .tip b {
    display: block;
    margin-bottom: 3px;
  }
  .tip div {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tip i {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }
  .tip span {
    margin-left: auto;
    padding-left: 12px;
    font-weight: 600;
  }
  .note {
    font-size: 12px;
    color: var(--up-muted);
  }
  .version {
    font-size: 10px;
    color: var(--up-muted);
    text-align: right;
    margin-top: 6px;
  }
`;
