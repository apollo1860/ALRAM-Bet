/**
 * A short two-tone confirmation chime, synthesized on the fly via the Web
 * Audio API - same bright "payment confirmed" rhythm as Apple Pay's sound,
 * but not a copy of their actual audio asset (which we can't legally ship).
 * Entirely best-effort: browsers can block audio without a recent user
 * gesture, so a failure here just means silence, never a thrown error.
 */
export function playDepositChime(): void {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

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

    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // Web Audio unavailable or blocked - the visual animation already carries the moment on its own
  }
}
