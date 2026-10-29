import { warn } from 'cc';
import { CloudSavePort } from '../../application/ports/cloudSavePort';

/** Phần của ConnectTracksLocalStore mà tầng đồng bộ cần (tách ra để test không phải dựng cả store). */
export interface CloudSyncLocalStore {
    onPersisted(listener: () => void): () => void;
    getSavedAt(): number;
    exportSnapshot(): string;
    importSnapshot(json: string): boolean;
}

export type CloudPullResult =
    | 'adopted-cloud'   // bản cloud mới hơn -> đã thay bản local
    | 'pushed-local'    // bản local mới hơn (hoặc cloud trống) -> đã đẩy lên cloud
    | 'unchanged'       // hai bên cùng mốc, hoặc cả hai đều trống
    | 'failed';         // không đọc được cloud (lỗi/quá hạn) -> giữ local, KHÔNG đẩy lên trong phiên này

export interface CloudSyncOptions {
    /** Đợi bao lâu sau lần ghi local cuối cùng thì đẩy lên cloud (gộp nhiều lần ghi liên tiếp). */
    readonly debounceMs?: number;
    /** Quá hạn này mà cloud chưa trả lời thì bỏ qua để không treo màn loading. */
    readonly pullTimeoutMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 2000;
const DEFAULT_PULL_TIMEOUT_MS = 4000;

/**
 * Đồng bộ document `connecttracks:save:v1` lên cloud của nền tảng (Facebook player data).
 *
 * LUẬT HOÀ GIẢI (đang là UNKNOWN theo CLAUDE.md — chưa có xác nhận của User, chọn cách đơn giản
 * và dễ đảo ngược nhất, gói gọn trong `reconcile`): so `savedAt` của CẢ document, bên mới hơn thắng
 * nguyên khối; không trộn từng field.
 *
 * AN TOÀN: chỉ được ĐẨY lên cloud sau khi đã ĐỌC cloud thành công ít nhất một lần trong phiên. Nếu
 * đọc thất bại thì tuyệt đối không ghi (tránh ghi đè tiến trình mới hơn từ thiết bị khác bằng bản
 * local cũ); local vẫn lưu bình thường.
 */
export class ConnectTracksCloudSync {
    private readonly debounceMs: number;
    private readonly pullTimeoutMs: number;
    private canPush = false;
    private dirty = false;
    private pushing: Promise<void> | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private unsubscribe: (() => void) | null = null;

    constructor(
        private readonly store: CloudSyncLocalStore,
        private readonly cloud: CloudSavePort,
        options: CloudSyncOptions = {},
    ) {
        this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
        this.pullTimeoutMs = options.pullTimeoutMs ?? DEFAULT_PULL_TIMEOUT_MS;
    }

    /** Gọi 1 lần lúc boot, TRƯỚC khi SaveManager.load(). Không bao giờ ném lỗi. */
    async pull(): Promise<CloudPullResult> {
        let remote: string | null;
        try {
            remote = await this.withTimeout(this.cloud.read());
        } catch (error) {
            warn('[ConnectTracksCloudSync] Cannot read cloud save; staying local-only this session.', error);
            return 'failed';
        }

        const result = this.reconcile(remote);
        this.canPush = true;
        this.unsubscribe?.();
        this.unsubscribe = this.store.onPersisted(() => this.markDirty());
        if (result === 'pushed-local') this.markDirty(true);
        return result;
    }

    /** Đẩy ngay phần đang chờ (nếu có) rồi ép nền tảng ghi. Gọi khi game bị pause/đóng. */
    async flush(): Promise<void> {
        if (!this.canPush) return;
        this.clearTimer();
        await this.push();
        try {
            await this.cloud.flush();
        } catch (error) {
            warn('[ConnectTracksCloudSync] flush failed.', error);
        }
    }

    dispose(): void {
        this.clearTimer();
        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    private reconcile(remote: string | null): CloudPullResult {
        const localSavedAt = this.store.getSavedAt();
        const remoteSavedAt = remote === null ? 0 : readSavedAt(remote);

        if (remoteSavedAt > localSavedAt) {
            return this.store.importSnapshot(remote as string) ? 'adopted-cloud' : 'unchanged';
        }
        if (localSavedAt > remoteSavedAt) return 'pushed-local';
        return 'unchanged';
    }

    private markDirty(immediate = false): void {
        if (!this.canPush) return;
        this.dirty = true;
        this.clearTimer();
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.push();
        }, immediate ? 0 : this.debounceMs);
    }

    private push(): Promise<void> {
        if (this.pushing) return this.pushing;
        if (!this.dirty) return Promise.resolve();
        const running = this.pushLoop().then(() => { this.pushing = null; });
        this.pushing = running;
        return running;
    }

    private async pushLoop(): Promise<void> {
        while (this.dirty) {
            this.dirty = false;
            try {
                await this.cloud.write(this.store.exportSnapshot());
            } catch (error) {
                // Giữ dirty để lần ghi local kế tiếp (hoặc flush) thử lại; không lặp vô hạn.
                this.dirty = true;
                warn('[ConnectTracksCloudSync] Cannot write cloud save.', error);
                return;
            }
        }
    }

    private clearTimer(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private withTimeout<T>(promise: Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Cloud save read timed out.')), this.pullTimeoutMs);
            promise.then(
                (value) => { clearTimeout(timeout); resolve(value); },
                (error: unknown) => { clearTimeout(timeout); reject(error); },
            );
        });
    }
}

function readSavedAt(json: string): number {
    try {
        const value = (JSON.parse(json) as { savedAt?: unknown }).savedAt;
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    } catch {
        return 0;
    }
}
