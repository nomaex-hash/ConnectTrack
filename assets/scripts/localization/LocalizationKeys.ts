/**
 * Danh mục KEY dịch — nguồn sự thật duy nhất cho tên key.
 *
 * Giá trị của mỗi thuộc tính CHÍNH LÀ key trong file JSON, nên:
 *   - IDE autocomplete: `L10N.menu.play`
 *   - Đổi tên key ở một chỗ, không sợ gõ sai chuỗi rải rác.
 *
 * Quy tắc đặt key: `nhóm.tên` viết thường, phân tách bằng dấu chấm. Nhóm theo màn
 * hình hoặc chức năng (menu, common, settings, result, tutorial, ...).
 *
 * Mỗi key ở đây PHẢI có mục tương ứng trong mọi file `<lang>.json`.
 */
export const L10N = {
    boot: {
        tips: 'boot.tips', // MẢNG — màn Boot chọn ngẫu nhiên 1 câu mỗi lần vào game
    },

    common: {
        next: 'common.next',
        gotIt: 'common.gotIt',
        replay: 'common.replay',
        home: 'common.home',
        playNow: 'common.playNow',
        backToMenu: 'common.backToMenu',
        continue: 'common.continue',
        apply: 'common.apply', // nút "Áp dụng" trên khung mô tả gợi ý
        row: 'common.row', // "hàng" — ghép với số, dùng trong text gợi ý
        col: 'common.col', // "cột" — ghép với số, dùng trong text gợi ý
        and: 'common.and', // từ nối "và" khi liệt kê nhiều màu/hàng/cột trong 1 câu
        you: 'common.you', // tên hiển thị fallback cho dòng "của mình" trong leaderboard khi chưa có tên FB
        done: 'common.done',
        save: 'common.save',
        tapToContinue: 'common.tapToContinue',
    },

    menu: {
        play: 'menu.play',
        levelPrefix: 'menu.levelPrefix', // "LEVEL " — nối với số
        dailyChallenge: 'menu.dailyChallenge',
        streak: 'menu.streak',
        tutorial: 'menu.tutorial',
        dailyLocked: 'menu.dailyLocked', // cần chơi tới level N
        dailyDone: 'menu.dailyDone', // đã hoàn thành hôm nay
        dailyFinished: 'menu.dailyFinished', // nhãn ngắn "Finished" trên nút Daily ở Main Menu
    },

    gameplay: {
        levelCaption: 'gameplay.levelCaption', // "Level"
        dateCaption: 'gameplay.dateCaption', // "Date"
        scoreCaption: 'gameplay.scoreCaption',
        encourageTexts: 'gameplay.encourageTexts', // MẢNG — vào màn (campaign lẫn daily) chọn ngẫu nhiên 1 câu
        hardEncourageTexts: 'gameplay.hardEncourageTexts', // MẢNG — vào LEVEL KHÓ chọn ngẫu nhiên 1 câu (thay encourageTexts)
        hardLevelBadge: 'gameplay.hardLevelBadge', // "Level khó" — label cụm badge lửa hiện suốt level khó
        hardBadge: 'gameplay.hardBadge', // "Khó" — nhãn ngắn trên nút Chơi/nút tiếp tục bản level khó
    },

    result: {
        win: 'result.win',
        lose: 'result.lose',
        winTexts: 'result.winTexts', // MẢNG — chữ chính khi THẮNG (ResultPopup), chọn ngẫu nhiên 1 câu
        loseTexts: 'result.loseTexts', // MẢNG — chữ chính khi THUA (ResultPopup), chọn ngẫu nhiên 1 câu
        praiseTexts: 'result.praiseTexts', // MẢNG — thắng (campaign lẫn daily) chọn ngẫu nhiên 1 câu khen
    },

    settings: {
        title: 'settings.title',
        music: 'settings.music',
        sound: 'settings.sound',
        vibration: 'settings.vibration',
        feedback: 'settings.feedback',
        language: 'settings.language',
    },

    tutorial: {
        placeDog1: 'tutorial.placeDog1',
        getIt: 'tutorial.GetIt', // text chính lúc hiện nút Got it, sau khi đặt xong chó đầu tiên
        markRowCol1: 'tutorial.markRowCol1',
        markRowCol1Hint: 'tutorial.markRowCol1Hint', // text phụ ở dưới, chỉ hiện ở bước này
        placeDog2: 'tutorial.placeDog2',
        markAround2: 'tutorial.markAround2',
        placeDog3: 'tutorial.placeDog3',
        finish: 'tutorial.finish',
        wrong: 'tutorial.wrong', // đặt sai — mời suy nghĩ lại
    },

    connectTracksTutorial: {
        intro: 'connectTracksTutorial.intro', // "Mục tiêu là <color>nối tất cả đường ray</color> thành 1 tuyến duy nhất."
        rowClue: 'connectTracksTutorial.rowClue', // "Số <color>2</color> có nghĩa là hàng này có <color>2 ô đường ray</color>"
        colClue: 'connectTracksTutorial.colClue', // "Số <color>3</color> nghĩa là cột này đang có <color>3 ô đường ray</color>"
        tryNow: 'connectTracksTutorial.tryNow', // "đặt đường ray theo <color>gợi ý số</color> của mỗi <color>hàng và cột</color> thành 1 tuyến <color>liền mạch</color>"
        doubleTapHint: 'connectTracksTutorial.doubleTapHint', // "Ô <color>nối với đường ray</color> chắc chắn có đường ray. <color>Chạm hai lần</color> vào ô trống để đặt đường ray."
        excludeHint: 'connectTracksTutorial.excludeHint', // "Hàng này đã đủ đường ray, nên các ô còn lại <color>không thể là đường ray</color>. <color>Chạm</color> vào ô trống để loại trừ nó."
        sweepHint: 'connectTracksTutorial.sweepHint', // "<color>Quét</color> để nối tất cả đường ray!"
        nextButton: 'connectTracksTutorial.nextButton', // "Tiếp theo"
        tryNowButton: 'connectTracksTutorial.tryNowButton', // "Thử ngay"
        hintButton: 'connectTracksTutorial.hintButton', // nhãn nút gợi ý riêng của tutorial
    },

    streak: {
        title: 'streak.title',
        current: 'streak.current',
        best: 'streak.best', // mẫu: "Best streak: {n}"
        celebratePrompt: 'streak.celebratePrompt',
        lockedPrompt: 'streak.lockedPrompt',
        continuePrompt: 'streak.continuePrompt', // đã có chuỗi (streak>0) nhưng CHƯA chơi hôm nay
    },

    weekday: {
        sun: 'weekday.sun',
        mon: 'weekday.mon',
        tue: 'weekday.tue',
        wed: 'weekday.wed',
        thu: 'weekday.thu',
        fri: 'weekday.fri',
        sat: 'weekday.sat',
    },

    /**
     * Text khung mô tả gợi ý — 1 key ứng với 1 tổ hợp (HintKind, HintAction) cụ thể trong
     * core/Hint.ts. Bản đầu, GD tinh chỉnh lại câu chữ tự do, không ảnh hưởng code.
     *
     * 2 token động, GD có thể chèn tự do vào bất kỳ câu nào bên dưới (chỉ thay khi
     * Hint.regionIds / Hint.lines có giá trị — xem core/Hint.ts). Cả 2 đều tự nối "A và B"
     * nếu có nhiều hơn 1 phần tử (vd n=2,3 của ColorsLockedInLines):
     *   {colors} -> (các) tên màu, mỗi tên tô đúng màu vùng (tra trong nhóm `color` bên dưới)
     *   {lines}  -> (các) "hàng N"/"cột N" (1-based)
     */
    hint: {
        misplacedMark: 'hint.misplacedMark', // Bước 0
        placeDogSingleCandidate: 'hint.placeDogSingleCandidate', // Bước 1a
        markAroundDog: 'hint.markAroundDog', // Bước 1b
        markColorsLocked: 'hint.markColorsLocked', // Bước 2 + 3 (n=1,2,3 dùng chung 1 câu, {colors}/{lines} tự liệt kê)
        markFullLineColor: 'hint.markFullLineColor', // Bước 4
        markContradiction: 'hint.markContradiction', // Bước 5 — chỉ 1 ô thủ phạm duy nhất
        markContradictionPlural: 'hint.markContradictionPlural', // Bước 5 — nhiều hơn 1 ô thủ phạm, {n} = số ô
        randomReveal: 'hint.randomReveal', // Bước 6 — "Có vẻ có 1 con chó ở đây"
    },

    /**
     * Tên gọi các màu vùng — dùng làm giá trị cho RegionColorEntry.nameKey (BoardView).
     * QUAN TRỌNG: key ở đây PHẢI khớp CHÍNH XÁC (cả chữ hoa/thường) với key trong MỌI file
     * <lang>.json — Localization.get() tra theo key giống hệt nhau ở mọi ngôn ngữ, chỉ value
     * dịch khác nhau. Gõ trực tiếp text hiển thị (vd "hồng đậm") thay vì 1 trong các key dưới
     * đây vào nameKey sẽ hiện nguyên văn, không dịch được sang ngôn ngữ khác.
     */
    color: {
        green: 'color.green',
        vang: 'color.vang', // yellow
        cam: 'color.Cam', // orange
        nau: 'color.nau', // brown
        hongDam: 'color.hongDam', // dark pink
        xanhNgoc: 'color.xanhNgoc', // teal
        xanhDuong: 'color.xanhDuong', // light blue
        xanhDuongDam: 'color.xanhDuongDam', // dark blue
        tim: 'color.tim', // purple
        hongPastel: 'color.hongPastel', // pastel pink
        xanhLaDam: 'color.xanhLaDam', // dark green
        hong: 'color.hong', // pink
        xanhNon: 'color.xanhnon', // lime green
    },

    shop: {
        title: 'shop.title',
        starterBundle: 'shop.starterBundle', // nameKey mặc định của SHOP_PACKAGES[0]
    },

    rewards: {
        title: 'rewards.title', // "Rewards" — tiêu đề chung RewardReceivePopup (Tournament/Streak/Shop...)
        collect: 'rewards.collect',
    },

    leaderboard: {
        title: 'leaderboard.title',
        tabWeek: 'leaderboard.tabWeek',
        tabWorld: 'leaderboard.tabWorld',
        goToCollect: 'leaderboard.goToCollect',
        clearMainLevel: 'leaderboard.clearMainLevel',
        topTheLeaderboard: 'leaderboard.topTheLeaderboard',
        exclusiveRewards: 'leaderboard.exclusiveRewards',
        unknownScore: 'leaderboard.unknownScore', // "???" — điểm chưa xác định (fallback hiển thị)
    },

    profile: {
        title: 'profile.title',
        nameRequired: 'profile.nameRequired',
        avatarsTab: 'profile.avatarsTab',
        frameTab: 'profile.frameTab',
        generalStats: 'profile.generalStats',
        firstTryWins: 'profile.firstTryWins',
        weeklyWins: 'profile.weeklyWins',
        maxStreak: 'profile.maxStreak',
        tournamentWins: 'profile.tournamentWins',
    },

    tournament: {
        newSession: 'tournament.newSession',
        description: 'tournament.description',
        claim: 'tournament.claim',
        // "{rank} place {n} {unit}" — TournamentResultPopup (rewardTop3.prefab), {rank}/{unit} tự
        // lấy từ rank1/rank2/rank3 + unitOne/unitMany bên dưới, {n} là số lần đạt hạng (2 chữ số).
        resultTitle: 'tournament.resultTitle',
        rank1: 'tournament.rank1',
        rank2: 'tournament.rank2',
        rank3: 'tournament.rank3',
        unitOne: 'tournament.unitOne', // số lần = 1
        unitMany: 'tournament.unitMany', // số lần > 1
    },

    howToPlay: {
        title: 'howToPlay.title',
        page1: 'howToPlay.page1',
        page2: 'howToPlay.page2',
        page3: 'howToPlay.page3',
        page4: 'howToPlay.page4',
    },
} as const;
