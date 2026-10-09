import { useAppMode } from '../store/useAppMode';

/**
 * One-time risk notice, shown the first time the main interface appears on
 * a device (right after mode/identity selection) - both buttons just
 * dismiss it for good, there's no "disagree" path.
 */
export function Disclaimer() {
  const dismissDisclaimer = useAppMode((s) => s.dismissDisclaimer);

  return (
    <div className="disclaimer-backdrop" role="dialog" aria-modal="true">
      <div className="disclaimer-card">
        <h2>⚠️ Achtung: Sportwetten bergen Risiken!</h2>
        <p>
          Wetten kann süchtig machen und zu finanziellen Verlusten führen. Gewinne sind nicht garantiert. Setze nur
          Geld ein, dessen Verlust du dir leisten kannst, und spiele verantwortungsbewusst. Nur für Personen ab 18
          Jahren.
        </p>
        <div className="button-col">
          <button onClick={dismissDisclaimer}>Es ist kein Glücksspiel, wenn man ein System hat</button>
          <button className="button-secondary" onClick={dismissDisclaimer}>
            Juckt?
          </button>
        </div>
      </div>
    </div>
  );
}
