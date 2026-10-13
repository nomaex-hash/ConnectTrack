import { LevelData } from '../../domain/level/levelData';
import { LevelDataPort } from '../ports/levelDataPort';

/** One speculative level per owner. Loading never creates a session or changes progression. */
export class PreloadedLevelData implements LevelDataPort {
    private pending: { id: string; promise: Promise<LevelData> } | null = null;

    constructor(private readonly source: LevelDataPort) {}

    async preload(id: string): Promise<void> {
        if (this.pending?.id === id) {
            await this.pending.promise;
            return;
        }
        const entry = { id, promise: this.source.loadLevel(id) };
        this.pending = entry;
        try { await entry.promise; }
        catch (error) {
            if (this.pending === entry) this.pending = null;
            throw error;
        }
    }

    loadLevel(id: string): Promise<LevelData> {
        if (this.pending?.id === id) {
            const promise = this.pending.promise;
            this.pending = null;
            return promise;
        }
        return this.source.loadLevel(id);
    }
}
