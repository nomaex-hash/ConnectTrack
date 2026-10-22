import { _decorator, AssetManager, assetManager, Component, Prefab } from 'cc';

const { ccclass } = _decorator;

/** Quá thời gian này mà bundle chưa nạp xong thì coi là lỗi (xem loadBundle). */
const BUNDLE_LOAD_TIMEOUT_MS = 20000;

@ccclass('ResourceManager')
export class ResourceManager extends Component {
    private static _instance: ResourceManager | null = null;
    static get instance(): ResourceManager {
        if (!this._instance) throw new Error('ResourceManager chưa được khởi tạo.');
        return this._instance;
    }

    private readonly bundleCache: Map<string, AssetManager.Bundle> = new Map();
    private readonly pendingBundles: Map<string, Promise<AssetManager.Bundle>> = new Map();

    onLoad(): void {
        ResourceManager._instance = this;
    }

    async init(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Tải 1 Bundle (đánh dấu qua Editor: chọn thư mục trong Assets → tick "Bundle") theo tên,
     * cache lại để lần sau gọi trả về ngay — dùng cho lazy-load prefab UI (vd trang Shop/
     * Leaderboard trong HomeTabGroupManager, mirror MConfigResourceUtils.loadPrefabUI_Bundle
     * của dự án tham khảo).
     */
    loadBundle(bundleName: string): Promise<AssetManager.Bundle> {
        const cached = this.bundleCache.get(bundleName);
        if (cached) return Promise.resolve(cached);

        const pending = this.pendingBundles.get(bundleName);
        if (pending) return pending;

        const promise = new Promise<AssetManager.Bundle>((resolve, reject) => {
            // Nếu file config.json của bundle trả về không phải JSON (vd host trả index.html/404 cho đường dẫn thiếu),
            // engine ném TypeError NGAY TRONG callback nội bộ và KHÔNG BAO GIỜ gọi callback của ta -> promise treo mãi
            // và Bootloader kẹt ở màn loading. Hẹn giờ chờ để biến trường hợp đó thành lỗi có thể xử lý.
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                this.pendingBundles.delete(bundleName);
                reject(new Error(
                    `Hết thời gian chờ bundle '${bundleName}' (${BUNDLE_LOAD_TIMEOUT_MS}ms) — kiểm tra file ` +
                    `assets/${bundleName}/config.json trên host có tồn tại và trả về JSON không.`,
                ));
            }, BUNDLE_LOAD_TIMEOUT_MS);
            assetManager.loadBundle(bundleName, (error, bundle) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                this.pendingBundles.delete(bundleName);
                if (error || !bundle) {
                    reject(error ?? new Error(`Không tải được bundle '${bundleName}'.`));
                    return;
                }
                this.bundleCache.set(bundleName, bundle);
                resolve(bundle);
            });
        });
        this.pendingBundles.set(bundleName, promise);
        return promise;
    }

    /** Tải 1 Prefab bên trong 1 Bundle (đường dẫn KHÔNG kèm đuôi .prefab, tính từ gốc Bundle). */
    async loadPrefabFromBundle(bundleName: string, prefabPath: string): Promise<Prefab> {
        const bundle = await this.loadBundle(bundleName);
        return new Promise<Prefab>((resolve, reject) => {
            bundle.load(prefabPath, Prefab, (error, asset) => {
                if (error || !asset) {
                    reject(error ?? new Error(`Không tải được prefab '${prefabPath}' trong bundle '${bundleName}'.`));
                    return;
                }
                resolve(asset);
            });
        });
    }

    /**
     * Tải TRƯỚC (download + cache phụ thuộc, KHÔNG parse/dựng node) 1 Prefab trong Bundle để lần
     * loadPrefabFromBundle() sau gần như tức thì. Ném lỗi nếu bundle không tải được (vd bundle chưa được
     * tạo trong Editor) — caller tự quyết định nuốt lỗi hay không.
     */
    async preloadPrefabFromBundle(bundleName: string, prefabPath: string): Promise<void> {
        const bundle = await this.loadBundle(bundleName);
        return new Promise<void>((resolve, reject) => {
            bundle.preload(prefabPath, Prefab, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
}
