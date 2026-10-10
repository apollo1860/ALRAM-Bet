type AudioCtxCtor = typeof AudioContext;

function getAudioCtxCtor(): AudioCtxCtor | undefined {
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext;
}

// Kept alive for the page's lifetime once created, rather than a fresh context per chime -
// iOS Safari only allows creating/resuming an AudioContext synchronously inside a real user
// gesture's call stack. The chime itself fires later from a setTimeout (to land on the
// checkmark animation), well outside that window, so by then it's too late to create one.
let sharedCtx: AudioContext | null = null;

function getSharedContext(): AudioContext | null {
  try {
    if (sharedCtx) return sharedCtx;
    const AudioCtx = getAudioCtxCtor();
    if (!AudioCtx) return null;
    sharedCtx = new AudioCtx();
    return sharedCtx;
  } catch {
    return null;
  }
}

/**
 * Call this synchronously from inside the actual tap/click/submit handler that starts a
 * deposit - before any state updates or other async work - so the shared context exists and
 * is running by the time playDepositChime() fires later. Safe to call on every deposit.
 */
export function unlockDepositChime(): void {
  try {
    const ctx = getSharedContext();
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
  } catch {
    // best-effort, see playDepositChime
  }
}

/**
 * A short two-tone confirmation chime, synthesized on the fly via the Web
 * Audio API - same bright "payment confirmed" rhythm as Apple Pay's sound,
 * but not a copy of their actual audio asset (which we can't legally ship).
 * Entirely best-effort: browsers can block audio without a recent user
 * gesture, so a failure here just means silence, never a thrown error.
 */
export function playDepositChime(): void {
  try {
    const ctx = getSharedContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const tone = (freq: number, start: number, duration: number, peakGain: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peakGain, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    const now = ctx.currentTime;
    tone(988, now, 0.16, 0.2); // B5
    tone(1318, now + 0.1, 0.22, 0.22); // E6 - a touch brighter and longer, like the second half of a "ding-ding"
  } catch {
    // Web Audio unavailable or blocked - the visual animation already carries the moment on its own
  }
}
