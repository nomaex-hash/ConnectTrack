import { sys, warn } from 'cc';

const KEY = 'connecttracks:save:v1';

interface ConnectTracksSaveDocument {
    version: 1;
    placeTrackCharges?: number;
    sessions: Record<string, unknown>;
}

function emptyDoc(): ConnectTracksSaveDocument {
    return { version: 1, sessions: {} };
}

/**
 * Singleton gộp TOÀN BỘ dữ liệu lưu local của ConnectTracks — kho Place Track + board-in-progress
 * của từng level — vào ĐÚNG 1 key localStorage duy nhất (xác nhận từ user: "chỉ giữ lại 1 key
 * chính của connecttrack"). Trước đây mỗi phần có key riêng (1 cho kho Place Track, 1 CHO MỖI
 * LEVEL còn dở — connecttracks:session:v1:campaign:1:, ...:campaign:25:...), cộng dồn theo thời
 * gian chơi/test thành nhiều key rải rác trong localStorage.
 *
 * Dùng bởi CocosSessionProgressAdapter (board-in-progress, theo id level) và
 * CocosConnectTracksInventoryAdapter (kho Place Track, toàn cục) — cả 2 chỉ còn là lớp mỏng
 * uỷ quyền xuống đây, không tự đụng localStorage nữa. Đọc/parse 1 LẦN rồi cache trong bộ nhớ, ghi
 * lại NGUYÊN document mỗi lần có thay đổi (tần suất gọi thấp — mỗi lần thắng/thua/thoát màn, hoặc
 * mỗi lần dùng/nạp Place Track — ghi lại cả document mỗi lần là đủ rẻ, không cần debounce).
 */
class ConnectTracksLocalStore {
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
        return this.doc;
    }

    private persist(): void {
        if (!this.doc) return;
        try {
            sys.localStorage.setItem(KEY, JSON.stringify(this.doc));
        } catch (error) {
            warn('[ConnectTracks] Cannot save local data.', error);
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
}

export const connectTracksLocalStore = new ConnectTracksLocalStore();
