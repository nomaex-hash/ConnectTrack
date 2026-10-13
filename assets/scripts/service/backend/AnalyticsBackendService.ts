import { BackendConfig } from '../../config/BackendConfig';
import { IFBInstantManager } from '../platform/IFBInstantManager';
import { IPGSPlayInstantManager } from './IPGSPlayInstantManager';

export class AnalyticsBackendService {
    constructor(
        private readonly client: IPGSPlayInstantManager,
        private readonly platform: IFBInstantManager,
    ) {}

    async trackEvent(
        clientId: string,
        eventName: string,
        params: Readonly<Record<string, unknown>> = {},
        userProperties: Readonly<Record<string, unknown>> = {},
    ): Promise<void> {
        if (!this.client.isAvailable()) return;
        const player = this.platform.getPlayer();
        if (!player) return;

        await this.client.post('/api/track-event/', {
            gameId: BackendConfig.gameId,
            clientId,
            eventName,
            params,
            userId: player.id,
            userProperties,
        });
    }
}
