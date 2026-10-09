import { useEffect } from 'react';
import { fmtCoins } from '../lib/format';

const DISMISS_AFTER_MS = 2600;
const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * A one-shot full-screen confirmation overlay shown right after a deposit -
 * styled after the familiar dark checkmark "payment confirmed" moment
 * (circle bounces in, checkmark draws itself, caption fades up, then the
 * whole thing dismisses on its own), just carrying the app's own branding
 * instead of any real payment provider's.
 */
export function PaymentPulse({ amount, onDone }: { amount: number; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="pay-pulse-backdrop" role="status" aria-live="polite">
      <div className="pay-pulse-card">
        <div className="pay-pulse-brand">ALRAM PAY</div>
        <div className="pay-pulse-ring-wrap">
          <svg viewBox="0 0 100 100" className="pay-pulse-ring" aria-hidden="true">
            <circle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              style={{ strokeDasharray: RING_CIRCUMFERENCE, strokeDashoffset: RING_CIRCUMFERENCE }}
            />
          </svg>
          <div className="pay-pulse-circle">
            <svg viewBox="0 0 64 64" className="pay-pulse-check" aria-hidden="true">
              <path d="M18 34 L28 44 L47 22" />
            </svg>
          </div>
        </div>
        <div className="pay-pulse-caption">Erledigt</div>
        <div className="pay-pulse-amount">{fmtCoins(amount)} eingezahlt</div>
      </div>
    </div>
  );
}
