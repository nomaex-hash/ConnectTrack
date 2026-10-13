import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    createDefaultSaveData,
    createDefaultPlayerData,
    serializeSaveData,
    deserializeSaveData,
} from '../../assets/scripts/data/SaveDataSerializer';
import { SaveData, SAVE_DATA_CURRENT_VERSION } from '../../assets/scripts/model/SaveData';
import { CellState } from '../../assets/scripts/core/CellState';
import { RankTier } from '../../assets/scripts/core/RankTier';
import { GameConfig } from '../../assets/scripts/config/GameConfig';

/**
 * Save hỏng ÂM THẦM: bug chỉ lộ khi người chơi mở lại app, rất lâu sau khi code sai được
 * viết. Test này phủ toàn bộ 8 chế độ hỏng ở 08 — mục 4.
 *
 * Nguyên tắc bao trùm: deserializeSaveData KHÔNG BAO GIỜ ném lỗi — người chơi mất tiến
 * trình còn hơn app không mở được.
 */

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    warn.mockRestore();
});

function makeSave(overrides: Partial<SaveData['playerData']> = {}): string {
    const doc: SaveData = {
        version: SAVE_DATA_CURRENT_VERSION,
        playerData: { ...createDefaultPlayerData(), ...overrides },
    };
    return JSON.stringify(doc);
}

describe('SaveDataSerializer — round-trip', () => {
    it('serialize rồi deserialize trả về đúng dữ liệu', () => {
        const original = createDefaultSaveData();
        original.playerData.progression.highestLevel = 3;
        original.playerData.daily = {
            lastDailyDate: '2026-07-14',
            lastDailySeconds: 88,
            lastDailyRank: RankTier.Silver,
            streak: 5,
            bestStreak: 9,
            streakLastDate: '2026-07-14',
            streakAnchorDate: '2026-07-10',
            checkedDates: ['2026-07-10', '2026-07-14'],
            rewardClaimedForAnchor: false,
        };
        original.playerData.inventory.placeDogCharges = 7;
        original.playerData.settings = {
            bgmVolume: 0.4,
            sfxVolume: 0.9,
            vibration: false,
            language: 'vi',
        };
        original.playerData.boardInProgress = {
            context: 'campaign',
            puzzleId: 42,
            puzzleDate: null,
            cellStates: [CellState.Empty, CellState.Mark, CellState.Dog, CellState.WrongMark],
            mistakesRemaining: 2,
            elapsedSeconds: 31,
        };

        const restored = deserializeSaveData(serializeSaveData(original));

        expect(restored).toEqual(original);
    });

    it('người chơi mới: default hợp lệ', () => {
        const fresh = createDefaultSaveData();
        expect(fresh.version).toBe(SAVE_DATA_CURRENT_VERSION);
        expect(fresh.playerData.progression.highestLevel).toBe(0);
        expect(fresh.playerData.daily.lastDailyDate).toBeNull();
        expect(fresh.playerData.boardInProgress).toBeNull();
    });
});

describe('SaveDataSerializer — chế độ hỏng (08 — mục 4)', () => {
    it('JSON hỏng → save mặc định, KHÔNG ném lỗi', () => {
        expect(() => deserializeSaveData('{ khong-phai-json')).not.toThrow();
        expect(deserializeSaveData('{ khong-phai-json')).toEqual(createDefaultSaveData());
    });

    it('JSON hợp lệ nhưng không phải object (mảng, số, null) → save mặc định', () => {
        expect(deserializeSaveData('[1,2,3]')).toEqual(createDefaultSaveData());
        expect(deserializeSaveData('42')).toEqual(createDefaultSaveData());
        expect(deserializeSaveData('null')).toEqual(createDefaultSaveData());
    });

    it('thiếu version → save mặc định', () => {
        expect(deserializeSaveData('{"playerData":{}}')).toEqual(createDefaultSaveData());
    });

    it('version <= 0 → save mặc định', () => {
        expect(deserializeSaveData('{"version":0}')).toEqual(createDefaultSaveData());
        expect(deserializeSaveData('{"version":-1}')).toEqual(createDefaultSaveData());
    });

    it('version MỚI HƠN code (người chơi hạ cấp app) → save mặc định + warning', () => {
        const future = JSON.stringify({
            version: SAVE_DATA_CURRENT_VERSION + 5,
            playerData: createDefaultPlayerData(),
        });

        expect(deserializeSaveData(future)).toEqual(createDefaultSaveData());
        expect(warn).toHaveBeenCalled();
    });

    it('không có migration cho version cũ → save mặc định + warning', () => {
        const old = JSON.stringify({ version: 1, playerData: createDefaultPlayerData() });

        // Code đang ở version 3, nhưng không có migration nào.
        const result = deserializeSaveData(old, { migrations: {}, currentVersion: 3 });

        expect(result).toEqual(createDefaultSaveData());
        expect(warn).toHaveBeenCalled();
    });
});

describe('SaveDataSerializer — migration', () => {
    it('migration tuần tự 1 → 2 → 3 chạy đúng thứ tự', () => {
        const old = JSON.stringify({
            version: 1,
            playerData: { ...createDefaultPlayerData(), inventory: { placeDogCharges: 1 } },
        });

        const steps: number[] = [];
        const result = deserializeSaveData(old, {
            currentVersion: 3,
            migrations: {
                1: (raw) => {
                    steps.push(1);
                    return { ...raw, version: 2 };
                },
                2: (raw) => {
                    steps.push(2);
                    const pd = raw.playerData as Record<string, unknown>;
                    return {
                        ...raw,
                        version: 3,
                        playerData: { ...pd, inventory: { placeDogCharges: 99 } },
                    };
                },
            },
        });

        expect(steps).toEqual([1, 2]); // đúng thứ tự, không nhảy cóc
        expect(result.version).toBe(3);
        expect(result.playerData.inventory.placeDogCharges).toBe(99);
    });

    it('migration KHÔNG tăng version → save mặc định + warning (chống lặp vô hạn)', () => {
        const old = JSON.stringify({ version: 1, playerData: createDefaultPlayerData() });

        const result = deserializeSaveData(old, {
            currentVersion: 3,
            migrations: {
                1: (raw) => ({ ...raw, version: 1 }), // quên tăng
            },
        });

        expect(result).toEqual(createDefaultSaveData());
        expect(warn).toHaveBeenCalled();
    });

    it('migration trả về thứ không phải object → save mặc định', () => {
        const old = JSON.stringify({ version: 1, playerData: createDefaultPlayerData() });

        const result = deserializeSaveData(old, {
            currentVersion: 2,
            migrations: {
                1: () => null as unknown as Record<string, unknown>,
            },
        });

        expect(result).toEqual(createDefaultSaveData());
    });
});

describe('SaveDataSerializer — lấp default cho nhánh thiếu (08 — mục 3.1)', () => {
    it('save cũ THIẾU một nhánh → nhánh đó về default, các nhánh khác GIỮ NGUYÊN', () => {
        // Mô phỏng save từ version cũ chưa có `inventory`.
        const partial = JSON.stringify({
            version: SAVE_DATA_CURRENT_VERSION,
            playerData: {
                progression: { completedLevelIds: [1, 2, 3] },
                daily: { lastCompletedDate: '2026-07-14', streak: 9 },
                settings: { bgmVolume: 0.3, sfxVolume: 0.6 },
                // inventory và boardInProgress vắng mặt
            },
        });

        const result = deserializeSaveData(partial);

        // Nhánh thiếu về default (lấy từ GameConfig — người chơi mới có sẵn lượt)...
        expect(result.playerData.inventory.placeDogCharges).toBe(
            GameConfig.initialPlaceDogCharges,
        );
        expect(result.playerData.inventory.hintCharges).toBe(GameConfig.initialHintCharges);
        expect(result.playerData.boardInProgress).toBeNull();

        // ...nhưng KHÔNG mất phần còn lại. Đây là điểm quan trọng nhất của test này:
        // `raw as SaveData` sẽ cho undefined và crash ở chỗ khác.
        expect(result.playerData.progression.highestLevel).toBe(3); // suy ra từ mảng id cũ
        expect(result.playerData.daily.streak).toBe(9);
        expect(result.playerData.settings.bgmVolume).toBe(0.3);
    });

    it('playerData vắng hoàn toàn → toàn bộ về default, không crash', () => {
        const result = deserializeSaveData(`{"version":${SAVE_DATA_CURRENT_VERSION}}`);
        expect(result.playerData).toEqual(createDefaultPlayerData());
    });

    it('trường sai KIỂU → về default của riêng trường đó', () => {
        const corrupt = JSON.stringify({
            version: SAVE_DATA_CURRENT_VERSION,
            playerData: {
                progression: { completedLevelIds: 'không phải mảng' },
                daily: { lastCompletedDate: 12345, streak: 'nhiều' },
                inventory: { placeDogCharges: 'ba' },
                settings: { bgmVolume: NaN, sfxVolume: Infinity },
                boardInProgress: null,
            },
        });

        const result = deserializeSaveData(corrupt);
        const d = createDefaultPlayerData();

        expect(result.playerData.progression.highestLevel).toBe(0);
        expect(result.playerData.daily.lastDailyDate).toBeNull();
        expect(result.playerData.daily.streak).toBe(d.daily.streak);
        expect(result.playerData.inventory.placeDogCharges).toBe(d.inventory.placeDogCharges);
        // NaN và Infinity không phải giá trị hợp lệ → về default, không lọt vào âm lượng.
        expect(result.playerData.settings.bgmVolume).toBe(d.settings.bgmVolume);
        expect(result.playerData.settings.sfxVolume).toBe(d.settings.sfxVolume);
    });

    it('save cũ (mảng id, lẫn rác) → quy về mốc cao nhất, bỏ phần tử không phải số', () => {
        const legacy = JSON.stringify({
            version: SAVE_DATA_CURRENT_VERSION,
            playerData: {
                progression: { completedLevelIds: [1, 'hai', 3, null, 5] },
            },
        });

        expect(deserializeSaveData(legacy).playerData.progression.highestLevel).toBe(5);
    });
});

describe('SaveDataSerializer — snapshot board hỏng (08 — mục 4)', () => {
    it('snapshot hợp lệ được giữ', () => {
        const save = makeSave({
            boardInProgress: {
                context: 'daily',
                puzzleId: 7,
                puzzleDate: '2026-07-14',
                cellStates: [0, 1, 2, 3],
                mistakesRemaining: 1,
                elapsedSeconds: 0,
            },
        });

        const snapshot = deserializeSaveData(save).playerData.boardInProgress;
        expect(snapshot).not.toBeNull();
        expect(snapshot!.context).toBe('daily');
        expect(snapshot!.puzzleDate).toBe('2026-07-14');
    });

    it('context lạ → BỎ snapshot, GIỮ progression', () => {
        const save = makeSave({
            progression: { highestLevel: 2 },
            boardInProgress: {
                context: 'tournament' as never,
                puzzleId: 1,
                puzzleDate: null,
                cellStates: [0, 1],
                mistakesRemaining: 3,
                elapsedSeconds: 0,
            },
        });

        const result = deserializeSaveData(save);
        expect(result.playerData.boardInProgress).toBeNull();
        // Mất ván dở còn hơn mất cả tiến trình.
        expect(result.playerData.progression.highestLevel).toBe(2);
    });

    it('puzzleId không phải số → bỏ snapshot', () => {
        const save = makeSave({
            boardInProgress: {
                context: 'campaign',
                puzzleId: '42' as unknown as number,
                puzzleDate: null,
                cellStates: [0, 1],
                mistakesRemaining: 3,
                elapsedSeconds: 0,
            },
        });
        expect(deserializeSaveData(save).playerData.boardInProgress).toBeNull();
    });

    it('cellStates rỗng → bỏ snapshot', () => {
        const save = makeSave({
            boardInProgress: {
                context: 'campaign',
                puzzleId: 1,
                puzzleDate: null,
                cellStates: [],
                mistakesRemaining: 3,
                elapsedSeconds: 0,
            },
        });
        expect(deserializeSaveData(save).playerData.boardInProgress).toBeNull();
    });

    it('puzzleDate sai kiểu → về null, snapshot vẫn dùng được', () => {
        const save = makeSave({
            boardInProgress: {
                context: 'campaign',
                puzzleId: 1,
                puzzleDate: 20260714 as unknown as string,
                cellStates: [0, 1],
                mistakesRemaining: 3,
                elapsedSeconds: 0,
            },
        });

        const snapshot = deserializeSaveData(save).playerData.boardInProgress;
        expect(snapshot).not.toBeNull();
        expect(snapshot!.puzzleDate).toBeNull();
    });
});
