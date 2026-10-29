import { _decorator, Button, Label, Node, RichText, Sprite, SpriteFrame, Tween, UIOpacity, Vec3, tween } from 'cc';
import { UIPopup } from '../../ui/UIPopup';
import { TournamentResultSnapshot } from './TournamentPresentation';
import { GameManager } from '../../manager/GameManager';
import { LeaderboardManager as LegacyLeaderboardManager } from '../../leaderboard/LeaderboardManager';
import { PROFILE_TAB_TYPE, ProfileManager } from '../../profile/ProfileManager';
import { MConfigResourceUtils } from '../../framework/MConfigResourceUtils';
import { clientEvent } from '../../framework/clientEvent';
import { Constants } from '../../framework/constants';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
const { ccclass, property } = _decorator;

/** Màu số lần đạt hạng ("02" trong "You've won 1st place 02 times") — xanh lá, theo đúng thiết kế. */
const TIMES_COUNT_COLOR = '#4CD137';

/** 3 hằng số pop-in huy chương — LẤY Y HỆT giá trị ItemLeaderboardBase.showItem() (hiệu ứng dòng
 * Top 3 thật ở Leaderboard) để 2 nơi hiện giống hệt nhau. */
const MEDAL_POP_FROM_SCALE = 0.8;
const MEDAL_POP_DURATION_SECONDS = 0.3;
const MEDAL_POP_STAGGER_SECONDS = 0.1;

/** L10N.tournament.rank1/2/3 theo hạng — dùng chung cho titleRichText/titleShadowLabel. */
function rankKey(rank: number): string {
    switch (rank) {
        case 1: return L10N.tournament.rank1;
        case 2: return L10N.tournament.rank2;
        default: return L10N.tournament.rank3;
    }
}

/**
 * Popup NHẬN THƯỞNG khi giải đấu tuần kết thúc và người chơi lọt Top 3 (UIPopup thật của Dogdoku —
 * mở qua UIManager, xem TournamentPresentation). CHỈ mở cho Top 3 — UIManager tự quyết định mở
 * popup này hay TournamentResetPopup (không Top 3) dựa vào hạng, KHÔNG có chuỗi nối tiếp giữa 2
 * popup này (2 popup tách biệt hoàn toàn cho 2 nhóm khác nhau).
 *
 * Thiết kế mới (RewardTop3.prefab): hiện "You've won {1st/2nd/3rd} place {NN} time(s)" (số lần
 * ĐÃ TỪNG đạt đúng hạng này — LeaderboardManager.getTimesAchievedRank(), tăng ngay lúc hạng cuối
 * cùng được xác định ở checkWeekRollover(), không phải lúc bấm nút) + 3 huy chương hạng 2/1/3 cố
 * định vị trí, phóng to/nổi bật đúng huy chương khớp hạng đạt được.
 *
 * Bấm "Collect" → mở RewardReceivePopup hiện DANH SÁCH thưởng sẽ nhận (chỉ XEM TRƯỚC, đọc thẳng
 * leaderboardRewards[hạng-1], KHÔNG cộng kho gì ở bước này) → khi người chơi đóng RewardReceivePopup
 * (đã "nhận thưởng" xong): GameManager.claimTournamentReward() cộng thưởng vào kho (CHỈ cộng kho,
 * KHÔNG kích hoạt giải đấu gì cả) rồi ĐÓNG popup này. Popup này KHÔNG tự mở popup kế tiếp — bên mở
 * nó (UIManager.maybeOpenTournamentResult() hoặc LeaderboardPopup.onTouchCollect()) mới là nơi
 * đăng ký mở popup "New Session" (PopupId.TournamentReset, dùng CHUNG với luồng ngoài Top 3) trong
 * callback onClosed, chạy SAU KHI popup này đóng HOÀN TOÀN (hết animation) — đảm bảo không có 2
 * popup cùng hiện chồng lên nhau lúc chuyển tiếp. Popup "New Session" mới thật sự "chốt sổ"/kích
 * hoạt giải đấu mới, nên giờ tính giải đấu mới LUÔN bắt đầu đúng lúc NÓ hiện lên.
 */
@ccclass('TournamentResultPopup')
export class TournamentResultPopup extends UIPopup<TournamentResultSnapshot> {
    @property({
        type: RichText,
        tooltip:
            'RichText "You\'ve won {1st/2nd/3rd} place {NN} time(s)" — CHỈ số lần (NN) tô màu xanh ' +
            'lá qua tag <color>, chữ "time(s)" giữ màu gốc.',
    })
    titleRichText: RichText | null = null;

    @property({
        type: Label,
        tooltip:
            'Label "bóng đổ" (shadow) nằm ĐÈ SAU titleRichText, lệch vài px tạo hiệu ứng đổ bóng — ' +
            'Label THƯỜNG, KHÔNG cần màu/tag <color> gì cả (script tự đồng bộ CÙNG nội dung chữ ' +
            'thô, không có tag). Để trống nếu prefab không có node bóng riêng.',
    })
    titleShadowLabel: Label | null = null;

    @property({ type: Node, tooltip: 'Huy chương hạng 1 (vàng, ở giữa).' })
    medalRank1: Node | null = null;

    @property({ type: Node, tooltip: 'Huy chương hạng 2 (xanh).' })
    medalRank2: Node | null = null;

    @property({ type: Node, tooltip: 'Huy chương hạng 3 (đỏ).' })
    medalRank3: Node | null = null;

    @property({ type: Sprite, tooltip: 'Avatar hạng 1 (node "avatar" trong "top1/groupava").' })
    avatarRank1: Sprite | null = null;
    @property({ type: Sprite, tooltip: 'Khung avatar hạng 1 (node "frame" trong "top1/groupava").' })
    frameRank1: Sprite | null = null;

    @property({ type: Sprite, tooltip: 'Avatar hạng 2 (node "avatar" trong "top2/groupava").' })
    avatarRank2: Sprite | null = null;
    @property({ type: Sprite, tooltip: 'Khung avatar hạng 2 (node "frame" trong "top2/groupava").' })
    frameRank2: Sprite | null = null;

    @property({ type: Sprite, tooltip: 'Avatar hạng 3 (node "avatar" trong "top3/groupava").' })
    avatarRank3: Sprite | null = null;
    @property({ type: Sprite, tooltip: 'Khung avatar hạng 3 (node "frame" trong "top3/groupava").' })
    frameRank3: Sprite | null = null;

    @property({ range: [1, 1.5, 0.01], slide: true, tooltip: 'Scale huy chương KHỚP hạng đạt được.' })
    achievedMedalScale = 1.15;

    @property({ range: [0.5, 1, 0.01], slide: true, tooltip: 'Scale 2 huy chương CÒN LẠI (không khớp hạng).' })
    otherMedalScale = 0.85;

    @property({ type: Sprite, tooltip: 'Sprite hộp quà — đổi hình theo hạng đạt được (xem boxFrameRank1/2/3).' })
    boxSprite: Sprite | null = null;

    @property({ type: SpriteFrame, tooltip: 'Hình hộp quà — hạng 1 (vàng, vd rw_gold).' })
    boxFrameRank1: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Hình hộp quà — hạng 2 (xanh, vd rw_blue).' })
    boxFrameRank2: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Hình hộp quà — hạng 3 (đỏ, vd rw_red).' })
    boxFrameRank3: SpriteFrame | null = null;

    @property(Button)
    btnCollect: Button | null = null;

    protected onEnable(): void {
        this.btnCollect?.node.on(Constants.CLICK, this.onTouchCollect, this);
    }

    protected onDisable(): void {
        this.btnCollect?.node.off(Constants.CLICK, this.onTouchCollect, this);
    }

    protected onShow(data: TournamentResultSnapshot): void {
        // BUG đã sửa ("mở lên bị trống và lag" — avatar/frame hạng 1-3 tải BẤT ĐỒNG BỘ qua
        // MConfigResourceUtils.getProfileSpriteFrame() ở refreshTopAvatars()/loadAvatarInto(), vẫn
        // đang trống (null) lúc hideLoading() cũ gọi NGAY ở đây — hideLoading() giờ dời xuống cuối,
        // CHỈ gọi sau khi refreshTopAvatars() báo cả 3 slot (avatar+frame) đã tải xong, cùng chính
        // sách "chỉ tắt icon loading khi mọi node trong prefab đã ổn định" đã áp cho LeaderboardPopup/
        // LeaderboardPreviewPopup (xác nhận từ user).
        const timesAchieved = LegacyLeaderboardManager.instance?.getTimesAchievedRank(data.rank) ?? 0;
        const unitText = Localization.get(timesAchieved === 1 ? L10N.tournament.unitOne : L10N.tournament.unitMany);
        const countText = timesAchieved < 10 ? `0${timesAchieved}` : `${timesAchieved}`;
        const rankText = Localization.get(rankKey(data.rank));
        const template = Localization.get(L10N.tournament.resultTitle);
        const plainTitle = template
            .replace('{rank}', rankText)
            .replace('{n}', countText)
            .replace('{unit}', unitText);

        // CHỈ số lần (countText) tô xanh ở chữ CHÍNH — "time(s)" đứng sau giữ NGUYÊN màu gốc,
        // không nằm trong tag <color>. Label bóng đổ là Label thường, không đọc tag <color> nên
        // dùng plainTitle (chữ thô, không tag) — xác nhận từ user: shadow dùng CHUNG 1 template với
        // chữ chính (resultTitle), không tách key riêng nữa. Viền chữ (outline) của titleRichText
        // KHÔNG còn chèn qua tag <outline> trong string nữa (xác nhận từ user) — chỉ còn
        // titleShadowLabel tự lo outline qua field native _enableOutline/_outlineColor/_outlineWidth
        // sẵn có trong RewardTop3.prefab, titleRichText chỉ khác titleShadowLabel đúng 1 điểm duy
        // nhất: tag <color> tô số lần đạt hạng.
        if (this.titleRichText) {
            this.titleRichText.string = template
                .replace('{rank}', rankText)
                .replace('{n}', `<color=${TIMES_COUNT_COLOR}>${countText}</color>`)
                .replace('{unit}', unitText);
        }
        // Bóng đổ nằm sau titleRichText phải cùng nội dung — nếu không đồng bộ, bóng vẫn hiện
        // text CŨ (mặc định lúc thiết kế prefab), chồng lệch lên chữ chính mới đã cập nhật.
        if (this.titleShadowLabel) this.titleShadowLabel.string = plainTitle;

        this.highlightMedal(data.rank);
        void this.refreshTopAvatars().then(() => this.hideLoading());
        this.updateBoxForRank(data.rank);
    }

    /** Hộp quà đổi hình theo hạng đạt được — CÙNG màu với huy chương khớp hạng (vàng/xanh/đỏ), để
     * nhất quán với highlightMedal(). */
    private updateBoxForRank(rank: number): void {
        if (!this.boxSprite) return;
        const frame = rank === 1 ? this.boxFrameRank1 : rank === 2 ? this.boxFrameRank2 : this.boxFrameRank3;
        if (frame) this.boxSprite.spriteFrame = frame;
    }

    /**
     * Avatar + khung của ĐÚNG 3 người đứng đầu giải đấu VỪA KẾT THÚC (đóng băng — cùng
     * currWeekScore/fakeBotWeeklyScores/fakeBotWeeklyIdentities mà LeaderboardGroupWeek dùng để vẽ
     * TOP3 thật ở tab Leaderboard, xem LeaderboardGroupWeek.receiveListRankLeaderboard()), KHÔNG
     * phải top3 của giải đấu MỚI (chưa kích hoạt lúc popup này đang hiện). Ghép người chơi + bot
     * theo điểm rồi lấy 3 người cao nhất — tự nhiên khớp đúng elemtn đã quyết định pendingResultRank.
     */
    private refreshTopAvatars(): Promise<void> {
        const legacy = LegacyLeaderboardManager.instance;
        if (!legacy) return Promise.resolve();

        const botScores = legacy.getFakeBotWeeklyScores();
        const botIdentities = legacy.getFakeBotWeeklyIdentities();
        const entries: { score: number; isMyRank: boolean; avatarURL: string }[] = botScores.map((score, i) => ({
            score,
            isMyRank: false,
            avatarURL: botIdentities[i]?.avatarURL ?? '',
        }));
        entries.push({ score: legacy.getLeaderboardCurrWeekScore(), isMyRank: true, avatarURL: '' });
        entries.sort((a, b) => b.score - a.score);

        const slots: ReadonlyArray<{ avatar: Sprite | null; frame: Sprite | null }> = [
            { avatar: this.avatarRank1, frame: this.frameRank1 },
            { avatar: this.avatarRank2, frame: this.frameRank2 },
            { avatar: this.avatarRank3, frame: this.frameRank3 },
        ];

        const loads: Promise<void>[] = [];
        for (let i = 0; i < slots.length; i++) {
            const entry = entries[i];
            if (!entry) continue;
            loads.push(this.loadAvatarInto(slots[i].avatar, slots[i].frame, entry.isMyRank, entry.avatarURL));
        }
        return Promise.all(loads).then(() => {});
    }

    /** Nạp avatar + khung — Y HỆT logic ItemLeaderboardBase.loadAvatar() (đọc chung 1 nguồn dữ
     * liệu ProfileManager/MConfigResourceUtils để đảm bảo avatar hiện ở đây khớp avatar thật hiện
     * ở Leaderboard), chỉ khác là nhận thẳng avatarURL/isMyRank thay vì phải có component
     * ItemRankInfo đầy đủ. */
    /** Trả về Promise CHỈ xong khi cả avatar LẪN frame đã tải xong (thành công hay lỗi đều
     * resolve() — không treo mãi nếu 1 ảnh lỗi) — cho refreshTopAvatars() gom lại, tắt loadingIcon
     * đúng lúc mọi avatar/frame đã ổn định (xác nhận từ user). */
    private loadAvatarInto(avatarSprite: Sprite | null, frameSprite: Sprite | null, isMyRank: boolean, avatarURL: string): Promise<void> {
        let pathAvatar = '';
        let pathFrame = '';
        if (isMyRank) {
            pathAvatar = ProfileManager.instance.getPathAvatar();
            pathFrame = ProfileManager.instance.getPathFrame();
        } else {
            let strAvatarURL = avatarURL;
            if (!strAvatarURL || strAvatarURL.indexOf('_') === -1) {
                strAvatarURL = ProfileManager.instance.getRandomAvatarURL();
            }
            const [strAvatar, strFrame] = strAvatarURL.split('_');
            pathAvatar = ProfileManager.instance.getPathAvatar_byID(parseInt(strAvatar, 10));
            pathFrame = ProfileManager.instance.getPathFrame_byID(parseInt(strFrame, 10));
        }

        if (avatarSprite) avatarSprite.spriteFrame = null;
        if (frameSprite) frameSprite.spriteFrame = null;

        const avatarLoaded = new Promise<void>(resolve => {
            MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.AVATAR, pathAvatar, (err: unknown, spriteFrame) => {
                if (err) {  resolve(); return; }
                // Guard .node — popup có thể đã đóng/huỷ TRƯỚC KHI callback load ảnh bất đồng bộ này
                // chạy tới (giống hệt lý do ItemLeaderboardBase.loadAvatar() guard tương tự).
                if (avatarSprite && avatarSprite.node) avatarSprite.spriteFrame = spriteFrame;
                resolve();
            });
        });
        const frameLoaded = new Promise<void>(resolve => {
            MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.FRAME, pathFrame, (err: unknown, spriteFrame) => {
                if (err) {  resolve(); return; }
                if (frameSprite && frameSprite.node) frameSprite.spriteFrame = spriteFrame;
                resolve();
            });
        });
        return Promise.all([avatarLoaded, frameLoaded]).then(() => {});
    }

    /** Hiện 3 huy chương kiểu POP-IN — Y HỆT hiệu ứng dòng Top 3 thật ở Leaderboard
     * (ItemLeaderboardBase.showItem(): scale 0.8 → đích, mờ → đậm, 0.3s, so le theo thứ tự
     * medalRank1/2/3) thay vì hiện thẳng không animation như trước. Cả 3 huy chương đều đậm lên
     * ĐỦ 255 (KHÔNG còn làm mờ 2 huy chương không khớp hạng như trước nữa) — CHỈ còn scale phân
     * biệt: huy chương khớp hạng to hơn hẳn (achievedMedalScale), 2 huy chương còn lại nhỏ hơn
     * (otherMedalScale). */
    private highlightMedal(rank: number): void {
        const medals: ReadonlyArray<{ node: Node | null; rank: number }> = [
            { node: this.medalRank1, rank: 1 },
            { node: this.medalRank2, rank: 2 },
            { node: this.medalRank3, rank: 3 },
        ];

        for (let i = 0; i < medals.length; i++) {
            const medal = medals[i]!;
            if (!medal.node) continue;
            const achieved = medal.rank === rank;
            const targetScale = achieved ? this.achievedMedalScale : this.otherMedalScale;
            const targetOpacity = 255;

            this.playMedalPopIn(medal.node, targetScale, targetOpacity, i * MEDAL_POP_STAGGER_SECONDS);
        }
    }

    private playMedalPopIn(node: Node, targetScale: number, targetOpacity: number, delay: number): void {
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);

        node.setScale(new Vec3(MEDAL_POP_FROM_SCALE, MEDAL_POP_FROM_SCALE, 1));
        opacity.opacity = 0;

        tween(node)
            .delay(delay)
            .to(MEDAL_POP_DURATION_SECONDS, { scale: new Vec3(targetScale, targetScale, 1) }, { easing: 'quadOut' })
            .start();
        tween(opacity)
            .delay(delay)
            .to(MEDAL_POP_DURATION_SECONDS, { opacity: targetOpacity }, { easing: 'linear' })
            .start();
    }

    private onTouchCollect(): void {
        // CHỈ ĐỌC (peek) danh sách thưởng để hiện trước ở RewardReceivePopup — KHÔNG gọi
        // GameManager.claimTournamentReward() ở đây, để tránh cộng kho NGAY LÚC bấm Collect,
        // trước khi người chơi thật sự xem xong màn hình thưởng.
        const legacy = LegacyLeaderboardManager.instance;
        const rank = legacy?.getPendingTournamentRank() ?? 0;
        const rewards = legacy?.leaderboardRewards?.[rank - 1]?.rewards ?? [];

        // Ẩn NGAY khi RewardReceivePopup vừa mở lên — không để RewardTop3 còn nằm dưới suốt lúc
        // RewardReceivePopup đang hiện. CHỈ ẩn hình (node.active=false), KHÔNG gọi requestClose()
        // ở đây — requestClose() sẽ trigger callback onClosed (mở popup "New Session") NGAY, sớm
        // hơn lúc người chơi thật sự nhận thưởng xong. requestClose() thật sự vẫn gọi SAU, trong
        // callback đóng RewardReceivePopup bên dưới, để giữ đúng thời điểm chuyển sang popup kế —
        // animation exit (PopupAnimation.playExit) vẫn chạy đúng lúc đó dù node đang ẩn, vì tween
        // chạy qua scheduler riêng, không phụ thuộc node.active.
        this.node.active = false;

        clientEvent.dispatchEvent(Constants.SHOW_REWARD_RECEIVE_POPUP, Localization.get(L10N.rewards.title), rewards, () => {
            // Người chơi đã xem xong/đóng RewardReceivePopup — cộng thưởng vào kho (CHỈ cộng kho,
            // KHÔNG kích hoạt giải đấu mới ở đây — xem GameManager.claimTournamentReward()). KHÔNG
            // tự mở popup "New Session" ở đây — việc đó chuyển sang callback onClosed do BÊN NGOÀI
            // đăng ký lúc mở popup này (UIManager.maybeOpenTournamentResult() /
            // LeaderboardPopup.onTouchCollect()), chỉ chạy SAU KHI popup này đã đóng HOÀN TOÀN
            // (hết animation) — đảm bảo không bao giờ có 2 popup cùng hiện lúc chuyển tiếp.
            GameManager.instance?.claimTournamentReward();
            this.requestClose();
        });
    }
}
