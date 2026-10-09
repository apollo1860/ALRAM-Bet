import { useStore } from '../store/useStore';
import { fmtCoins, fmtOdds, playerName } from '../lib/format';
import { decimalOddsFromRating } from '../lib/odds';

function DepositLog() {
  const players = useStore((s) => s.players);
  const guests = useStore((s) => s.guests);
  const transactions = useStore((s) => s.transactions);
  const cancelDeposit = useStore((s) => s.cancelDeposit);

  const deposits = transactions.filter((t) => t.type === 'deposit').sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="card">
      <h2>Einzahlungs-Logbuch</h2>
      <p className="hint">
        Nur für dich als Admin sichtbar: wer wann wie viele Coins eingezahlt hat. Eine falsch eingetragene
        Einzahlung kannst du hier stornieren - das Konto wird um den Betrag zurückgebucht.
      </p>
      {deposits.length === 0 ? (
        <p className="hint">Noch keine Einzahlungen.</p>
      ) : (
        <table className="table stack">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>Person</th>
              <th>Betrag</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((t) => (
              <tr key={t.id}>
                <td data-label="Zeitpunkt">{new Date(t.createdAt).toLocaleString('de-DE')}</td>
                <td data-label="Person">{playerName(players, t.playerId, guests)}</td>
                <td data-label="Betrag">{fmtCoins(t.amount)}</td>
                <td data-label="">
                  <button
                    className="button-secondary deposit-cancel-btn"
                    onClick={() =>
                      confirm(
                        `Einzahlung von ${fmtCoins(t.amount)} (${playerName(players, t.playerId, guests)}) wirklich stornieren?`
                      ) && cancelDeposit(t.id)
                    }
                  >
                    Stornieren
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function Setup({ isAdmin }: { isAdmin: boolean }) {
  const players = useStore((s) => s.players);
  const phase = useStore((s) => s.phase);
  const updatePlayer = useStore((s) => s.updatePlayer);
  const resetTournament = useStore((s) => s.resetTournament);

  const editable = phase === 'setup' && isAdmin;

  return (
    <>
      <div className="card">
        <h2>Spieler &amp; Startquoten</h2>
        <p className="hint">
          Die Gesamtsieg-Quote bestimmt die Ausgangsstärke jedes Spielers. Daraus werden die Quoten für
          einzelne Spiele berechnet (wer ist Favorit gegen wen) – die Stärke passt sich danach automatisch an
          Sieg/Niederlage im Turnierverlauf an.
        </p>
        {!isAdmin && <p className="hint">Nur der Admin kann Spieler und Quoten bearbeiten.</p>}
        {phase !== 'setup' && (
          <p className="hint">
            „Aktuelle Form“ bewegt sich mit jedem Ergebnis ein Stück (Sieg gegen einen Favoriten zieht die Quote
            stärker nach unten als gegen einen Außenseiter) - die Gesamtsieg-Quote links bleibt die fixe
            Ausgangsquote von vor dem Turnier.
          </p>
        )}
        <table className="table stack">
          <thead>
            <tr>
              <th>Name</th>
              <th>Gesamtsieg-Quote</th>
              {phase !== 'setup' && <th>Aktuelle Form</th>}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td data-label="Name">
                  <input
                    type="text"
                    value={p.name}
                    disabled={!editable}
                    onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                  />
                </td>
                <td data-label="Quote">
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    value={p.initialOdds}
                    disabled={!editable}
                    onChange={(e) => updatePlayer(p.id, { initialOdds: Number(e.target.value) })}
                  />
                </td>
                {phase !== 'setup' && (
                  <td data-label="Aktuelle Form">
                    <strong>{fmtOdds(decimalOddsFromRating(p.currentRating))}</strong>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {editable && <p className="hint">Weiter geht's im K.O.-Tab: dort die Bracket-Positionen zuweisen und starten.</p>}
      </div>
      {isAdmin && (
        <div className="card">
          <h2>Alles beenden</h2>
          <p className="hint">
            Setzt Spieler, Gäste, Quoten, Bracket, Wallets, Wetten und Nachrichten komplett zurück auf den
            Anfangszustand - z.B. um das Turnier neu zu testen. Das kann nicht rückgängig gemacht werden.
          </p>
          <button
            className="danger"
            onClick={() => confirm('Wirklich alles beenden und zurücksetzen? Das kann nicht rückgängig gemacht werden.') && resetTournament()}
          >
            Turnier beenden &amp; zurücksetzen
          </button>
        </div>
      )}
      {isAdmin && <DepositLog />}
    </>
  );
}
