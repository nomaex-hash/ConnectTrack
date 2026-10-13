/**
 * Timing and distance thresholds the Presentation input layer uses to tell a tap from a double
 * tap from a drag. The gameplay contract leaves these UNKNOWN: no Android reference observation
 * has confirmed them. The values below are implementation defaults to make the input layer work,
 * not reference-runtime facts, and are freely replaceable without touching Domain or Application.
 */
export interface GestureInputConfig {
    /** Maximum gap, in ms, between the first release and the second press to count as a double tap. */
    readonly doubleTapWindowMs: number;
    /** Maximum press duration, in ms, for a press to still be a tap (not a long hold). */
    readonly maxTapDurationMs: number;
    /** Pointer movement, in UI pixels, past which a press becomes a drag instead of a tap. */
    readonly dragDistanceUi: number;
    /** Maximum pointer movement, in UI pixels, between the two presses of a double tap. */
    readonly doubleTapDistanceUi: number;
}

export const DEFAULT_GESTURE_INPUT_CONFIG: GestureInputConfig = Object.freeze({
    // Lowered from 300 (confirmed by the user) — the window only gates the OPTIONAL upgrade to a
    // double tap now (the tap itself already fires instantly), so it can be tight without making
    // marking feel delayed.
    doubleTapWindowMs: 180,
    maxTapDurationMs: 300,
    dragDistanceUi: 12,
    doubleTapDistanceUi: 24,
});
