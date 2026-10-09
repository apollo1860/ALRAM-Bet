import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { useAppMode } from '../store/useAppMode';
import { ADMIN_ID, fmtCoinsShort, playerName } from '../lib/format';

const NEW_GUEST = '__new_guest__';

function GuestPrompt({ onConfirm, onCancel }: { onConfirm: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');

  const confirm = () => {
    if (name.trim()) onConfirm(name.trim());
  };

  // Rendered into document.body rather than inline here: this component lives inside
  // <header>, and header's backdrop-filter makes it a containing block for
  // position:fixed descendants in Chromium, which would otherwise clip this
  // "full-screen" overlay to the header's own tiny box instead of the viewport.
  return createPortal(
    <div className="guest-prompt-backdrop" role="dialog" aria-modal="true">
      <div className="guest-prompt-card">
        <h3>Als Gast beitreten</h3>
        <p className="hint">Du spielst nicht im Turnier mit, kannst aber auf alle Spiele tippen.</p>
        <input
          autoFocus
          type="text"
          placeholder="Dein Name"
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <div className="button-col">
          <button disabled={!name.trim()} onClick={confirm}>
            Beitreten
          </button>
          <button className="button-secondary" onClick={onCancel}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function PlayerSwitcher() {
  const players = useStore((s) => s.players);
  const guests = useStore((s) => s.guests);
  const addGuest = useStore((s) => s.addGuest);
  const activePlayerId = useStore((s) => s.activePlayerId);
  const setActivePlayer = useStore((s) => s.setActivePlayer);
  const wallets = useStore((s) => s.wallets);
  const mode = useAppMode((s) => s.mode);
  const isRoomAdmin = useAppMode((s) => s.isRoomAdmin);
  const [addingGuest, setAddingGuest] = useState(false);

  const isSingleAdmin = activePlayerId === ADMIN_ID;
  const balance = activePlayerId && !isSingleAdmin ? wallets[activePlayerId] ?? 0 : null;

  // In a shared multi-device room your identity was fixed when you joined -
  // no free swapping between people's personal accounts. The room creator
  // is still a real player (own wallet), just with admin rights on top.
  if (mode === 'multi') {
    return (
      <div className="player-switcher">
        {balance !== null && <span className="balance-pill">{fmtCoinsShort(balance)}</span>}
        <span className="identity-label">
          {playerName(players, activePlayerId, guests)}
          {isRoomAdmin && ' 🛠'}
        </span>
      </div>
    );
  }

  return (
    <div className="player-switcher">
      {balance !== null && <span className="balance-pill">{fmtCoinsShort(balance)}</span>}
      <select
        aria-label="Aktive Identität wählen"
        value={activePlayerId ?? ''}
        onChange={(e) => {
          const value = e.target.value;
          if (value === NEW_GUEST) {
            setAddingGuest(true);
            return;
          }
          setActivePlayer(value);
        }}
      >
        <option value={ADMIN_ID}>🛠 Admin</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.eliminated ? ' ✗' : ''}
          </option>
        ))}
        {guests.map((g) => (
          <option key={g.id} value={g.id}>
            👤 {g.name}
          </option>
        ))}
        <option value={NEW_GUEST}>+ Neuer Gast</option>
      </select>
      {addingGuest && (
        <GuestPrompt
          onConfirm={(name) => {
            setActivePlayer(addGuest(name));
            setAddingGuest(false);
          }}
          onCancel={() => setAddingGuest(false)}
        />
      )}
    </div>
  );
}
