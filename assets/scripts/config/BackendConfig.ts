/**
 * Cấu hình backend SaaS bên thứ 3 (playinstant.playgameo.com-style) — player/score/leaderboard/
 * remote-config/notification/analytics. gameId dùng cho header "x-id" của mọi request có ký.
 */
export const BackendConfig = {
    baseUrl: 'https://playinstant.playgameo.com',

    /** TODO: điền gameId thật được cấp cho Dogdoku trước khi build bản Facebook Instant Games. */
    gameId: 'REPLACE_WITH_REAL_GAME_ID',
} as const;
