import { JsonAsset, resources } from 'cc';

// TODO(TEST): Chỉ dùng bởi MockPGSPlayInstantManager để test UI Leaderboard trong Editor
// Preview khi chưa có backend thật — xoá cùng lúc với phần data giả trong Mock trước khi build
// thật. File JSON: assets/resources/data/test/FakeLeaderboardUsers.json (50 người chơi giả).
const FIXTURE_PATH = 'data/test/FakeLeaderboardUsers';

let cached: unknown[] | null = null;

export function loadFakeLeaderboardEntries(): Promise<unknown[]> {
    if (cached) return Promise.resolve(cached);

    return new Promise<unknown[]>((resolve, reject) => {
        resources.load(FIXTURE_PATH, JsonAsset, (error, asset) => {
            if (error || !asset) {
                reject(error ?? new Error(`[MockLeaderboardFixture] Không load được '${FIXTURE_PATH}'.`));
                return;
            }
            cached = Array.isArray(asset.json) ? (asset.json as unknown[]) : [];
            resolve(cached);
        });
    });
}
