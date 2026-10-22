import { sys, warn } from 'cc';

const KEY = 'connecttracks:save:v1';

/**
 * Hai key CŨ được gộp vào document này (đọc để migrate 1 lần, sau đó xoá):
 *  - 'dogdoku_save_data' — save người chơi (SaveManager/LocalSaveService)  -> field `player`
 *  - 'MagicSort'         — `configuration` thừa kế từ dự án mẫu MagicSort   -> field `legacyConfig`
 * Hardcode chuỗi (không import Constants.GAME_NAME) để migration không phụ thuộc vào việc ai đó đổi
 * hằng số đó sau này.
 */
const LEGACY_PLAYER_KEY = 'dogdoku_save_data';
const LEGACY_CONFIG_KEY = 'MagicSort';

type MergedField = 'player' | 'legacyConfig';

interface ConnectTracksSaveDocument {
    version: 1;
    placeTrackCharges?: number;
    sessions: Record<string, unknown>;
    /** Chuỗi JSON NGUYÊN VĂN của save người chơi (do SaveDataSerializer tạo) — lưu dạng chuỗi để không
     * biến đổi byte nào so với trước khi gộp. */
    player?: string;
    /** Chuỗi JSON NGUYÊN VĂN của `configuration` (shop/IAP/heart/leaderboard... thừa kế từ MagicSort). */
    legacyConfig?: string;
}

function emptyDoc(): ConnectTracksSaveDocument {
    return { version: 1, sessions: {} };
}

/**
 * Singleton gộp TOÀN BỘ dữ liệu lưu local của ConnectTracks vào ĐÚNG 1 key localStorage duy nhất
 * (`connecttracks:save:v1`): board-in-progress từng level + kho Place Track + save người chơi +
 * config thừa kế. Mọi thành phần đều đi qua singleton này (1 bản cache trong bộ nhớ, 1 nơi ghi) nên
 * không còn tình trạng 2 nơi ghi đè lên nhau.
 *
 * MIGRATION AN TOÀN (xem migrateLegacyKeys): chỉ chạy lúc load đầu tiên; KHÔNG BAO GIỜ ghi đè dữ liệu
 * đã có trong document mới; chỉ xoá key cũ SAU KHI đã ghi document mới và đọc lại kiểm tra khớp.
 * Nếu ghi/kiểm tra thất bại thì key cũ được giữ nguyên để thử lại ở lần mở sau.
 *
 * Đọc/parse 1 LẦN rồi cache; ghi lại NGUYÊN document mỗi lần có thay đổi.
 */
export class ConnectTracksLocalStore {
    private doc: ConnectTracksSaveDocument | null = null;

    private load(): ConnectTracksSaveDocument {
        if (this.doc) return this.doc;
        try {
            const raw = sys.localStorage.getItem(KEY);
            const parsed: unknown = raw ? JSON.parse(raw) : null;
            this.doc = parsed && typeof parsed === 'object' && 'sessions' in (parsed as object)
                ? (parsed as ConnectTracksSaveDocument)
                : emptyDoc();
        } catch (error) {
            warn('[ConnectTracks] Cannot read local save — starting fresh.', error);
            this.doc = emptyDoc();
        }
        this.migrateLegacyKeys(this.doc);
        return this.doc;
    }

    /** Ghi document xuống storage. Trả về false nếu thất bại (không ném lỗi). */
    private persist(): boolean {
        if (!this.doc) return false;
        try {
            sys.localStorage.setItem(KEY, JSON.stringify(this.doc));
            return true;
        } catch (error) {
            warn('[ConnectTracks] Cannot save local data.', error);
            return false;
        }
    }

    /** Đọc lại KEY từ storage và kiểm tra các field đã migrate khớp với bộ nhớ. */
    private verifyPersisted(fields: ReadonlyArray<MergedField>): boolean {
        try {
            const raw = sys.localStorage.getItem(KEY);
            if (!raw) return false;
            const stored = JSON.parse(raw) as ConnectTracksSaveDocument;
            return fields.every((field) => stored[field] === this.doc?.[field]);
        } catch {
            return false;
        }
    }

    private readLegacy(key: string): string | null {
        try {
            const raw = sys.localStorage.getItem(key);
            return typeof raw === 'string' && raw.length > 0 ? raw : null;
        } catch (error) {
            warn(`[ConnectTracks] Cannot read legacy key "${key}".`, error);
            return null;
        }
    }

    /**
     * Gộp 2 key cũ vào document. Quy tắc an toàn:
     *  1. Document mới LUÔN thắng — field đã có dữ liệu thì không bị ghi đè bởi key cũ.
     *  2. Key cũ giống hệt dữ liệu đã có -> coi như đã migrate, được xoá.
     *  3. Key cũ KHÁC dữ liệu đã có -> giữ nguyên key cũ (không xoá) và cảnh báo; không đoán bên nào đúng.
     *  4. Chỉ xoá key cũ sau khi ghi document mới thành công VÀ đọc lại thấy khớp.
     */
    private migrateLegacyKeys(doc: ConnectTracksSaveDocument): void {
        const mappings: ReadonlyArray<{ key: string; field: MergedField }> = [
            { key: LEGACY_PLAYER_KEY, field: 'player' },
            { key: LEGACY_CONFIG_KEY, field: 'legacyConfig' },
        ];
        const removable: string[] = [];
        const copiedFields: MergedField[] = [];
        for (const { key, field } of mappings) {
            const raw = this.readLegacy(key);
            if (raw === null) continue;
            if (doc[field] === undefined) {
                doc[field] = raw;
                copiedFields.push(field);
                removable.push(key);
            } else if (doc[field] === raw) {
                removable.push(key);
            } else {
                warn(`[ConnectTracks] Legacy key "${key}" differs from the merged save; keeping both (merged save wins).`);
            }
        }
        if (removable.length === 0) return;

        if (copiedFields.length > 0) {
            if (!this.persist() || !this.verifyPersisted(copiedFields)) {
                warn('[ConnectTracks] Legacy save migration could not be verified; legacy keys kept for retry.');
                return;
            }
        }
        for (const key of removable) {
            try {
                sys.localStorage.removeItem(key);
            } catch (error) {
                warn(`[ConnectTracks] Cannot remove migrated legacy key "${key}".`, error);
            }
        }
    }

    readPlaceTrackCharges(): number | null {
        const value = this.load().placeTrackCharges;
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }

    writePlaceTrackCharges(charges: number): void {
        this.load().placeTrackCharges = charges;
        this.persist();
    }

    readSession(id: string): unknown {
        return this.load().sessions[id] ?? null;
    }

    writeSession(id: string, progress: unknown): void {
        this.load().sessions[id] = progress;
        this.persist();
    }

    removeSession(id: string): void {
        const doc = this.load();
        if (id in doc.sessions) {
            delete doc.sessions[id];
            this.persist();
        }
    }

    /** Save người chơi (chuỗi JSON của SaveDataSerializer), hoặc null nếu chưa có. */
    readPlayerSave(): string | null {
        return this.load().player ?? null;
    }

    /** Ném lỗi nếu không ghi được xuống storage (SaveManager.persist() bắt và log). */
    writePlayerSave(json: string): void {
        this.load().player = json;
        if (!this.persist()) throw new Error('[ConnectTracks] Cannot write player save to localStorage.');
    }

    /** Chuỗi JSON của `configuration` (config thừa kế từ MagicSort), hoặc null nếu chưa có. */
    readLegacyConfig(): string | null {
        return this.load().legacyConfig ?? null;
    }

    writeLegacyConfig(json: string): void {
        this.load().legacyConfig = json;
        if (!this.persist()) throw new Error('[ConnectTracks] Cannot write legacy config to localStorage.');
    }
}

export const connectTracksLocalStore = new ConnectTracksLocalStore();
