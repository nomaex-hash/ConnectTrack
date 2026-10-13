import { _decorator, Color, Component, Node, RichText, Tween, Vec3, tween } from 'cc';
import { EventManager } from '../../core/EventManager';
import { ENCOURAGE_HIDDEN_EVENT, PUZZLE_READY_EVENT, PuzzleReadyEventPayload } from '../../event/PuzzleEvents';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
import { boardAppearDuration } from '../board/BoardAppearTiming';
import { highlightNumbers } from '../../utility/RichTextHighlight';

const { ccclass, property } = _decorator;

const POP_IN_DURATION = 0.28;
const POP_OUT_DURATION = 0.18;
const POP_FROM_SCALE = 0.4;


@ccclass('RuleFrameIntro')
export class RuleFrameIntro extends Component {
    @property({
        type: Node,
        tooltip: 'Khung chữ khích lệ — LEVEL THƯỜNG. Node RIÊNG, tự chứa đủ nền + label. Ẩn sẵn; script tự bật/tắt.',
    })
    encourageNodeNormal: Node | null = null;

    @property({
        type: RichText,
        tooltip:
            'Label chữ khích lệ BÊN TRONG encourageNodeNormal — dùng RichText (không phải Label) vì ' +
            'chữ số/% trong câu cần tô màu riêng qua BBCode. KHÔNG gắn L10nLabel vào đây.',
    })
    encourageLabelNormal: RichText | null = null;

    @property({
        type: Node,
        tooltip: 'Khung chữ khích lệ — LEVEL KHÓ. Node RIÊNG khác hẳn (tự chứa nền + label kiểu level khó). Ẩn sẵn; script tự bật/tắt.',
    })
    encourageNodeHard: Node | null = null;

    @property({
        type: RichText,
        tooltip:
            'Label chữ khích lệ BÊN TRONG encourageNodeHard — dùng RichText, cùng lý do với ' +
            'encourageLabelNormal. KHÔNG gắn L10nLabel vào đây.',
    })
    encourageLabelHard: RichText | null = null;

    @property({ tooltip: 'Giữ chữ khích lệ trên màn bao lâu (giây) trước khi biến mất.' })
    encourageHoldSeconds = 1.1;

    @property({ tooltip: 'Màu tô cho chữ số và "%" trong câu khích lệ — LEVEL THƯỜNG.' })
    normalHighlightColor: Color = new Color(76, 175, 80);

    @property({ tooltip: 'Màu tô cho chữ số và "%" trong câu khích lệ — LEVEL KHÓ.' })
    hardHighlightColor: Color = new Color(255, 213, 79);

    @property({
        range: [1, 2, 0.01],
        slide: true,
        tooltip: 'Cỡ chữ số/% nổi bật so với cỡ chữ gốc của label (vd 1.2 = to hơn 20%) — áp dụng chung cho CẢ encourageLabelNormal lẫn encourageLabelHard.',
    })
    highlightNumberSizeRatio = 1.2;

    private pendingIsHardLevel = false;

    @property({ type: Node, tooltip: 'RuleFrame — CẢ NODE này (khung + viền vàng + 3 rule card) cùng phóng to/thu lại như 1 khối.' })
    ruleFrameNode: Node | null = null;

    @property({
        type: Node,
        tooltip: 'Sprite viền vàng. Nên là CON của RuleFrame để phóng to cùng. Ẩn sẵn.',
    })
    goldBorderNode: Node | null = null;

    @property({ tooltip: 'Số lần nhấp nháy của RuleFrame.' })
    blinkCount = 2;

    @property({ range: [1, 1.5, 0.01], slide: true, tooltip: 'Phóng to tới mức nào khi nhấp nháy.' })
    blinkScale = 1.12;

    @property({ tooltip: 'Thời gian một nhịp phóng (hoặc thu) khi nhấp nháy — giây.' })
    blinkHalfSeconds = 0.22;

    onLoad(): void {
        EventManager.instance.on<PuzzleReadyEventPayload>(
            PUZZLE_READY_EVENT,
            this.onPuzzleReady,
            this,
        );

        if (this.encourageNodeNormal) this.encourageNodeNormal.active = false;
        if (this.encourageNodeHard) this.encourageNodeHard.active = false;
        if (this.goldBorderNode) this.goldBorderNode.active = false;
    }

    start(): void {
        // Hoãn sang FRAME SAU (không làm ngay ở onLoad/start) — RulesFrame có cc.Widget tự canh vị
        // trí (an toàn màn hình...), lần đầu align CHƯA CHẮC đã chạy xong khi onLoad()/start() của
        // component này thực thi. Nếu chụp world position lúc đó, Encourage sẽ bị đông cứng SAI VỊ
        // TRÍ (chụp vị trí ruleFrameNode TRƯỚC khi Widget canh xong) — đúng lỗi vừa gặp. Đợi 1 frame
        // để WidgetManager chạy ít nhất 1 lượt align trước khi chụp world position sang cha mới.
        this.scheduleOnce(() => this.detachEncourageFromRuleFrame(), 0);
    }

    /**
     * Chuyển 2 node Encourage RA KHỎI cây con của ruleFrameNode, sang làm con của CHÍNH CHA của
     * ruleFrameNode (anh em với nó) — GIỮ NGUYÊN vị trí hiển thị qua worldPositionStays=true. Đã
     * thử 2 cách "giữ Encourage làm con rồi tự bù trừ scale" (qua onUpdate của tween, rồi qua
     * update() của component) — cả 2 đều bị playEncourage() giành quyền ghi scale cùng lúc khi 2
     * hiệu ứng chồng thời gian (board nhỏ hiện nhanh hơn tổng thời gian nhấp nháy), khiến Encourage
     * vẫn bị ảnh hưởng. Tách hẳn khỏi cây con là cách DUY NHẤT loại bỏ hoàn toàn, không cần so thời
     * điểm 2 hiệu ứng có chồng nhau hay không. KHÔNG cần thêm field Editor — tự suy ra từ
     * ruleFrameNode.parent sẵn có. */
    private detachEncourageFromRuleFrame(): void {
        const anchor = this.ruleFrameNode?.parent;
        if (!anchor) return;

        for (const node of [this.encourageNodeNormal, this.encourageNodeHard]) {
            if (node && node.parent !== anchor) {
                node.setParent(anchor, true);
            }
        }
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
        this.stopAll();
    }

    private onPuzzleReady = (payload: PuzzleReadyEventPayload): void => {
        if (payload.context === 'tutorial') {
            // Tutorial không chạy encourage — báo "đã ẩn" NGAY để HardLevelBadge (nếu có đợi) không
            // bị treo vô thời hạn.
            this.emitEncourageHidden();
            return;
        }

        this.pendingIsHardLevel = payload.isHardLevel;
        this.stopAll();

        // Board hiện theo hiệu ứng stagger (BoardView) — tính đúng thời gian nó chạy
        // xong để đồng bộ: nhấp nháy RuleFrame chạy NGAY lúc board bắt đầu hiện, encourage
        // chờ tới KHI board hiện XONG (100%) mới bật lên. Hai hiệu ứng tác động lên 2 node
        // khác nhau (ruleFrameNode / encourageNode*) nên không ảnh hưởng lẫn nhau.
        const duration = boardAppearDuration(payload.size);
        this.unschedule(this.playEncourage);
        this.playRuleFrameBlink();
        this.scheduleOnce(this.playEncourage, duration);
    };


    /** Chọn ĐÚNG 1 trong 2 node (thường/khó) theo pendingIsHardLevel — node còn lại KHÔNG được
     * đụng tới, giữ nguyên inactive (giống cách toggle dialogGameplay/dialogMainMenu ở SettingsPopup). */
    private playEncourage = (): void => {
        const node = this.pendingIsHardLevel ? this.encourageNodeHard : this.encourageNodeNormal;
        const label = this.pendingIsHardLevel ? this.encourageLabelHard : this.encourageLabelNormal;
        if (!node) {
            // Không có node để chạy — coi như "đã ẩn" NGAY, tránh HardLevelBadge đợi vô thời hạn.
            this.emitEncourageHidden();
            return;
        }

        if (label) {
            const highlightColor = this.pendingIsHardLevel ? this.hardHighlightColor : this.normalHighlightColor;
            const emphasisSize = Math.round(label.fontSize * this.highlightNumberSizeRatio);
            label.string = highlightNumbers(this.pickText(), highlightColor.toHEX('#rrggbb'), emphasisSize);
        }

        node.active = true;
        node.setScale(POP_FROM_SCALE, POP_FROM_SCALE, 1);

        tween(node)
            .to(POP_IN_DURATION, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .delay(this.encourageHoldSeconds)
            .to(
                POP_OUT_DURATION,
                { scale: new Vec3(POP_FROM_SCALE, POP_FROM_SCALE, 1) },
                { easing: 'quadIn' },
            )
            .call(() => {
                node.active = false;
                node.setScale(1, 1, 1);
                this.emitEncourageHidden();
            })
            .start();
    };

    /** Bong bóng khích lệ đã ẩn HẲN (hoặc không có gì để chạy) — HardLevelBadge đợi mốc này mới
     * được phép hiện hiệu ứng pop-in, tránh chồng lúc encourage đang hiện/tắt. */
    private emitEncourageHidden(): void {
        EventManager.instance.emit(ENCOURAGE_HIDDEN_EVENT, undefined);
    }


    /** Scale THẲNG cả `ruleFrameNode` như 1 khối duy nhất (khung + viền vàng + 3 rule card cùng
     * phóng to/thu lại) — chỉ 1 tween trên 1 node nên KHÔNG THỂ lệch nhịp giữa các phần bên trong.
     * Encourage đã được detachEncourageFromRuleFrame() tách khỏi cây con của node này từ lúc
     * onLoad(), nên không còn bị kéo theo nữa, kể cả khi 2 hiệu ứng chạy chồng thời gian. */
    private playRuleFrameBlink = (): void => {
        const frame = this.ruleFrameNode;
        if (!frame) return;

        if (this.goldBorderNode) this.goldBorderNode.active = true;

        Tween.stopAllByTarget(frame);
        frame.setScale(1, 1, 1);

        const big = new Vec3(this.blinkScale, this.blinkScale, 1);
        const normal = new Vec3(1, 1, 1);

        tween(frame)
            .repeat(
                Math.max(1, this.blinkCount),
                tween<Node>()
                    .to(this.blinkHalfSeconds, { scale: big }, { easing: 'sineOut' })
                    .to(this.blinkHalfSeconds, { scale: normal }, { easing: 'sineIn' }),
            )
            .call(() => {
                if (this.goldBorderNode) this.goldBorderNode.active = false;
            })
            .start();
    };

    private pickText(): string {
        return Localization.getRandom(
            this.pendingIsHardLevel ? L10N.gameplay.hardEncourageTexts : L10N.gameplay.encourageTexts,
        );
    }

    private stopAll(): void {
        this.unschedule(this.playEncourage);

        for (const node of [this.encourageNodeNormal, this.encourageNodeHard]) {
            if (!node?.isValid) continue;
            Tween.stopAllByTarget(node);
            node.active = false;
            node.setScale(1, 1, 1);
        }
        if (this.ruleFrameNode?.isValid) {
            Tween.stopAllByTarget(this.ruleFrameNode);
            this.ruleFrameNode.setScale(1, 1, 1);
        }
        if (this.goldBorderNode?.isValid) this.goldBorderNode.active = false;
    }
}
