import { useState } from 'react';
import { useAppMode } from '../store/useAppMode';
import { useStore } from '../store/useStore';
import { createRoomDoc, generateRoomCode, getRoomPlayers, roomExists } from '../lib/roomSync';
import { ADMIN_ID } from '../lib/format';
import type { Player } from '../types';

type Screen = 'choice' | 'create' | 'join-code' | 'join-identity';

export function RoomGate() {
  const setMode = useAppMode((s) => s.setMode);
  const setRoomCode = useAppMode((s) => s.setRoomCode);
  const setActivePlayer = useStore((s) => s.setActivePlayer);
  const [screen, setScreen] = useState<Screen>('choice');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [roster, setRoster] = useState<Player[]>([]);
  const [pickedPlayerId, setPickedPlayerId] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      let code = generateRoomCode();
      for (let i = 0; i < 5 && (await roomExists(code)); i++) {
        code = generateRoomCode();
      }
      await createRoomDoc(code);
      setCreatedCode(code);
      setScreen('create');
    } catch (e) {
      setError(
        `Raum konnte nicht erstellt werden - ist Firebase in src/firebase.ts konfiguriert? (${(e as Error).message})`
      );
    } finally {
      setBusy(false);
    }
  }

  function enterAsAdmin() {
    if (!createdCode) return;
    setActivePlayer(ADMIN_ID);
    setRoomCode(createdCode);
  }

  async function handleFindRoom() {
    setError(null);
    if (!/^\d{4}$/.test(joinInput)) {
      setError('Bitte genau 4 Ziffern eingeben.');
      return;
    }
    setBusy(true);
    try {
      const exists = await roomExists(joinInput);
      if (!exists) {
        setError('Raum nicht gefunden. Code prüfen oder neuen Raum erstellen.');
        return;
      }
      const players = await getRoomPlayers(joinInput);
      setRoster(players);
      setPickedPlayerId(players[0]?.id ?? null);
      setScreen('join-identity');
    } catch (e) {
      setError(`Verbindung fehlgeschlagen. (${(e as Error).message})`);
    } finally {
      setBusy(false);
    }
  }

  function confirmIdentity() {
    if (!pickedPlayerId) return;
    setActivePlayer(pickedPlayerId);
    setRoomCode(joinInput);
  }

  return (
    <div className="app centered">
      <div className="card">
        <h2>Mehrgeräte-Raum</h2>

        {screen === 'choice' && (
          <>
            <p className="hint">Erstelle einen neuen Raum oder tritt einem bestehenden mit dem 4-stelligen Code bei.</p>
            <div className="button-col">
              <button disabled={busy} onClick={handleCreate}>
                Neuen Raum erstellen
              </button>
              <button className="button-secondary" disabled={busy} onClick={() => setScreen('join-code')}>
                Raum beitreten
              </button>
              <button className="button-secondary" onClick={() => setMode(null)}>
                Zurück
              </button>
            </div>
          </>
        )}

        {screen === 'create' && createdCode && (
          <>
            <p className="hint">
              Gib diesen Code an alle anderen Geräte weiter. Du selbst betrittst den Raum als Admin (Setup,
              Ergebnisse eintragen, Turnier steuern).
            </p>
            <div className="room-code-display">{createdCode}</div>
            <p className="hint">Tipp: Trag zuerst unter Setup die echten Namen ein, bevor du den Code teilst.</p>
            <div className="button-col">
              <button onClick={enterAsAdmin}>Als Admin betreten</button>
              <button className="button-secondary" onClick={() => setScreen('choice')}>
                Zurück
              </button>
            </div>
          </>
        )}

        {screen === 'join-code' && (
          <>
            <p className="hint">4-stelligen Raum-Code eingeben:</p>
            <input
              className="code-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoFocus
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <div className="button-col">
              <button disabled={busy} onClick={handleFindRoom}>
                Weiter
              </button>
              <button className="button-secondary" onClick={() => setScreen('choice')}>
                Zurück
              </button>
            </div>
          </>
        )}

        {screen === 'join-identity' && (
          <>
            <p className="hint">
              Wer bist du? Das legt dieses Gerät fest auf diese Person fest - du kannst nur für dich selbst
              einzahlen und wetten, nicht für andere.
            </p>
            {roster.length === 0 ? (
              <p className="error">Im Raum sind noch keine Spieler eingetragen. Bitte den Admin, zuerst das Setup auszufüllen.</p>
            ) : (
              <div className="button-col">
                {roster.map((p) => (
                  <label key={p.id} className={`identity-option ${pickedPlayerId === p.id ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="identity"
                      checked={pickedPlayerId === p.id}
                      onChange={() => setPickedPlayerId(p.id)}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
            <div className="button-col">
              <button disabled={!pickedPlayerId} onClick={confirmIdentity}>
                Als {roster.find((p) => p.id === pickedPlayerId)?.name ?? '...'} beitreten
              </button>
              <button className="button-secondary" onClick={() => setScreen('join-code')}>
                Zurück
              </button>
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
