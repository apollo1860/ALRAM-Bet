import { useState } from 'react';
import { useAppMode } from '../store/useAppMode';
import { useStore } from '../store/useStore';
import { createRoomDoc, generateRoomCode, getRoomPlayers, roomExists } from '../lib/roomSync';
import type { Player } from '../types';

type Screen = 'choice' | 'create' | 'join-code' | 'identity';

export function RoomGate() {
  const setMode = useAppMode((s) => s.setMode);
  const setRoomCode = useAppMode((s) => s.setRoomCode);
  const setIsRoomAdmin = useAppMode((s) => s.setIsRoomAdmin);
  const setActivePlayer = useStore((s) => s.setActivePlayer);
  const [screen, setScreen] = useState<Screen>('choice');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [enteringAsAdmin, setEnteringAsAdmin] = useState(false);
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
      setPendingCode(code);
      setScreen('create');
    } catch (e) {
      setError(
        `Raum konnte nicht erstellt werden - ist Firebase in src/firebase.ts konfiguriert? (${(e as Error).message})`
      );
    } finally {
      setBusy(false);
    }
  }

  async function proceedToIdentity(code: string, asAdmin: boolean) {
    setError(null);
    setBusy(true);
    try {
      const players = await getRoomPlayers(code);
      setRoster(players);
      setPickedPlayerId(players[0]?.id ?? null);
      setPendingCode(code);
      setEnteringAsAdmin(asAdmin);
      setScreen('identity');
    } catch (e) {
      setError(`Verbindung fehlgeschlagen. (${(e as Error).message})`);
    } finally {
      setBusy(false);
    }
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
        setBusy(false);
        return;
      }
    } catch (e) {
      setError(`Verbindung fehlgeschlagen. (${(e as Error).message})`);
      setBusy(false);
      return;
    }
    setBusy(false);
    await proceedToIdentity(joinInput, false);
  }

  function confirmIdentity() {
    if (!pickedPlayerId || !pendingCode) return;
    setActivePlayer(pickedPlayerId);
    setIsRoomAdmin(enteringAsAdmin);
    setRoomCode(pendingCode);
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

        {screen === 'create' && pendingCode && (
          <>
            <p className="hint">
              Gib diesen Code an alle anderen Geräte weiter. Du bist auch selbst ein Spieler - gleich im nächsten
              Schritt wählst du dich aus der Liste, bekommst aber zusätzlich Admin-Rechte (Setup, Ergebnisse
              eintragen, Turnier steuern).
            </p>
            <div className="room-code-display">{pendingCode}</div>
            <p className="hint">Tipp: Trag zuerst unter Setup die echten Namen ein, bevor du den Code teilst.</p>
            <div className="button-col">
              <button disabled={busy} onClick={() => proceedToIdentity(pendingCode, true)}>
                Weiter
              </button>
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

        {screen === 'identity' && (
          <>
            <p className="hint">
              Wer bist du? Das legt dieses Gerät fest auf diese Person fest - du kannst nur für dich selbst
              einzahlen und wetten, nicht für andere.
              {enteringAsAdmin && ' Zusätzlich bekommst du als Raum-Ersteller Admin-Rechte.'}
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
                Als {roster.find((p) => p.id === pickedPlayerId)?.name ?? '...'}
                {enteringAsAdmin ? ' + Admin' : ''} beitreten
              </button>
              <button className="button-secondary" onClick={() => setScreen(enteringAsAdmin ? 'create' : 'join-code')}>
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
