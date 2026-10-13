import { ContextUpdatePayload, IFBInstantManager, PlatformPlayer, SignedPlayerInfo } from './IFBInstantManager';
import './FBInstantTypes';

/** Implementation thật — bọc FBInstant SDK (chỉ tồn tại khi build Facebook Instant Games). */
export class FBInstantManager implements IFBInstantManager {
    private ready = false;

    async init(): Promise<void> {
        if (typeof FBInstant === 'undefined') {
            throw new Error('[FBInstantManager] FBInstant SDK chưa được nạp.');
        }
        await FBInstant.startGameAsync();
        this.ready = true;
    }

    isReady(): boolean {
        return this.ready;
    }

    getPlayer(): PlatformPlayer | null {
        if (!this.ready || typeof FBInstant === 'undefined') return null;

        return {
            id: FBInstant.player.getID() ?? '',
            name: FBInstant.player.getName() ?? '',
            photoUrl: FBInstant.player.getPhoto() ?? '',
        };
    }

    async getSignedPlayerInfo(): Promise<SignedPlayerInfo | null> {
        if (!this.ready || typeof FBInstant === 'undefined') return null;

        const info = await FBInstant.player.getSignedPlayerInfoAsync('metadata');
        return { playerId: info.getPlayerID(), signature: info.getSignature() };
    }

    getContextId(): string | null {
        if (!this.ready || typeof FBInstant === 'undefined') return null;
        return FBInstant.context.getID();
    }

    async chooseContext(): Promise<void> {
        if (typeof FBInstant === 'undefined') return;
        await FBInstant.context.chooseAsync();
    }

    async createContext(playerId: string): Promise<void> {
        if (typeof FBInstant === 'undefined') return;
        await FBInstant.context.createAsync(playerId);
    }

    async switchContext(contextId: string): Promise<void> {
        if (typeof FBInstant === 'undefined') return;
        await FBInstant.context.switchAsync(contextId);
    }

    async updateContext(payload: ContextUpdatePayload): Promise<void> {
        if (typeof FBInstant === 'undefined') return;

        await FBInstant.updateAsync({
            action: 'CUSTOM',
            cta: 'Chơi ngay',
            template: 'dogdoku_generic',
            text: { default: payload.text },
            data: payload.imageBase64 ? { imageBase64: payload.imageBase64 } : undefined,
        });
    }
}
