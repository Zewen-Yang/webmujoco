import { useState } from 'react';
import { useSimStore, type ExcitationMode } from '../store/simStore';
import { state as engineState } from '../mujoco/engine';
import { Panel, SidePanelShell } from './Panel';

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold tabular-nums text-surface-fg">
          {value.toFixed(step < 1 ? 2 : 0)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 outline-none accent-brand-600"
      />
    </label>
  );
}

function ModeSwitch({
  value,
  onChange,
}: {
  value: ExcitationMode;
  onChange: (m: ExcitationMode) => void;
}) {
  // Explicit labels because camelCase ids like 'sineAll' don't render nicely
  // with the `capitalize` Tailwind utility.
  const modes: { id: ExcitationMode; label: string }[] = [
    { id: 'hold', label: 'Hold' },
    { id: 'sine', label: 'Sine' },
    { id: 'step', label: 'Step' },
    { id: 'sineAll', label: 'Sine ×7' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Excitation mode"
      className="flex flex-wrap gap-0.5 rounded-lg bg-slate-100 p-0.5"
    >
      {modes.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={
              'flex-1 min-w-[60px] cursor-pointer rounded-md px-2 py-1.5 text-[11px] font-semibold transition ' +
              (active
                ? 'bg-white text-surface-fg shadow-sm'
                : 'text-surface-fg-muted hover:text-surface-fg')
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Right-side floating panel that owns every *input* affecting the simulation:
 * excitation mode, pause toggle, PD gains. Read-only readouts (joint plots,
 * tracking error) live in the `StatePanel` on the left.
 */
export function ControlPanel() {
  const { kp, kd, mode, paused, setKp, setKd, setMode, setPaused } = useSimStore();
  const [collapsed, setCollapsed] = useState(false);

  const updateKp = (v: number) => {
    setKp(v);
    engineState.scalarKp = v;
  };
  const updateKd = (v: number) => {
    setKd(v);
    engineState.scalarKd = v;
  };
  const updateMode = (m: ExcitationMode) => {
    setMode(m);
    engineState.excitationMode = m;
    engineState.simTime = 0;
    // Clear rolling buffers so plots start fresh from the new excitation.
    engineState.jointHistory.length = 0;
    engineState.errorHistory.length = 0;
  };
  const togglePaused = () => {
    const next = !paused;
    setPaused(next);
    engineState.paused = next;
  };

  return (
    <SidePanelShell
      title="Robot Control"
      side="right"
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((c) => !c)}
    >
      <Panel title="Excitation">
        <ModeSwitch value={mode} onChange={updateMode} />
        <button
          type="button"
          onClick={togglePaused}
          className={
            'w-full cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition ' +
            (paused
              ? 'border-brand-300 bg-brand-100 text-brand-700'
              : 'border-surface-border bg-white text-surface-fg hover:bg-surface-muted')
          }
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </Panel>

      <Panel title="PD Gains">
        <Slider label="Kp" value={kp} min={10} max={1000} step={1} onChange={updateKp} />
        <Slider label="Kd" value={kd} min={0} max={50} step={0.1} onChange={updateKd} />
      </Panel>

      <Panel title="Tips" defaultOpen={false}>
        <ul className="m-0 list-disc space-y-1 pl-4 text-xs leading-relaxed text-surface-fg-muted">
          <li>Drag any link in the scene to apply a force.</li>
          <li>Right-click + drag to rotate the camera.</li>
          <li>Scroll to zoom.</li>
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#ff4444]"></span>
            Desired (Reference) Trajectory
          </li>
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#4444ff]"></span>
            Actual Trajectory
          </li>
        </ul>
      </Panel>
    </SidePanelShell>
  );
}
