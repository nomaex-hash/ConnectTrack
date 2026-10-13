export type WeeklyLeagueTier =
    | 'Group1'
    | 'Group2'
    | 'Group3'
    | 'Group4'
    | 'Group5'
    | 'Group6'
    | 'Group7'
    | 'Group8'
    | 'Group9';

export interface WeeklyLeagueTierConfig {
    readonly tier: WeeklyLeagueTier;

    readonly winRateOnUserWin: number;

    readonly winRateOnUserLose: number;

    readonly winRateOffline: number;
}


export const WEEKLY_LEAGUE_TIERS: readonly WeeklyLeagueTierConfig[] = [
    { tier: 'Group1', winRateOnUserWin: 0.8, winRateOnUserLose: 0.5, winRateOffline: 0.6 },
    { tier: 'Group2', winRateOnUserWin: 0.7, winRateOnUserLose: 0.5, winRateOffline: 0.5 },
    { tier: 'Group3', winRateOnUserWin: 0.5, winRateOnUserLose: 0.45, winRateOffline: 0.4 },
    { tier: 'Group4', winRateOnUserWin: 0.45, winRateOnUserLose: 0.45, winRateOffline: 0.4 },
    { tier: 'Group5', winRateOnUserWin: 0.4, winRateOnUserLose: 0.4, winRateOffline: 0.4 },
    { tier: 'Group6', winRateOnUserWin: 0.35, winRateOnUserLose: 0.4, winRateOffline: 0.3 },
    { tier: 'Group7', winRateOnUserWin: 0.3, winRateOnUserLose: 0.3, winRateOffline: 0.3 },
    { tier: 'Group8', winRateOnUserWin: 0.25, winRateOnUserLose: 0.3, winRateOffline: 0.3 },
    { tier: 'Group9', winRateOnUserWin: 0.2, winRateOnUserLose: 0.3, winRateOffline: 0.25 },
];


export const AHEAD_SCORE_GAP_THRESHOLD = 10;

export const OFFLINE_TICK_MINUTES_NORMAL = 10;

export const OFFLINE_TICK_MINUTES_WHEN_AHEAD = 60;

export type WeeklyMatchOutcome = 'win' | 'lose';


export function getBotTierByIndex(index: number, total: number): WeeklyLeagueTier {
    const groupCount = WEEKLY_LEAGUE_TIERS.length;
    const groupSize = total / groupCount;
    const groupIndex = Math.min(groupCount - 1, Math.floor(index / groupSize));
    return WEEKLY_LEAGUE_TIERS[groupIndex].tier;
}

export function getWeeklyLeagueTierConfig(tier: WeeklyLeagueTier): WeeklyLeagueTierConfig {
    return WEEKLY_LEAGUE_TIERS.find((t) => t.tier === tier) ?? WEEKLY_LEAGUE_TIERS[WEEKLY_LEAGUE_TIERS.length - 1];
}


export function isBotFarAhead(botScore: number, playerScore: number): boolean {
    return botScore - playerScore > AHEAD_SCORE_GAP_THRESHOLD;
}


export function getOfflineTickMinutes(botScore: number, playerScore: number): number {
    return isBotFarAhead(botScore, playerScore) ? OFFLINE_TICK_MINUTES_WHEN_AHEAD : OFFLINE_TICK_MINUTES_NORMAL;
}

/** Điểm Weekly giờ tính theo điểm GHI ĐƯỢC lúc thắng (Dogdoku: số tim còn lại 0..GameConfig.
 * maxMistakes; ConnectTracks: số ô đường ray của màn, thường 10..50 — xem LeaderboardManager.
 * addCurrWeekScore()/GameManager.pushLeaderboardScore()), KHÔNG còn +1 cố định/màn. Bot Weekly
 * "tăng điểm như vậy" — mỗi lượt ghi điểm random ra 1 giá trị trong khoảng WEEKLY_BOT_POINTS_PER_
 * ROLL_MIN..MAX (rescale lại theo thang điểm MỚI — xác nhận từ user: chơi 3-4 màn phải leo được Top
 * 1-3, FAKE_BOT_WEEKLY_START_MIN/MAX cũng đã rescale tương ứng, xem LeaderboardManager.ts), LUÔN ít
 * nhất MIN (KHÔNG bao giờ 0) — bot "ghi điểm lượt này hay không" đã được quyết định RIÊNG bởi roll
 * tỉ lệ thắng theo tier (winRate) rồi, nên khi đã trúng roll thì luôn có điểm thật, không cần thêm
 * 1 lớp random-ra-0 nữa (khác người chơi thật — người chơi CÓ THỂ thắng màn mà dùng hết cả 3 tim ở
 * Dogdoku, được 0 điểm, còn bot không có khái niệm "chơi mà không ghi điểm" tách biệt khỏi roll
 * winRate). KHÔNG áp dụng cho Global — Global vẫn tính theo LEVEL đã qua, không liên quan điểm tuần. */
const WEEKLY_BOT_POINTS_PER_ROLL_MIN = 8;
const WEEKLY_BOT_POINTS_PER_ROLL_MAX = 18;
function rollWeeklyBotPoints(): number {
    return WEEKLY_BOT_POINTS_PER_ROLL_MIN
        + Math.floor(Math.random() * (WEEKLY_BOT_POINTS_PER_ROLL_MAX - WEEKLY_BOT_POINTS_PER_ROLL_MIN + 1));
}

/**
 * Random 1 bot có ghi thêm điểm hay không — gọi mỗi khi NGƯỜI CHƠI vừa kết thúc 1 ván (thắng
 * hoặc thua), cho TỪNG bot riêng lẻ (mỗi bot random độc lập, không phải tất cả cùng ăn/trượt).
 * Nếu bot đang bỏ xa người chơi (isBotFarAhead) thì LUÔN dùng winRateOnUserLose bất kể outcome
 * thật là 'win' hay 'lose' — xem điều kiện đặc biệt ở đầu file.
 * @returns số điểm bot ghi được lượt này (WEEKLY_BOT_POINTS_PER_ROLL_MIN..MAX, 0 nếu trượt roll thắng).
 */
export function rollWeeklyPointsOnMatchEnd(
    tier: WeeklyLeagueTier,
    outcome: WeeklyMatchOutcome,
    botScore: number,
    playerScore: number,
): number {
    const config = getWeeklyLeagueTierConfig(tier);
    const winRate = isBotFarAhead(botScore, playerScore)
        ? config.winRateOnUserLose
        : outcome === 'win'
        ? config.winRateOnUserWin
        : config.winRateOnUserLose;
    return Math.random() < winRate ? rollWeeklyBotPoints() : 0;
}

/**
 * Random 1 bot có ghi thêm điểm hay không tại 1 mốc "offline tick" — gọi bởi scheduler bên
 * ngoài (chưa có sẵn, xem ghi chú "PHẦN CÒN THIẾU" ở đầu file) đúng theo chu kỳ trả về từ
 * getOfflineTickMinutes() của bot đó. Tỉ lệ winRateOffline KHÔNG đổi theo điều kiện đặc biệt — chỉ
 * có TẦN SUẤT gọi hàm này (chu kỳ phút/lần) mới đổi khi bot bỏ xa người chơi.
 * @returns số điểm bot ghi được lượt tick này (WEEKLY_BOT_POINTS_PER_ROLL_MIN..MAX, 0 nếu trượt roll).
 */
export function rollWeeklyPointsOffline(tier: WeeklyLeagueTier): number {
    const config = getWeeklyLeagueTierConfig(tier);
    return Math.random() < config.winRateOffline ? rollWeeklyBotPoints() : 0;
}



export type GlobalLeagueTier =
    | 'Group1'
    | 'Group2'
    | 'Group3'
    | 'Group4'
    | 'Group5'
    | 'Group6'
    | 'Group7'
    | 'Group8'
    | 'Group9';

export interface GlobalLeagueTierConfig {
    readonly tier: GlobalLeagueTier;
    readonly winRateOnUserWin: number;
    readonly winRateOnUserLose: number;
    readonly winRateOffline: number;
}

export const GLOBAL_LEAGUE_TIERS: readonly GlobalLeagueTierConfig[] = [
    { tier: 'Group1', winRateOnUserWin: 0.7, winRateOnUserLose: 0.5, winRateOffline: 0.5 },
    { tier: 'Group2', winRateOnUserWin: 0.5, winRateOnUserLose: 0.45, winRateOffline: 0.4 },
    { tier: 'Group3', winRateOnUserWin: 0.45, winRateOnUserLose: 0.45, winRateOffline: 0.4 },
    { tier: 'Group4', winRateOnUserWin: 0.4, winRateOnUserLose: 0.4, winRateOffline: 0.4 },
    { tier: 'Group5', winRateOnUserWin: 0.35, winRateOnUserLose: 0.4, winRateOffline: 0.35 },
    { tier: 'Group6', winRateOnUserWin: 0.3, winRateOnUserLose: 0.35, winRateOffline: 0.35 },
    { tier: 'Group7', winRateOnUserWin: 0.3, winRateOnUserLose: 0.3, winRateOffline: 0.3 },
    { tier: 'Group8', winRateOnUserWin: 0.25, winRateOnUserLose: 0.3, winRateOffline: 0.3 },
    { tier: 'Group9', winRateOnUserWin: 0.2, winRateOnUserLose: 0.3, winRateOffline: 0.25 },
];

/** Độ rộng GỐC từng khoảng (1-5, 6-15, ..., 91-100) — tổng = 100, dùng để co giãn tỉ lệ về N bot
 * bất kỳ (xem getGlobalBotTierByIndex). */
const GLOBAL_TIER_ORIGINAL_WIDTHS: readonly number[] = [5, 10, 10, 10, 15, 15, 10, 15, 10];

/** Mốc chia (index cuối, exclusive) của từng tier khi co giãn GLOBAL_TIER_ORIGINAL_WIDTHS (tổng
 * gốc 100) về đúng `total` bot hiện có — tích luỹ theo tỉ lệ, bù làm tròn vào tier cuối để tổng
 * luôn khớp `total` chính xác. */
function globalTierBoundaries(total: number): number[] {
    const sumWidths = GLOBAL_TIER_ORIGINAL_WIDTHS.reduce((a, b) => a + b, 0);
    const boundaries: number[] = [];
    let acc = 0;
    for (const w of GLOBAL_TIER_ORIGINAL_WIDTHS) {
        acc += w;
        boundaries.push(Math.round((acc / sumWidths) * total));
    }
    boundaries[boundaries.length - 1] = total;
    return boundaries;
}

export function getGlobalBotTierByIndex(index: number, total: number): GlobalLeagueTier {
    const boundaries = globalTierBoundaries(total);
    for (let i = 0; i < boundaries.length; i++) {
        if (index < boundaries[i]) return GLOBAL_LEAGUE_TIERS[i].tier;
    }
    return GLOBAL_LEAGUE_TIERS[GLOBAL_LEAGUE_TIERS.length - 1].tier;
}

export function getGlobalLeagueTierConfig(tier: GlobalLeagueTier): GlobalLeagueTierConfig {
    return GLOBAL_LEAGUE_TIERS.find((t) => t.tier === tier) ?? GLOBAL_LEAGUE_TIERS[GLOBAL_LEAGUE_TIERS.length - 1];
}

/** Random 1 bot Global có ghi thêm 1 điểm hay không — gọi mỗi khi NGƯỜI CHƠI vừa kết thúc 1 ván
 * (thắng hoặc thua). Cùng cơ chế hãm bot bỏ xa như rollWeeklyPointsOnMatchEnd(). */
export function rollGlobalPointsOnMatchEnd(
    tier: GlobalLeagueTier,
    outcome: WeeklyMatchOutcome,
    botScore: number,
    playerScore: number,
): number {
    const config = getGlobalLeagueTierConfig(tier);
    const winRate = isBotFarAhead(botScore, playerScore)
        ? config.winRateOnUserLose
        : outcome === 'win'
        ? config.winRateOnUserWin
        : config.winRateOnUserLose;
    return Math.random() < winRate ? 1 : 0;
}

/** Random 1 bot Global có ghi thêm 1 điểm hay không tại 1 mốc "offline tick" — tần suất gọi hàm
 * này do getOfflineTickMinutes() quyết định, giống Weekly. */
export function rollGlobalPointsOffline(tier: GlobalLeagueTier): number {
    const config = getGlobalLeagueTierConfig(tier);
    return Math.random() < config.winRateOffline ? 1 : 0;
}