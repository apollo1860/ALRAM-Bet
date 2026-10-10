import { useEffect, useRef, useState } from 'react';

/**
 * True for a brief moment right after `value` changes (never on the very
 * first render) - meant to be turned into a CSS "pulse" class, e.g. on a
 * balance display right after a deposit or payout lands.
 */
export function usePulseOnChange(value: number, durationMs = 500): boolean {
  const [pulsing, setPulsing] = useState(false);
  const prev = useRef(value);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      prev.current = value;
      return;
    }
    if (value === prev.current) return;
    prev.current = value;
    setPulsing(true);
    const timer = setTimeout(() => setPulsing(false), durationMs);
    return () => clearTimeout(timer);
  }, [value, durationMs]);

  return pulsing;
}
