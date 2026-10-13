import { BackendConfig } from '../../config/BackendConfig';
import { IFBInstantManager } from '../platform/IFBInstantManager';
import { IPGSPlayInstantManager } from './IPGSPlayInstantManager';

export interface LeaderboardEntry {
    readonly playerId: string;
    readonly name: string;
    readonly avatarUrl: string;
    /** Id trong AvatarCatalogConfig — có thì ưu tiên tra catalog cục bộ thay vì tải avatarUrl. Backend thật CHƯA trả field này. */
    readonly avatarId?: string;
    readonly frameId?: string;
    readonly score: number;
    readonly rank: number;
}

export interface LeaderboardFetchResult {
    readonly entries: readonly LeaderboardEntry[];
    readonly total: number;
}

interface RawLeaderboardInfo {
    readonly contextId: string;
    readonly _id: string;
}

interface RawScoreEntry {
    readonly playerId: string;
    readonly name: string;
    readonly avatar: string;
    /** Chỉ có ở dữ liệu giả (MockPGSPlayInstantManager) — backend thật chưa trả field này. */
    readonly avatarId?: string;
    readonly frameId?: string;
    readonly score: number;
    readonly rank: number;
}

function toLeaderboardEntry(raw: RawScoreEntry): LeaderboardEntry {
    return {
        playerId: raw.playerId,
        name: raw.name,
        avatarUrl: raw.avatar,
        avatarId: raw.avatarId,
        frameId: raw.frameId,
        score: raw.score,
        rank: raw.rank,
    };
}

export class ScoreBackendService {
    constructor(
        private readonly client: IPGSPlayInstantManager,
        private readonly platform: IFBInstantManager,
    ) {}

   
    async resolveLeaderboardIds(contextIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
        const map = new Map<string, string>();
        if (!this.client.isAvailable() || contextIds.length === 0) return map;

        const result = await this.client.get<{ data: RawLeaderboardInfo[] }>(
            `/api/leaderboard/${BackendConfig.gameId}/contextIds`,
            { contextIds: contextIds.join(',') },
        );
        for (const info of result.data) map.set(info.contextId, info._id);
        return map;
    }

    async submitScore(leaderboardId: string, score: number): Promise<void> {
        if (!this.client.isAvailable() || !leaderboardId) return;
        const player = this.platform.getPlayer();
        if (!player) return;

        await this.client.post('/api/player-score/', {
            gameId: BackendConfig.gameId,
            playerId: player.id,
            leaderboardId,
            score,
        });
    }

    async fetchLeaderboard(leaderboardId: string, limit = 100): Promise<LeaderboardFetchResult> {
        if (!this.client.isAvailable() || !leaderboardId) return { entries: [], total: 0 };

        const result = await this.client.get<{ data: RawScoreEntry[]; total: number }>(
            `/api/player-score/leaderboard/${leaderboardId}`,
            { limit: String(limit) },
        );
        return { entries: result.data.map(toLeaderboardEntry), total: result.total };
    }
}
