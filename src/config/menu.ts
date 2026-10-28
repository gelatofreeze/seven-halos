/** Pause-menu layout and gesture tuning (CSS px and milliseconds). UI only; never read by gameplay. */
export const MENU_LAYOUT = {
  /** All four areas side by side. */
  wideMinWidth: 1000,
  wideMinHeight: 460,
  /** Equipment + backpack + a tabbed details/progression column (phones in landscape). */
  splitMinWidth: 600,
  /** Below that: one area at a time, with tabs. */
  /** The backpack always shows at least this many cells (empty ones included). */
  minBackpackCells: 16,
  /** Touch/pen: hold this long without moving to pick an item up. */
  holdToDragMs: 220,
  /** Touch/pen: movement that turns a press into a scroll, or (sideways) into a drag. */
  touchDragThreshold: 10,
  mouseDragThreshold: 5,
  /** Keep the drag preview clear of the finger. */
  touchGhostOffset: 28,
} as const;
