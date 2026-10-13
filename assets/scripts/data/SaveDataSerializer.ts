import { SaveData, SAVE_DATA_CURRENT_VERSION } from '../model/SaveData';
import { PlayerData } from '../model/PlayerData';
import { BoardSaveData } from '../model/BoardSaveData';
import { RankTier } from '../core/RankTier';
import { GameConfig } from '../config/GameConfig';
import { DEFAULT_LANGUAGE } from '../localization/Language';
import { DEFAULT_AVATAR_ID, DEFAULT_FRAME_ID } from '../config/AvatarCatalogConfig';

export function createDefaultPlayerData(): PlayerData {
    return {
        progression: { highestLevel: 0 },
        daily: {
            lastDailyDate: null,
            lastDailySeconds: null,
            lastDailyScore: null,
            lastDailyRank: null,
            streak: 0,
            bestStreak: 0,
            streakLastDate: null,
            streakAnchorDate: null,
            checkedDates: [],
            rewardClaimedForAnchor: false,
        },
        inventory: {
            placeDogCharges: GameConfig.initialPlaceDogCharges,
            hintCharges: GameConfig.initialHintCharges,
            coin: GameConfig.initialCoin,
        },
        settings: { bgmVolume: 1, sfxVolume: 1, vibration: true, language: DEFAULT_LANGUAGE },
        boardInProgress: null,
        hasSeenTutorial: false,
        shopPurchases: { purchaseCounts: {}, starterPackStartTime: 0 },
        leaderboardState: {
            currWeek: 0,
            currWeekScore: 0,
            lastWeekCheckReward: 0,
            weeklyRewardClaimed: false,
            tutorialCompleted: false,
        },
        profile: { avatarId: DEFAULT_AVATAR_ID, frameId: DEFAULT_FRAME_ID },
    };
}

export function createDefaultSaveData(): SaveData {
    return {
        version: SAVE_DATA_CURRENT_VERSION,
        playerData: createDefaultPlayerData(),
    };
}

export function serializeSaveData(data: SaveData): string {
    return JSON.stringify(data);
}

type RawObject = Record<string, unknown>;
type MigrationFn = (raw: RawObject) => RawObject;


const migrations: Record<number, MigrationFn> = {};

function isObject(value: unknown): value is RawObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickNumber(raw: RawObject, key: string, fallback: number): number {
    const value = raw[key];
    return typeof value === 'number' && isFinite(value) ? value : fallback;
}

function pickBoolean(raw: RawObject, key: string, fallback: boolean): boolean {
    const value = raw[key];
    return typeof value === 'boolean' ? value : fallback;
}

function pickNumberArray(raw: RawObject, key: string): number[] {
    const value = raw[key];
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is number => typeof item === 'number');
}

function maxOf(values: readonly number[]): number {
    let max = 0;
    for (const value of values) {
        if (value > max) max = value;
    }
    return max;
}

function pickString(raw: RawObject, key: string): string | null {
    const value = raw[key];
    return typeof value === 'string' ? value : null;
}

function pickNullableNumber(raw: RawObject, key: string): number | null {
    const value = raw[key];
    return typeof value === 'number' && isFinite(value) ? value : null;
}

function pickStringArray(raw: RawObject, key: string): string[] {
    const value = raw[key];
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
}

function pickRankTier(raw: RawObject, key: string): RankTier | null {
    const value = raw[key];
    return value === RankTier.Bronze || value === RankTier.Silver || value === RankTier.Gold
        ? value
        : null;
}

function pickNumberRecord(raw: RawObject, key: string): Record<string, number> {
    const value = raw[key];
    if (!isObject(value)) return {};

    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'number' && isFinite(v)) result[k] = v;
    }
    return result;
}

function pickBoardSaveData(value: unknown): BoardSaveData | null {
    if (!isObject(value)) return null;

    const context = value.context;
    if (context !== 'campaign' && context !== 'daily') return null;

    const puzzleId = value.puzzleId;
    if (typeof puzzleId !== 'number') return null;

    const cellStates = pickNumberArray(value, 'cellStates');
    if (cellStates.length === 0) return null;

    return {
        context,
        puzzleId,
        puzzleDate: typeof value.puzzleDate === 'string' ? value.puzzleDate : null,
        cellStates,
        mistakesRemaining: pickNumber(value, 'mistakesRemaining', 0),
        elapsedSeconds: pickNumber(value, 'elapsedSeconds', 0),
    };
}


function coercePlayerData(value: unknown): PlayerData {
    const defaults = createDefaultPlayerData();
    if (!isObject(value)) return defaults;

    const progression = isObject(value.progression) ? value.progression : {};
    const daily = isObject(value.daily) ? value.daily : {};
    const inventory = isObject(value.inventory) ? value.inventory : {};
    const settings = isObject(value.settings) ? value.settings : {};
    const shopPurchases = isObject(value.shopPurchases) ? value.shopPurchases : {};
    const leaderboardState = isObject(value.leaderboardState) ? value.leaderboardState : {};
    const profile = isObject(value.profile) ? value.profile : {};

    return {
        progression: {
            // Save cũ lưu mảng id đã hoàn thành → quy về mốc cao nhất.
            highestLevel: pickNumber(
                progression,
                'highestLevel',
                maxOf(pickNumberArray(progression, 'completedLevelIds')),
            ),
        },
        daily: {
            lastDailyDate: pickString(daily, 'lastDailyDate') ?? pickString(daily, 'lastCompletedDate'),
            lastDailySeconds: pickNullableNumber(daily, 'lastDailySeconds'),
            lastDailyScore: pickNullableNumber(daily, 'lastDailyScore'),
            lastDailyRank: pickRankTier(daily, 'lastDailyRank'),
            streak: pickNumber(daily, 'streak', defaults.daily.streak),
            bestStreak: pickNumber(daily, 'bestStreak', pickNumber(daily, 'streak', 0)),
            streakLastDate:
                pickString(daily, 'streakLastDate') ?? pickString(daily, 'lastCompletedDate'),
            streakAnchorDate:
                pickString(daily, 'streakAnchorDate') ?? pickString(daily, 'lastCompletedDate'),
            checkedDates: pickStringArray(daily, 'checkedDates'),
            rewardClaimedForAnchor: pickBoolean(daily, 'rewardClaimedForAnchor', false),
        },
        inventory: {
            placeDogCharges: pickNumber(
                inventory,
                'placeDogCharges',
                defaults.inventory.placeDogCharges,
            ),
            hintCharges: pickNumber(inventory, 'hintCharges', defaults.inventory.hintCharges),
            coin: pickNumber(inventory, 'coin', defaults.inventory.coin),
        },
        settings: {
            bgmVolume: pickNumber(settings, 'bgmVolume', defaults.settings.bgmVolume),
            sfxVolume: pickNumber(settings, 'sfxVolume', defaults.settings.sfxVolume),
            vibration: pickBoolean(settings, 'vibration', defaults.settings.vibration),
            language: pickString(settings, 'language') ?? defaults.settings.language,
        },
        boardInProgress: pickBoardSaveData(value.boardInProgress),
        hasSeenTutorial: pickBoolean(value, 'hasSeenTutorial', defaults.hasSeenTutorial),
        shopPurchases: {
            purchaseCounts: pickNumberRecord(shopPurchases, 'purchaseCounts'),
            starterPackStartTime: pickNumber(shopPurchases, 'starterPackStartTime', 0),
        },
        leaderboardState: {
            currWeek: pickNumber(leaderboardState, 'currWeek', 0),
            currWeekScore: pickNumber(leaderboardState, 'currWeekScore', 0),
            lastWeekCheckReward: pickNumber(leaderboardState, 'lastWeekCheckReward', 0),
            weeklyRewardClaimed: pickBoolean(leaderboardState, 'weeklyRewardClaimed', false),
            tutorialCompleted: pickBoolean(leaderboardState, 'tutorialCompleted', false),
        },
        profile: {
            avatarId: pickString(profile, 'avatarId') ?? DEFAULT_AVATAR_ID,
            frameId: pickString(profile, 'frameId') ?? DEFAULT_FRAME_ID,
        },
    };
}


export function deserializeSaveData(
    json: string,
    options?: { migrations?: Record<number, MigrationFn>; currentVersion?: number },
): SaveData {
    const migrationTable = options?.migrations ?? migrations;
    const targetVersion = options?.currentVersion ?? SAVE_DATA_CURRENT_VERSION;

    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return createDefaultSaveData();
    }

    if (!isObject(parsed)) return createDefaultSaveData();

    let doc: RawObject = parsed;
    let version = typeof doc.version === 'number' ? doc.version : 0;
    if (version <= 0) return createDefaultSaveData();

    while (version < targetVersion) {
        const migrate = migrationTable[version];
        if (!migrate) {
            console.warn(`[SaveData] Không có migration cho version ${version}. Tạo save mới.`);
            return createDefaultSaveData();
        }
        const migrated = migrate(doc);
        if (!isObject(migrated)) return createDefaultSaveData();

        const next = typeof migrated.version === 'number' ? migrated.version : version;
        if (next <= version) {
            console.warn(`[SaveData] Migration từ version ${version} không tăng version.`);
            return createDefaultSaveData();
        }
        doc = migrated;
        version = next;
    }

    if (version > targetVersion) {
        console.warn(`[SaveData] Save version ${version} mới hơn code. Tạo save mới.`);
        return createDefaultSaveData();
    }

    return {
        version: targetVersion,
        playerData: coercePlayerData(doc.playerData),
    };
}
