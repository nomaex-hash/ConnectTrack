import { BackendConfig } from '../../config/BackendConfig';
import { IPGSPlayInstantManager } from './IPGSPlayInstantManager';


export interface RemoteConfigData {
    readonly raw: Readonly<Record<string, unknown>>;
}

export class RemoteConfigService {
    constructor(private readonly client: IPGSPlayInstantManager) {}

    async fetch(): Promise<RemoteConfigData | null> {
        if (!this.client.isAvailable()) return null;

        const result = await this.client.get<{ data: Record<string, unknown> }>(
            `/api/game-data/${BackendConfig.gameId}`,
        );
        return { raw: result.data };
    }
}
