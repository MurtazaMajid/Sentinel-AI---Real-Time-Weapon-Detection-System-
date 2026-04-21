/** Brief threat beep using WebAudio. No assets required. */
let ctx: AudioContext | null = null;
let lastPlay = 0;

export function playAlert() {
  const now = Date.now();
  if (now - lastPlay < 600) return; // throttle
  lastPlay = now;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const t = ctx.currentTime;
    [880, 660].forEach((freq, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t + i * 0.18);
      g.gain.linearRampToValueAtTime(0.18, t + i * 0.18 + 0.02);
      g.gain.linearRampToValueAtTime(0, t + i * 0.18 + 0.16);
      o.connect(g).connect(ctx!.destination);
      o.start(t + i * 0.18);
      o.stop(t + i * 0.18 + 0.18);
    });
  } catch {
    /* noop */
  }
}
