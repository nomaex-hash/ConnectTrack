import {
    _decorator,
    Animation,
    EditBox,
    Label,
    Node,
    Prefab,
    Tween,
    UIOpacity,
    Vec3,
    instantiate,
    tween,
} from 'cc';
import { UIScreen } from '../UIScreen';
import { AppState } from '../../core/AppState';
import { EventManager } from '../../core/EventManager';
import { GameManager } from '../../manager/GameManager';
import {
    LEVEL_SELECTED_EVENT,
    LevelSelectedEventPayload,
    NAVIGATE_REQUESTED_EVENT,
    NavigateRequestedEventPayload,
    PLACE_DOG_GRANT_REQUESTED_EVENT,
    PlaceDogGrantRequestedEventPayload,
    SAVE_REQUESTED_EVENT,
} from '../../event/AppEvents';
import { StreakBoard } from '../../model/StreakBoard';
import { DailyServiceHolder } from '../../service/DailyServiceHolder';
import { ProgressionHolder } from '../../gameplay/progression/ProgressionHolder';
import { StreakPresentation } from '../../gameplay/streak/StreakPresentation';
import { StreakDayCell } from '../widget/StreakDayCell';
import { StreakNumberSprite } from '../widget/StreakNumberSprite';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
import { GameResource } from '../../datainfo/GameResource';
import { RESOURCE_TYPE, BOOSTER_TYPE, Constants } from '../../framework/constants';
import { clientEvent } from '../../framework/clientEvent';

const { ccclass, property } = _decorator;

/** 1 CỤM node cho hiệu ứng hiện lên tuần tự (playRevealSequence) — mọi node trong CÙNG 1 cụm
 * mờ dần (opacity 0→255) CÙNG LÚC với nhau; các cụm KHÁC NHAU mới hiện tuần tự cách nhau
 * revealStaggerSeconds, giống đúng cách sunNode/glowNode/promptNode/... đang hiện hiện tại. */
@ccclass('DailyStreakRevealGroup')
class DailyStreakRevealGroup {
    @property({ type: [Node], tooltip: 'Các node thuộc CỤM này — kéo bao nhiêu node cũng được, tất cả mờ dần CÙNG LÚC.' })
    nodes: Node[] = [];
}

/** Tên clip Animation gán trên sunAnimation — chạy đúng 1 lần ngay lúc bấm sun để thắp chuỗi (hết
 * clip mới cho các node khác hiện lên). sunNode giờ CHỈ còn lo hiệu ứng bấm này — trạng thái tĩnh
 * đã thắp/chưa thắp (trước đây là clip "GlowSun"/"DimSun" trên CHÍNH sunAnimation) giờ là 2 NODE
 * riêng (glowSunNode/dimSunNode, xem setSunLitDisplay()). */
const SUN_ANIM_TAP = 'streak';

/**
 * Màn Streak KHÔNG còn animation xoay/particle nào (mặt trời/glow không tự xoay nữa) — chỉ còn
 * giữ lại hiệu ứng "quay số" cho streakValueSprite VÀ hiệu ứng hiện lên (mờ dần + phóng to) cho
 * từng CỤM nội dung khi mở màn (xem playRevealSequence()): (1) mặt trời + glow, (2) cụm nội
 * dung (prompt HOẶC chuỗi hiện tại/tốt nhất/dãy điểm danh, tuỳ trạng thái), (3) nút dưới cùng.
 */
@ccclass('DailyStreakScreen')
export class DailyStreakScreen extends UIScreen {
    @property({
        type: Node,
        tooltip:
            'Node mặt trời — CHỈ còn xử lý hiệu ứng bấm thắp chuỗi (nút bấm, wire click trong ' +
            'Editor gọi onTapSun(), + component Animation ở sunAnimation chạy clip "streak"). ' +
            'KHÔNG còn tự đổi GlowSun/DimSun nữa — xem glowSunNode/dimSunNode bên dưới (2 node ' +
            'RIÊNG). LUÔN hiện, không bị ẩn/fade theo các cụm khác.',
    })
    sunNode: Node | null = null;

    @property({
        type: Animation,
        tooltip:
            'Component Animation trên/trong sunNode, đã gán clip "streak" — chạy đúng 1 lần khi ' +
            'bấm sun lúc đang thắp chuỗi; hết clip thì các cụm khác mới hiện lên.',
    })
    sunAnimation: Animation | null = null;

    @property({
        type: Node,
        tooltip:
            'Node RIÊNG hiện khi ĐÃ thắp chuỗi (xem lại lúc đã thắp, hoặc vừa thắp xong) — tự loại ' +
            'trừ với dimSunNode (chỉ 1 trong 2 active cùng lúc).',
    })
    glowSunNode: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Node RIÊNG hiện khi CHƯA thắp chuỗi (chưa có chuỗi, hoặc còn chuỗi nhưng hôm nay ' +
            'chưa chơi, hoặc đang ở màn thắp chuỗi nhưng CHƯA bấm sun) — tự loại trừ với glowSunNode.',
    })
    dimSunNode: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Sprite trong suốt phủ lên sunNode — BẬT ngay lúc bấm thắp chuỗi (onTapSun()) để chặn ' +
            'bấm lại mặt trời lần nữa, TẮT lại ngay lúc vào màn thắp chuỗi kế tiếp ' +
            '(enterCelebrateMode()). Nên gắn thêm component chặn chạm (BlockInputEvents) trong ' +
            'Editor, kích thước phủ đúng vùng sunNode.',
    })
    sunTapBlocker: Node | null = null;

    @property({ type: Node, tooltip: 'Vòng sáng phía sau mặt trời — chỉ bật/tắt theo lit, không còn xoay.' })
    glowNode: Node | null = null;

    @property({ type: Node, tooltip: 'Khung chữ dưới mặt trời. Chỉ hiện khi CHƯA có nội dung.' })
    promptNode: Node | null = null;

    @property({
        type: Label,
        tooltip: 'Label trong khung prompt — đổi text theo trạng thái. Trống thì giữ text tĩnh prefab.',
    })
    promptLabel: Label | null = null;

    @property({
        type: Node,
        tooltip: 'Nhóm nội dung: chuỗi hiện tại + chuỗi tốt nhất + dãy điểm danh.',
    })
    contentNode: Node | null = null;

    @property({
        type: StreakNumberSprite,
        tooltip:
            'Số chuỗi hiện tại — ghép từ sprite chữ số (xác nhận từ user: thay Label bằng sprite, ' +
            '2 trạng thái xám/vàng). Xem StreakNumberSprite để gán 2 bộ sprite 0-9.',
    })
    streakValueSprite: StreakNumberSprite | null = null;

    @property({
        type: StreakNumberSprite,
        tooltip: 'Bản đổ bóng của streakValueSprite (node riêng) — đổi giá trị CÙNG LÚC, không còn trượt.',
    })
    streakValueShadowSprite: StreakNumberSprite | null = null;

    @property({
        type: Node,
        tooltip:
            'Node Mask là CHA của streakValueSprite (xác nhận từ user) — gán vào đây để ' +
            'flyStreakNumberUp() bay node MASK này (streakValueSprite là con, tự bay theo kế thừa ' +
            'transform cha, KHÔNG tween thêm vị trí riêng của chính nó nữa). Để trống nếu ' +
            'streakValueSprite không nằm trong Mask nào — lúc đó flyStreakNumberUp() mới tween ' +
            'thẳng node streakValueSprite như trước.',
    })
    streakValueMask: Node | null = null;

    @property({
        type: Node,
        tooltip: 'Mask (node CHA) của streakValueShadowSprite — cùng công dụng với streakValueMask ở trên, áp cho bản đổ bóng.',
    })
    streakValueShadowMask: Node | null = null;

    @property({ type: Label, tooltip: 'Nhãn chuỗi tốt nhất, ví dụ "Chuỗi tốt nhất: 5".' })
    bestStreakLabel: Label | null = null;

    @property({ type: Node, tooltip: 'Node cha chứa dãy ô điểm danh (nên gắn Layout ngang).' })
    dayRow: Node | null = null;

    @property({ type: Prefab, tooltip: 'StreakDayCell.prefab — một ô điểm danh.' })
    dayCellPrefab: Prefab | null = null;

    @property({
        type: [Node],
        tooltip:
            'Danh sách TUỲ Ý các node KHÁC cần ẨN lúc đang ở màn thắp chuỗi (celebrate) — kéo thêm ' +
            'bao nhiêu node cũng được (ví dụ tiêu đề "Daily Streak", ô nhập liệu test...). Ẩn/hiện ' +
            'CÙNG LÚC với glowNode/bestStreakLabel/dayRow/homeButtonNode (xem ' +
            'enterCelebrateMode()/playCelebrateRevealSequence()).',
    })
    extraCelebrateHiddenNodes: Node[] = [];

    @property({ tooltip: 'Label số chuỗi quay lên/xuống bao xa (px) khi thắp chuỗi (playStreakRollUp).' })
    streakRollDistance = 60;

    @property({ tooltip: 'Label số chuỗi: số cũ quay lên + số mới quay từ dưới lên mất bao lâu (giây).' })
    streakRollSeconds = 0.35;

    @property({
        tooltip:
            'Số chuỗi: SAU KHI bấm sun để thắp chuỗi, trễ bao lâu (giây) rồi mới bắt đầu bay lên ' +
            '(hiệu ứng MỚI, độc lập với hiệu ứng quay số ở trên — tự canh trễ đủ lớn để không đụng ' +
            'nhau với streakRollSeconds nếu muốn 2 hiệu ứng nối tiếp thay vì chồng lên).',
    })
    streakFlyUpDelaySeconds = 0.5;

    @property({ tooltip: 'Số chuỗi: bay lên xa bao nhiêu (px) kể từ vị trí hiện tại.' })
    streakFlyUpDistance = 40;

    @property({ min: 0.01, tooltip: 'Số chuỗi: tốc độ bay lên (px/giây) — thời gian bay = khoảng cách / tốc độ này.' })
    streakFlyUpSpeedPxPerSecond = 80;

    @property({
        tooltip:
            'Vị trí Y GỐC (lúc CHƯA bay lên) của streakValueMask/streakValueShadowMask (hoặc thẳng ' +
            'sprite nếu không gán mask) — ví dụ -96. Áp LẠI giá trị này mỗi lúc vào màn thắp chuỗi ' +
            'MỚI (enterCelebrateMode(), trước khi bấm sun). Lúc xem Streak bình thường (đã thắp, ' +
            'enterViewMode()) hiện ở vị trí Y SAU KHI bay = giá trị này + streakFlyUpDistance (xác ' +
            'nhận từ user: "giữ lại vị trí sau khi bay lên", vd gốc -96 + bay 96 = 0).',
    })
    streakValueRestY = -96;

    @property({
        tooltip:
            'Vừa thắng xong ĐÚNG ngày thứ 7 (quà sẵn sàng, chưa nhận) — SAU KHI CẢ hiệu ứng quay số ' +
            '(afterStreakRollUp) LẪN toàn bộ UI "tròn streak" (celebrateToggleNodes — glow/chuỗi tốt ' +
            'nhất/dãy điểm danh/nút dưới cùng) đã hiện XONG HẲN (xác nhận từ user: "đợi tất cả ui ' +
            'tròn streak hiện xong rồi đợi thêm [bằng này giây] rồi mới mở nhận thưởng"), đợi thêm ' +
            'bằng này giây rồi TỰ ĐỘNG mở popup nhận thưởng luôn, không cần người chơi tự bấm vào ô ' +
            'quà nữa.',
    })
    rewardPopupDelaySeconds = 0.2;

    @property({
        type: Label,
        tooltip:
            'Nhãn trên nút dưới cùng. Đổi giữa "về trang chủ" và "chơi ngay" tuỳ người ' +
            'chơi đã qua màn nào chưa.',
    })
    homeButtonLabel: Label | null = null;

    @property({ type: Node, tooltip: 'Node nút dưới cùng (Trang chủ/Chơi ngay).' })
    homeButtonNode: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Text CHỈ hiện trong lúc đang ở màn thắp chuỗi (enterCelebrateMode(), trước khi bấm sun) ' +
            '— bấm sun xong (onTapSun()) thì tự ẩn NGAY qua opacity (mờ dần, KHÔNG active=false). Ẩn ' +
            'hẳn (active=false) ở enterViewMode()/enterLockedMode() (không phải màn thắp chuỗi). Để ' +
            'trống thì bỏ qua hẳn node này.',
    })
    celebratePromptText: Node | null = null;

    @property({ tooltip: 'Text chỉ hiện lúc thắp chuỗi (celebratePromptText): ẩn đi sau khi bấm sun mất bao lâu (giây).' })
    celebratePromptHideSeconds = 0.25;

    @property({
        type: Node,
        tooltip: 'Nút RESET chuỗi — chỉ để TEST. Tắt cờ dưới để ẩn khi phát hành.',
    })
    resetButton: Node | null = null;

    @property({ tooltip: 'BẬT nút reset chuỗi (chỉ dùng khi test). Tắt trước khi build phát hành.' })
    enableResetButton = true;

    @property({
        type: EditBox,
        tooltip:
            'CHỈ ĐỂ TEST — nhập số rồi rời ô (Done/chạm ra ngoài) để ép THẲNG số chuỗi (streak) ' +
            'thành đúng số đó, hiện lại ngay. KHÔNG liên quan tới dayRow (dãy điểm danh Mon-Sun) — ' +
            'xem DailyPuzzleService.setTestStreakValue(). Để trống thì bỏ qua tính năng này.',
    })
    debugStreakValueInput: EditBox | null = null;

    @property({
        type: Node,
        tooltip:
            'CHỈ ĐỂ TEST — nút ép dayRow tuần hiện tại thành ĐÃ điểm danh đúng 6/7 ngày (ngày quà — ' +
            'ô cuối cùng — còn trống), để chơi xong 1 màn NGAY HÔM NAY là đủ thắp chuỗi ngày 7/nhận ' +
            'quà, test luồng nhận thưởng. KHÔNG đụng gì tới số chuỗi (streak). Gắn Click Event trỏ ' +
            'thẳng onTapDebugJumpToDaySix() (public, giống onTapResetStreak()). Để trống thì bỏ qua.',
    })
    debugJumpToDaySixButton: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'CHỈ ĐỂ TEST — nút bỏ dấu "đã chơi hôm nay", GIỮ NGUYÊN số chuỗi (streak) — khác hẳn ' +
            'resetButton (đưa streak về 0 hoàn toàn). Dùng để test lại luồng thắp chuỗi (bấm sun) ' +
            'nhiều lần mà không mất số đã tích luỹ — thắng 1 màn mới vẫn cộng dồn tiếp bình thường. ' +
            'Gắn Click Event trỏ thẳng onTapDebugResetToUnlit() (public, giống onTapResetStreak()). ' +
            'Để trống thì bỏ qua.',
    })
    debugResetToUnlitButton: Node | null = null;

    @property({ tooltip: 'Hiệu ứng hiện lên từng cụm: 1 cụm mờ dần (opacity 0→255) mất bao lâu (giây).' })
    revealFadeSeconds = 0.3;

    @property({
        tooltip:
            'Hiệu ứng hiện lên từng cụm: cụm này mờ dần XONG rồi đợi bao lâu (giây) mới tới cụm ' +
            'kế tiếp — các cụm hiện TUẦN TỰ theo thứ tự trên xuống (mặt trời → glow → prompt/nội ' +
            'dung → nút dưới cùng), KHÔNG chạy đồng thời.',
    })
    revealStaggerSeconds = 0.12;

    @property({
        type: [DailyStreakRevealGroup],
        tooltip:
            'Mảng các CỤM node cho hiệu ứng hiện lên tuần tự (playRevealSequence) — mỗi phần tử là ' +
            '1 cụm gồm NHIỀU node, tất cả node trong 1 cụm mờ dần (opacity 0→255) CÙNG LÚC; các cụm ' +
            'hiện SAU danh sách cố định (sunNode/glowNode/promptNode/contentNode/homeButtonNode), ' +
            'theo đúng thứ tự khai báo, cách nhau revealStaggerSeconds. Để trống thì không ảnh hưởng ' +
            'gì (playRevealSequence() chạy y nguyên như cũ).',
    })
    revealGroups: DailyStreakRevealGroup[] = [];

    private readonly cells: StreakDayCell[] = [];

    /** Label CLONE tạm hiện số CŨ trong lúc "quay số" (playStreakRollUp) — 1 cho streakValueLabel,
     * 1 cho streakValueShadowLabel (nếu có) — giữ tham chiếu để huỷ ngay nếu màn đóng/quay số lại
     * giữa chừng (ví dụ bấm reset chuỗi lúc đang quay). */
    private readonly streakRollOutNodes: Node[] = [];

    private lit = false;
    private playNowMode = false;
    private pendingResult = false;

    /** Đang ở màn thắp chuỗi, đợi người chơi bấm sun — chỉ true trong đúng khoảng thời gian này,
     * dùng để chặn onTapSun() hoạt động ở mọi trường hợp khác (xem màn Streak bình thường...). */
    private awaitingSunTap = false;
    /** Đã bấm sun rồi — chặn bấm lần 2 (xác nhận từ user: "nút này người chơi chỉ bấm được 1
     * lần"). Reset lại mỗi lần vào enterCelebrateMode() mới. */
    private sunTapped = false;
    /** true đúng lúc đang đợi callback FINISHED của clip "streak" (onTapSun() vừa play) — tránh
     * onSunAnimationFinished() phản ứng nhầm lúc sunAnimation.play() các clip tĩnh khác
     * (GlowSun/DimSun) cũng tự bắn FINISHED nếu clip đó không loop. */
    private awaitingSunAnimFinish = false;
    /** true khi hiệu ứng quay số (playStreakRollUp -> afterStreakRollUp) đã chạy xong HẲN cho lần
     * thắp chuỗi hiện tại — xem tryAutoOpenReward(). Reset mỗi lần vào enterCelebrateMode() mới. */
    private numberRollDone = false;
    /** true khi toàn bộ UI celebrateToggleNodes (glow/chuỗi tốt nhất/dãy điểm danh/nút dưới cùng)
     * đã hiện XONG HẲN (không chỉ mới bắt đầu fade) — xem markRevealSequenceDone()/
     * tryAutoOpenReward(). Reset mỗi lần vào enterCelebrateMode() mới. */
    private revealSequenceDone = false;

    onLoad(): void {
        this.sunAnimation?.on(Animation.EventType.FINISHED, this.onSunAnimationFinished, this);
        this.debugStreakValueInput?.node.on(EditBox.EventType.EDITING_DID_ENDED, this.onDebugStreakValueEditingEnded, this);
    }

    protected onOpen(): void {
        if (this.resetButton) this.resetButton.active = this.enableResetButton;
        this.render(StreakPresentation.consumeCelebrate());
    }

    protected onClose(): void {
        this.stopScheduledEffects();
    }

    onDestroy(): void {
        this.stopScheduledEffects();
        if (this.sunAnimation?.isValid) this.sunAnimation.off(Animation.EventType.FINISHED, this.onSunAnimationFinished, this);
        if (this.debugStreakValueInput?.isValid) {
            this.debugStreakValueInput.node.off(EditBox.EventType.EDITING_DID_ENDED, this.onDebugStreakValueEditingEnded, this);
        }
    }

    private stopScheduledEffects(): void {
        this.unschedule(this.playStreakRollSequence);
        this.unschedule(this.afterStreakRollUp);
        this.unschedule(this.autoOpenRewardPopup);
        this.unschedule(this.flyStreakNumberUp);
        this.unschedule(this.markRevealSequenceDone);
        this.awaitingSunAnimFinish = false;

        for (const node of this.streakRollOutNodes) {
            if (node?.isValid) node.destroy();
        }
        this.streakRollOutNodes.length = 0;

        if (this.streakValueSprite?.node?.isValid) Tween.stopAllByTarget(this.streakValueSprite.node);
        if (this.streakValueShadowSprite?.node?.isValid) Tween.stopAllByTarget(this.streakValueShadowSprite.node);
        if (this.streakValueMask?.isValid) Tween.stopAllByTarget(this.streakValueMask);
        if (this.streakValueShadowMask?.isValid) Tween.stopAllByTarget(this.streakValueShadowMask);

        const opacityNodes: (Node | null)[] = [this.sunNode, this.promptNode, this.contentNode, this.celebratePromptText];
        const revealGroupNodes: (Node | null)[] = [];
        for (const group of this.revealGroups) {
            for (const node of group.nodes) revealGroupNodes.push(node);
        }
        for (const node of opacityNodes.concat(this.celebrateToggleNodes()).concat(revealGroupNodes)) {
            const opacity = node?.isValid ? node.getComponent(UIOpacity) : null;
            if (opacity) Tween.stopAllByTarget(opacity);
        }
    }

    private render(celebrate: boolean): void {
        const board = this.readBoard();
        console.log('[DEBUG DailyStreakScreen] render() celebrate=', celebrate, 'board=', JSON.stringify({
            streak: board.streak, playedToday: board.playedToday, rewardReady: board.rewardReady,
        }));
        this.buildDayRow(board);
        this.fillLabels(board);
        this.setupBottomButton(board, celebrate);

        if (board.streak === 0) {
            // CHƯA thắp chuỗi lần nào — ẩn hẳn nút home/tiếp tục, không có gì để "về" cả.
            this.enterLockedMode(Localization.get(L10N.streak.lockedPrompt), false);
            this.playRevealSequence();
        } else if (!board.playedToday) {
            // Chuỗi vẫn còn giá trị (chưa đứt) nhưng HÔM NAY chưa chơi gì — không được
            // hiện như đã "thắp sáng" xong xuôi, vẫn phải nhắc chơi để giữ chuỗi.
            this.enterLockedMode(Localization.get(L10N.streak.continuePrompt), true);
            this.playRevealSequence();
        } else if (celebrate) {
            // Luồng mới (xác nhận từ user): KHÔNG hiện tuần tự hết mọi cụm ngay — chỉ sunNode +
            // số chuỗi (trong contentNode) hiện từ đầu, đợi người chơi BẤM sun (onTapSun()) rồi
            // mới hiện các cụm còn lại, xem enterCelebrateMode()/onTapSun().
            this.enterCelebrateMode(board);
        } else {
            this.enterViewMode(board);
            this.playRevealSequence();
        }
    }

    /** Hiện LẦN LƯỢT từng CỤM theo đúng thứ tự TRÊN XUỐNG trên màn hình — CHỈ mờ dần (opacity
     * 0→255), KHÔNG scale/phóng to. Gọi SAU KHI các nhánh enterXMode() đã quyết định xong node
     * nào active trong trạng thái hiện tại (node đang ẩn — active=false — bị bỏ qua, không cộng
     * vào độ trễ tuần tự của các cụm sau). */
    private playRevealSequence(): void {
        const order: readonly (Node | null)[] = [
            this.sunNode,
            this.glowNode,
            this.promptNode,
            this.contentNode,
            this.homeButtonNode,
        ];

        let delaySeconds = 0;
        for (const node of order) {
            if (!node?.isValid || !node.active) continue;
            this.fadeIn(node, delaySeconds);
            delaySeconds += this.revealStaggerSeconds;
        }

        for (const group of this.revealGroups) {
            const activeNodes = group.nodes.filter(node => node?.isValid && node.active);
            if (activeNodes.length === 0) continue;
            for (const node of activeNodes) this.fadeIn(node, delaySeconds);
            delaySeconds += this.revealStaggerSeconds;
        }
    }

    /** Danh sách node ẨN/HIỆN cùng lúc ở màn thắp chuỗi (celebrate) — dùng CHUNG cho cả lúc ẩn
     * (enterCelebrateMode()) lẫn lúc hiện lại (playCelebrateRevealSequence()), gồm các node cố
     * định SẴN CÓ cộng thêm bất kỳ node nào kéo vào extraCelebrateHiddenNodes. */
    private celebrateToggleNodes(): readonly (Node | null)[] {
        const fixed: readonly (Node | null)[] = [
            this.glowNode, this.bestStreakLabel?.node ?? null, this.dayRow, this.homeButtonNode,
        ];
        return fixed.concat(this.extraCelebrateHiddenNodes);
    }

    /** Bản RIÊNG cho màn thắp chuỗi (celebrate) — gọi SAU KHI anim "streak" của sunNode chạy xong
     * (xem onTapSun()/onSunTapAnimFinished()). KHÔNG gồm sunNode (đã hiện sẵn từ đầu, không cần
     * fade lại) LẪN contentNode (phải giữ active NGUYÊN VẸN xuyên suốt vì số chuỗi — con của nó —
     * cần hiện sẵn từ đầu cùng sunNode; chỉ các node con CÒN LẠI của nó — bestStreakLabel/dayRow —
     * mới thuộc diện ẩn/hiện ở đây, xem enterCelebrateMode()). */
    private playCelebrateRevealSequence(): void {
        let delaySeconds = 0;
        let lastFadeInStart = 0;
        for (const node of this.celebrateToggleNodes()) {
            if (!node?.isValid || !node.active) continue;
            this.fadeIn(node, delaySeconds);
            lastFadeInStart = delaySeconds;
            delaySeconds += this.revealStaggerSeconds;
        }
        // "Đợi TẤT CẢ ui tròn streak hiện xong rồi mới mở nhận thưởng" (xác nhận từ user) — báo hiệu
        // reveal sequence đã hiện XONG HẲN (node cuối cùng mờ-dần xong, không chỉ mới BẮT ĐẦU) đúng
        // lúc node CUỐI trong celebrateToggleNodes() fade-in xong — xem revealSequenceDone/
        // tryAutoOpenReward().
        this.revealSequenceDone = false;
        this.unschedule(this.markRevealSequenceDone);
        this.scheduleOnce(this.markRevealSequenceDone, lastFadeInStart + this.revealFadeSeconds);
    }

    private markRevealSequenceDone = (): void => {
        this.revealSequenceDone = true;
        this.tryAutoOpenReward();
    };

    /** "Đợi tất cả ui tròn streak hiện xong rồi đợi thêm rewardPopupDelaySeconds rồi mới mở nhận
     * thưởng" (xác nhận từ user) — CHỈ mở khi CẢ 2 mốc đều đã xong: (1) hiệu ứng quay số
     * (numberRollDone, xem afterStreakRollUp()) VÀ (2) toàn bộ UI celebrateToggleNodes đã hiện XONG
     * HẲN (revealSequenceDone, xem markRevealSequenceDone()) — 2 mốc này chạy trên 2 lịch độc lập
     * (reveal sequence chỉ bắt đầu SAU KHI anim "streak" của sunNode chạy xong, không nhất thiết
     * cùng nhịp với quay số), nên không thể gộp chung làm 1 schedule duy nhất. */
    private tryAutoOpenReward(): void {
        if (!this.numberRollDone || !this.revealSequenceDone) return;
        const board = this.readBoard();
        this.unschedule(this.autoOpenRewardPopup);
        if (board.rewardReady && !board.rewardClaimed) {
            this.scheduleOnce(this.autoOpenRewardPopup, this.rewardPopupDelaySeconds);
        }
    }

    /** glowSunNode/dimSunNode — 2 node RIÊNG (trước đây là 2 clip "GlowSun"/"DimSun" trên CHÍNH
     * sunAnimation, giờ tách ra vì sunNode chỉ còn lo hiệu ứng bấm thắp chuỗi) — luôn loại trừ
     * nhau, CHỈ 1 trong 2 active cùng lúc theo đúng `lit`. */
    private setSunLitDisplay(lit: boolean): void {
        if (this.glowSunNode) this.glowSunNode.active = lit;
        if (this.dimSunNode) this.dimSunNode.active = !lit;
    }

    /** Ẩn NGAY qua opacity=0 (KHÔNG active=false) — dùng cho các node cần fade vào SAU (xem
     * playCelebrateRevealSequence()) nhưng phải giữ active=true để fadeIn() gọi SAU này còn tween
     * được (node active=false thì không render/không chạy tween gì cả). */
    private hideByOpacity(node: Node | null): void {
        if (!node?.isValid) return;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
    }

    /** Mờ dần (opacity 0→255) sau `delaySeconds` — không đụng gì tới scale/vị trí node. */
    private fadeIn(node: Node, delaySeconds: number): void {
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);

        opacity.opacity = 0;
        tween(opacity).delay(delaySeconds).to(this.revealFadeSeconds, { opacity: 255 }).start();
    }

    /** Mờ dần (opacity hiện tại → 0) trong `seconds` giây — KHÔNG active=false khi xong (node vẫn
     * tồn tại, chỉ trong suốt; enterLockedMode()/enterViewMode() tự active=false đúng lúc nếu cần). */
    private fadeOut(node: Node | null, seconds: number): void {
        if (!node?.isValid) return;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        tween(opacity).to(Math.max(0.01, seconds), { opacity: 0 }).start();
    }

    private setPrompt(text: string): void {
        if (this.promptLabel) this.promptLabel.string = text;
    }

    private readBoard(): StreakBoard {
        const service = DailyServiceHolder.current;
        if (service) return service.getStreakBoard();

        console.warn('[DailyStreakScreen] DailyPuzzleService chưa sẵn sàng — hiện dãy rỗng.');
        return { streak: 0, bestStreak: 0, days: [], rewardReady: false, rewardClaimed: false, playedToday: false };
    }

    private fillLabels(board: StreakBoard): void {
        // Mặc định: VÀNG nếu hôm nay đã chơi (xem/giữ nguyên lúc mở lại màn sau khi đã thắp),
        // XÁM nếu chưa (locked mode) — enterCelebrateMode() tự ghi đè XÁM+giá trị cũ ngay sau đây
        // nếu đang ở chế độ ăn mừng (quay số), không phụ thuộc giá trị mặc định này.
        const gold = board.playedToday;
        this.streakValueSprite?.setValue(board.streak, gold);
        this.streakValueShadowSprite?.setValue(board.streak, gold);
        if (this.bestStreakLabel) {
            this.bestStreakLabel.string = Localization.get(L10N.streak.best).replace(
                '{n}',
                `${board.bestStreak}`,
            );
        }
    }

    private buildDayRow(board: StreakBoard): void {
        const row = this.dayRow;
        if (!row) return;

        while (this.cells.length < board.days.length) {
            if (!this.dayCellPrefab) break;

            const node = instantiate(this.dayCellPrefab);
            node.parent = row;

            const cell = node.getComponent(StreakDayCell);
            if (!cell) {
                console.error('[DailyStreakScreen] dayCellPrefab thiếu component StreakDayCell.');
                node.destroy();
                break;
            }
            this.cells.push(cell);
        }

        for (let i = 0; i < this.cells.length; i++) {
            const day = board.days[i];
            const cell = this.cells[i];
            if (!cell) continue;

            cell.node.active = day !== undefined;
            if (!day) continue;


            const reward = day.isReward
                ? {
                      ready: board.rewardReady,
                      claimed: board.rewardClaimed,
                      onClaim: () => this.onClaimReward(),
                  }
                : undefined;
            cell.bind(day, reward);
        }
    }


    /** Dùng CHUNG RewardReceivePopup với luồng nhận thưởng Top 3 giải đấu (xem
     * TournamentResultPopup.onTouchClaim()) — KHÔNG còn dùng PopupId.Reward/RewardPopup (bỏ
     * riêng cho luồng này, file giữ nguyên không xoá). Bọc số lượt Place Dog thành 1
     * GameResource[] để đúng shape RewardReceivePopup đang nhận (dùng qua clientEvent, cùng cơ
     * chế ShopPopup/StarterPackPopup/TournamentResultPopup đang dùng). */
    private onClaimReward(): void {
        const service = DailyServiceHolder.current;
        if (!service) return;

        const reward = service.claimReward();
        if (reward <= 0) return;


        const grant: PlaceDogGrantRequestedEventPayload = { amount: reward };
        EventManager.instance.emit(PLACE_DOG_GRANT_REQUESTED_EVENT, grant);

        const rewards: GameResource[] = [new GameResource(RESOURCE_TYPE.BOOSTER, BOOSTER_TYPE.PLACE_DOG, reward)];
        clientEvent.dispatchEvent(Constants.SHOW_REWARD_RECEIVE_POPUP, Localization.get(L10N.rewards.title), rewards);
    }

    private autoOpenRewardPopup = (): void => {
        this.onClaimReward();
    };

    private playStreakRollSequence = (): void => {
        const board = this.readBoard();
        this.playStreakRollUp(Math.max(0, board.streak - 1), board.streak);
    };

    /** "Quay số" kiểu đồng hồ công-tơ-mét cho streakValueLabel VÀ streakValueShadowLabel (nếu có)
     * — CẢ 2 label trượt/đổi số CÙNG LÚC, y hệt nhau, để bóng luôn bám đúng theo số chính. Sau
     * khi quay xong (streakRollSeconds), nếu ĐÚNG lúc này hoàn thành ngày thứ 7 (quà sẵn sàng,
     * chưa nhận) thì đợi thêm rewardPopupDelaySeconds rồi tự động mở popup nhận thưởng. */
    private playStreakRollUp(fromValue: number, toValue: number): void {
        for (const node of this.streakRollOutNodes) {
            if (node?.isValid) node.destroy();
        }
        this.streakRollOutNodes.length = 0;

        this.rollOneSprite(this.streakValueSprite, fromValue, toValue);
        this.rollOneSprite(this.streakValueShadowSprite, fromValue, toValue);

        this.unschedule(this.afterStreakRollUp);
        this.scheduleOnce(this.afterStreakRollUp, this.streakRollSeconds);
    }

    private afterStreakRollUp = (): void => {
        // "Khi thắp chuỗi xong thì chuyển sang glowSunNode" (xác nhận từ user) — số đã quay xong
        // hẳn, đúng mốc "thắp chuỗi xong" thật sự (không phải lúc anim "streak"/sunNode vừa chạy
        // xong — đó chỉ là lúc các cụm khác BẮT ĐẦU hiện lên, xem onSunAnimationFinished()).
        this.lit = true;
        this.setSunLitDisplay(true);

        this.numberRollDone = true;
        this.tryAutoOpenReward();
    };

    /** Node THỰC SỰ di chuyển cho hiệu ứng vị trí Y của số chuỗi CHÍNH — mask (node CHA, xác nhận
     * từ user) nếu có gán, sprite (chính nó) nếu KHÔNG gán mask. */
    private streakValueMoveTarget(): Node | null {
        if (this.streakValueMask?.isValid) return this.streakValueMask;
        if (this.streakValueSprite?.node?.isValid) return this.streakValueSprite.node;
        return null;
    }

    /** Tương tự streakValueMoveTarget() nhưng cho bản ĐỔ BÓNG (shadow). */
    private streakValueShadowMoveTarget(): Node | null {
        if (this.streakValueShadowMask?.isValid) return this.streakValueShadowMask;
        if (this.streakValueShadowSprite?.node?.isValid) return this.streakValueShadowSprite.node;
        return null;
    }

    /** Ẩn/hiện số CHÍNH (streakValueMoveTarget — mask hoặc sprite tuỳ cái nào có gán) — KHÔNG đụng
     * tới bóng (streakValueShadowMoveTarget luôn hiện, tự đứng đúng vị trí qua setStreakValueY()).
     * enterLockedMode() gọi false (chỉ còn bóng hiện, xác nhận từ user); enterViewMode()/
     * enterCelebrateMode() gọi true. */
    private setMainStreakValueVisible(visible: boolean): void {
        const target = this.streakValueMoveTarget();
        if (target) target.active = visible;
    }

    /** Dùng chung cho flyStreakNumberUp() — cả số chính lẫn bóng CÙNG bay (chỉ khác nhau lúc
     * enterLockedMode(), xem setStreakValueY()). */
    private streakValueMoveTargets(): readonly Node[] {
        const targets: Node[] = [];
        const main = this.streakValueMoveTarget();
        if (main) targets.push(main);
        const shadow = this.streakValueShadowMoveTarget();
        if (shadow) targets.push(shadow);
        return targets;
    }

    private setPositionY(node: Node | null, y: number): void {
        if (!node) return;
        Tween.stopAllByTarget(node);
        node.setPosition(node.position.x, y, node.position.z);
    }

    /** "Khi vào màn thắp chuỗi mới thì hiện ở vị trí GỐC, giữ lại vị trí SAU KHI bay lên lúc xem
     * Streak bình thường" (xác nhận từ user) — gọi ở enterCelebrateMode() với streakValueRestY
     * (gốc, CẢ số chính lẫn bóng), enterViewMode() với streakValueRestY + streakFlyUpDistance (đã
     * bay, CẢ 2). KHÔNG dùng lúc đang bay dở (flyStreakNumberUp() tự tween, gọi hàm này giữa chừng
     * sẽ cắt ngang tween đó).
     *
     * `shadowY` (mặc định = `mainY`): BUG đã sửa (xác nhận từ user — "node bóng, khi CHƯA thắp
     * chuỗi, vị trí của nó giống như node số khi ĐÃ bay lên; chỉ trong màn thắp chuỗi thì nó mới về
     * vị trí gốc") — enterLockedMode() (chưa thắp hôm nay) truyền RIÊNG 2 giá trị khác nhau: số
     * chính vẫn ở vị trí gốc như cũ, CHỈ bóng đổi sang vị trí đã bay. */
    private setStreakValueY(mainY: number, shadowY: number = mainY): void {
        this.setPositionY(this.streakValueMoveTarget(), mainY);
        this.setPositionY(this.streakValueShadowMoveTarget(), shadowY);
    }

    /** Hiệu ứng MỚI (xác nhận từ user): số chuỗi tự bay lên sau khi bấm sun, trễ
     * streakFlyUpDelaySeconds kể từ lúc bấm — tự canh >= streakRollSeconds (duration hiệu ứng quay
     * số ở trên) để không đụng độ vị trí, vì hiệu ứng quay số CŨNG tween `position` của CHÍNH node
     * streakValueSprite/streakValueShadowSprite. "Mask và label là node cha-con, label bay thế nào
     * thì mask bay như thế" (xác nhận từ user — streakValueMask/streakValueShadowMask LÀ node CHA
     * của sprite) — vì vậy CHỈ bay node MASK (cha): sprite (con) tự bay theo SẴN qua kế thừa
     * transform cha, không tween thêm `position` của CHÍNH sprite nữa (nếu tween cả 2 thì sprite bị
     * dịch chuyển GẤP ĐÔI khoảng cách thật — lệch sai so với mask). Nơi nào CHƯA gán mask (để
     * trống) thì mới tween thẳng node sprite như trước, để vẫn hoạt động được kể cả không có mask. */
    private flyStreakNumberUp = (): void => {
        const duration = this.streakFlyUpDistance / this.streakFlyUpSpeedPxPerSecond;
        for (const node of this.streakValueMoveTargets()) {
            this.flyNodeUp(node, duration);
        }
    };

    private flyNodeUp(node: Node, duration: number): void {
        Tween.stopAllByTarget(node);
        const from = node.position.clone();
        const to = new Vec3(from.x, from.y + this.streakFlyUpDistance, from.z);
        tween(node).to(duration, { position: to }, { easing: 'quadOut' }).start();
    }

    /** Số CŨ (XÁM, đang hiện ở `sprite`) trượt LÊN và mờ dần biến mất, đồng thời số MỚI (VÀNG)
     * trượt LÊN từ phía dưới vào đúng vị trí — 2 hiệu ứng chạy ĐỒNG THỜI, không nối tiếp (xác
     * nhận từ user: "hiệu ứng cuộn là số xám bị cuộn và số vàng thay thế vị trí"). Số cũ dùng 1
     * bản CLONE tạm (huỷ ngay sau khi trượt xong) vì `sprite` gốc cần đổi ngay sang số mới để
     * trượt vào. */
    private rollOneSprite(sprite: StreakNumberSprite | null, fromValue: number, toValue: number): void {
        if (!sprite || !sprite.node.isValid) return;

        const node = sprite.node;
        Tween.stopAllByTarget(node);

        const restPos = node.position.clone();
        const distance = this.streakRollDistance;
        const duration = this.streakRollSeconds;

        const outNode = instantiate(node);
        outNode.setParent(node.parent);
        outNode.setPosition(restPos);
        outNode.setSiblingIndex(node.getSiblingIndex());
        outNode.getComponent(StreakNumberSprite)?.setValue(fromValue, false);
        const outOpacity = outNode.getComponent(UIOpacity) ?? outNode.addComponent(UIOpacity);
        outOpacity.opacity = 255;
        this.streakRollOutNodes.push(outNode);

        tween(outNode)
            .to(duration, { position: new Vec3(restPos.x, restPos.y + distance, restPos.z) }, { easing: 'quadIn' })
            .call(() => {
                const index = this.streakRollOutNodes.indexOf(outNode);
                if (index >= 0) this.streakRollOutNodes.splice(index, 1);
                outNode.destroy();
            })
            .start();
        tween(outOpacity).to(duration, { opacity: 0 }, { easing: 'quadIn' }).start();

        sprite.setValue(toValue, true);
        node.setPosition(restPos.x, restPos.y - distance, restPos.z);
        tween(node).to(duration, { position: restPos }, { easing: 'quadOut' }).start();
    }


    /**
     * `pendingResult`: đang ở đúng luồng "thắng màn đầu tiên trong ngày" (celebrate) — màn
     * Result/DailyResult bị hoãn lại, chỉ hiện SAU KHI bấm nút này. Đổi CHỮ thành "Tiếp
     * tục" và đổi ĐÍCH điều hướng thành Gameplay (thay vì MainMenu) — xem onTapHome().
     */
    private setupBottomButton(board: StreakBoard, pendingResult: boolean): void {
        this.playNowMode = board.streak === 0 || !board.playedToday;
        this.pendingResult = pendingResult;
        console.log('[DEBUG DailyStreakScreen] setupBottomButton:', JSON.stringify({
            streak: board.streak, playedToday: board.playedToday, rewardReady: board.rewardReady,
            rewardClaimed: board.rewardClaimed, playNowMode: this.playNowMode, pendingResult,
        }));

        if (this.homeButtonLabel) {
            const key = this.playNowMode
                ? L10N.common.playNow
                : pendingResult
                    ? L10N.common.continue
                    : L10N.common.home;
            this.homeButtonLabel.string = Localization.get(key);
        }
    }


    private enterViewMode(board: StreakBoard): void {
        this.lit = board.streak > 0;
        this.awaitingSunTap = false;

        if (this.glowNode) this.glowNode.active = this.lit;
        if (this.promptNode) this.promptNode.active = false;
        if (this.homeButtonNode) this.homeButtonNode.active = true;
        if (this.contentNode) this.contentNode.active = true;
        // enterViewMode() chỉ chạy khi board.streak>0 && board.playedToday (xem render()) — tức
        // LUÔN đã thắp hôm nay, this.lit luôn true tới đây.
        this.setSunLitDisplay(true);
        // "sunNode chỉ hiện trong hiệu ứng thắp chuỗi, vào lại Streak [xem] thì ẩn đi" (xác nhận từ
        // user) — glowSunNode/dimSunNode (2 node TĨNH riêng) mới là thứ hiện ở đây.
        if (this.sunNode) this.sunNode.active = false;
        // "Giữ lại vị trí sau khi bay lên lúc xem Streak bình thường (đã thắp)" (xác nhận từ user).
        this.setStreakValueY(this.streakValueRestY + this.streakFlyUpDistance);
        this.setMainStreakValueVisible(true);
        // "Text chỉ hiện trong lúc thắp chuỗi" (xác nhận từ user) — ẩn hẳn ở mọi trạng thái khác.
        if (this.celebratePromptText) this.celebratePromptText.active = false;
    }

    /**
     * Thắng màn ĐẦU TIÊN trong ngày → được điều hướng thẳng tới màn Streak với cờ "ăn mừng". Luồng
     * MỚI (xác nhận từ user): CHỈ sunNode + số chuỗi (con của contentNode, vẫn XÁM vì chưa thắp)
     * hiện từ đầu — mọi cụm khác (glow/chuỗi tốt nhất/dãy điểm danh/nút dưới cùng) ẩn qua opacity
     * (active=true nhưng opacity=0, để sau còn fade vào được — xem hideByOpacity()). Đợi người
     * chơi BẤM sunNode (onTapSun(), nút chỉ tác dụng ĐÚNG 1 LẦN) rồi mới: (1) chạy anim "streak"
     * của sunNode, (2) quay số CÙNG LÚC — anim "streak" chạy XONG mới hiện các cụm còn lại
     * (onSunAnimationFinished() → playCelebrateRevealSequence()). Số chuỗi còn tự bay lên sau đó
     * (flyStreakNumberUp(), trễ streakFlyUpDelaySeconds kể từ lúc bấm). "Thắp chuỗi xong" THẬT SỰ
     * (số đã quay xong hẳn) mới chuyển sang glowSunNode — xem afterStreakRollUp(). Nếu ĐÚNG lúc
     * này hoàn thành NGÀY THỨ 7 (quà sẵn sàng, chưa nhận), SAU KHI quay số xong mới tự động mở
     * popup nhận thưởng (afterStreakRollUp()).
     */
    private enterCelebrateMode(board: StreakBoard): void {
        this.lit = false;
        this.sunTapped = false;
        this.awaitingSunTap = true;
        this.awaitingSunAnimFinish = false;
        this.numberRollDone = false;
        this.revealSequenceDone = false;

        if (this.promptNode) this.promptNode.active = false;
        if (this.contentNode) this.contentNode.active = true;

        for (const node of this.celebrateToggleNodes()) {
            if (!node) continue;
            node.active = true;
            this.hideByOpacity(node);
        }

        if (this.sunNode) this.sunNode.active = true;
        // "Ở màn thắp chuỗi thì cả dim sun và glow sun đều phải tắt đi" (xác nhận từ user) — khác
        // với enterViewMode()/enterLockedMode() (luôn hiện ĐÚNG 1 trong 2), ở đây sunNode tự lo
        // hết phần hiển thị qua anim "streak" của chính nó.
        if (this.glowSunNode) this.glowSunNode.active = false;
        if (this.dimSunNode) this.dimSunNode.active = false;
        // "Tắt lớp chặn chạm sun lại ngay lúc vào màn thắp chuỗi kế tiếp" (xác nhận từ user) — cho
        // phép bấm sun lần này; onTapSun() sẽ tự bật lại ngay khi bấm.
        if (this.sunTapBlocker) this.sunTapBlocker.active = false;
        // "Khi thắp chuỗi thì mới hiện ở vị trí gốc" (xác nhận từ user) — đưa về đúng vị trí ban
        // đầu TRƯỚC khi bấm sun, sẵn sàng cho flyStreakNumberUp() bay lên lại từ đây.
        this.setStreakValueY(this.streakValueRestY);
        this.setMainStreakValueVisible(true);

        // Chuỗi luôn tăng ĐÚNG 1 (hoặc reset về 1 nếu vừa đứt) mỗi lần ghi nhận thắng đầu tiên
        // trong ngày — giá trị TRƯỚC lần thắng này luôn là board.streak - 1 (kể cả trường hợp
        // vừa reset: board.streak=1 → cũ=0, quay 0→1 vẫn đúng ý nghĩa "bắt đầu chuỗi mới").
        const oldValue = Math.max(0, board.streak - 1);
        this.streakValueSprite?.setValue(oldValue, false);
        this.streakValueShadowSprite?.setValue(oldValue, false);

        // KHÔNG còn tự hẹn giờ quay số nữa — đợi người chơi bấm sun (onTapSun()).

        // "Text chỉ hiện trong lúc thắp chuỗi" (xác nhận từ user) — hiện lại NGAY từ đầu, kể cả
        // nếu đang fade dở từ lần trước (reset thẳng opacity=255, không tween).
        if (this.celebratePromptText) {
            this.celebratePromptText.active = true;
            const opacity = this.celebratePromptText.getComponent(UIOpacity) ?? this.celebratePromptText.addComponent(UIOpacity);
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 255;
        }
    }

    private enterLockedMode(prompt: string, showHomeButton: boolean): void {
        this.lit = false;
        this.awaitingSunTap = false;

        if (this.glowNode) this.glowNode.active = false;
        this.setPrompt(prompt);
        if (this.promptNode) this.promptNode.active = true;
        if (this.homeButtonNode) this.homeButtonNode.active = showHomeButton;

        // Chưa thắp chuỗi vẫn hiện ĐẦY ĐỦ nội dung còn lại (chuỗi hiện tại/tốt nhất, dãy
        // điểm danh) CÙNG LÚC với dòng nhắc — không ẩn hẳn như trước nữa.
        if (this.contentNode) this.contentNode.active = true;
        // "Bấm vào Streak lúc CHƯA thắp chuỗi (hôm nay) thì dùng dimSunNode" (xác nhận từ user) —
        // enterLockedMode() chạy cả 2 trường hợp "chưa từng thắp" lẫn "còn chuỗi nhưng hôm nay
        // chưa chơi", cả 2 đều tính là "chưa thắp chuỗi" hôm nay.
        this.setSunLitDisplay(false);
        // "sunNode chỉ hiện trong hiệu ứng thắp chuỗi" (xác nhận từ user).
        if (this.sunNode) this.sunNode.active = false;
        // "Node bóng, khi CHƯA thắp chuỗi, vị trí của nó giống như node số khi ĐÃ bay lên; chỉ
        // trong màn thắp chuỗi thì nó mới về vị trí gốc" (xác nhận từ user) — số CHÍNH vẫn ở vị trí
        // GỐC như cũ (chưa từng bay lên), CHỈ bóng đổi sang vị trí ĐÃ BAY.
        this.setStreakValueY(this.streakValueRestY, this.streakValueRestY + this.streakFlyUpDistance);
        // "Chỉ số ở TRÊN (bóng, đã ở vị trí đã bay) mới đúng, tắt số DƯỚI (chính, ở vị trí gốc) đi"
        // (xác nhận từ user, kèm ảnh — 2 node cùng hiện số thật trông như lỗi trùng lặp) — ẨN HẲN số
        // CHÍNH ở locked mode, CHỈ còn bóng hiện (đã dời lên vị trí đã bay). enterViewMode()/
        // enterCelebrateMode() tự bật lại (setMainStreakValueVisible(true)).
        this.setMainStreakValueVisible(false);
        // "Text chỉ hiện trong lúc thắp chuỗi" (xác nhận từ user) — ẩn hẳn ở mọi trạng thái khác.
        if (this.celebratePromptText) this.celebratePromptText.active = false;
    }

    /** Nút sun — chỉ có tác dụng ĐÚNG 1 LẦN, ĐÚNG lúc đang ở màn thắp chuỗi (awaitingSunTap, xem
     * enterCelebrateMode()); mọi lần bấm khác (xem Streak bình thường, hoặc bấm lại lần 2) đều
     * KHÔNG làm gì (xác nhận từ user). Bấm 1 cái kích hoạt ĐỒNG THỜI: (1) anim "streak" của
     * sunNode, (2) hiệu ứng quay số, (3) bật sunTapBlocker (chặn bấm lại mặt trời lần nữa) — các
     * cụm còn lại CHỈ hiện lên SAU KHI anim "streak" chạy xong (onSunAnimationFinished()). Wire
     * Button click trong Editor gọi hàm này. */
    onTapSun(): void {
        // LOG TẠM ĐỂ DEBUG ("bấm vào sun thì không chạy anim") — xoá sau khi xác định được nguyên
        // nhân thật. awaitingSunTap=false nghĩa là KHÔNG ở đúng màn thắp chuỗi (xem màn Streak
        // bình thường/đã thắp/chưa thắp đều không cho bấm — đúng thiết kế, không phải lỗi) hoặc đã
        // bấm rồi (sunTapped=true, chỉ bấm được 1 lần). sunAnimation=null nghĩa là CHƯA gán
        // component Animation vào property này trong Inspector.
        console.log('[DEBUG DailyStreakScreen] onTapSun(): awaitingSunTap=', this.awaitingSunTap,
            'sunTapped=', this.sunTapped, 'sunAnimation=', !!this.sunAnimation);
        if (!this.awaitingSunTap || this.sunTapped) return;
        this.sunTapped = true;
        this.awaitingSunTap = false;
        // "Hiện lớp sprite trong suốt chặn thao tác ngay lúc bấm thắp chuỗi" (xác nhận từ user).
        if (this.sunTapBlocker) this.sunTapBlocker.active = true;
        // "Bấm nút xong thì text ẩn luôn kiểu opacity" (xác nhận từ user).
        this.fadeOut(this.celebratePromptText, this.celebratePromptHideSeconds);

        if (this.sunAnimation) {
            this.awaitingSunAnimFinish = true;
            this.sunAnimation.play(SUN_ANIM_TAP);
        } else {
            // Không có Animation để đợi FINISHED — hiện các cụm còn lại NGAY, tránh kẹt màn hình.
            this.playCelebrateRevealSequence();
        }

        this.playStreakRollSequence();
        this.unschedule(this.flyStreakNumberUp);
        this.scheduleOnce(this.flyStreakNumberUp, this.streakFlyUpDelaySeconds);
    }

    /** Callback FINISHED CHUNG của sunAnimation (đăng ký 1 LẦN ở onLoad(), không dùng .once() lặp
     * lại mỗi lần bấm) — chỉ thực sự xử lý khi awaitingSunAnimFinish=true (vừa play clip "streak"
     * từ onTapSun()), bỏ qua FINISHED bắn ra từ các clip tĩnh khác (GlowSun/DimSun) nếu chúng
     * không loop. */
    private onSunAnimationFinished = (): void => {
        if (!this.awaitingSunAnimFinish) return;
        this.awaitingSunAnimFinish = false;
        this.playCelebrateRevealSequence();
    };

    onTapHome(): void {
        console.log('[DEBUG DailyStreakScreen] onTapHome: playNowMode=', this.playNowMode, 'pendingResult=', this.pendingResult);
        if (this.playNowMode) {
            const levelId = ProgressionHolder.current?.getCurrentLevel() ?? 1;
            console.log('[DEBUG DailyStreakScreen] playNowMode branch -> LEVEL_SELECTED_EVENT levelId=', levelId);
            const payload: LevelSelectedEventPayload = { context: 'campaign', levelId };
            EventManager.instance.emit(LEVEL_SELECTED_EVENT, payload);
            return;
        }

        // Vừa thắng lần đầu trong ngày ("Tiếp tục"): quay LẠI Gameplay đúng session vừa
        // chơi xong (GameManager giữ session sống, tự re-emit ready) — Result/DailyResult
        // hiện đè lên đó, KHÔNG phải về MainMenu như nút "Trang chủ" bình thường.
        const payload: NavigateRequestedEventPayload = {
            to: this.pendingResult ? AppState.Gameplay : AppState.MainMenu,
        };
        EventManager.instance.emit(NAVIGATE_REQUESTED_EVENT, payload);
    }


    onTapBack(): void {
        this.stopScheduledEffects();
        const payload: NavigateRequestedEventPayload = { to: AppState.MainMenu };
        EventManager.instance.emit(NAVIGATE_REQUESTED_EVENT, payload);
    }


    onTapResetStreak(): void {
        const service = DailyServiceHolder.current;
        if (!service) return;

        service.resetStreak();
        EventManager.instance.emit(SAVE_REQUESTED_EVENT, undefined);

        this.stopScheduledEffects();
        this.render(false);
    }

    /** CHỈ ĐỂ TEST — nhập số rồi rời ô (Done/chạm ra ngoài) ép thẳng số chuỗi thành đúng số đó,
     * KHÔNG đụng gì tới dayRow (xem GameManager.setTestStreakValue()/
     * DailyPuzzleService.setTestStreakValue()). Số không hợp lệ (rỗng/âm/không phải số) bị bỏ qua
     * lặng lẽ, không báo lỗi gì — đây là ô debug, không phải input người chơi thật. */
    private onDebugStreakValueEditingEnded = (): void => {
        const raw = this.debugStreakValueInput?.string ?? '';
        const value = parseInt(raw, 10);
        if (!Number.isInteger(value) || value < 0) return;

        GameManager.instance?.setTestStreakValue(value);
        this.stopScheduledEffects();
        this.render(false);
    };

    /** CHỈ ĐỂ TEST — ép dayRow tuần hiện tại thành ĐÃ điểm danh 6/7 ngày (ngày quà còn trống), KHÔNG
     * đụng gì tới số chuỗi (xem GameManager.setTestWeekToDaySix()/
     * DailyPuzzleService.setTestWeekToDaySix()). Gắn Click Event của debugJumpToDaySixButton trỏ
     * thẳng hàm này trong Editor, giống hệt onTapResetStreak(). */
    onTapDebugJumpToDaySix(): void {
        GameManager.instance?.setTestWeekToDaySix();
        this.stopScheduledEffects();
        this.render(false);
    }

    /** CHỈ ĐỂ TEST — bỏ dấu "đã chơi hôm nay", GIỮ NGUYÊN số chuỗi, KHÔNG như onTapResetStreak()
     * (đưa streak về 0 hoàn toàn) — xem GameManager.setTestNotPlayedToday()/
     * DailyPuzzleService.setTestNotPlayedToday(). Gắn Click Event của debugResetToUnlitButton trỏ
     * thẳng hàm này trong Editor, giống hệt onTapResetStreak()/onTapDebugJumpToDaySix(). */
    onTapDebugResetToUnlit(): void {
        GameManager.instance?.setTestNotPlayedToday();
        this.stopScheduledEffects();
        this.render(false);
    }
}
