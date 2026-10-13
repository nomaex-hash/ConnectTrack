import {
    _decorator,
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
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
import { GameResource } from '../../datainfo/GameResource';
import { RESOURCE_TYPE, BOOSTER_TYPE, Constants } from '../../framework/constants';
import { clientEvent } from '../../framework/clientEvent';

const { ccclass, property } = _decorator;


/**
 * Màn Streak KHÔNG còn animation xoay/particle nào (mặt trời/glow không tự xoay nữa) — chỉ còn
 * giữ lại hiệu ứng "quay số" cho streakValueLabel VÀ hiệu ứng hiện lên (mờ dần + phóng to) cho
 * từng CỤM nội dung khi mở màn (xem playRevealSequence()): (1) mặt trời + glow, (2) cụm nội
 * dung (prompt HOẶC chuỗi hiện tại/tốt nhất/dãy điểm danh, tuỳ trạng thái), (3) nút dưới cùng.
 */
@ccclass('DailyStreakScreen')
export class DailyStreakScreen extends UIScreen {
    @property({ type: Node, tooltip: 'Sprite mặt trời/lịch — tĩnh, không còn animation gì.' })
    sunNode: Node | null = null;

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

    @property({ type: Label, tooltip: 'Số chuỗi hiện tại.' })
    streakValueLabel: Label | null = null;

    @property({
        type: Label,
        tooltip: 'Label đổ bóng của streakValueLabel (node riêng) — đổi text CÙNG LÚC, không còn trượt.',
    })
    streakValueShadowLabel: Label | null = null;

    @property({ type: Label, tooltip: 'Nhãn chuỗi tốt nhất, ví dụ "Chuỗi tốt nhất: 5".' })
    bestStreakLabel: Label | null = null;

    @property({ type: Node, tooltip: 'Node cha chứa dãy ô điểm danh (nên gắn Layout ngang).' })
    dayRow: Node | null = null;

    @property({ type: Prefab, tooltip: 'StreakDayCell.prefab — một ô điểm danh.' })
    dayCellPrefab: Prefab | null = null;

    @property({
        tooltip:
            'Vào màn ăn mừng (thắng màn đầu tiên trong ngày): hiện ĐẦY ĐỦ ngay lập tức — chỉ ' +
            'dừng lại đúng bằng này giây rồi mới cho streakValueLabel quay số lên giá trị mới.',
    })
    celebrateStartDelaySeconds = 1;

    @property({ tooltip: 'Label số chuỗi quay lên/xuống bao xa (px) khi thắp chuỗi (playStreakRollUp).' })
    streakRollDistance = 60;

    @property({ tooltip: 'Label số chuỗi: số cũ quay lên + số mới quay từ dưới lên mất bao lâu (giây).' })
    streakRollSeconds = 0.35;

    @property({
        tooltip:
            'Vừa thắng xong ĐÚNG ngày thứ 7 (quà sẵn sàng, chưa nhận) — SAU KHI hiệu ứng quay số ' +
            'chạy xong, đợi thêm bằng này giây rồi TỰ ĐỘNG mở popup nhận thưởng luôn, không cần ' +
            'người chơi tự bấm vào ô quà nữa.',
    })
    rewardPopupDelaySeconds = 0.5;

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
        tooltip: 'Nút RESET chuỗi — chỉ để TEST. Tắt cờ dưới để ẩn khi phát hành.',
    })
    resetButton: Node | null = null;

    @property({ tooltip: 'BẬT nút reset chuỗi (chỉ dùng khi test). Tắt trước khi build phát hành.' })
    enableResetButton = true;

    @property({ tooltip: 'Hiệu ứng hiện lên từng cụm: 1 cụm mờ dần (opacity 0→255) mất bao lâu (giây).' })
    revealFadeSeconds = 0.3;

    @property({
        tooltip:
            'Hiệu ứng hiện lên từng cụm: cụm này mờ dần XONG rồi đợi bao lâu (giây) mới tới cụm ' +
            'kế tiếp — các cụm hiện TUẦN TỰ theo thứ tự trên xuống (mặt trời → glow → prompt/nội ' +
            'dung → nút dưới cùng), KHÔNG chạy đồng thời.',
    })
    revealStaggerSeconds = 0.12;

    private readonly cells: StreakDayCell[] = [];

    /** Label CLONE tạm hiện số CŨ trong lúc "quay số" (playStreakRollUp) — 1 cho streakValueLabel,
     * 1 cho streakValueShadowLabel (nếu có) — giữ tham chiếu để huỷ ngay nếu màn đóng/quay số lại
     * giữa chừng (ví dụ bấm reset chuỗi lúc đang quay). */
    private readonly streakRollOutNodes: Node[] = [];

    private lit = false;
    private playNowMode = false;
    private pendingResult = false;

    protected onOpen(): void {
        if (this.resetButton) this.resetButton.active = this.enableResetButton;
        this.render(StreakPresentation.consumeCelebrate());
    }

    protected onClose(): void {
        this.stopScheduledEffects();
    }

    onDestroy(): void {
        this.stopScheduledEffects();
    }

    private stopScheduledEffects(): void {
        this.unschedule(this.playStreakRollSequence);
        this.unschedule(this.afterStreakRollUp);
        this.unschedule(this.autoOpenRewardPopup);

        for (const node of this.streakRollOutNodes) {
            if (node?.isValid) node.destroy();
        }
        this.streakRollOutNodes.length = 0;

        if (this.streakValueLabel?.node?.isValid) Tween.stopAllByTarget(this.streakValueLabel.node);
        if (this.streakValueShadowLabel?.node?.isValid) Tween.stopAllByTarget(this.streakValueShadowLabel.node);

        for (const node of [this.sunNode, this.glowNode, this.promptNode, this.contentNode, this.homeButtonNode]) {
            const opacity = node?.isValid ? node.getComponent(UIOpacity) : null;
            if (opacity) Tween.stopAllByTarget(opacity);
        }
    }

    private render(celebrate: boolean): void {
        const board = this.readBoard();
        this.buildDayRow(board);
        this.fillLabels(board);
        this.setupBottomButton(board, celebrate);

        if (board.streak === 0) {
            // CHƯA thắp chuỗi lần nào — ẩn hẳn nút home/tiếp tục, không có gì để "về" cả.
            this.enterLockedMode(Localization.get(L10N.streak.lockedPrompt), false);
        } else if (!board.playedToday) {
            // Chuỗi vẫn còn giá trị (chưa đứt) nhưng HÔM NAY chưa chơi gì — không được
            // hiện như đã "thắp sáng" xong xuôi, vẫn phải nhắc chơi để giữ chuỗi.
            this.enterLockedMode(Localization.get(L10N.streak.continuePrompt), true);
        } else if (celebrate) {
            this.enterCelebrateMode(board);
        } else {
            this.enterViewMode(board);
        }

        this.playRevealSequence();
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
    }

    /** Mờ dần (opacity 0→255) sau `delaySeconds` — không đụng gì tới scale/vị trí node. */
    private fadeIn(node: Node, delaySeconds: number): void {
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);

        opacity.opacity = 0;
        tween(opacity).delay(delaySeconds).to(this.revealFadeSeconds, { opacity: 255 }).start();
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
        if (this.streakValueLabel) this.streakValueLabel.string = `${board.streak}`;
        if (this.streakValueShadowLabel) this.streakValueShadowLabel.string = `${board.streak}`;
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

        this.rollOneLabel(this.streakValueLabel, fromValue, toValue);
        this.rollOneLabel(this.streakValueShadowLabel, fromValue, toValue);

        this.unschedule(this.afterStreakRollUp);
        this.scheduleOnce(this.afterStreakRollUp, this.streakRollSeconds);
    }

    private afterStreakRollUp = (): void => {
        const board = this.readBoard();
        this.unschedule(this.autoOpenRewardPopup);
        if (board.rewardReady && !board.rewardClaimed) {
            this.scheduleOnce(this.autoOpenRewardPopup, this.rewardPopupDelaySeconds);
        }
    };

    /** Số CŨ (đang hiện ở `label`) trượt LÊN và mờ dần biến mất, đồng thời số MỚI trượt LÊN từ
     * phía dưới vào đúng vị trí — 2 hiệu ứng chạy ĐỒNG THỜI, không nối tiếp. Số cũ dùng 1 Label
     * CLONE tạm (huỷ ngay sau khi trượt xong) vì `label` gốc cần đổi text ngay sang số mới để
     * trượt vào. */
    private rollOneLabel(label: Label | null, fromValue: number, toValue: number): void {
        if (!label || !label.node.isValid) return;

        const node = label.node;
        Tween.stopAllByTarget(node);

        const restPos = node.position.clone();
        const distance = this.streakRollDistance;
        const duration = this.streakRollSeconds;

        const outNode = instantiate(node);
        outNode.setParent(node.parent);
        outNode.setPosition(restPos);
        outNode.setSiblingIndex(node.getSiblingIndex());
        const outLabel = outNode.getComponent(Label);
        if (outLabel) outLabel.string = `${fromValue}`;
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

        label.string = `${toValue}`;
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

        if (this.glowNode) this.glowNode.active = this.lit;
        if (this.promptNode) this.promptNode.active = false;
        if (this.homeButtonNode) this.homeButtonNode.active = true;
        if (this.contentNode) this.contentNode.active = true;
    }

    /**
     * Thắng màn ĐẦU TIÊN trong ngày → được điều hướng thẳng tới màn Streak với cờ "ăn mừng" —
     * hiện ĐẦY ĐỦ ngay lập tức (không còn hiệu ứng mặt trời bay lên/particle như trước), CHỈ
     * còn giữ lại hiệu ứng quay số streakValueLabel (số cũ trượt lên biến mất, số mới trượt lên
     * vào chỗ). Dừng đúng celebrateStartDelaySeconds giây rồi mới quay số lên giá trị mới — xem
     * playStreakRollSequence(). Nếu ĐÚNG lúc này hoàn thành NGÀY THỨ 7 (quà sẵn sàng, chưa nhận),
     * SAU KHI quay số xong mới tự động mở popup nhận thưởng (afterStreakRollUp).
     */
    private enterCelebrateMode(board: StreakBoard): void {
        this.lit = true;

        if (this.glowNode) this.glowNode.active = true;
        if (this.promptNode) this.promptNode.active = false;
        if (this.homeButtonNode) this.homeButtonNode.active = true;
        if (this.contentNode) this.contentNode.active = true;

        // Chuỗi luôn tăng ĐÚNG 1 (hoặc reset về 1 nếu vừa đứt) mỗi lần ghi nhận thắng đầu tiên
        // trong ngày — giá trị TRƯỚC lần thắng này luôn là board.streak - 1 (kể cả trường hợp
        // vừa reset: board.streak=1 → cũ=0, quay 0→1 vẫn đúng ý nghĩa "bắt đầu chuỗi mới").
        const oldValue = Math.max(0, board.streak - 1);
        if (this.streakValueLabel) this.streakValueLabel.string = `${oldValue}`;
        if (this.streakValueShadowLabel) this.streakValueShadowLabel.string = `${oldValue}`;

        this.unschedule(this.playStreakRollSequence);
        this.scheduleOnce(this.playStreakRollSequence, this.celebrateStartDelaySeconds);
    }

    private enterLockedMode(prompt: string, showHomeButton: boolean): void {
        this.lit = false;

        if (this.glowNode) this.glowNode.active = false;
        this.setPrompt(prompt);
        if (this.promptNode) this.promptNode.active = true;
        if (this.homeButtonNode) this.homeButtonNode.active = showHomeButton;

        // Chưa thắp chuỗi vẫn hiện ĐẦY ĐỦ nội dung còn lại (chuỗi hiện tại/tốt nhất, dãy
        // điểm danh) CÙNG LÚC với dòng nhắc — không ẩn hẳn như trước nữa.
        if (this.contentNode) this.contentNode.active = true;
    }

    onTapHome(): void {
        if (this.playNowMode) {
            const levelId = ProgressionHolder.current?.getCurrentLevel() ?? 1;
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
}
