import { SessionProgressPort } from '../../application/ports/sessionProgressPort';
import { SessionProgress } from '../../application/session/sessionProgress';
import { connectTracksLocalStore } from './connectTracksLocalStore';

/** Local board progress only; never rewrites the legacy Meowdoku save document. Thin wrapper
 * around connectTracksLocalStore (xác nhận từ user: gộp về 1 key localStorage duy nhất cho
 * ConnectTracks thay vì 1 key riêng cho mỗi level). */
export class CocosSessionProgressAdapter implements SessionProgressPort {
    read(id: string): unknown {
        return connectTracksLocalStore.readSession(id);
    }
    write(id: string, progress: SessionProgress): void {
        connectTracksLocalStore.writeSession(id, progress);
    }
    remove(id: string): void {
        connectTracksLocalStore.removeSession(id);
    }
}
