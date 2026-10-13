import { IPGSPlayInstantManager } from './IPGSPlayInstantManager';
import { loadFakeLeaderboardEntries } from './MockLeaderboardFixture';

// TODO(TEST): isAvailable()=true + nhánh get() bên dưới CHỈ để xem UI Leaderboard chạy được
// trong Cocos Editor Preview khi chưa có backend/gameId thật (BackendConfig.gameId vẫn là
// placeholder) — PHẢI XOÁ (trả isAvailable() về false, get() về throw như cũ) trước khi build
// thật, nếu không mọi lời gọi backend khác (submitScore, remote config...) cũng sẽ đi qua Mock
// và nhận lỗi/giá trị giả thay vì dữ liệu thật. Dữ liệu giả nằm ở
// assets/resources/data/test/FakeLeaderboardUsers.json (xem MockLeaderboardFixture).

export class MockPGSPlayInstantManager implements IPGSPlayInstantManager {
    isAvailable(): boolean {
        return true;
    }

    async get<T>(path: string, query?: Record<string, string>): Promise<T> {
        if (path.startsWith('/api/leaderboard/') && path.endsWith('/contextIds')) {
            const contextIds = query?.contextIds?.split(',') ?? [];
            return { data: contextIds.map((contextId) => ({ contextId, _id: `fake-${contextId}` })) } as T;
        }
        if (path.startsWith('/api/player-score/leaderboard/')) {
            const entries = await loadFakeLeaderboardEntries();
            return { data: entries, total: entries.length } as T;
        }
        throw new Error(`[MockPGSPlayInstantManager] Không có backend thật — GET ${path} bị bỏ qua.`);
    }

    async post<T>(path: string): Promise<T> {
        throw new Error(`[MockPGSPlayInstantManager] Không có backend thật — POST ${path} bị bỏ qua.`);
    }

    async put<T>(path: string): Promise<T> {
        throw new Error(`[MockPGSPlayInstantManager] Không có backend thật — PUT ${path} bị bỏ qua.`);
    }
}
