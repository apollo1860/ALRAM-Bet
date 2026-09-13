import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { useAppMode } from './store/useAppMode';
import { ModeSelect } from './components/ModeSelect';
import { PlayerSwitcher } from './components/PlayerSwitcher';
import { Setup } from './components/Setup';
import { GroupStage } from './components/GroupStage';
import { Bracket } from './components/Bracket';
import { Betting } from './components/Betting';
import { Wallet } from './components/Wallet';
import { Payout } from './components/Payout';
import { ADMIN_ID } from './lib/format';

// Firebase and the room-gate UI are only needed in multi-device mode, so
// keep them out of the bundle everyone downloads for single-device use.
const RoomGate = lazy(() => import('./components/RoomGate').then((m) => ({ default: m.RoomGate })));

type Tab = 'setup' | 'group' | 'knockout' | 'betting' | 'wallet' | 'payout';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'setup', label: 'Setup', icon: '⚙️' },
  { id: 'group', label: 'Gruppe', icon: '📋' },
  { id: 'knockout', label: 'K.O.', icon: '🏆' },
  { id: 'betting', label: 'Wetten', icon: '💰' },
  { id: 'wallet', label: 'Konto', icon: '👤' },
  { id: 'payout', label: 'Abrechnung', icon: '🧾' },
];

function ConnectionBar() {
  const roomCode = useAppMode((s) => s.roomCode);
  const setMode = useAppMode((s) => s.setMode);

  return (
    <div className="connection-bar">
      <span>🌐 Raum {roomCode}</span>
      <button className="button-secondary" onClick={() => setMode(null)}>
        Raum verlassen
      </button>
    </div>
  );
}

function MainApp({ isMulti }: { isMulti: boolean }) {
  const [tab, setTab] = useState<Tab>('setup');
  const activePlayerId = useStore((s) => s.activePlayerId);
  const isAdmin = activePlayerId === ADMIN_ID;
  const bettorId = isAdmin ? null : activePlayerId;

  return (
    <div className="app">
      <header>
        <span className="brand">🏓 ALRAM Bet</span>
        <PlayerSwitcher />
      </header>

      <main>
        {isMulti && <ConnectionBar />}
        {tab === 'setup' && <Setup isAdmin={isAdmin} />}
        {tab === 'group' && <GroupStage isAdmin={isAdmin} />}
        {tab === 'knockout' && <Bracket isAdmin={isAdmin} />}
        {tab === 'betting' && <Betting bettorId={bettorId} />}
        {tab === 'wallet' && <Wallet playerId={bettorId} />}
        {tab === 'payout' && <Payout />}
      </main>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function App() {
  const mode = useAppMode((s) => s.mode);
  const roomCode = useAppMode((s) => s.roomCode);

  useEffect(() => {
    if (mode !== 'multi' || !roomCode) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    import('./lib/roomSync').then(({ startRoomSync, stopRoomSync }) => {
      if (cancelled) return;
      startRoomSync(roomCode);
      stop = stopRoomSync;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [mode, roomCode]);

  if (!mode) return <ModeSelect />;
  if (mode === 'multi' && !roomCode) {
    return (
      <Suspense fallback={<div className="app centered" />}>
        <RoomGate />
      </Suspense>
    );
  }
  return <MainApp isMulti={mode === 'multi'} />;
}

export default App;
