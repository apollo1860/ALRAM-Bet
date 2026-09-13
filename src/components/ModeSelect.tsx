import { useAppMode } from '../store/useAppMode';

export function ModeSelect() {
  const setMode = useAppMode((s) => s.setMode);

  return (
    <div className="app centered">
      <div className="card">
        <h2>Wie willst du testen?</h2>
        <p className="hint">
          Auf einem Gerät simulierst du alle Spieler selbst per Umschalter. Mit mehreren Geräten treten echte Leute
          über einen gemeinsamen Raum-Code bei und wetten live mit.
        </p>
        <div className="button-col">
          <button onClick={() => setMode('single')}>📱 Ein Gerät (lokal)</button>
          <button className="button-secondary" onClick={() => setMode('multi')}>
            🌐 Mehrere Geräte (Raum)
          </button>
        </div>
      </div>
    </div>
  );
}
