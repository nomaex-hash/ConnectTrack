import { _decorator, Button, Label, Node, Tween, UIOpacity, Vec3, instantiate, tween } from 'cc';
import { UIScreen } from '../UIScreen';
import { EventManager } from '../../core/EventManager';
import { GameConfig } from '../../config/GameConfig';
import { isHardLevel } from '../../config/LevelListConfig';
import { AppState } from '../../core/AppState';
import {
    LEVEL_SELECTED_EVENT,
    LevelSelectedEventPayload,
    NAVIGATE_REQUESTED_EVENT,
    NavigateRequestedEventPayload,
} from '../../event/AppEvents';
import { LANGUAGE_CHANGED_EVENT } from '../../localization/LocalizationEvents';
import { ProgressionHolder } from '../../gameplay/progression/ProgressionHolder';
import { DailyServiceHolder } from '../../service/DailyServiceHolder';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
import { PopupId } from '../PopupId';
import { ShopIAPManagerHolder } from '../../service/shop/ShopIAPManagerHolder';
import { CountDownTime } from '../../gameplay/timer/CountDownTime';
import { LeaderboardManager as LegacyLeaderboardManager } from '../../leaderboard/LeaderboardManager';
import { GameManager } from '../../manager/GameManager';
import { UIManager } from '../../manager/UIManager';
import { GameResource } from '../../datainfo/GameResource';
import { RESOURCE_TYPE, BOOSTER_TYPE, Constants } from '../../framework/constants';
import { clientEvent } from '../../framework/clientEvent';
import { StreakConfig } from '../../config/StreakConfig';
import { PLACE_DOG_GRANT_REQUESTED_EVENT, PlaceDogGrantRequestedEventPayload } from '../../event/AppEvents';

const STARTER_PACK_ID = 'starter_bundle';

const { ccclass, property } = _decorator;


const DAILY_MESSAGE_SECONDS = 0;


@ccclass('MainMenuScreen')
export class MainMenuScreen extends UIScreen {
    @property({ type: Label })
    playLabel: Label | null = null;

    @property({ type: Button, tooltip: 'Nút Chơi' })
    playButton: Button | null = null;

    @property({
        type: Node,
        tooltip:
            'CỤM node nút Chơi của LEVEL KHÓ (cả cụm, không chỉ sprite). Khi level kế tiếp là level khó ' +
            'thì cụm này hiện và nút Chơi thường (playButton) ẩn; ngược lại thì đảo lại. Nút bên trong ' +
            'cụm cần gắn clickEvents trỏ tới onTapPlay() của MainMenuScreen.',
    })
    hardPlayButtonNode: Node | null = null;

    @property({ type: Label, tooltip: 'Label hiện level hiện tại BÊN TRONG cụm nút Chơi khó (giống playLabel).' })
    hardPlayLabel: Label | null = null;

    @property({ type: Label, tooltip: 'Tiến trình tổng quát, ví dụ "34 / 617". Có thể trống.' })
    progressLabel: Label | null = null;

    @property({
        type: Node,
        tooltip: `Hình nút Daily khi KHÓA (sprite xám). Hiện tới khi tới level ${GameConfig.dailyUnlockLevel}.`,
    })
    dailyLockedNode: Node | null = null;

    @property({ type: Node, tooltip: 'Hình nút Daily khi MỞ (sprite xanh lá).' })
    dailyUnlockedNode: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Khung text báo lỗi khi bấm Daily (chưa mở khóa / đã chơi hôm nay). Ẩn sẵn; ' +
            'script tự bật và đổi nội dung.',
    })
    dailyLockedMessage: Node | null = null;

    @property({
        type: Label,
        tooltip: 'Label BÊN TRONG khung trên. Trống thì khung giữ text tĩnh của prefab.',
    })
    dailyMessageLabel: Label | null = null;

    @property({ tooltip: 'Khung thông báo Daily (khoá/đã chơi hôm nay): bay lên bao nhiêu px lúc biến mất.' })
    dailyMessageFlyUpDistance = 30;

    @property({ tooltip: 'Khung thông báo Daily: thời gian bay lên + mờ dần biến mất (giây).' })
    dailyMessageFadeOutSeconds = 0.35;

    @property({
        type: Node,
        tooltip: 'Nút Daily (cả nút) — hiện ĐẦU TIÊN khi vào Main Menu (scale nhỏ→lớn + mờ→đậm).',
    })
    dailyButtonNode: Node | null = null;

    @property({
        type: Node,
        tooltip: 'Nút Streak — hiện ĐẦU TIÊN cùng lúc với nút Daily (scale nhỏ→lớn + mờ→đậm).',
    })
    streakButtonNode: Node | null = null;

    @property({
        type: Node,
        tooltip: `Nút Leaderboard — ẨN cho tới khi THẮNG XONG level ${GameConfig.leaderboardUnlockLevel} (isCompleted, xem refresh()).`,
    })
    leaderboardButtonNode: Node | null = null;

    @property({
        type: Node,
        tooltip: 'Nút Starter Pack — tự ẩn nếu đã mua hoặc hết hạn. Mở StarterPackPopup khi bấm.',
    })
    starterPackButtonNode: Node | null = null;

    @property({ type: CountDownTime, tooltip: 'Đếm ngược trên nút Starter Pack.' })
    starterPackCountDownTime: CountDownTime | null = null;

    @property({
        type: Node,
        tooltip:
            'Logo — hiện SAU CÙNG với hiệu ứng: to → mờ dần đậm lên → đập xuống nhỏ hơn ' +
            'scale gốc → nảy nhẹ về scale gốc.',
    })
    logoNode: Node | null = null;

    @property({
        tooltip:
            'MỌI nút (Chơi/Daily/Streak/Leaderboard/Starter Pack...) TRỪ logo: thời gian mờ→đậm ' +
            '(opacity 0→255) — tất cả cùng chạy ĐỒNG LOẠT, không còn so le/scale nữa.',
    })
    introButtonsFadeSeconds = 0.3;

    @property({ tooltip: 'Logo: trễ bao lâu (giây) sau khi các nút mờ→đậm xong rồi mới bắt đầu xuất hiện.' })
    introLogoDelaySeconds = 0.15;

    @property({ tooltip: 'Logo: scale BẮT ĐẦU (to hơn scale gốc) lúc vừa xuất hiện.' })
    introLogoFromScale = 1.6;

    @property({ tooltip: 'Logo: scale "đập xuống" (thấp hơn scale gốc) trước khi nảy nhẹ lên lại.' })
    introLogoUndershootScale = 0.9;

    @property({ tooltip: 'Logo: thời gian từ to đập xuống (giây).' })
    introLogoDropSeconds = 0.18;

    @property({ tooltip: 'Logo: thời gian nảy nhẹ lên lại về scale gốc (giây).' })
    introLogoBounceSeconds = 0.14;

    @property({
        tooltip:
            'Đợi THÊM bằng này giây SAU KHI toàn bộ hiệu ứng vào Home (nút mờ→đậm + logo) chạy ' +
            'xong HẲN, rồi mới báo cho UIManager biết là an toàn để hiện popup kích hoạt/kết quả ' +
            'giải đấu (ví dụ giải đấu vừa hết giờ lúc người chơi đang OFFLINE, phát hiện ngay lúc ' +
            'mở app) — tránh popup hiện đè lên lúc các nút/logo còn đang mờ dần/nảy vào.',
    })
    postIntroTournamentPopupDelaySeconds = 0.3;

    /** Campaign không có "hoàn thành hẳn" — luôn có level kế tiếp (xem ProgressionSystem.getCurrentLevel). */
    private currentLevel = 0;
    private dailyUnlocked = false;
    private dailyMessageBasePos: Vec3 | null = null;

    /**
     * Scale GỐC thật của logo — chốt ĐÚNG 1 LẦN ở onLoad(), KHÔNG đọc lại node.scale mỗi lần
     * popLogo() chạy. Trước đây popLogo() tự đọc node.scale làm "original" ngay lúc gọi — nếu bị
     * gọi lại (ví dụ mở Settings rồi bấm Home trong lúc logo còn đang chạy dở animation to→nhỏ)
     * TRƯỚC KHI tween trước đó chạy xong, node.scale lúc đó đang là 1 giá trị TRUNG GIAN (không
     * phải scale gốc thật), khiến "original" bị chốt SAI — animation mới tính fromScale/
     * undershootScale/final dựa trên baseline sai đó, kẹt logo lại ở kích thước rất lớn vĩnh
     * viễn (đúng bug đã gặp). Đọc 1 lần từ onLoad() (lúc chắc chắn chưa tween gì) tránh hẳn lỗi này.
     */
    private logoBaseScale: Vec3 | null = null;

    onLoad(): void {
        if (this.logoNode) {
            const scale = this.logoNode.scale;
            this.logoBaseScale = new Vec3(scale.x, scale.y, scale.z || 1);
        }
    }

    protected onOpen(): void {
        if (!this.playLabel) {
            console.warn("[MainMenuScreen] Chưa gán 'playLabel' trong Inspector.");
        }
        if (!this.playButton) {
            console.warn("[MainMenuScreen] Chưa gán 'playButton' trong Inspector.");
        }

        this.refresh();
        this.playIntroAnimation();

        // onOpen() chỉ chạy lại khi MỞ HẲN màn này (từ Boot hoặc quay lại Home) — nếu người chơi
        // mở Settings NGAY TỪ Main Menu (popup đè lên, MainMenuScreen KHÔNG đóng/mở lại) rồi đổi
        // ngôn ngữ, playLabel/hardPlayLabel ("LEVEL N") không tự cập nhật vì chỉ được set 1 LẦN
        // trong refresh() ở trên, KHÔNG qua LocalizedLabel (là chuỗi ghép L10N.menu.levelPrefix +
        // số, không phải text tĩnh) — phải tự lắng nghe LANGUAGE_CHANGED_EVENT và refresh() lại.
        EventManager.instance.on(LANGUAGE_CHANGED_EVENT, this.refresh, this);
    }

    protected onClose(): void {
        EventManager.instance.targetOff(this);
    }

    /**
     * MỌI nút (Chơi/Daily/Streak/Leaderboard/Starter Pack...) mờ→đậm ĐỒNG LOẠT (opacity 0→255,
     * KHÔNG còn scale/so le nữa) — chạy y hệt mỗi lần MỞ màn này (lần đầu từ Boot lẫn mọi lần
     * quay lại Home từ màn khác). Logo giữ NGUYÊN hiệu ứng riêng (to → mờ đậm dần → đập xuống →
     * nảy nhẹ về scale gốc, xem popLogo()), chỉ đổi mốc bắt đầu: đợi các nút mờ→đậm xong
     * (introButtonsFadeSeconds) rồi mới tới lượt logo, KHÔNG còn phải cộng dồn qua nhiều giai
     * đoạn so le như trước.
     */
    private playIntroAnimation(): void {
        // Nhiều property (dailyButtonNode/dailyLockedNode/dailyUnlockedNode...) CÓ THỂ trỏ
        // trùng cùng 1 node ngoài Editor — xử lý 2 LẦN trên cùng 1 node sẽ hỏng (ẩn/tween 2 lần).
        // Lọc trùng bằng Set trước khi xử lý.
        const animated = new Set<Node>();
        const candidates = [
            this.playButton?.node ?? null,
            this.hardPlayButtonNode,
            this.dailyButtonNode,
            this.streakButtonNode,
            this.dailyLockedNode,
            this.dailyUnlockedNode,
            this.leaderboardButtonNode,
            this.starterPackButtonNode,
        ];

        for (const node of candidates) {
            if (!node || !node.active || animated.has(node)) continue;
            animated.add(node);

            const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 0;
            tween(opacity).to(this.introButtonsFadeSeconds, { opacity: 255 }).start();
        }

        this.popLogo();
        this.scheduleTournamentPopupCheck();
    }

    /** Đợi hiệu ứng vào Home chạy XONG HẲN (nút mờ→đậm + logo bay/đập/nảy) + THÊM
     * postIntroTournamentPopupDelaySeconds rồi mới báo UIManager kiểm tra popup kích hoạt/kết quả
     * giải đấu — xem doc property ở trên. Cùng công thức tổng thời gian logo dùng trong popLogo(). */
    private scheduleTournamentPopupCheck(): void {
        const totalIntroSeconds =
            this.introButtonsFadeSeconds +
            this.introLogoDelaySeconds +
            this.introLogoDropSeconds +
            this.introLogoBounceSeconds +
            this.postIntroTournamentPopupDelaySeconds;

        this.unschedule(this.notifyIntroFinished);
        this.scheduleOnce(this.notifyIntroFinished, totalIntroSeconds);
    }

    private notifyIntroFinished = (): void => {
        UIManager.instance?.onMainMenuIntroFinished();
    };

    private popLogo(): void {
        const node = this.logoNode;
        if (!node || !this.logoBaseScale) return;

        const original = this.logoBaseScale;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);

        const fromScale = new Vec3(original.x * this.introLogoFromScale, original.y * this.introLogoFromScale, original.z);
        const undershootScale = new Vec3(
            original.x * this.introLogoUndershootScale,
            original.y * this.introLogoUndershootScale,
            original.z,
        );

        // Mọi nút mờ→đậm xong (introButtonsFadeSeconds, giờ chạy ĐỒNG LOẠT nên chỉ còn 1 giai
        // đoạn, không cần cộng dồn nhiều mốc so le như trước) → chờ rồi logo mới bắt đầu.
        const startDelay = this.introButtonsFadeSeconds + this.introLogoDelaySeconds;

        node.setScale(fromScale);
        opacity.opacity = 0;

        tween(node)
            .delay(startDelay)
            .to(this.introLogoDropSeconds, { scale: undershootScale }, { easing: 'quadIn' })
            .to(this.introLogoBounceSeconds, { scale: original }, { easing: 'backOut' })
            .start();

        tween(opacity)
            .delay(startDelay)
            .to(this.introLogoDropSeconds + this.introLogoBounceSeconds, { opacity: 255 })
            .start();
    }

    /** Level khó: hiện CỤM nút Chơi khó, ẩn nút Chơi thường (và ngược lại). Chạy TRƯỚC
     * playIntroAnimation() nên hiệu ứng mờ→đậm chỉ áp lên cụm đang active. */
    private applyPlayButtonVariant(hard: boolean): void {
        if (!this.hardPlayButtonNode) return;
        this.hardPlayButtonNode.active = hard;
        if (this.playButton) this.playButton.node.active = !hard;
    }

    // Arrow field: được EventManager gọi trực tiếp làm handler của LANGUAGE_CHANGED_EVENT (xem
    // onOpen()) nên phải tự giữ đúng `this` — EventManager.emit() gọi handler KHÔNG qua .call(target),
    // target chỉ dùng để so khớp lúc targetOff() (xem SettingsPopup.refresh cùng lý do).
    private refresh = (): void => {
        const progression = ProgressionHolder.current;
        if (!progression) {
            console.warn('[MainMenuScreen] ProgressionSystem chưa sẵn sàng.');
            return;
        }

        this.currentLevel = progression.getCurrentLevel();

        if (this.playLabel) {
            this.playLabel.string = Localization.get(L10N.menu.levelPrefix) + this.currentLevel;
        }
        if (this.hardPlayLabel) {
            this.hardPlayLabel.string = Localization.get(L10N.menu.levelPrefix) + this.currentLevel;
        }
        if (this.playButton) {
            this.playButton.interactable = true;
        }
        this.applyPlayButtonVariant(isHardLevel(this.currentLevel));
        if (this.progressLabel) {
            this.progressLabel.string = `${progression.completedCount} / ${progression.totalLevels}`;
        }

        this.dailyUnlocked = progression.isUnlocked(GameConfig.dailyUnlockLevel);
        if (this.dailyLockedNode) this.dailyLockedNode.active = !this.dailyUnlocked;
        if (this.dailyUnlockedNode) this.dailyUnlockedNode.active = this.dailyUnlocked;
        this.setDailyMessageVisible(false);

        // isCompleted (KHÔNG phải isUnlocked) — level vừa "mở ra để chơi" thì CHƯA đủ, phải THẮNG
        // xong level leaderboardUnlockLevel mới hiện nút.
        if (this.leaderboardButtonNode) {
            this.leaderboardButtonNode.active = progression.isCompleted(GameConfig.leaderboardUnlockLevel);
        }

        // "Streak mở ở level 5, thắng xong level 5 thì các hoạt động liên quan Streak mới kích
        // hoạt" (xác nhận từ user) — cùng kiểu isCompleted như leaderboardButtonNode ở trên.
        if (this.streakButtonNode) {
            this.streakButtonNode.active = progression.isCompleted(GameConfig.streakUnlockLevel);
        }

        this.refreshStarterPackButton();
    };

    /** Ẩn nút nếu đã mua Starter Pack hoặc hết hạn 2 tiếng — mirror ButtonEventStarterPackManager gốc. */
    private refreshStarterPackButton(): void {
        if (!this.starterPackButtonNode) return;

        const bought = ShopIAPManagerHolder.current?.hasPurchased(STARTER_PACK_ID) ?? false;
        const secondsLeft = ShopIAPManagerHolder.current?.getStarterPackSecondsLeft() ?? 0;

        if (bought || secondsLeft <= 0) {
            this.starterPackButtonNode.active = false;
            return;
        }

        this.starterPackButtonNode.active = true;
        this.starterPackCountDownTime?.initCountDownTime(secondsLeft, () => {
            if (this.starterPackButtonNode) this.starterPackButtonNode.active = false;
        });
    }

    onTapPlay(): void {
        const payload: LevelSelectedEventPayload = {
            context: 'campaign',
            levelId: this.currentLevel,
        };
        EventManager.instance.emit(LEVEL_SELECTED_EVENT, payload);
    }

    onTapDaily(): void {
        // Luôn đọc trạng thái mới nhất tại thời điểm bấm, không dùng cờ
        // `dailyUnlocked` cache từ lúc refresh() — cache đó có thể lệch nếu
        // tiến trình/daily thay đổi trong lúc màn hình đang mở.
        // "Đã mở khoá" là điều kiện CHẶN TRƯỚC — khớp với chính thẻ đang hiển thị trên Main
        // Menu (dailyLockedNode/dailyUnlockedNode ở refresh() cũng chỉ dựa vào isUnlocked(),
        // không quan tâm đã chơi hôm nay hay chưa). Nếu chưa mở khoá thì LUÔN hiện thông báo
        // "cần lên màn 25", bất kể dữ liệu lastDailyDate cũ (test/reset) có trùng hôm nay
        // hay không — tránh vừa hiện thẻ khoá vừa báo "đã chơi hôm nay" (mâu thuẫn).
        const unlocked = ProgressionHolder.current?.isUnlocked(GameConfig.dailyUnlockLevel) ?? false;
        this.dailyUnlocked = unlocked;

        if (!unlocked) {
            const text = Localization.get(L10N.menu.dailyLocked).replace(
                '{n}',
                `${GameConfig.dailyUnlockLevel}`,
            );
            this.showDailyMessage(text);
            return;
        }

        if (DailyServiceHolder.current?.isDailyDoneToday() ?? false) {
            this.showDailyMessage(Localization.get(L10N.menu.dailyDone));
            return;
        }

        const payload: LevelSelectedEventPayload = { context: 'daily', levelId: null };
        EventManager.instance.emit(LEVEL_SELECTED_EVENT, payload);
    }

    /**
     * Mỗi lần bấm tạo 1 BẢN SAO riêng (từ template `dailyLockedMessage`, template này luôn
     * ẩn, không bao giờ tự hiện) — thay vì dùng chung 1 node. Nhờ vậy nếu bấm thêm lần nữa
     * lúc bản trước ĐANG bay lên/mờ dần, bản cũ KHÔNG bị cắt ngang, cứ tự bay tiếp và tự
     * huỷ khi xong; bản mới chỉ đơn giản xuất hiện độc lập bên cạnh.
     */
    private showDailyMessage(text: string): void {
        const template = this.dailyLockedMessage;
        const parent = template?.parent;
        if (!template || !parent) return;

        if (!this.dailyMessageBasePos) this.dailyMessageBasePos = template.position.clone();
        const basePos = this.dailyMessageBasePos;

        const instance = instantiate(template);
        instance.setParent(parent);
        instance.setPosition(basePos);
        instance.setSiblingIndex(parent.children.length - 1);
        instance.active = true;

        const label = this.resolveClonedLabel(template, instance);
        if (label) label.string = text;

        const opacity = instance.getComponent(UIOpacity) ?? instance.addComponent(UIOpacity);
        opacity.opacity = 255;

        const flyUpPos = new Vec3(basePos.x, basePos.y + this.dailyMessageFlyUpDistance, basePos.z);

        // MỘT chuỗi tween duy nhất (đứng yên DAILY_MESSAGE_SECONDS giây rồi mới bay lên +
        // mờ dần) — không dùng scheduleOnce() riêng để tránh lệch nhịp giữa 2 hệ thống
        // đếm giờ khác nhau (scheduler của component vs tween).
        tween(instance)
            .delay(DAILY_MESSAGE_SECONDS)
            .to(this.dailyMessageFadeOutSeconds, { position: flyUpPos }, { easing: 'quadOut' })
            .start();

        tween(opacity)
            .delay(DAILY_MESSAGE_SECONDS)
            .to(this.dailyMessageFadeOutSeconds, { opacity: 0 })
            .call(() => instance.destroy())
            .start();
    }

    /**
     * Tìm ĐÚNG label trong bản sao `instance`, tương ứng với `dailyMessageLabel` gốc trên
     * template — không dùng getComponentInChildren() vì label có thể là node RIÊNG (không
     * phải con của template), lúc đó bản sao sẽ không hề chứa label này, khiến text không
     * bao giờ được cập nhật (luôn hiện nội dung cũ nhất đã set trên template gốc).
     */
    private resolveClonedLabel(template: Node, instance: Node): Label | null {
        const original = this.dailyMessageLabel?.node ?? null;
        if (!original) return null;

        if (!this.isDescendantOf(original, template)) {
            // Label nằm ngoài cây con của template — không nhân bản theo được, đành dùng
            // lại chính label gốc (không độc lập theo từng bản sao, nhưng text vẫn đúng).
            return this.dailyMessageLabel;
        }

        const path: number[] = [];
        let current = original;
        while (current !== template && current.parent) {
            path.unshift(current.getSiblingIndex());
            current = current.parent;
        }

        let node: Node = instance;
        for (const index of path) {
            const child = node.children[index];
            if (!child) return this.dailyMessageLabel;
            node = child;
        }
        return node.getComponent(Label);
    }

    private isDescendantOf(node: Node, ancestor: Node): boolean {
        let current: Node | null = node;
        while (current) {
            if (current === ancestor) return true;
            current = current.parent;
        }
        return false;
    }


    private setDailyMessageVisible(visible: boolean): void {
        if (this.dailyLockedMessage) this.dailyLockedMessage.active = visible;

        const labelNode = this.dailyMessageLabel?.node;
        if (labelNode && labelNode !== this.dailyLockedMessage) labelNode.active = visible;
    }

  
    onTapLevelSelect(): void {
        const payload: NavigateRequestedEventPayload = { to: AppState.LevelSelect };
        EventManager.instance.emit(NAVIGATE_REQUESTED_EVENT, payload);
    }

    onTapStreak(): void {
        const payload: NavigateRequestedEventPayload = { to: AppState.DailyStreak };
        EventManager.instance.emit(NAVIGATE_REQUESTED_EVENT, payload);
    }

    /** Mở Leaderboard dạng popup nổi đè lên Main Menu (PopupId.Leaderboard, xem
     * home/LeaderboardPopup.ts) — KHÔNG còn hệ thống tab Shop/Home/Leaderboard nữa. Leaderboard là
     * POPUP nổi đè lên, KHÔNG phải đổi AppState — MainMenuScreen bên dưới không hề bị đóng/mở lại
     * (onOpen() chỉ chạy theo AppState) nên hiệu ứng mờ→đậm của các nút KHÔNG tự chạy lại khi đóng
     * Leaderboard. Chạy lại thủ công ở đây (đúng y hệt playIntroAnimation() lúc mới vào Home) để
     * "quay lại Home" sau khi xem Leaderboard cũng thấy hiệu ứng, như mọi lần khác. */
    onTapLeaderboard(): void {
        this.popups?.openPopup(PopupId.Leaderboard, undefined, () => {
            // refresh() trước — lỡ vừa nhận thưởng Top 3 trong Leaderboard làm đổi trạng thái gì
            // đó hiển thị ở Home (vd tiến trình) thì không bị hiện dữ liệu cũ trong lúc chạy hiệu
            // ứng, giống hệt trình tự onOpen() đang làm.
            this.refresh();
            this.playIntroAnimation();
        });
    }

    onTapStarterPack(): void {
        this.popups?.openPopup(PopupId.StarterPack, undefined);
    }

    onTapTutorial(): void {
        const payload: LevelSelectedEventPayload = { context: 'tutorial', levelId: 0 };
        EventManager.instance.emit(LEVEL_SELECTED_EVENT, payload);
    }

    onTapSettings(): void {
        this.popups?.openPopup(PopupId.Settings, undefined);
    }

    /** DÙNG ĐỂ TEST — reset bảng xếp hạng Weekly (điểm, hạng đang chờ Claim/Continue, bot) về mới
     * toanh, KHÔNG đụng Global. Gán vào Click Events của nút test trên Main Menu trong Editor,
     * giống các onTap* khác trong file này. */
    onTapResetLeaderboard(): void {
        // Giả lập "giải đấu tuần vừa kết thúc" dựa trên điểm/hạng THẬT hiện tại (không tự xoá dữ
        // liệu — chỉ thật sự reset SAU KHI bấm Claim/Got it ở popup, đúng luồng thật) — để test
        // TournamentResultPopup (Top 3)/TournamentResetPopup (không Top 3). Muốn test nhánh Top 3
        // thì chơi vài màn cho điểm tuần đủ cao TRƯỚC khi bấm nút này.
        LegacyLeaderboardManager.instance?.resetWeeklyForTesting();
        GameManager.instance?.checkPendingTournamentResult();
        UIManager.instance?.checkTournamentPopupForTesting();
        console.log('[MainMenuScreen] Đã giả lập giải đấu Weekly kết thúc (test) — popup sẽ tự hiện.');
    }

    /** DÙNG ĐỂ TEST — hiện THẲNG RewardReceivePopup với đúng phần thưởng Streak cấu hình
     * (StreakConfig.rewardPlaceDogCharges), KHÔNG cần chờ tới ngày thứ 7 của chu kỳ thật. Vẫn
     * CỘNG THẬT số lượt Place Dog (giống hệt DailyStreakScreen.onClaimReward() sản phẩm thật) —
     * chỉ bỏ qua điều kiện rewardReady/rewardClaimed, không giả lập gì khác. */
    onTapTestStreakReward(): void {
        const rewardAmount = StreakConfig.rewardPlaceDogCharges;

        const grant: PlaceDogGrantRequestedEventPayload = { amount: rewardAmount };
        EventManager.instance.emit(PLACE_DOG_GRANT_REQUESTED_EVENT, grant);

        const rewards: GameResource[] = [new GameResource(RESOURCE_TYPE.BOOSTER, BOOSTER_TYPE.PLACE_DOG, rewardAmount)];
        clientEvent.dispatchEvent(Constants.SHOW_REWARD_RECEIVE_POPUP, Localization.get(L10N.rewards.title), rewards);
    }

    /** DÙNG ĐỂ TEST — hiện THẲNG RewardReceivePopup với đúng tier thưởng Top 3 hạng 1 đang cấu
     * hình (LeaderboardManager.leaderboardRewards[0]), KHÔNG cần điểm thật đủ cao để vào top 3.
     * CỐ TÌNH KHÔNG gọi GameManager.claimTournamentReward() thật — hàm đó giờ CHỈ cộng kho (không
     * còn tự "chốt sổ"/reset tournamentStartMs nữa, xem TournamentResultPopup.onTouchCollect), gọi
     * thẳng ở đây vẫn sẽ cộng thật vào kho ngoài ý muốn của 1 nút chỉ để xem trước giao diện. Muốn
     * test full pipeline (cộng kho thật + mở popup "New Session" sau khi nhận thưởng) thì dùng
     * onTapResetLeaderboard() ở trên với điểm tuần thật đủ cao để vào top 3.
     */
    onTapTestTop3Reward(): void {
        const rewards = LegacyLeaderboardManager.instance?.leaderboardRewards?.[0]?.rewards ?? [];
        clientEvent.dispatchEvent(Constants.SHOW_REWARD_RECEIVE_POPUP, Localization.get(L10N.rewards.title), rewards);
    }
}
