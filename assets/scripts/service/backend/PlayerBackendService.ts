import { BackendConfig } from '../../config/BackendConfig';
import { IFBInstantManager } from '../platform/IFBInstantManager';
import { IPGSPlayInstantManager } from './IPGSPlayInstantManager';

export interface PlayerScoreEntry {
    readonly playerId: string;
    readonly name: string;
    readonly avatarUrl: string;
    readonly score: number;
}

interface RawPlayerEntry {
    readonly playerId: string;
    readonly name: string;
    readonly avatar: string;
    readonly score: number;
}

function toPlayerScoreEntry(raw: RawPlayerEntry): PlayerScoreEntry {
    return { playerId: raw.playerId, name: raw.name, avatarUrl: raw.avatar, score: raw.score };
}

export class PlayerBackendService {
    constructor(
        private readonly client: IPGSPlayInstantManager,
        private readonly platform: IFBInstantManager,
    ) {}

    async registerPlayer(): Promise<void> {
        if (!this.client.isAvailable()) return;
        const player = this.platform.getPlayer();
        if (!player) return;

        await this.client.post(`/api/player/`, {
            gameId: BackendConfig.gameId,
            playerId: player.id,
            name: player.name || 'Guest',
            avatar: player.photoUrl,
            asid: '',
        });
    }

    async updatePlayerInfo(name: string, avatarUrl: string): Promise<void> {
        if (!this.client.isAvailable()) return;
        const player = this.platform.getPlayer();
        if (!player) return;

        await this.client.put(`/api/player/${player.id}`, {
            gameId: BackendConfig.gameId,
            playerId: player.id,
            name,
            avatar: avatarUrl,
            asid: '',
        });
    }

    async updatePlayerPoints(score: number): Promise<void> {
        if (!this.client.isAvailable()) return;
        const player = this.platform.getPlayer();
        if (!player) return;

        await this.client.put(`/api/player/${BackendConfig.gameId}/${player.id}/points`, { score });
    }

    async getPlayersByIds(playerIds: readonly string[]): Promise<readonly PlayerScoreEntry[]> {
        if (!this.client.isAvailable() || playerIds.length === 0) return [];

        const result = await this.client.get<{ data: RawPlayerEntry[] }>('/api/player/', {
            playerIds: playerIds.join(','),
            gameId: BackendConfig.gameId,
        });
        return result.data.map(toPlayerScoreEntry);
    }

    async getTopPlayers(limit = 100): Promise<readonly PlayerScoreEntry[]> {
        if (!this.client.isAvailable()) return [];

        const result = await this.client.get<{ data: RawPlayerEntry[] }>('/api/player/top-players', {
            gameId: BackendConfig.gameId,
            limit: String(limit),
            sortField: 'score',
            sortOrder: 'desc',
        });
        return result.data.map(toPlayerScoreEntry);
    }
}
