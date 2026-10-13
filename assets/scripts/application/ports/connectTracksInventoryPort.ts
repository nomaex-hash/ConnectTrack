/**
 * Place Track charges (confirmed by the user, modelled on the existing Place Dog booster) — a
 * small PLAYER-level inventory for ConnectTracks, persisting across levels (unlike board progress,
 * which is per-level). Deliberately separate from the legacy Dogdoku/Meowdoku save document
 * (SaveManager.playerData.inventory) — song song, not entangled with it.
 */
export interface ConnectTracksInventoryPort {
    /** Null means "never saved before" — the caller seeds a starting amount in that case. */
    readPlaceTrackCharges(): number | null;
    writePlaceTrackCharges(charges: number): void;
}
