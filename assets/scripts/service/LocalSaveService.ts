import { ISaveService } from './ISaveService';
import { connectTracksLocalStore } from '../infrastructure/persistence/connectTracksLocalStore';

/**
 * Save người chơi — nay nằm trong document duy nhất `connecttracks:save:v1` (field `player`) cùng với
 * mọi dữ liệu local khác của ConnectTracks, thay vì key riêng `dogdoku_save_data`. Key cũ được
 * connectTracksLocalStore tự migrate (an toàn, không ghi đè, chỉ xoá sau khi kiểm tra) ở lần đọc đầu.
 */
export class LocalSaveService implements ISaveService {
    async read(): Promise<string | null> {
        return connectTracksLocalStore.readPlayerSave();
    }

    async write(json: string): Promise<void> {
        connectTracksLocalStore.writePlayerSave(json);
    }
}
