import { JsonAsset, resources } from 'cc';
import { PuzzleData } from '../model/PuzzleData';
import { PuzzleContext } from '../model/BoardSaveData';
import { getPuzzlePath, getPuzzleCount, isValidPuzzleId } from '../config/LevelListConfig';
import { parsePuzzleData } from '../data/PuzzleDataParser';
import { IPuzzleProvider } from './IPuzzleProvider';

interface PendingPreload {
    readonly context: PuzzleContext;
    readonly id: number;
    readonly promise: Promise<PuzzleData>;
}

export class LocalPuzzleProvider implements IPuzzleProvider {
    private pendingPreload: PendingPreload | null = null;

    /** Cache PuzzleData ĐÃ PARSE theo "context:id" — resources.load() của Cocos KHÔNG tự tái sử
     * dụng asset đã tải trước đó trong môi trường Preview (đo được: tải lại ĐÚNG file đã tải 1 lần
     * rồi vẫn mất ~1.3s y hệt lần đầu, dù không release() gì cả) — nên tự giữ kết quả đã parse ở
     * đây, bỏ qua hẳn resources.load() cho những id đã từng tải trong phiên này. File puzzle rất
     * nhỏ (1-2KB) nên giữ cả trăm màn trong bộ nhớ không đáng kể. */
    private readonly cache = new Map<string, PuzzleData>();

    private cacheKey(context: PuzzleContext, id: number): string {
        return `${context}:${id}`;
    }

    async load(context: PuzzleContext, id: number): Promise<PuzzleData> {
        const cached = this.cache.get(this.cacheKey(context, id));
        if (cached) return cached;

        const pending = this.pendingPreload;
        if (pending && pending.context === context && pending.id === id) {
            this.pendingPreload = null;
            return pending.promise;
        }

        return this.performLoad(context, id);
    }

    preload(context: PuzzleContext, id: number): void {
        if (!isValidPuzzleId(context, id)) return;
        if (this.cache.has(this.cacheKey(context, id))) return;

        const pending = this.pendingPreload;
        if (pending && pending.context === context && pending.id === id) return;

        this.cancelPreload();

        const promise = this.performLoad(context, id).catch((error: unknown) => {
            if (this.pendingPreload?.promise === promise) this.pendingPreload = null;
            throw error;
        });
        this.pendingPreload = { context, id, promise };
    }

    cancelPreload(): void {
        const pending = this.pendingPreload;
        if (!pending) return;

        this.pendingPreload = null;
        resources.release(getPuzzlePath(pending.context, pending.id), JsonAsset);
    }

    release(context: PuzzleContext, id: number): void {
        if (!isValidPuzzleId(context, id)) return;
        resources.release(getPuzzlePath(context, id), JsonAsset);
    }

    private async performLoad(context: PuzzleContext, id: number): Promise<PuzzleData> {
        if (!isValidPuzzleId(context, id)) {
            throw new Error(
                `[LocalPuzzleProvider] id ${id} ngoài pool '${context}' ` +
                    `(1..${getPuzzleCount(context)}).`,
            );
        }

        const path = getPuzzlePath(context, id);
        const asset = await this.loadJsonAsset(path);

        try {
            const puzzle = parsePuzzleData(asset.json, context === 'tutorial');
            this.cache.set(this.cacheKey(context, id), puzzle);
            return puzzle;
        } catch (error: unknown) {

            resources.release(path, JsonAsset);
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`[LocalPuzzleProvider] Puzzle '${path}' hỏng: ${reason}`);
        }
    }

    private loadJsonAsset(path: string): Promise<JsonAsset> {
        return new Promise<JsonAsset>((resolve, reject) => {
            resources.load(path, JsonAsset, (error: Error | null, asset: JsonAsset) => {
                if (error) {
                    reject(new Error(`[LocalPuzzleProvider] Không load được '${path}': ${error.message}`));
                    return;
                }
                resolve(asset);
            });
        });
    }
}
