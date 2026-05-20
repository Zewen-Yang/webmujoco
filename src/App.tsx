import { useEffect } from 'react';
import { initMuJoCo } from './mujoco/engine';
import { Scene } from './components/Scene';
import { ControlPanel } from './components/ControlPanel';
import { StatePanel } from './components/StatePanel';
import { useSimStore } from './store/simStore';

function App() {
  const { loading, status, setLoading, setStatus } = useSimStore();

  useEffect(() => {
    initMuJoCo(setStatus)
      .then(() => setLoading(false))
      .catch((e) => setStatus('Error: ' + e.message));
  }, [setLoading, setStatus]);

  return (
    <div className="h-screen w-screen bg-scene text-surface-fg">
      <div className="relative h-full w-full">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-600">
            <div
              aria-hidden
              className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-300 border-t-brand-600"
            />
            <h2 className="m-0 text-sm font-medium tracking-wide">{status}</h2>
          </div>
        ) : (
          <>
            <Scene />
            <StatePanel />
            <ControlPanel />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
