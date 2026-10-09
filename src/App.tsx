import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { useAppMode } from './store/useAppMode';
import { ModeSelect } from './components/ModeSelect';
import { PlayerSwitcher } from './components/PlayerSwitcher';
import { Mailbox } from './components/Mailbox';
import { Logo } from './components/Logo';
import { Setup } from './components/Setup';
import { Seeding } from './components/Seeding';
import { Bracket } from './components/Bracket';
import { Betting } from './components/Betting';
import { Wallet } from './components/Wallet';
import { Payout } from './components/Payout';
import { Disclaimer } from './components/Disclaimer';
import { useSyncStatus, type SyncStatus } from './store/useSyncStatus';
import { ADMIN_ID } from './lib/format';

// Firebase and the room-gate UI are only needed in multi-device mode, so
// keep them out of the bundle everyone downloads for single-device use.
const RoomGate = lazy(() => import('./components/RoomGate').then((m) => ({ default: m.RoomGate })));

type Tab = 'setup' | 'knockout' | 'betting' | 'wallet' | 'payout';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'setup', label: 'Setup', icon: '⚙️' },
  { id: 'knockout', label: 'K.O.', icon: '🏆' },
  { id: 'betting', label: 'Wetten', icon: '💰' },
  { id: 'wallet', label: 'Konto', icon: '👤' },
  { id: 'payout', label: 'Abrechnung', icon: '🧾' },
];

const SYNC_STATUS_LABEL: Record<SyncStatus, string> = {
  idle: '⏳ Verbinde...',
  connected: '🟢 Verbunden',
  offline: '🔴 Keine Verbindung',
  error: '⚠️ Sync fehlgeschlagen',
};

function ConnectionBar() {
  const roomCode = useAppMode((s) => s.roomCode);
  const setMode = useAppMode((s) => s.setMode);
  const status = useSyncStatus((s) => s.status);

  return (
    <div className="connection-bar">
      <span>
        🌐 Raum {roomCode} · <span className={`sync-status sync-status-${status}`}>{SYNC_STATUS_LABEL[status]}</span>
      </span>
      <button className="button-secondary" onClick={() => setMode(null)}>
        Raum verlassen
      </button>
    </div>
  );
}

function MainApp({ isMulti }: { isMulti: boolean }) {
  const [tab, setTab] = useState<Tab>('setup');
  const activePlayerId = useStore((s) => s.activePlayerId);
  const phase = useStore((s) => s.phase);
  const isRoomAdmin = useAppMode((s) => s.isRoomAdmin);
  const hasSeenDisclaimer = useAppMode((s) => s.hasSeenDisclaimer);
  // Single-device mode simulates everyone via the ADMIN_ID dropdown choice;
  // multi-device mode tracks admin rights separately, since the room
  // creator is also a real player with their own wallet.
  const isAdmin = isMulti ? isRoomAdmin : activePlayerId === ADMIN_ID;
  const bettorId = activePlayerId === ADMIN_ID ? null : activePlayerId;

  return (
    <div className="app">
      {!hasSeenDisclaimer && <Disclaimer />}
      <header>
        <span className="brand">
          <Logo size={30} />
          <span className="brand-text">
            ALRAM<span className="brand-accent">BET</span>
          </span>
        </span>
        <div className="header-right">
          <PlayerSwitcher />
          <Mailbox />
        </div>
      </header>

      <main>
        {isMulti && <ConnectionBar />}
        {tab === 'setup' && <Setup isAdmin={isAdmin} />}
        {tab === 'knockout' && (phase === 'setup' ? <Seeding isAdmin={isAdmin} /> : <Bracket isAdmin={isAdmin} />)}
        {tab === 'betting' && <Betting bettorId={bettorId} isAdmin={isAdmin} />}
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
