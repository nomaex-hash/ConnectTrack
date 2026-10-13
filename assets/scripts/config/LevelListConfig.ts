import { PuzzleContext } from '../model/BoardSaveData';


const CAMPAIGN_SOURCES = {
    saveOldData: { folder: 'saveOldData', levelCount: 617 },
  
    testLevelData: { folder: 'testLevelData', levelCount: 771 },
} as const;

export type CampaignSourceKey = keyof typeof CAMPAIGN_SOURCES;


export const ACTIVE_CAMPAIGN_SOURCE: CampaignSourceKey = 'testLevelData';

const activeCampaign = CAMPAIGN_SOURCES[ACTIVE_CAMPAIGN_SOURCE];

export const LevelListConfig = {
    campaignLevelCount: activeCampaign.levelCount,

    dailyPuzzleCount: 154,

    campaignPathPrefix: `data/puzzles/${activeCampaign.folder}/Level_`,
    dailyPathPrefix: 'data/daily/Daily_',

    tutorialPath: 'data/tutorial/Tutorial_0',

    /**
     * Sau khi người chơi vượt qua level CUỐI CÙNG trong data (campaignLevelCount), số level
     * hiển thị (text "MÀN N", tiến độ, ...) vẫn tiếp tục đếm lên VÔ HẠN, nhưng dữ liệu puzzle
     * thật sự được tải sẽ LẶP VÒNG trong khoảng [endlessLoopStartLevel, campaignLevelCount] —
     * xem resolveCampaignPuzzleDataId() bên dưới.
     */
    endlessLoopStartLevel: 100,
} as const;


export function getPuzzleCount(context: PuzzleContext): number {
    switch (context) {
        case 'campaign':
            return LevelListConfig.campaignLevelCount;
        case 'daily':
            return LevelListConfig.dailyPuzzleCount;
        case 'tutorial':
            return 1;
    }
}


export function getPuzzlePath(context: PuzzleContext, id: number): string {
    switch (context) {
        case 'campaign':
            return `${LevelListConfig.campaignPathPrefix}${id}`;
        case 'daily':
            return `${LevelListConfig.dailyPathPrefix}${id}`;
        case 'tutorial':
            return LevelListConfig.tutorialPath;
    }
}


export function isValidPuzzleId(context: PuzzleContext, id: number): boolean {
    if (context === 'tutorial') return id === 0;
    return Number.isInteger(id) && id >= 1 && id <= getPuzzleCount(context);
}

/**
 * Ánh xạ "level HIỂN THỊ" (displayLevel, KHÔNG giới hạn — vd 620) sang "id file puzzle THẬT"
 * (luôn nằm trong 1..campaignLevelCount) — CHỈ dùng cho việc TẢI file, không được dùng cho
 * progression/HUD (những chỗ đó phải giữ nguyên displayLevel để đếm đúng số level đã qua).
 *
 * displayLevel <= campaignLevelCount: dùng thẳng (giống hệt cách cũ, chưa vào vùng lặp).
 * displayLevel > campaignLevelCount: lặp vòng qua [endlessLoopStartLevel, campaignLevelCount].
 */
export function resolveCampaignPuzzleDataId(displayLevel: number): number {
    const total = LevelListConfig.campaignLevelCount;
    if (displayLevel <= total) return displayLevel;

    const loopStart = Math.min(Math.max(1, LevelListConfig.endlessLoopStartLevel), total);
    const rangeSize = total - loopStart + 1;
    const offset = (displayLevel - total - 1) % rangeSize;
    return loopStart + offset;
}

/**
 * Level "khó" — chỉ là NHÃN hiển thị (đổi hiệu ứng), KHÔNG đổi puzzle data. Từ level 30 trở đi,
 * cứ mỗi 10 level là 1 level khó (30, 40, 50, ...), lặp lại vô hạn kể cả sau khi displayLevel
 * vượt quá campaignLevelCount (vòng lặp endless vẫn tính trên displayLevel).
 */
export function isHardLevel(displayLevel: number): boolean {
    return displayLevel >= 30 && (displayLevel - 30) % 10 === 0;
}
