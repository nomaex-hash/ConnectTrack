import { _decorator, Color, Label, Node, ParticleSystem, RichText, Sprite, SpriteFrame, Tween, UIOpacity, Vec3, tween } from 'cc';
import { playOutcomeGlow, playOutcomeTextPop, setOutcomeText, stopOutcomeGlow } from '../../animation/OutcomeTextEffects';
import { WinCelebrationView } from '../../animation/WinCelebrationView';
import { pickRandomDailyText } from '../../config/DailyResultTextConfig';
import { highlightNumbers } from '../../utility/RichTextHighlight';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
import { UIPopup } from '../UIPopup';
import { PuzzleContext } from '../../model/BoardSaveData';
import { isHardLevel } from '../../config/LevelListConfig';
import { UIManager } from '../../manager/UIManager';
import { EventManager } from '../../core/EventManager';
import { RESULT_POPUP_SHOWN_EVENT, ResultPopupShownEventPayload } from '../../event/PuzzleEvents';

const { ccclass, property } = _decorator;


export interface ResultData {
    readonly outcome: 'win' | 'lose';
    readonly context: PuzzleContext;
    readonly puzzleId: number;
   
    readonly nextLevelId: number | null;
}


@ccclass('ResultPopup')
export class ResultPopup extends UIPopup<ResultData> {
    @property({
        type: Node,
        tooltip:
            'Node chữ chính khi THẮNG (Label thường, KHÔNG còn spine) — nội dung chọn NGẪU ' +
            'NHIÊN từ result.winTexts mỗi lần mở popup. Tự chạy hiệu ứng scale to→đập nhỏ→' +
            'nảy lại kèm mờ→đậm qua playOutcomeTextPop().',
    })
    winTextNode: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Node ánh sáng mờ phía sau chữ THẮNG — hiện SAU chữ 1 khoảng (outcomeGlowDelaySeconds), ' +
            'nhún xuống 1 nhịp rồi mờ dần biến mất. Có thể để trống.',
    })
    winGlow: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Node chữ chính khi THUA (Label thường) — nội dung chọn NGẪU NHIÊN từ ' +
            'result.loseTexts mỗi lần mở popup. Chạy CHUNG hiệu ứng pop với chữ thắng.',
    })
    loseTextNode: Node | null = null;

    @property({
        type: Node,
        tooltip: 'Node ánh sáng mờ phía sau chữ THUA — giống hệt winGlow nhưng riêng cho màn thua. Có thể để trống.',
    })
    loseGlow: Node | null = null;

    @property({ tooltip: 'Node ánh sáng (thắng/thua): hiện sau khi chữ bắt đầu bao lâu (giây).' })
    outcomeGlowDelaySeconds = 0.15;

    @property({ tooltip: 'Node ánh sáng: nhún xuống còn bao nhiêu scale (tỉ lệ so với gốc) trước khi nảy lại.' })
    outcomeGlowSquishScale = 0.85;

    @property({ tooltip: 'Node ánh sáng: mỗi chặng nhún xuống/nảy lại mất bao lâu (giây).' })
    outcomeGlowSquishSeconds = 0.15;

    @property({ tooltip: 'Node ánh sáng: đứng yên bao lâu (giây) trước khi mờ dần biến mất.' })
    outcomeGlowHoldSeconds = 0.2;

    @property({ tooltip: 'Node ánh sáng: thời gian mờ dần biến mất (giây).' })
    outcomeGlowFadeSeconds = 0.4;

    @property({
        type: Sprite,
        tooltip:
            'Sprite chim cánh cụt TĨNH (chưa có anim, dùng CHUNG 1 node cho cả thắng lẫn thua, ' +
            'script chỉ đổi spriteFrame) — đặt sẵn đúng vị trí/kích thước mong muốn trong scene.',
    })
    outcomePenguinSprite: Sprite | null = null;

    @property({ type: SpriteFrame, tooltip: 'Ảnh chim cánh cụt khi THẮNG.' })
    winPenguinSpriteFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Ảnh chim cánh cụt khi THUA.' })
    losePenguinSpriteFrame: SpriteFrame | null = null;

    @property({ tooltip: 'Chim cánh cụt: scale BẮT ĐẦU lúc vừa hiện lên (nhỏ hơn scale gốc).' })
    outcomePenguinFromScale = 0.4;

    @property({ tooltip: 'Chim cánh cụt: thời gian hiện lên — scale nhỏ→lớn kèm mờ→đậm (giây).' })
    outcomePenguinPopSeconds = 0.3;

    @property({
        type: WinCelebrationView,
        tooltip: 'Pháo hoa 2 bên + pháo giấy rơi + text chúc mừng — chỉ chạy khi THẮNG.',
    })
    winCelebration: WinCelebrationView | null = null;

    @property({
        type: [Node],
        tooltip:
            'Các node CHỈ hiện khi THẮNG, tự ẩn khi THUA (ví dụ hiệu ứng pháo bông, khung ' +
            'chúc mừng...). Kéo bao nhiêu node tuỳ ý vào đây, không cần sửa code.',
    })
    winOnlyNodes: Node[] = [];

    @property({
        type: [Node],
        tooltip: 'Các node CHỈ hiện khi THUA, tự ẩn khi THẮNG. Kéo bao nhiêu node tuỳ ý vào đây.',
    })
    loseOnlyNodes: Node[] = [];

    @property({
        type: [Node],
        tooltip:
            'Các node mờ dần rồi đậm lên CÙNG LÚC khi thắng (ví dụ 2 node hiệu ứng + node ' +
            'chim cánh cụt). Kéo bao nhiêu node tuỳ ý vào đây.',
    })
    celebrateFadeInNodes: Node[] = [];

    @property({ tooltip: 'Thời gian mờ dần lên đậm của celebrateFadeInNodes (giây).' })
    celebrateFadeInSeconds = 0.3;

    @property({
        type: Label,
        tooltip: 'Chữ trên nút đi tiếp — đổi theo ngữ cảnh nên không viết cứng trong prefab.',
    })
    continueLabel: Label | null = null;

    @property({
        type: Node,
        tooltip:
            'Node nút "đi tiếp" (cả nút, không chỉ chữ) — mờ dần rồi đậm lên SAU KHI hiệu ' +
            'ứng ăn mừng/particle vừa kích hoạt. Có thể để trống nếu không cần hiệu ứng này.',
    })
    continueButtonNode: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'CỤM nút "đi tiếp" dùng khi màn KẾ TIẾP là LEVEL KHÓ — node RIÊNG hoàn toàn (giống ' +
            'hardPlayButtonNode ở MainMenuScreen), tự bật/tắt qua active, KHÔNG tự đổi sprite. ' +
            'Chỉ áp dụng khi thắng và có màn kế tiếp; thua/về Home vẫn luôn dùng continueButtonNode.',
    })
    continueButtonNodeHard: Node | null = null;

    @property({ type: Label, tooltip: 'Chữ trên nút đi tiếp BÊN TRONG continueButtonNodeHard.' })
    continueLabelHard: Label | null = null;

    @property({ tooltip: 'Nút đi tiếp: trễ bao lâu (giây) rồi mới bắt đầu mờ dần lên đậm.' })
    continueButtonDelaySeconds = 0.5;

    @property({ tooltip: 'Nút đi tiếp: thời gian mờ dần lên đậm (giây), tính từ sau khi hết trễ.' })
    continueButtonFadeSeconds = 0.3;

    @property({
        type: RichText,
        tooltip:
            'Câu khen ngẫu nhiên khi THẮNG (dùng chung pool với màn hình Daily Result). ' +
            'Là RichText để tô nổi bật số/% trong câu. Có thể để trống nếu không cần.',
    })
    praiseLabel: RichText | null = null;

    @property({ tooltip: 'Màu tô nổi bật số/% trong câu khen.' })
    praiseNumberColor: Color = new Color(76, 209, 55);

    @property({
        range: [1, 2, 0.01],
        slide: true,
        tooltip: 'Cỡ chữ số/% nổi bật so với cỡ chữ gốc của praiseLabel (vd 1.2 = to hơn 20%).',
    })
    praiseNumberSizeRatio = 1.2;

    @property({ tooltip: 'Chữ WELL DONE/LOSE: scale BẮT ĐẦU (rất to) lúc vừa xuất hiện.' })
    outcomeTextFromScale = 3;

    @property({ tooltip: 'Chữ WELL DONE/LOSE: scale "đập xuống" (thấp hơn scale gốc) trước khi nảy lên lại.' })
    outcomeTextUndershootScale = 0.85;

    @property({ tooltip: 'Chữ WELL DONE/LOSE: thời gian từ to đập xuống (giây).' })
    outcomeTextDropSeconds = 0.18;

    @property({ tooltip: 'Chữ WELL DONE/LOSE: thời gian nảy lên lại về scale gốc (giây).' })
    outcomeTextBounceSeconds = 0.14;

    /**
     * Scale GỐC thật của outcomePenguinSprite — chốt ĐÚNG 1 LẦN ở onLoad(), KHÔNG đọc lại
     * node.scale mỗi lần showOutcomeAnim() chạy (mỗi lần mở popup). Trước đây showOutcomeAnim()
     * setScale(outcomePenguinFromScale) rồi tween thẳng tới Vec3(1,1,1) CỐ ĐỊNH — bất kể node
     * được chỉnh scale gốc bao nhiêu trong Editor, animation luôn kéo nó về ĐÚNG scale 1, ghi đè
     * hoàn toàn giá trị đã chỉnh (bug đã gặp y hệt ở MainMenuScreen.popLogo() với logo Main Menu).
     */
    private outcomePenguinBaseScale: Vec3 | null = null;

    onLoad(): void {
        const node = this.outcomePenguinSprite?.node;
        if (node) {
            const scale = node.scale;
            this.outcomePenguinBaseScale = new Vec3(scale.x, scale.y, scale.z || 1);
        }
    }

    protected onShow(data: ResultData): void {
        // Toàn bộ dữ liệu hiện ở đây có sẵn ĐỒNG BỘ (không có bước tải mạng/tài nguyên nào) — tắt
        // loading NGAY, không thì icon (UIPopup.showLoading() tự bật lúc show()) kẹt lại mãi mãi.
        this.hideLoading();

        // Chặn MỌI thao tác người chơi từ lúc popup này hiện lên tới khi nút "tiếp tục" hiện XONG
        // hẳn (fadeInContinueButton, gỡ chặn ở đó) — cùng cơ chế UIManager.setBlockInput() đã dùng
        // ở LeaderboardPreviewPopup, tránh bấm được nút dù đang mờ (opacity 0 vẫn interactable).
        UIManager.instance.setBlockInput(true);

        const win = data.outcome === 'win';

        const shownPayload: ResultPopupShownEventPayload = { outcome: data.outcome };
        EventManager.instance.emit(RESULT_POPUP_SHOWN_EVENT, shownPayload);

        const outcomeTextNode = win ? this.winTextNode : this.loseTextNode;
        const outcomeGlow = win ? this.winGlow : this.loseGlow;

        if (this.winTextNode) this.winTextNode.active = win;
        if (this.loseTextNode) this.loseTextNode.active = !win;

        this.setRandomOutcomeText(outcomeTextNode, win);
        playOutcomeTextPop(outcomeTextNode, {
            fromScale: this.outcomeTextFromScale,
            undershootScale: this.outcomeTextUndershootScale,
            dropSeconds: this.outcomeTextDropSeconds,
            bounceSeconds: this.outcomeTextBounceSeconds,
        });
        playOutcomeGlow(outcomeGlow, {
            delaySeconds: this.outcomeGlowDelaySeconds,
            squishScale: this.outcomeGlowSquishScale,
            squishSeconds: this.outcomeGlowSquishSeconds,
            holdSeconds: this.outcomeGlowHoldSeconds,
            fadeSeconds: this.outcomeGlowFadeSeconds,
        });

        this.showOutcomeAnim(win);

        this.applyOutcomeVisibility(win);

        if (win) {
            this.winCelebration?.play();
            this.playCelebrateFadeIn();
        } else {
            this.winCelebration?.stop();
        }

        if (this.praiseLabel) {
            const colorHex = this.praiseNumberColor.toHEX('#rrggbb');
            const emphasisSize = Math.round(this.praiseLabel.fontSize * this.praiseNumberSizeRatio);
            this.praiseLabel.string = win ? highlightNumbers(pickRandomDailyText(), colorHex, emphasisSize) : '';
            this.praiseLabel.node.active = win;
        }

        // Màn kế tiếp là LEVEL KHÓ (chỉ xét khi thắng và còn màn kế) — hiện cụm nút riêng, ẩn cụm
        // thường, giống hệt cách MainMenuScreen đổi hardPlayButtonNode/playButton.
        const nextIsHard = win && data.nextLevelId !== null && isHardLevel(data.nextLevelId);
        if (this.continueButtonNode) this.continueButtonNode.active = !nextIsHard;
        if (this.continueButtonNodeHard) this.continueButtonNodeHard.active = nextIsHard;

        this.setContinueLabel(this.continueLabel, data, win);
        this.setContinueLabel(this.continueLabelHard, data, win);

        this.fadeInContinueButton(nextIsHard);
    }

    private setContinueLabel(label: Label | null, data: ResultData, win: boolean): void {
        if (!label) return;
        if (win && data.nextLevelId !== null) {
            label.string = `${Localization.get(L10N.menu.levelPrefix)}${data.nextLevelId}`;
        } else {
            const key = win ? L10N.common.backToMenu : L10N.common.replay;
            label.string = Localization.get(key);
        }
    }


    private setRandomOutcomeText(node: Node | null, win: boolean): void {
        if (!node) return;

        const key = win ? L10N.result.winTexts : L10N.result.loseTexts;
        const text = Localization.getRandom(key) || Localization.get(win ? L10N.result.win : L10N.result.lose);
        setOutcomeText(node, text);
    }

    private playCelebrateFadeIn(): void {
        for (const node of this.celebrateFadeInNodes) {
            if (!node?.isValid) continue;

            const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 0;
            tween(opacity).to(this.celebrateFadeInSeconds, { opacity: 255 }).start();

    
            const particle = node.getComponent(ParticleSystem) ?? node.getComponentInChildren(ParticleSystem);
            if (particle) {
                particle.stop();
                particle.clear();
                particle.play();
            }
        }
    }

    private fadeInContinueButton(nextIsHard: boolean): void {
        const node = nextIsHard ? this.continueButtonNodeHard : this.continueButtonNode;
        if (!node) {
            // Không có node nút nào cả (chưa gán trong Editor) — không có gì để đợi, gỡ chặn NGAY
            // tránh kẹt màn hình mãi mãi.
            UIManager.instance.setBlockInput(false);
            return;
        }

        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
        tween(opacity)
            .delay(this.continueButtonDelaySeconds)
            .to(this.continueButtonFadeSeconds, { opacity: 255 })
            .call(() => UIManager.instance.setBlockInput(false))
            .start();
    }

 
    private applyOutcomeVisibility(win: boolean): void {
        for (const node of this.winOnlyNodes) {
            if (node?.isValid) node.active = win;
        }
        for (const node of this.loseOnlyNodes) {
            if (node?.isValid) node.active = !win;
        }
    }

    /** Chưa có anim thắng/thua thật — dùng CHUNG 1 sprite tĩnh, chỉ đổi ảnh + chạy hiệu ứng
     * hiện lên (scale nhỏ→lớn kèm mờ→đậm), giữ nguyên cảm giác "xuất hiện" như trước. */
    private showOutcomeAnim(win: boolean): void {
        const sprite = this.outcomePenguinSprite;
        const frame = win ? this.winPenguinSpriteFrame : this.losePenguinSpriteFrame;
        if (!sprite || !frame || !this.outcomePenguinBaseScale) return;

        sprite.spriteFrame = frame;
        sprite.node.active = true;

        const opacity = sprite.node.getComponent(UIOpacity) ?? sprite.node.addComponent(UIOpacity);
        Tween.stopAllByTarget(sprite.node);
        Tween.stopAllByTarget(opacity);

        const original = this.outcomePenguinBaseScale;
        const fromScale = new Vec3(
            original.x * this.outcomePenguinFromScale,
            original.y * this.outcomePenguinFromScale,
            original.z,
        );
        sprite.node.setScale(fromScale);
        opacity.opacity = 0;

        tween(sprite.node)
            .to(this.outcomePenguinPopSeconds, { scale: original }, { easing: 'backOut' })
            .start();
        tween(opacity).to(this.outcomePenguinPopSeconds, { opacity: 255 }).start();
    }

    protected onHide(): void {
        // Phòng hờ: popup bị đóng ép (forceClose/closeAllPopups) NGAY GIỮA LÚC nút "tiếp tục" còn
        // đang mờ dần lên — fadeInContinueButton() sẽ không bao giờ chạy tới lượt gỡ chặn, phải gỡ
        // ở đây tránh kẹt màn hình mãi mãi (cùng cơ chế LeaderboardPreviewPopup.onDisable()).
        UIManager.instance.setBlockInput(false);

        this.winCelebration?.stop();

        stopOutcomeGlow(this.winGlow);
        stopOutcomeGlow(this.loseGlow);

    
        for (const node of this.celebrateFadeInNodes) {
            if (!node?.isValid) continue;
            const particle = node.getComponent(ParticleSystem) ?? node.getComponentInChildren(ParticleSystem);
            particle?.stop();
            particle?.clear();
        }
    }


    /** CHỈ đóng popup — không tự điều hướng nữa. Việc "tiếp tục" (sang màn kế/thử lại/về Home)
     * chuyển sang UIManager (xem afterResultClosed()/continueAfterResult()), chạy SAU KHI toàn bộ
     * popup giải đấu (kích hoạt/kết quả cũ, nếu có) đã đóng xong — tránh hiệu ứng vào màn kế tiếp
     * (BoardView/RuleFrameIntro...) chạy chồng lên lúc popup giải đấu còn đang mở, vì trước đây
     * điều hướng chạy NGAY khi bấm nút, không đợi animation đóng/popup kế tiếp xử lý xong. */
    onTapContinue(): void {
        this.requestClose();
    }
}
