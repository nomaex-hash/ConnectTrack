import { Direction } from '../../domain/board/direction';

/**
 * Neutral gameplay commands. They describe player intent, not input events.
 * Presentation decides whether a gesture was a single tap, a double tap, or a drag, and sends
 * the matching command. No timing, pointer coordinates, or sampling here.
 */
export type GameCommand =
    | { readonly type: 'tapCell'; readonly cell: number }
    | { readonly type: 'doubleTapCell'; readonly cell: number }
    | { readonly type: 'markCellsAsX'; readonly cells: readonly number[] }
    | { readonly type: 'removeXCells'; readonly cells: readonly number[] }
    | { readonly type: 'beginTrackDrag'; readonly cell: number }
    | { readonly type: 'trackBoundaryCrossed'; readonly from: number; readonly to: number }
    | { readonly type: 'endTrackDrag' }
    | { readonly type: 'restart' }
    /**
     * Track option menu (confirmed by the user): directly sets EXACTLY this cell's own 2
     * connections — scoped to this cell alone, unlike a drag crossing. Never touches any
     * neighbour: no reciprocal link, no redirect, no wrongTarget/RedX/mistake, even for a
     * direction that turns out not to be on the solution path. `directions` must be 2 distinct
     * Direction values; Presentation only ever sends a pair it already found geometrically valid
     * via trackOptions.computeTrackOptionValidity (never a Solution Truth check).
     */
    | { readonly type: 'applyTrackShape'; readonly cell: number; readonly directions: readonly [Direction, Direction] }
    /** Track option menu's "track preview" option: clears a cell's links back to a bare TrackPreview. */
    | { readonly type: 'resetTrackPreview'; readonly cell: number }
    /**
     * Place Track (confirmed by the user, modelled on the existing Place Dog hint): auto-places
     * ONE correct Track on a required cell that isn't correctly placed yet. GameSession alone
     * picks which cell (see GameSession.findNextTrackCell) — this command carries no payload.
     * Charge-counting (like placeDogCharges) is Presentation's concern, same as Place Dog.
     */
    | { readonly type: 'placeTrack' }
    /**
     * Revive (confirmed by the user, via the new ConnectTracks Lose popup's "watch ad" button):
     * only meaningful when `phase === Lost` — gives back a fresh mistake budget and resumes Active
     * play WITHOUT touching the board (unlike 'restart', which wipes every placed track). Ad-charge
     * accounting (like placeDogCharges) is Presentation's concern, same as Place Dog/Place Track.
     */
    | { readonly type: 'revive' };
