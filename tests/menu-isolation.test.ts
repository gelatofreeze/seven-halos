import { describe, expect, it } from 'vitest';
import { createInputFrame } from '../src/input/InputActions';
import { InputHub } from '../src/input/InputHub';
import { flatSim, run, ScriptedInput } from './helpers';

describe('Pause menu input isolation', () => {
  it('presses made before or while the menu is open never fire after it closes', () => {
    const hub = new InputHub();
    const frame = createInputFrame();
    hub.press('attack', 'touch:a');
    hub.release('attack', 'touch:a');
    hub.press('dodge', 'key:KeyL');
    hub.press('right', 'touch');
    // Menu opens: release + discard.
    hub.releaseAll();
    hub.discardPendingPresses();
    hub.press('jump', 'key:Space'); // a key pressed while the menu is up
    hub.release('jump', 'key:Space');
    // Menu closes: release + discard again.
    hub.releaseAll();
    hub.discardPendingPresses();
    hub.sample(frame);
    expect([frame.attackPressed, frame.dodgePressed, frame.jumpPressed, frame.moveX]).toEqual([false, false, false, 0]);
    // New presses after closing work normally.
    hub.press('attack', 'touch:a');
    hub.sample(frame);
    expect(frame.attackPressed).toBe(true);
  });

  it('a buffered attack is dropped across the menu instead of firing on close', () => {
    const outcome = (discard: boolean) => {
      const sim = flatSim();
      const input = new ScriptedInput();
      input.frame.dodgePressed = true;
      run(sim, input, 1);
      let len = 0;
      while (sim.player.state === 'dodge' && len < 120) {
        run(sim, input, 1);
        len++;
      }
      // Same again, but press attack just before the roll ends and "open the menu" right then.
      const sim2 = flatSim();
      input.frame.dodgePressed = true;
      run(sim2, input, 1);
      run(sim2, input, len - 10);
      input.frame.attackPressed = true;
      run(sim2, input, 1);
      // The menu is open: the simulation doesn't step at all.
      if (discard) {
        sim2.discardQueuedInput(); // menu open
        sim2.discardQueuedInput(); // menu close
      }
      let attacked = false;
      run(sim2, input, 30, () => {
        if (sim2.player.state === 'attack') attacked = true;
      });
      return attacked;
    };
    // Control: without the discard, the buffered press would fire after the menu.
    expect(outcome(false)).toBe(true);
    expect(outcome(true)).toBe(false);
  });
});
