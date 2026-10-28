/**
 * Temporary synthesized sound effects (Web Audio), so combat has audible
 * feedback before real audio exists. Replace with recorded assets via
 * Phaser's sound manager later; call sites only use `play(name)`.
 */
export type SfxName =
  | 'swing'
  | 'heavySwing'
  | 'hit'
  | 'heavyHit'
  | 'hurt'
  | 'dodge'
  | 'jump'
  | 'land'
  | 'telegraph'
  | 'enemySwing'
  | 'evade'
  | 'death'
  | 'chargeFull'
  | 'block'
  | 'guardBreak'
  | 'parryAttempt'
  | 'parry'
  | 'postureBreak'
  | 'riposte'
  | 'scytheSwing'
  | 'scytheHeavySwing'
  | 'reaperTelegraph'
  | 'reward'
  | 'pickup'
  | 'rarePickup'
  | 'equip';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private chargeOsc: { osc: OscillatorNode; gain: GainNode } | null = null;
  muted = false;

  /** Must be called from a user gesture on iOS before any sound can play. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    switch (name) {
      case 'swing':
        this.noiseBurst(t, 0.12, 'bandpass', 1800, 600, 0.35);
        break;
      case 'heavySwing':
        this.noiseBurst(t, 0.24, 'bandpass', 1300, 250, 0.55);
        this.tone(t, 0.18, 'triangle', 140, 60, 0.15);
        break;
      case 'chargeFull':
        this.tone(t, 0.25, 'sine', 1320, 1320, 0.12);
        this.tone(t, 0.25, 'sine', 1980, 1980, 0.05);
        break;
      case 'block':
        this.tone(t, 0.12, 'square', 620, 420, 0.12);
        this.noiseBurst(t, 0.06, 'highpass', 3000, 1500, 0.35);
        break;
      case 'guardBreak':
        this.tone(t, 0.35, 'sawtooth', 300, 70, 0.3);
        this.noiseBurst(t, 0.3, 'bandpass', 2500, 300, 0.6);
        break;
      case 'parryAttempt':
        this.noiseBurst(t, 0.07, 'bandpass', 3000, 1600, 0.2);
        break;
      case 'parry':
        // Bright metallic ring: the signature "you did it right" sound.
        this.tone(t, 0.6, 'sine', 1560, 1500, 0.18);
        this.tone(t, 0.45, 'sine', 2340, 2300, 0.08);
        this.tone(t, 0.08, 'square', 900, 500, 0.12);
        break;
      case 'postureBreak':
        this.tone(t, 0.9, 'sine', 110, 90, 0.35);
        this.tone(t, 0.6, 'triangle', 220, 180, 0.12);
        this.noiseBurst(t, 0.2, 'lowpass', 900, 150, 0.4);
        break;
      case 'riposte':
        this.noiseBurst(t, 0.25, 'lowpass', 2200, 120, 0.8);
        this.tone(t, 0.4, 'sawtooth', 160, 35, 0.35);
        break;
      case 'scytheSwing':
        // Longer, airier whoosh than the sword.
        this.noiseBurst(t, 0.2, 'bandpass', 1100, 380, 0.4);
        this.tone(t, 0.16, 'sine', 520, 260, 0.05);
        break;
      case 'scytheHeavySwing':
        this.noiseBurst(t, 0.32, 'bandpass', 900, 180, 0.6);
        this.tone(t, 0.3, 'sine', 300, 110, 0.12);
        break;
      case 'reaperTelegraph':
        // A hollow, rattling whisper.
        this.noiseBurst(t, 0.3, 'bandpass', 2600, 900, 0.18);
        this.tone(t, 0.35, 'triangle', 196, 240, 0.08);
        break;
      case 'reward':
        this.tone(t, 0.12, 'triangle', 660, 660, 0.08);
        this.tone(t + 0.08, 0.16, 'triangle', 990, 990, 0.07);
        break;
      case 'pickup':
        this.tone(t, 0.08, 'square', 880, 1320, 0.05);
        break;
      case 'rarePickup':
        this.tone(t, 0.18, 'sine', 784, 784, 0.12);
        this.tone(t + 0.12, 0.18, 'sine', 1047, 1047, 0.12);
        this.tone(t + 0.24, 0.5, 'sine', 1568, 1568, 0.1);
        break;
      case 'equip':
        this.noiseBurst(t, 0.06, 'highpass', 2800, 2000, 0.25);
        this.tone(t, 0.1, 'square', 520, 700, 0.05);
        break;
      case 'enemySwing':
        this.noiseBurst(t, 0.22, 'bandpass', 900, 300, 0.5);
        break;
      case 'hit':
        this.noiseBurst(t, 0.08, 'highpass', 2500, 1200, 0.5);
        this.tone(t, 0.12, 'square', 180, 60, 0.25);
        break;
      case 'heavyHit':
        this.noiseBurst(t, 0.14, 'lowpass', 1800, 300, 0.7);
        this.tone(t, 0.2, 'sawtooth', 120, 40, 0.3);
        break;
      case 'hurt':
        this.tone(t, 0.25, 'sawtooth', 220, 70, 0.3);
        this.noiseBurst(t, 0.15, 'lowpass', 1200, 200, 0.5);
        break;
      case 'dodge':
        this.noiseBurst(t, 0.18, 'lowpass', 700, 200, 0.3);
        break;
      case 'jump':
        this.tone(t, 0.07, 'triangle', 260, 420, 0.12);
        break;
      case 'land':
        this.noiseBurst(t, 0.06, 'lowpass', 500, 120, 0.25);
        break;
      case 'telegraph':
        this.tone(t, 0.5, 'sine', 330, 660, 0.12);
        this.tone(t + 0.02, 0.5, 'sine', 495, 990, 0.06);
        break;
      case 'evade':
        this.tone(t, 0.2, 'sine', 900, 1400, 0.1);
        break;
      case 'death':
        this.tone(t, 0.8, 'sawtooth', 160, 30, 0.25);
        this.noiseBurst(t, 0.6, 'lowpass', 900, 80, 0.4);
        break;
    }
  }

  /** Rising tone while a heavy attack charges; `seconds` is the time to full charge. */
  startCharge(seconds: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted || ctx.state !== 'running') return;
    this.stopCharge();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(660, t + seconds);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.09, t + 0.08);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    this.chargeOsc = { osc, gain };
  }

  stopCharge(): void {
    const c = this.chargeOsc;
    if (!c || !this.ctx) return;
    const t = this.ctx.currentTime;
    c.gain.gain.cancelScheduledValues(t);
    c.gain.gain.setValueAtTime(c.gain.gain.value, t);
    c.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    c.osc.stop(t + 0.06);
    this.chargeOsc = null;
  }

  private tone(t: number, dur: number, type: OscillatorType, f0: number, f1: number, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(t: number, dur: number, filterType: BiquadFilterType, f0: number, f1: number, vol: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

export const sfx = new Sfx();
