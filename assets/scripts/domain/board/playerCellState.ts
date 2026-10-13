/**
 * Player-owned state of a single cell. Separate from Level Solution Truth,
 * the Main Track, and transient Interaction State (e.g. Track ?).
 */
export enum PlayerCellState {
    Empty = 'Empty',
    X = 'X',
    TrackPreview = 'TrackPreview',
    Track = 'Track',
    RedX = 'RedX',
}
