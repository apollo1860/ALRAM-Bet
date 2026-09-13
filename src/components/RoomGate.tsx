import { useState } from 'react';
import { useAppMode } from '../store/useAppMode';
import { createRoomDoc, generateRoomCode, roomExists } from '../lib/roomSync';

type Screen = 'choice' | 'create' | 'join';

export function RoomGate() {
  const setMode = useAppMode((s) => s.setMode);
  const setRoomCode = useAppMode((s) => s.setRoomCode);
  const [screen, setScreen] = useState<Screen>('choice');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');

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

  async function handleJoin() {
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
      setRoomCode(joinInput);
    } catch (e) {
      setError(`Verbindung fehlgeschlagen. (${(e as Error).message})`);
    } finally {
      setBusy(false);
    }
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
              <button className="button-secondary" disabled={busy} onClick={() => setScreen('join')}>
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
            <p className="hint">Gib diesen Code an alle anderen Geräte weiter:</p>
            <div className="room-code-display">{createdCode}</div>
            <div className="button-col">
              <button onClick={() => setRoomCode(createdCode)}>Raum betreten</button>
              <button className="button-secondary" onClick={() => setScreen('choice')}>
                Zurück
              </button>
            </div>
          </>
        )}

        {screen === 'join' && (
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
              <button disabled={busy} onClick={handleJoin}>
                Beitreten
              </button>
              <button className="button-secondary" onClick={() => setScreen('choice')}>
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
