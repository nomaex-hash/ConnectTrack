import { ContextUpdatePayload, IFBInstantManager, PlatformPlayer, SignedPlayerInfo } from './IFBInstantManager';

/**
 * Chạy khi không có FBInstant (Editor/preview) — player giả cố định, mọi thao tác context
 * là no-op có log, KHÔNG có chữ ký thật (backend thật không gọi được, xem MockPGSPlayInstantManager).
 */
export class MockFBInstantManager implements IFBInstantManager {
    private readonly mockPlayer: PlatformPlayer = {
        id: 'mock-player',
        name: 'Người chơi thử',
        photoUrl: '',
    };

    async init(): Promise<void> {}

    isReady(): boolean {
        return true;
    }

    getPlayer(): PlatformPlayer | null {
        return this.mockPlayer;
    }

    async getSignedPlayerInfo(): Promise<SignedPlayerInfo | null> {
        return null;
    }

    getContextId(): string | null {
        return null;
    }

    async chooseContext(): Promise<void> {
        console.log('[MockPlatform] chooseContext');
    }

    async createContext(playerId: string): Promise<void> {
        console.log('[MockPlatform] createContext', playerId);
    }

    async switchContext(contextId: string): Promise<void> {
        console.log('[MockPlatform] switchContext', contextId);
    }

    async updateContext(payload: ContextUpdatePayload): Promise<void> {
        console.log('[MockPlatform] updateContext', payload);
    }
}
