import { useState } from 'react';
import { useStore } from './store/useStore';
import { PlayerSwitcher } from './components/PlayerSwitcher';
import { Setup } from './components/Setup';
import { GroupStage } from './components/GroupStage';
import { Bracket } from './components/Bracket';
import { Betting } from './components/Betting';
import { Wallet } from './components/Wallet';
import { Payout } from './components/Payout';
import { ADMIN_ID } from './lib/format';

type Tab = 'setup' | 'group' | 'knockout' | 'betting' | 'wallet' | 'payout';

const TABS: { id: Tab; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'group', label: 'Gruppenphase' },
  { id: 'knockout', label: 'K.O.-Runde' },
  { id: 'betting', label: 'Wetten' },
  { id: 'wallet', label: 'Mein Konto' },
  { id: 'payout', label: 'Abrechnung' },
];

function App() {
  const [tab, setTab] = useState<Tab>('setup');
  const activePlayerId = useStore((s) => s.activePlayerId);
  const isAdmin = activePlayerId === ADMIN_ID;
  const bettorId = isAdmin ? null : activePlayerId;

  return (
    <div className="app">
      <header>
        <h1>🏓 ALRAM Bet</h1>
        <PlayerSwitcher />
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'setup' && <Setup />}
        {tab === 'group' && <GroupStage isAdmin={isAdmin} />}
        {tab === 'knockout' && <Bracket isAdmin={isAdmin} />}
        {tab === 'betting' && <Betting bettorId={bettorId} />}
        {tab === 'wallet' && <Wallet playerId={bettorId} />}
        {tab === 'payout' && <Payout />}
      </main>
    </div>
  );
}

export default App;
