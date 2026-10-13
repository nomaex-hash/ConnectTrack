import { ConnectTracksInventoryPort } from '../../application/ports/connectTracksInventoryPort';
import { connectTracksLocalStore } from './connectTracksLocalStore';

/** Local-storage-backed Place Track charges; never touches the legacy Meowdoku save document. Thin
 * wrapper around connectTracksLocalStore (xác nhận từ user: gộp về 1 key localStorage duy nhất cho
 * ConnectTracks thay vì 1 key riêng cho kho Place Track). */
export class CocosConnectTracksInventoryAdapter implements ConnectTracksInventoryPort {
    readPlaceTrackCharges(): number | null {
        return connectTracksLocalStore.readPlaceTrackCharges();
    }

    writePlaceTrackCharges(charges: number): void {
        connectTracksLocalStore.writePlaceTrackCharges(charges);
    }
}
