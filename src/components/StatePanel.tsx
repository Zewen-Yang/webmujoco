import { useEffect, useMemo, useState } from 'react';
import {
  state as engineState,
  NUM_JOINTS,
  HOME_QPOS,
  JOINT_HISTORY_LEN,
} from '../mujoco/engine';
import { Panel, SidePanelShell } from './Panel';

const JOINT_COLORS = [
  '#ef4444', // J1 red
  '#f97316', // J2 orange
  '#eab308', // J3 yellow
  '#22c55e', // J4 green
  '#06b6d4', // J5 cyan
  '#3b82f6', // J6 blue
  '#a855f7', // J7 purple
];

const MIN_Y_SPAN = 0.3; // rad — keep the plot from collapsing to a flat line

type Sample = { desired: number[]; achieved: number[] };

/**
 * Renders a single joint's rolling desired-vs-achieved trace. Kept small so
 * all 7 plots fit comfortably in the side panel.
 */
function JointPlot({
  jointIdx,
  samples,
  color,
}: {
  jointIdx: number;
  samples: Sample[];
  color: string;
}) {
  const W = 240;
  const H = 44;
  const padL = 28;
  const padR = 6;
  const padT = 4;
  const padB = 4;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Compute Y range from the current window, with a minimum span so a perfectly
  // tracked joint doesn't degenerate into a flat line at the midline.
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const s of samples) {
    const d = s.desired[jointIdx];
    const a = s.achieved[jointIdx];
    if (d < yMin) yMin = d;
    if (d > yMax) yMax = d;
    if (a < yMin) yMin = a;
    if (a > yMax) yMax = a;
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = HOME_QPOS[jointIdx] - MIN_Y_SPAN / 2;
    yMax = HOME_QPOS[jointIdx] + MIN_Y_SPAN / 2;
  }
  const span = yMax - yMin;
  if (span < MIN_Y_SPAN) {
    const mid = (yMin + yMax) / 2;
    yMin = mid - MIN_Y_SPAN / 2;
    yMax = mid + MIN_Y_SPAN / 2;
  }
  // Small visual padding so the trace doesn't graze the borders.
  const yPad = (yMax - yMin) * 0.08;
  yMin -= yPad;
  yMax += yPad;

  const xOf = (i: number) =>
    padL + (i / Math.max(JOINT_HISTORY_LEN - 1, 1)) * plotW;
  const yOf = (v: number) =>
    padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const n = samples.length;
  const startIdx = JOINT_HISTORY_LEN - n;

  const desiredPath = samples
    .map((s, i) => {
      const x = xOf(startIdx + i).toFixed(1);
      const y = yOf(s.desired[jointIdx]).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
  const achievedPath = samples
    .map((s, i) => {
      const x = xOf(startIdx + i).toFixed(1);
      const y = yOf(s.achieved[jointIdx]).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  const last = samples[n - 1];
  const err = last ? last.desired[jointIdx] - last.achieved[jointIdx] : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex w-7 flex-col items-end">
        <span
          className="text-[10px] font-semibold leading-none"
          style={{ color }}
        >
          J{jointIdx + 1}
        </span>
        <span className="mt-0.5 text-[8px] font-mono tabular-nums leading-none text-slate-400">
          {(err * 1000).toFixed(0)}m°
        </span>
      </div>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <text x={padL - 2} y={padT + 4} fontSize="7" fill="#94a3b8" textAnchor="end">
          {yMax.toFixed(2)}
        </text>
        <text
          x={padL - 2}
          y={padT + plotH + 2}
          fontSize="7"
          fill="#94a3b8"
          textAnchor="end"
        >
          {yMin.toFixed(2)}
        </text>
        <line
          x1={padL}
          y1={padT}
          x2={padL + plotW}
          y2={padT}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth="0.5"
        />
        <line
          x1={padL}
          y1={padT + plotH / 2}
          x2={padL + plotW}
          y2={padT + plotH / 2}
          stroke="rgba(0,0,0,0.04)"
          strokeWidth="0.5"
          strokeDasharray="2 2"
        />
        <line
          x1={padL}
          y1={padT + plotH}
          x2={padL + plotW}
          y2={padT + plotH}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth="0.5"
        />
        {n >= 2 && (
          <>
            <path
              d={desiredPath}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.1"
              strokeDasharray="3 2"
            />
            <path
              d={achievedPath}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>
    </div>
  );
}

function JointResponseSection({ samples }: { samples: Sample[] }) {
  const jointIdxs = useMemo(
    () => Array.from({ length: NUM_JOINTS }, (_, i) => i),
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-surface-fg-muted">
        <span>Joint angle (rad)</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-px w-3 bg-slate-400" />
            actual
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-px w-3"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg,#94a3b8 0 3px,transparent 3px 5px)',
              }}
            />
            desired
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {jointIdxs.map((i) => (
          <JointPlot
            key={i}
            jointIdx={i}
            samples={samples}
            color={JOINT_COLORS[i]}
          />
        ))}
      </div>
      {samples.length < 2 && (
        <p className="m-0 mt-1 text-center text-[10px] italic text-slate-400">
          Waiting for simulation data…
        </p>
      )}
    </div>
  );
}

function TcpErrorSection() {
  const [history, setHistory] = useState<{ t: number; e: number }[]>([]);
  const [currentError, setCurrentError] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHistory([...engineState.errorHistory]);
      setCurrentError(engineState.currentTcpError);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const width = 240;
  const height = 50;
  const maxError = Math.max(0.01, ...history.map((h) => h.e));

  const points = history
    .map((h, i) => {
      const x = (i / Math.max(history.length - 1, 1)) * width || 0;
      const y = height - (h.e / maxError) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col rounded-lg border border-slate-100 bg-slate-50 p-2">
      <div className="mb-2 flex items-end justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          TCP Error
        </span>
        <span className="font-mono text-sm font-bold text-slate-700">
          {(currentError * 1000).toFixed(2)} mm
        </span>
      </div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="mt-1 overflow-visible"
      >
        <line
          x1="0"
          y1={height}
          x2={width}
          y2={height}
          stroke="#e2e8f0"
          strokeWidth="1"
        />
        <line
          x1="0"
          y1="0"
          x2={width}
          y2="0"
          stroke="#e2e8f0"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        {history.length >= 2 && (
          <polyline
            points={points}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <div className="mt-1.5 flex justify-between">
        <span className="text-[9px] text-slate-400">
          Time ({(history.length * 0.016).toFixed(1)}s window)
        </span>
        <span className="text-[9px] text-slate-400">
          Max: {(maxError * 1000).toFixed(1)}mm
        </span>
      </div>
    </div>
  );
}

/**
 * Left-side floating panel that owns every *read-only* readout of the running
 * simulation: per-joint tracking traces and TCP cartesian error. Mirrors the
 * shape/spacing of `ControlPanel` on the right.
 */
export function StatePanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Snapshot the rolling buffer for React; entries themselves are
      // immutable per-frame so a shallow copy is enough.
      setSamples(engineState.jointHistory.slice());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <SidePanelShell
      title="Robot State"
      side="left"
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((c) => !c)}
    >
      <Panel title="Joint Response">
        <JointResponseSection samples={samples} />
      </Panel>

      <Panel title="TCP Tracking Error">
        <TcpErrorSection />
      </Panel>
    </SidePanelShell>
  );
}
