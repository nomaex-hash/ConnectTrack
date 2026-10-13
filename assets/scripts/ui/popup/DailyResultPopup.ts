import { _decorator, Color, Label, Node, RichText, Tween, UIOpacity, tween } from 'cc';
import { playOutcomeGlow, playOutcomeTextPop, setOutcomeText, stopOutcomeGlow } from '../../animation/OutcomeTextEffects';
import { WinCelebrationView } from '../../animation/WinCelebrationView';
import { UIPopup } from '../UIPopup';
import { EventManager } from '../../core/EventManager';
import {
    LEVEL_SELECTED_EVENT,
    LevelSelectedEventPayload,
} from '../../event/AppEvents';
import { DailyResult } from '../../model/DailyResult';
import { ShareContent } from '../../service/social/ISocialService';
import { SocialServiceHolder } from '../../service/social/SocialServiceHolder';
import { ProgressionHolder } from '../../gameplay/progression/ProgressionHolder';
import { formatElapsed } from '../../utility/TimeFormat';
import { highlightNumbers } from '../../utility/RichTextHighlight';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
import { RankBadge } from '../widget/RankBadge';

const { ccclass, property } = _decorator;


@ccclass('DailyResultPopup')
export class DailyResultPopup extends UIPopup<DailyResult> {
    @property({
        type: Node,
        tooltip:
            'Node chữ chính (Label thường, KHÔNG còn spine "WellDone") — nội dung chọn NGẪU ' +
            'NHIÊN từ result.winTexts (dùng chung danh sách với ResultPopup) mỗi lần mở popup. ' +
            'Tự chạy hiệu ứng scale to→đập nhỏ→nảy lại kèm mờ→đậm.',
    })
    winTextNode: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Node ánh sáng mờ phía sau chữ — hiện SAU chữ 1 khoảng (outcomeGlowDelaySeconds), ' +
            'nhún xuống 1 nhịp rồi mờ dần biến mất. Có thể để trống.',
    })
    winGlow: Node | null = null;

    @property({ tooltip: 'Chữ chính: scale BẮT ĐẦU (rất to) lúc vừa xuất hiện.' })
    outcomeTextFromScale = 3;

    @property({ tooltip: 'Chữ chính: scale "đập xuống" (thấp hơn scale gốc) trước khi nảy lên lại.' })
    outcomeTextUndershootScale = 0.85;

    @property({ tooltip: 'Chữ chính: thời gian từ to đập xuống (giây).' })
    outcomeTextDropSeconds = 0.18;

    @property({ tooltip: 'Chữ chính: thời gian nảy lên lại về scale gốc (giây).' })
    outcomeTextBounceSeconds = 0.14;

    @property({ tooltip: 'Node ánh sáng: hiện sau khi chữ bắt đầu bao lâu (giây).' })
    outcomeGlowDelaySeconds = 0.15;

    @property({ tooltip: 'Node ánh sáng: nhún xuống còn bao nhiêu scale (tỉ lệ so với gốc) trước khi nảy lại.' })
    outcomeGlowSquishScale = 0.85;

    @property({ tooltip: 'Node ánh sáng: mỗi chặng nhún xuống/nảy lại mất bao lâu (giây).' })
    outcomeGlowSquishSeconds = 0.15;

    @property({ tooltip: 'Node ánh sáng: đứng yên bao lâu (giây) trước khi mờ dần biến mất.' })
    outcomeGlowHoldSeconds = 0.2;

    @property({ tooltip: 'Node ánh sáng: thời gian mờ dần biến mất (giây).' })
    outcomeGlowFadeSeconds = 0.4;

    @property({ type: RichText, tooltip: 'Câu khen ngẫu nhiên — RichText để tô nổi bật số/% trong câu.' })
    praiseLabel: RichText | null = null;

    @property({ tooltip: 'Màu tô nổi bật số/% trong câu khen.' })
    praiseNumberColor: Color = new Color(76, 209, 55);

    @property({
        range: [1, 2, 0.01],
        slide: true,
        tooltip: 'Cỡ chữ số/% nổi bật so với cỡ chữ gốc của praiseLabel (vd 1.2 = to hơn 20%).',
    })
    praiseNumberSizeRatio = 1.2;

    @property({ type: Label, tooltip: 'Thời gian hoàn thành (đồng hồ).' })
    timeLabel: Label | null = null;

    @property({ type: Label, tooltip: 'Chuỗi hiện tại (số). Có thể trống.' })
    streakLabel: Label | null = null;

    @property({ type: RankBadge, tooltip: 'Huy chương hạng theo thời gian.' })
    rankBadge: RankBadge | null = null;

    @property({
        type: WinCelebrationView,
        tooltip:
            'Pháo hoa 2 cặp 2 bên + particle rơi từ trên xuống + text chúc mừng — dùng ' +
            'chung component với ResultPopup nên thứ tự hiện y hệt (2 cặp bên bắn sau 1 ' +
            'khoảng trễ, particle trên rơi liên tục ngay khi mở).',
    })
    winCelebration: WinCelebrationView | null = null;

    @property({
        type: [Node],
        tooltip:
            'Các khối nội dung màn Result Daily — hiện LẦN LƯỢT (mờ dần rồi đậm lên) từ ' +
            'TRÊN xuống DƯỚI ngay khi vừa mở popup. Kéo theo ĐÚNG THỨ TỰ từ trên xuống ' +
            'dưới. Khối nào đang ẩn (không active) sẽ tự bỏ qua.',
    })
    revealSections: Node[] = [];

    @property({ tooltip: 'Trễ bao lâu (giây) sau khi mở popup rồi MỚI bắt đầu hiện khối ĐẦU TIÊN.' })
    revealStartDelaySeconds = 0;

    @property({ tooltip: 'Mỗi khối: thời gian mờ dần lên đậm (giây).' })
    revealFadeSeconds = 0.25;

    @property({ tooltip: 'Độ trễ giữa khối này và khối kế tiếp (giây).' })
    revealStaggerSeconds = 0.08;

    private data: DailyResult | null = null;

    protected onShow(data: DailyResult): void {
        // Không có bước tải nào — tắt loading NGAY (UIPopup.showLoading() tự bật lúc show()).
        this.hideLoading();
        this.data = data;

        this.setRandomOutcomeText();
        playOutcomeTextPop(this.winTextNode, {
            fromScale: this.outcomeTextFromScale,
            undershootScale: this.outcomeTextUndershootScale,
            dropSeconds: this.outcomeTextDropSeconds,
            bounceSeconds: this.outcomeTextBounceSeconds,
        });
        playOutcomeGlow(this.winGlow, {
            delaySeconds: this.outcomeGlowDelaySeconds,
            squishScale: this.outcomeGlowSquishScale,
            squishSeconds: this.outcomeGlowSquishSeconds,
            holdSeconds: this.outcomeGlowHoldSeconds,
            fadeSeconds: this.outcomeGlowFadeSeconds,
        });

        if (this.praiseLabel) {
            const colorHex = this.praiseNumberColor.toHEX('#rrggbb');
            const emphasisSize = Math.round(this.praiseLabel.fontSize * this.praiseNumberSizeRatio);
            this.praiseLabel.string = highlightNumbers(data.praiseText, colorHex, emphasisSize);
        }
        if (this.timeLabel) this.timeLabel.string = formatElapsed(data.seconds);
        if (this.streakLabel) this.streakLabel.string = `${data.streak}`;
        this.rankBadge?.setTier(data.rank);

        this.winCelebration?.play();
        this.playRevealSections();
    }

    private setRandomOutcomeText(): void {
        const text = Localization.getRandom(L10N.result.winTexts) || Localization.get(L10N.result.win);
        setOutcomeText(this.winTextNode, text);
    }

    protected onHide(): void {
        this.data = null;
        this.winCelebration?.stop();
        stopOutcomeGlow(this.winGlow);

        for (const node of this.revealSections) {
            if (!node?.isValid) continue;
            const opacity = node.getComponent(UIOpacity);
            if (opacity) {
                Tween.stopAllByTarget(opacity);
                opacity.opacity = 255;
            }
        }
    }

   
    private playRevealSections(): void {
        let delay = this.revealStartDelaySeconds;
        for (const node of this.revealSections) {
            if (!node?.isValid || !node.active) continue;

            const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 0;
            tween(opacity).delay(delay).to(this.revealFadeSeconds, { opacity: 255 }).start();

            delay += this.revealStaggerSeconds;
        }
    }

    onTapChallenge(): void {
        const content = this.buildShareContent();
        if (content) void SocialServiceHolder.current.challengeFriend(content);
    }

    onTapShare(): void {
        const content = this.buildShareContent();
        if (content) void SocialServiceHolder.current.share(content);
    }

    onTapDone(): void {
        this.requestClose();

        const levelId = ProgressionHolder.current?.getCurrentLevel() ?? 1;
        const payload: LevelSelectedEventPayload = { context: 'campaign', levelId };
        EventManager.instance.emit(LEVEL_SELECTED_EVENT, payload);
    }

    private buildShareContent(): ShareContent | null {
        const data = this.data;
        if (!data) return null;
        return { text: data.praiseText, date: data.date, seconds: data.seconds, rank: data.rank };
    }
}
