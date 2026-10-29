import { CloudSavePort } from '../../application/ports/cloudSavePort';

/** Phần của `framework/configuration` (script dùng chung) mà adapter dùng. */
export interface ConfigurationLike {
    jsonData: Record<string, unknown>;
    /** Gán 1 key rồi tự lên lịch lưu: configuration.save() -> FBInstantManager.SetDataPlayer(str). */
    setGlobalData(key: string, value: unknown): void;
    /** Ép ghi NGAY (bỏ debounce 1 giây của save()). */
    flushNow(): void;
}

export interface ConfigurationCloudSaveOptions {
    readonly configuration: ConfigurationLike;
    /** Key trong configuration.jsonData chứa nguyên document ConnectTracks (dạng chuỗi JSON). */
    readonly key: string;
    /** true khi configuration đã nạp xong dữ liệu người chơi từ Facebook (localConfig.isGetPlayerDataSuccess). */
    readonly isPlayerDataReady: () => boolean;
    readonly pollIntervalMs?: number;
    /** Chờ tối đa bao lâu cho dữ liệu người chơi sẵn sàng trước khi từ bỏ (đọc coi như lỗi). */
    readonly maxWaitMs?: number;
}

const DEFAULT_POLL_MS = 100;
const DEFAULT_MAX_WAIT_MS = 15_000;

/**
 * CloudSavePort đi qua `configuration` dùng chung — đúng chỗ game lưu data lên Facebook
 * (configuration.save() -> FBInstantManager.SetDataPlayer). Document ConnectTracks được lưu như 1 key
 * của configuration.jsonData, nên không có đường ghi riêng nào khác lên player data của Facebook.
 */
export class ConfigurationCloudSaveAdapter implements CloudSavePort {
    constructor(private readonly options: ConfigurationCloudSaveOptions) {}

    async read(): Promise<string | null> {
        await this.waitUntilReady();
        const value = this.options.configuration.jsonData[this.options.key];
        return typeof value === 'string' ? value : null;
    }

    async write(payload: string): Promise<void> {
        this.options.configuration.setGlobalData(this.options.key, payload);
    }

    async flush(): Promise<void> {
        if (!this.options.isPlayerDataReady()) return;
        this.options.configuration.flushNow();
    }

    private waitUntilReady(): Promise<void> {
        if (this.options.isPlayerDataReady()) return Promise.resolve();
        const interval = this.options.pollIntervalMs ?? DEFAULT_POLL_MS;
        const maxWait = this.options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
        return new Promise<void>((resolve, reject) => {
            const startedAt = Date.now();
            const timer = setInterval(() => {
                if (this.options.isPlayerDataReady()) {
                    clearInterval(timer);
                    resolve();
                } else if (Date.now() - startedAt >= maxWait) {
                    clearInterval(timer);
                    reject(new Error('Player data from Facebook was not ready in time.'));
                }
            }, interval);
        });
    }
}
