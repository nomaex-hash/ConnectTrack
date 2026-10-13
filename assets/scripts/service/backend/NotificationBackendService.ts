import { BackendConfig } from '../../config/BackendConfig';
import { IFBInstantManager } from '../platform/IFBInstantManager';
import { IPGSPlayInstantManager } from './IPGSPlayInstantManager';


export class NotificationBackendService {
    constructor(
        private readonly client: IPGSPlayInstantManager,
        private readonly platform: IFBInstantManager,
    ) {}

    async send(): Promise<void> {
        if (!this.client.isAvailable()) return;
        const player = this.platform.getPlayer();
        if (!player) return;

        await this.client.post('/api/a2u-notifications/', { gameId: BackendConfig.gameId, playerId: player.id });
    }

    async cancel(): Promise<void> {
        if (!this.client.isAvailable()) return;
        const player = this.platform.getPlayer();
        if (!player) return;

        await this.client.post('/api/a2u-notifications/cancel', {
            gameId: BackendConfig.gameId,
            playerId: player.id,
        });
    }
}
