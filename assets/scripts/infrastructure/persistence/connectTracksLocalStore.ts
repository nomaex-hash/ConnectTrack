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
    /** Mốc (ms epoch) của lần ghi gần nhất — dùng để so bản local với bản trên cloud (Facebook). */
    savedAt?: number;
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
    private readonly persistListeners: Array<() => void> = [];

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
            this.doc.savedAt = Date.now();
            sys.localStorage.setItem(KEY, JSON.stringify(this.doc));
            this.notifyPersisted();
            return true;
        } catch (error) {
            warn('[ConnectTracks] Cannot save local data.', error);
            return false;
        }
    }

    private notifyPersisted(): void {
        for (const listener of this.persistListeners) {
            try {
                listener();
            } catch (error) {
                warn('[ConnectTracks] Persist listener failed.', error);
            }
        }
    }

    /** Gọi `listener` sau MỖI lần ghi local thành công (dùng để đẩy lên cloud). Trả về hàm huỷ đăng ký. */
    onPersisted(listener: () => void): () => void {
        this.persistListeners.push(listener);
        return () => {
            const index = this.persistListeners.indexOf(listener);
            if (index >= 0) this.persistListeners.splice(index, 1);
        };
    }

    /** Mốc ghi gần nhất của document local; 0 nếu chưa từng ghi (hoặc là save cũ chưa có mốc). */
    getSavedAt(): number {
        const value = this.load().savedAt;
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }

    /** Chuỗi JSON của TOÀN BỘ document hiện tại — dùng làm payload gửi lên cloud. */
    exportSnapshot(): string {
        // `legacyConfig` là bản sao của `configuration` — mà snapshot này lại được lưu VÀO configuration
        // để đồng bộ lên Facebook, nên phải bỏ nó đi để không lồng đệ quy và phình dần theo mỗi lần lưu.
        const { legacyConfig: _omitted, ...rest } = this.load();
        return JSON.stringify(rest);
    }

    /**
     * Thay TOÀN BỘ document local bằng snapshot lấy từ cloud. Trả về false (và KHÔNG đổi gì) nếu snapshot
     * không phải document hợp lệ hoặc không ghi được xuống storage. Giữ nguyên `savedAt` của snapshot và
     * KHÔNG phát `onPersisted` (tránh đẩy ngược đúng bản vừa tải về).
     */
    importSnapshot(json: string): boolean {
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            return false;
        }
        if (!parsed || typeof parsed !== 'object') return false;
        const candidate = parsed as ConnectTracksSaveDocument;
        if (candidate.version !== 1 || !candidate.sessions || typeof candidate.sessions !== 'object') return false;
        const keptLegacyConfig = this.load().legacyConfig;
        if (candidate.legacyConfig === undefined && keptLegacyConfig !== undefined) {
            candidate.legacyConfig = keptLegacyConfig;
        }
        try {
            sys.localStorage.setItem(KEY, JSON.stringify(candidate));
        } catch (error) {
            warn('[ConnectTracks] Cannot store cloud snapshot locally.', error);
            return false;
        }
        this.doc = candidate;
        return true;
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
