/** Debug visualisation flags. Toggle at runtime with ` (Backquote) / F3 or the DBG touch button. */
export interface DebugFlags {
  enabled: boolean;
  showSolids: boolean;
  showBodies: boolean;
  showHurtboxes: boolean;
  showHitboxes: boolean;
  showStatePanel: boolean;
}

export function createDebugFlags(search: string = typeof location !== 'undefined' ? location.search : ''): DebugFlags {
  const enabled = new URLSearchParams(search).has('debug');
  return {
    enabled,
    showSolids: true,
    showBodies: true,
    showHurtboxes: true,
    showHitboxes: true,
    showStatePanel: true,
  };
}
