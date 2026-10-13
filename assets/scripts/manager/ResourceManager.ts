import { _decorator, AssetManager, assetManager, Component, Prefab } from 'cc';

const { ccclass } = _decorator;

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
            assetManager.loadBundle(bundleName, (error, bundle) => {
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
}
