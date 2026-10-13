
export const GameConfig = {
  
    maxMistakes: 3,

 
    initialPlaceDogCharges: 5,

    initialHintCharges: 5,

    initialCoin: 0,

    dailyUnlockLevel: 21,

    /** Nút Leaderboard ở Main Menu chỉ hiện SAU KHI thắng xong đúng level này (isCompleted, không
     * phải isUnlocked — level vừa "mở ra để chơi" thì CHƯA đủ, phải THẮNG xong mới hiện nút). */
    leaderboardUnlockLevel: 10,


    scoreStreakBaseTier: 450,
    scoreStreakTierStep: 130,

  
    scoreSpeedBonusMax: 100,
    scoreSpeedBonusInstantSeconds: 1,
    scoreSpeedBonusDecayPerSecond: 10,


    scoreAutoMarkBonus: 100,

    doubleTapThresholdSeconds: 0.3,


    dogAppearDurationSeconds: 3.4,

    /** Riêng cho TUTORIAL — chỉ 3 con mèo, animation đặt mèo hiện tại (sprite tĩnh, pop-in nhanh)
     * kết thúc trong ~0.3-0.5 giây/lần đặt, KHÔNG cần đợi lâu như campaign/daily (mỗi màn hàng
     * chục ô). dogAppearDurationSeconds (3.4s) là con số cũ từ thời animation spine dài hơn nhiều —
     * chỉ đổi RIÊNG cho tutorial để không ảnh hưởng campaign/daily. */
    dogAppearDurationSecondsTutorial: 1,


    autoMarkPauseSeconds: 0.9,

    autoMarkRevealSettleSeconds: 0.25,

    autoMarkSparkSpreadSeconds: 0.4,

    autoMarkSparkFlightSeconds: 0.45,


    dragThresholdPixels: 10,

  
    maxGridSize: 11,
} as const;
