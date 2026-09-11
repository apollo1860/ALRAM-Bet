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

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'setup', label: 'Setup', icon: '⚙️' },
  { id: 'group', label: 'Gruppe', icon: '📋' },
  { id: 'knockout', label: 'K.O.', icon: '🏆' },
  { id: 'betting', label: 'Wetten', icon: '💰' },
  { id: 'wallet', label: 'Konto', icon: '👤' },
  { id: 'payout', label: 'Abrechnung', icon: '🧾' },
];

function App() {
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
        {tab === 'setup' && <Setup />}
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

export default App;
