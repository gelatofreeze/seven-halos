/**
 * Fixed-timestep accumulator. Gameplay always advances in identical `dt`
 * increments regardless of display refresh rate, which keeps movement and
 * combat frame data deterministic. `alpha` is the leftover fraction used for
 * render interpolation.
 */
export class FixedTimestep {
  readonly dt: number;
  private accumulator = 0;
  private readonly maxSteps: number;
  private readonly maxFrameTime: number;

  constructor(hz = 60, maxStepsPerFrame = 5) {
    this.dt = 1 / hz;
    this.maxSteps = maxStepsPerFrame;
    this.maxFrameTime = this.dt * maxStepsPerFrame;
  }

  /** Feed real elapsed seconds; invokes `step` zero or more times. Returns step count. */
  advance(elapsedSeconds: number, step: (dt: number) => void): number {
    this.accumulator += Math.min(Math.max(elapsedSeconds, 0), this.maxFrameTime);
    let steps = 0;
    // Small epsilon so 1/60 s frames on a 60 Hz display never drift into skipped steps.
    while (this.accumulator + 1e-7 >= this.dt && steps < this.maxSteps) {
      step(this.dt);
      this.accumulator -= this.dt;
      steps++;
    }
    if (this.accumulator < 0) this.accumulator = 0;
    return steps;
  }

  get alpha(): number {
    return Math.min(this.accumulator / this.dt, 1);
  }

  reset(): void {
    this.accumulator = 0;
  }
}

/** Gameplay frame data is authored in 60 Hz frames. */
export const SIM_HZ = 60;
export const framesToSeconds = (frames: number): number => frames / SIM_HZ;
