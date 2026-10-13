import {
    _decorator,
    Component,
    Label,
    Node,
    Prefab,
    Rect,
    sp,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    instantiate,
    tween,
    view,
} from 'cc';
import { CellState } from '../../core/CellState';
import { EventManager } from '../../core/EventManager';
import {
    CELL_CHANGED_EVENT,
    CellChangedEventPayload,
    DOG_SETTLED_EVENT,
    DogSettledEventPayload,
    PUZZLE_READY_EVENT,
    PuzzleReadyEventPayload,
    TUTORIAL_GUIDED_FINISHED_EVENT,
} from '../../event/PuzzleEvents';
import { PuzzleSessionHolder } from '../../gameplay/PuzzleSessionHolder';
import { playFrameAnimation } from '../../animation/FrameAnimUtil';
import { setActiveAnimated } from '../../animation/ToggleFade';
import { boardAppearDuration } from '../board/BoardAppearTiming';
import { BoardView } from '../board/BoardView';
import { TutorialInputGate } from './TutorialInputGate';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';

const { ccclass, property } = _decorator;

const HAND_TRACK = 0;

const GATE_OVERSIZE = 1.5;

const TEXT_FADE_SECONDS = 0.15;
const TEXT_FROM_SCALE = 0.7;


enum Step {
    Idle,
    WaitBoard,
    PlaceDog1,
    MarkRowCol1,
    PlaceDog2,
    MarkAround2,
    PlaceDog3,
    FreePlay,
}


@ccclass('TutorialController')
export class TutorialController extends Component {
    @property({ type: Node, tooltip: 'Nhóm mask + tay. Controller bật/tắt node này (KHÔNG phải node của controller).' })
    spotlightRoot: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Sprite nền đen mờ full màn (node "Grey"). Bật/tắt ĐỘC LẬP với tay/text/ô — ' +
            'KHÁC spotlightRoot (spotlightRoot chỉ bật/tắt 1 lần lúc bắt đầu/kết thúc dạy).',
    })
    dimNode: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Nút Back (thoát ván) — trong lúc dạy, node này tự được đưa lên TRÊN nền đen/gate ' +
            'chặn chạm, để người chơi luôn bấm thoát được bất cứ lúc nào. Để trống thì bỏ qua.',
    })
    backButtonNode: Node | null = null;

    @property({ type: sp.Skeleton, tooltip: 'Con trỏ tay (handtutorial).' })
    hand: sp.Skeleton | null = null;

    @property({
        type: Prefab,
        tooltip:
            'Prefab tay hiệu ứng MỚI (HandAnim) — dùng RIÊNG cho 3 bước ĐẶT chim cánh cụt ' +
            '(PlaceDog1/2/3). Các bước đánh dấu khác (hàng/cột, xung quanh) vẫn dùng tay Spine cũ ở trên.',
    })
    placeDogHandAnimPrefab: Prefab | null = null;

    @property({
        tooltip: 'Lệch prefab HandAnim so với tâm ô (px) — tự tinh chỉnh riêng, độc lập với Hand Offset.',
    })
    placeDogHandAnimOffset: Vec3 = new Vec3(-185, -15, 0);

    @property({ tooltip: 'Kích thước (scale) prefab HandAnim — tự tinh chỉnh riêng, độc lập với Hand Scale.' })
    placeDogHandAnimScale = 1;

    @property({ type: Node, tooltip: 'Node khung text HƯỚNG DẪN chính (luôn có mặt ở mọi bước dạy).' })
    textNode: Node | null = null;

    @property({ type: Label, tooltip: 'Label trong khung text chính.' })
    textLabel: Label | null = null;

    @property({
        type: Node,
        tooltip: 'Node khung text PHỤ ở dưới — chỉ hiện ở bước gộp hàng+cột (MarkRowCol1).',
    })
    subTextNode: Node | null = null;

    @property({ type: Label, tooltip: 'Label trong khung text phụ.' })
    subTextLabel: Label | null = null;

    @property({
        type: Node,
        tooltip:
            'Nút "Got it" — chỉ hiện sau khi đặt xong con chó ĐẦU TIÊN. Tự nhấp nháy nhỏ→to ' +
            'liên tục tới khi người chơi bấm. Click wiring: gắn clickEvents trỏ tới onTapGotIt().',
    })
    gotItButtonNode: Node | null = null;

    @property({ tooltip: 'Nút "Got it": mỗi nhịp phóng to (rồi thu lại) mất bao lâu (giây).' })
    gotItPulseSeconds = 0.5;

    @property({ range: [1, 1.3, 0.01], slide: true, tooltip: 'Nút "Got it" phóng to tới mức nào mỗi nhịp.' })
    gotItPulseScale = 1.08;

    @property({ tooltip: 'Đặt xong con chó thứ 2 (hồng): tắt nền đen bao lâu rồi bật lại (giây), KHÔNG có nút Got it.' })
    dog2FlashSeconds = 0.5;

    @property({ tooltip: 'Bước gộp hàng+cột: 2 text hiện xong rồi mới hiện viền vàng — trễ bao lâu (giây).' })
    stepRevealDelaySeconds = 0.3;

    @property({
        tooltip:
            'Đánh dấu xong 1 bước (KHÔNG áp dụng cho lúc vừa đặt xong chim cánh cụt — bước đó ' +
            'đã có delay riêng chờ animation) — trễ bao lâu (giây) trước khi chuyển sang bước kế tiếp.',
    })
    stepTransitionDelaySeconds = 1;

    @property({ tooltip: 'Nền đen: mỗi khi xuất hiện, thời gian mờ dần rồi đậm lên (giây) thay vì hiện thẳng.' })
    dimFadeInSeconds = 0.25;

    @property({
        tooltip:
            'Lệch con trỏ tay so với tâm ô (px) — dùng cho các bước ĐẶT (point, đứng yên 1 ô). ' +
            'Bù cho đầu ngón tay nằm ở trên-phải gốc skeleton. Tự tinh chỉnh khi chạy.',
    })
    handOffset: Vec3 = new Vec3(-185, -15, 0);

    @property({
        tooltip:
            'Lệch tay RIÊNG cho các bước "lướt" (đánh dấu hàng/cột/xung quanh) — tay đứng yên ' +
            'sprite tĩnh trong lúc lướt nên tự chỉnh số này độc lập với Hand Offset ở trên.',
    })
    sweepHandOffset: Vec3 = new Vec3(-185, -15, 0);

    @property({
        tooltip:
            'Lệch tay RIÊNG cho trường hợp bước "lướt" chỉ còn ĐÚNG 1 ô (tự chuyển sang tay ' +
            'chạy animation lặp thay vì đứng yên tĩnh) — tư thế tay khác bước lướt bình thường ' +
            'nên KHÔNG dùng chung Sweep Hand Offset, phải tự chỉnh riêng.',
    })
    singleMarkHandOffset: Vec3 = new Vec3(-185, -15, 0);

    @property({ tooltip: 'Kích thước tay (scale) — chỉnh cho vừa cỡ ô. Áp dụng cho mọi bước.' })
    handScale = 1;

    @property({ tooltip: 'Tên animation "chạm" của icon_hand.' })
    handTapAnim = 'Active';

    @property({ tooltip: 'Tên animation "chờ" của icon_hand.' })
    handIdleAnim = 'Idle';

    @property({ tooltip: 'Thời gian tay bay từ ô này sang ô kế (giây).' })
    handMoveSeconds = 0.35;

    @property({ tooltip: 'Tay dừng lại "chạm" ở mỗi ô bao lâu (giây).' })
    handTapSeconds = 0.35;

    @property({ tooltip: 'Đi hết một vòng lướt: sau khi biến mất hẳn thì chờ bao lâu rồi hiện lại từ đầu (giây).' })
    handRestSeconds = 1.5;

    @property({ tooltip: 'Lướt xong, tay đứng yên bao lâu trước khi bắt đầu hiệu ứng biến mất (giây).' })
    handHideHoldSeconds = 0.2;

    @property({ tooltip: 'Thời gian hiệu ứng thu nhỏ dần + mờ dần lúc tay biến mất (giây).' })
    handHideDuration = 0.25;

    @property({ tooltip: 'Đặt sai trong tutorial thì dấu X tự xóa sau bao lâu (giây).' })
    wrongClearSeconds = 2;

    @property
    private _gatePadding = 1.1;

    @property({
        slide: true,
        range: [0.9, 1.5, 0.01],
        tooltip:
            'KÍCH THƯỚC vùng cho phép chạm = cạnh ô nhìn thấy × giá trị này. Chỉ ảnh hưởng ' +
            'phạm vi nhận chạm (không phải hình hiển thị — ô sáng là node ô thật).',
    })
    get gatePadding(): number {
        return this._gatePadding;
    }
    set gatePadding(value: number) {
        this._gatePadding = value;
        this.refreshGate();
    }

    private get board(): BoardView | null {
        return BoardView.current;
    }

    private step: Step = Step.Idle;
    private size = 0;
    private regions: readonly number[] = [];

    private dogCell1 = -1;
    private dogCell2 = -1;
    private dogCell3 = -1;

    private markTargets: number[] = [];
    // Nhiều ô đặt sai LIÊN TIẾP (đặt nhanh trước khi ô trước kịp tự xoá) đều phải được
    // xoá đúng thứ tự đặt, mỗi ô tự đếm ngược ĐỘC LẬP — KHÔNG dùng 1 field/1 lịch hẹn
    // dùng chung, vì lịch sau sẽ ghi đè/huỷ lịch trước, bỏ sót ô đặt trước đó.
    private readonly wrongCells: number[] = [];

    private placeDogHandInstance: Node | null = null;

    private inputGate: TutorialInputGate | null = null;
    private spotlightLayer: Node | null = null;
    private readonly gateRects: Rect[] = [];
    private lastCells: readonly number[] = [];
    private borderedCells: number[] = [];

    private textOpacity: UIOpacity | null = null;

    private readonly tempWorld = new Vec3();

    onLoad(): void {
        const bus = EventManager.instance;
        bus.on<PuzzleReadyEventPayload>(PUZZLE_READY_EVENT, this.onPuzzleReady, this);
        bus.on<CellChangedEventPayload>(CELL_CHANGED_EVENT, this.onCellChanged, this);
        bus.on<DogSettledEventPayload>(DOG_SETTLED_EVENT, this.onDogSettled, this);

        if (this.gotItButtonNode) this.gotItButtonNode.active = false;
        this.hideAll();
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
    }


    private onPuzzleReady = (payload: PuzzleReadyEventPayload): void => {
        if (payload.context !== 'tutorial') {
            this.step = Step.Idle;
            this.hideAll();
            this.board?.setAllowedCells(null);
            return;
        }

        this.size = payload.size;
        this.regions = payload.regions;
        const guided = payload.tutorialGuidedCells ?? [];
        if (guided.length < 3) {
            console.error(
                '[TutorialController] tutorialGuidedCells cần ít nhất 3 ô — không dạy được.',
            );
            this.finishGuided();
            return;
        }

        this.dogCell1 = guided[0]!;
        this.dogCell2 = guided[1]!;
        this.dogCell3 = guided[2]!;

        // Ẩn nút Back NGAY từ lúc vào màn tutorial — không đợi tới lúc showSpotlight()
        // (chỉ chạy sau boardAppearDuration), không thì nút Back hiện 1 lúc rồi mới ẩn.
        this.hideBackButton();

        this.step = Step.WaitBoard;
        this.unschedule(this.beginGuided);
        this.scheduleOnce(this.beginGuided, boardAppearDuration(payload.size));
    };

    private beginGuided = (): void => {
        this.showSpotlight();
        this.setDim(true);
        this.enterPlaceDog1Step();
    };



    private enterPlaceDog1Step(): void {
        this.step = Step.PlaceDog1;
        this.setTopText(Localization.get(L10N.tutorial.placeDog1));
        this.hideBottomText();
        this.applyVisible([this.dogCell1], [this.dogCell1]);
        this.showPlaceDogHandAt(this.dogCell1);
    }

    private onDog1Placed(): void {
        this.relift(this.dogCell1);
        this.clearBorders();
        this.stopHandTour();
        this.hidePlaceDogHand();
        if (this.hand) this.hand.node.active = false;
        this.board?.setAllowedCells([]);
        this.setDim(false);
        this.setTopText(Localization.get(L10N.tutorial.getIt));
        this.showGotIt();
    }

    onTapGotIt(): void {
        this.hideGotIt();
        this.setDim(true);
        this.enterMarkRowCol1Step();
    }



    private enterMarkRowCol1Step(): void {
        this.step = Step.MarkRowCol1;
        this.markTargets = [
            ...this.rowCells(this.dogCell1, this.size),
            ...this.colCells(this.dogCell1, this.size),
        ];

        this.setTopText(Localization.get(L10N.tutorial.markRowCol1));
        this.showBottomText(Localization.get(L10N.tutorial.markRowCol1Hint));

        this.stopHandTour();
        if (this.hand) this.hand.node.active = false;

        this.unschedule(this.revealMarkRowCol1Targets);
        this.scheduleOnce(this.revealMarkRowCol1Targets, this.stepRevealDelaySeconds);
    }

    private revealMarkRowCol1Targets = (): void => {
        // Bước này KHÔNG dùng tay — chỉ viền vàng nhấp nháy trên các ô cùng hàng/cột.
        this.applyVisible([this.dogCell1, ...this.markTargets], this.markTargets);
    };

    private onMarkRowCol1Done(): void {
        this.clearBorders();
        this.hideBottomText();
        // Còn ô đặt sai đang chờ tự xoá (2s) thì ép xoá NGAY ở đây — nếu để nó tự chạy hết
        // giờ, dấu X đỏ có thể còn hiện SANG TỚI bước kế tiếp (delay chuyển bước chỉ 1s,
        // ngắn hơn 2s chờ xoá X sai), trông như tutorial nhảy bước dù còn lỗi chưa xử lý.
        this.forceClearPendingWrongPlacements();
        this.unschedule(this.goToPlaceDog2Step);
        this.scheduleOnce(this.goToPlaceDog2Step, this.stepTransitionDelaySeconds);
    }

    private goToPlaceDog2Step = (): void => {
        // Chốt kiểm tra LẦN CUỐI ngay lúc THỰC SỰ chuyển bước (không chỉ lúc lên lịch) —
        // nếu giữa lúc lên lịch và lúc này có gì đó khiến ô không còn đủ điều kiện nữa
        // (ví dụ 1 ô bị đặt sai rồi hoàn tác về Empty), HUỶ chuyển bước — đợi người chơi
        // đánh dấu lại đúng, lần đánh dấu ĐÚNG kế tiếp sẽ tự kích hoạt lại việc này.
        if (!this.allTargetsMarked()) return;
        this.enterPlaceDog2Step();
    };



    private enterPlaceDog2Step(): void {
        this.step = Step.PlaceDog2;
        // Hiện cả vùng hồng (gồm các ô đã bị loại từ bước hàng/cột trước đó), không chỉ ô đích.
        const pinkCells = this.sameRegionCells(this.dogCell2);

        this.setTopText(Localization.get(L10N.tutorial.placeDog2));
        this.applyVisible(pinkCells, [this.dogCell2]);
        this.showPlaceDogHandAt(this.dogCell2);
    }

    private onDog2Placed(): void {
        this.relift(this.dogCell2);
        this.clearBorders();
        this.stopHandTour();
        this.hidePlaceDogHand();
        if (this.hand) this.hand.node.active = false;
        this.board?.setAllowedCells([]);
        this.setDim(false);

        // KHÔNG hẹn giờ cố định ở đây — đợi đúng lúc hiệu ứng đặt chó (phồng to → đập
        // xuống) chạy xong hẳn (DOG_SETTLED_EVENT, xem onDogSettled) rồi mới bắt đầu đếm
        // dog2FlashSeconds, tránh cắt ngang animation nếu nó dài hơn thời gian hẹn.
    }

    private onDogSettled = (payload: DogSettledEventPayload): void => {
        if (this.step !== Step.PlaceDog2 || payload.cell !== this.dogCell2) return;

        this.unschedule(this.finishDog2Flash);
        this.scheduleOnce(this.finishDog2Flash, this.dog2FlashSeconds);
    };

    private finishDog2Flash = (): void => {
        this.setDim(true);
        this.enterMarkAround2Step();
    };



    private enterMarkAround2Step(): void {
        this.step = Step.MarkAround2;
        this.markTargets = this.blueNeighborTargets(this.dogCell2);

        this.setTopText(Localization.get(L10N.tutorial.markAround2));

        // Đợi nền đen mờ ĐẬM HẲN (setDim vừa gọi trước đó) rồi mới nhấc ô lên — nhấc/mờ
        // dần ô NGAY LÚC nền đen còn đang mờ sẽ không thấy được độ tương phản (ô mờ dần
        // hiện lên trên nền CŨNG đang còn sáng), trông như hiện thẳng luôn không hiệu ứng.
        // Cùng cách MarkRowCol1 đã dùng (stepRevealDelaySeconds).
        this.unschedule(this.revealMarkAround2Targets);
        this.scheduleOnce(this.revealMarkAround2Targets, this.stepRevealDelaySeconds);
    }

    private revealMarkAround2Targets = (): void => {
        this.applyVisible([this.dogCell2, ...this.markTargets], this.markTargets);
        this.spotlightMarkTargets();
    };



    private onMarkAround2Done(): void {
        this.clearBorders();
        this.stopHandTour();
        this.forceClearPendingWrongPlacements();
        this.unschedule(this.goToPlaceDog3Step);
        this.scheduleOnce(this.goToPlaceDog3Step, this.stepTransitionDelaySeconds);
    }

    private goToPlaceDog3Step = (): void => {
        // Chốt kiểm tra LẦN CUỐI ngay lúc THỰC SỰ chuyển bước — xem giải thích ở
        // goToPlaceDog2Step().
        if (!this.allTargetsMarked()) return;
        this.enterPlaceDog3Step();
    };

    private enterPlaceDog3Step(): void {
        this.step = Step.PlaceDog3;
        // "Tất cả các ô xanh dương" — nguyên vùng của dogCell3, không chỉ 3 ô vừa đánh dấu.
        const blueCells = this.sameRegionCells(this.dogCell3);

        this.setTopText(Localization.get(L10N.tutorial.placeDog3));
        this.applyVisible(blueCells, [this.dogCell3]);

        // Bước trước (MarkAround2) chạy tay kiểu "lướt" (startHandSweep) và TỰ ĐẶT LỊCH
        // gọi lại chính nó sau một khoảng nghỉ — nếu không huỷ lịch này, nó sẽ bất ngờ
        // kích hoạt lại kiểu lướt SAU KHI đã pointHandAt ở đây, kéo tay khỏi ô đích.
        this.stopHandTour();
        this.showPlaceDogHandAt(this.dogCell3);
    }

    /** Mọi ô cùng vùng (region) với `cell`, kể cả `cell`. */
    private sameRegionCells(cell: number): number[] {
        const region = this.regions[cell];
        const out: number[] = [];
        for (let i = 0; i < this.regions.length; i++) {
            if (this.regions[i] === region) out.push(i);
        }
        return out;
    }

    private onDog3Placed(): void {
        this.clearBorders();
        this.stopHandTour();
        this.hidePlaceDogHand();
        if (this.hand) this.hand.node.active = false;
        this.setDim(false);

        EventManager.instance.emit(TUTORIAL_GUIDED_FINISHED_EVENT, undefined);
        this.finishGuided(); 
    }


    private rowCells(dog: number, size: number): number[] {
        const row = Math.floor(dog / size);
        const out: number[] = [];
        for (let c = 0; c < size; c++) {
            const cell = row * size + c;
            if (cell !== dog) out.push(cell);
        }
        return out;
    }

    private colCells(dog: number, size: number): number[] {
        const col = dog % size;
        const out: number[] = [];
        for (let r = 0; r < size; r++) {
            const cell = r * size + col;
            if (cell !== dog) out.push(cell);
        }
        return out;
    }

  
    private blueNeighborTargets(dog: number): number[] {
        const size = this.size;
        const row = Math.floor(dog / size);
        const col = dog % size;
        const states = PuzzleSessionHolder.current?.cellStates;

        const out: number[] = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (r < 0 || r >= size || c < 0 || c >= size) continue;
                const cell = r * size + c;
                if (states && states[cell] !== CellState.Empty) continue;
                out.push(cell);
            }
        }

        out.sort((a, b) => {
            const rowA = Math.floor(a / size);
            const rowB = Math.floor(b / size);
            if (rowA !== rowB) return rowB - rowA; 
            return (a % size) - (b % size);
        });
        return out;
    }


    private finishGuided(): void {
        this.step = Step.FreePlay;
        this.hideSpotlight();
        this.board?.setAllowedCells(null);

        // FreePlay xong hẳn — HUỶ LUÔN gate chặn chạm (không chỉ tắt active) để không còn
        // gì có thể chặn nút Place Dog tutorial hay bất kỳ UI nào khác nữa.
        if (this.inputGate) {
            this.inputGate.node.destroy();
            this.inputGate = null;
        }

        // FreePlay: text KHÔNG tự ẩn nữa — đây là toàn bộ UI còn lại (cùng node place dog).
        this.unschedule(this.hideTopText);
        this.setTopText(Localization.get(L10N.tutorial.finish));
    }


    private onCellChanged = (payload: CellChangedEventPayload): void => {

        if (payload.state === CellState.WrongMark && this.isTutorialActive()) {
            this.handleWrongPlacement(payload.cell);
            return;
        }

        switch (this.step) {
            case Step.PlaceDog1:
                if (payload.cell === this.dogCell1 && payload.state === CellState.Dog) {
                    this.onDog1Placed();
                }
                break;
            case Step.MarkRowCol1:
                // CHỈ kiểm tra hoàn thành khi ô này VỪA được đánh dấu đúng (state === Mark)
                // — không kiểm tra ở sự kiện Empty do forgiveWrongMark() tự hoàn tác ô đặt
                // sai phát ra, không thì bước có thể bị tính xong "ăn theo" sự kiện hoàn
                // tác đó dù ô vừa đặt sai chưa hề được đánh dấu lại.
                if (payload.state === CellState.Mark && this.allTargetsMarked()) {
                    this.onMarkRowCol1Done();
                }
                break;
            case Step.PlaceDog2:
                if (payload.cell === this.dogCell2 && payload.state === CellState.Dog) {
                    this.onDog2Placed();
                }
                break;
            case Step.MarkAround2:
                if (payload.state === CellState.Mark && this.allTargetsMarked()) {
                    this.onMarkAround2Done();
                }
                break;
            case Step.PlaceDog3:
                if (payload.cell === this.dogCell3 && payload.state === CellState.Dog) {
                    this.onDog3Placed();
                }
                break;
        }
    };

    private isGuidedStep(): boolean {
        return this.step !== Step.Idle && this.step !== Step.WaitBoard && this.step !== Step.FreePlay;
    }

    /**
     * Guided steps + FreePlay (tự chơi sau khi dạy xong 3 con) — KHÁC isGuidedStep() ở
     * chỗ CÓ tính cả FreePlay, vì đặt sai lúc tự chơi cũng cần hiện chữ nhắc + hoàn lại
     * lượt mistake giống hệt lúc đang được dạy, tránh thua ngay trong màn tutorial.
     */
    private isTutorialActive(): boolean {
        return this.step !== Step.Idle && this.step !== Step.WaitBoard;
    }

    private handleWrongPlacement(cell: number): void {
        this.setTopText(Localization.get(L10N.tutorial.wrong));

        if (this.wrongCells.indexOf(cell) < 0) this.wrongCells.push(cell);

        // Lịch hẹn RIÊNG cho đúng ô này — không unschedule/dùng chung với ô khác, nên
        // nhiều ô đặt sai liên tiếp đều tự đếm ngược và tự xoá đúng lúc của mình.
        this.scheduleOnce(() => this.clearWrongPlacement(cell), this.wrongClearSeconds);
    }


    /**
     * Ép xoá NGAY mọi ô đang chờ tự xoá dấu X đặt sai — gọi lúc chuyển bước, để không còn
     * dấu X đỏ nào rơi rớt sang bước kế tiếp (huỷ lịch hẹn 2s riêng của từng ô là dư thừa
     * vì clearWrongPlacement tự an toàn nếu gọi 2 lần — forgiveWrongMark() no-op nếu ô đã
     * không còn là WrongMark nữa).
     */
    private forceClearPendingWrongPlacements(): void {
        for (const cell of [...this.wrongCells]) {
            this.clearWrongPlacement(cell);
        }
    }

    private clearWrongPlacement(cell: number): void {
        const index = this.wrongCells.indexOf(cell);
        if (index >= 0) this.wrongCells.splice(index, 1);

        PuzzleSessionHolder.current?.forgiveWrongMark(cell);

        // Còn ô sai khác chưa tới lượt xoá thì giữ nguyên chữ nhắc, đợi xoá HẾT mới trả
        // chữ về đúng bước hiện tại.
        if (this.wrongCells.length === 0) this.setTopText(this.currentStepText());
    }

    private currentStepText(): string {
        switch (this.step) {
            case Step.PlaceDog1:
                return Localization.get(L10N.tutorial.placeDog1);
            case Step.MarkRowCol1:
                return Localization.get(L10N.tutorial.markRowCol1);
            case Step.PlaceDog2:
                return Localization.get(L10N.tutorial.placeDog2);
            case Step.MarkAround2:
                return Localization.get(L10N.tutorial.markAround2);
            case Step.PlaceDog3:
                return Localization.get(L10N.tutorial.placeDog3);
            case Step.FreePlay:
                return Localization.get(L10N.tutorial.finish);
            default:
                return '';
        }
    }

    private allTargetsMarked(): boolean {
        // Còn ô đang chờ xoá dấu X đặt sai (this.wrongCells) thì CHƯA được coi là xong —
        // tránh trường hợp người chơi thử đặt sai 1 ô rồi bước lại vô tình được tính hoàn
        // thành trong lúc dấu X đỏ đó còn đang hiện/chờ hoàn lượt.
        if (this.wrongCells.length > 0) return false;

        const states = PuzzleSessionHolder.current?.cellStates;
        if (!states) return false;
        return this.markTargets.every((cell) => states[cell] === CellState.Mark);
    }

    
    private spotlightMarkTargets(): void {
        const remaining = this.unmarkedTargets();
        if (remaining.length === 1) {
            this.pointHandAt(remaining[0]!, this.singleMarkHandOffset);
        } else {
            this.startHandSweep();
        }
    }


    private applyVisible(visible: readonly number[], border: readonly number[]): void {
        const board = this.board;
        if (this.inputGate) this.inputGate.node.active = true;
        this.clearBorders();
        // Chỉ mờ dần TẮT đúng những ô KHÔNG còn ở bước mới, ô nào vẫn tiếp tục hiện thì
        // giữ nguyên (không tắt/nhấc lại) — khác restoreLiftedCells()+liftCellsTo() cũ
        // (hạ NGAY toàn bộ rồi nhấc lại), gây tắt đột ngột ô của bước trước.
        board?.syncLiftedCells(this.ensureSpotlightLayer(), visible);
        this.keepHandOnTop();

        board?.setAllowedCells(border);
        this.buildGateRects(border);
        this.setBorders(border);
    }

    /**
     * Lúc `applyVisible()` chạy cho ô này thì con chó CHƯA tồn tại (ô còn trống) nên
     * chưa được "nhấc" theo — ngay khi vừa đặt xong, node chó mới sinh ra lại nằm ở
     * dogLayer mặc định (dưới nền đen). Gọi lại liftCellsTo cho ĐÚNG ô này để bắt kịp
     * node chó vừa tạo, không thì nó bị nền đen che mất dù ô đang "sáng".
     */
    private relift(cell: number): void {
        if (this.spotlightLayer) this.board?.liftCellsTo(this.spotlightLayer, [cell]);
        this.keepHandOnTop();
    }

    /** Lưới mạng: gọi lại keepHandOnTop() MỖI FRAME, không chỉ ở 2 nơi liftCellsTo()/syncLiftedCells()
     * đã hook thủ công. raiseCellAboveNeighbors() (CellView — đặt mèo/hiệu ứng sóng Clear) tự đẩy
     * CHÍNH Ô đang tương tác lên sibling index cuối cùng CỦA CHA HIỆN TẠI — nếu ô đó đã bị "nhấc"
     * vào spotlightLayer (tutorial), thao tác này vô tình đè lên tay dù không hề gọi liftCellsTo/
     * syncLiftedCells lần nào (đúng bug "tương tác với ô thì tay bị đè" dù đã hook 2 chỗ kia). Chi
     * phí không đáng kể — chỉ set lại 2 sibling index (không cấp phát gì) trên board tutorial nhỏ. */
    protected update(): void {
        this.keepHandOnTop();
    }

    /** Đảm bảo (các) node tay LUÔN vẽ TRÊN CÙNG trong spotlightLayer. Ô/chó vừa "nhấc" lên (hoặc
     * vừa được raiseCellAboveNeighbors() đẩy lên) luôn bị APPEND/đẩy ở CUỐI danh sách con của CHA
     * HIỆN TẠI, nên nếu tay đang đứng yên/di chuyển dở (chỉ được đưa lên trên cùng ĐÚNG 1 LẦN lúc
     * showHand()/showPlaceDogHandAt()) thì ô đó sẽ đè lên tay — đúng bug đã báo (kèm ảnh): tay bị ô
     * bên cạnh che mất giữa lúc đang di chuyển vì người chơi vừa tương tác. Gọi thêm NGAY sau mỗi
     * lần liftCellsTo()/syncLiftedCells() (áp dụng ngay trong cùng frame, không đợi update() kế
     * tiếp) — update() ở trên là lưới mạng cho MỌI nguồn khác (kể cả raiseCellAboveNeighbors()). */
    private keepHandOnTop(): void {
        const layer = this.spotlightLayer;
        if (!layer) return;

        const hand = this.hand?.node;
        if (hand?.isValid && hand.active && hand.parent === layer) hand.setSiblingIndex(-1);

        const placeDogHand = this.placeDogHandInstance;
        if (placeDogHand?.isValid && placeDogHand.active && placeDogHand.parent === layer) {
            placeDogHand.setSiblingIndex(-1);
        }
    }

    private setBorders(cells: readonly number[]): void {
        this.borderedCells = [...cells];
        for (const cell of cells) this.board?.getCellView(cell)?.setGoldBorder(true);
    }

    private clearBorders(): void {
        for (const cell of this.borderedCells) this.board?.getCellView(cell)?.setGoldBorder(false);
        this.borderedCells = [];
    }

    private buildGateRects(cells: readonly number[]): void {
        this.lastCells = cells;

        const board = this.board;
        if (!board) return;

        const side = board.currentVisualCellSize * this._gatePadding;
        const half = side / 2;

        this.gateRects.length = 0;
        for (const cell of cells) {
            if (!board.getCellWorldPosition(cell, this.tempWorld)) continue;
            this.gateRects.push(new Rect(this.tempWorld.x - half, this.tempWorld.y - half, side, side));
        }

        this.inputGate?.setHoles(this.gateRects);
    }

    private refreshGate(): void {
        if (!this.isGuidedStep()) return;
        if (this.lastCells.length === 0) return;
        this.buildGateRects(this.lastCells);
    }

    /** Tay HandAnim mới — CHỈ dùng cho 3 bước đặt chó (PlaceDog1/2/3). */
    private showPlaceDogHandAt(cell: number): void {
        const prefab = this.placeDogHandAnimPrefab;
        if (!prefab) return;

        if (!this.placeDogHandInstance || !this.placeDogHandInstance.isValid) {
            this.placeDogHandInstance = instantiate(prefab);
            this.placeDogHandInstance.setParent(this.ensureSpotlightLayer());
        }

        const node = this.placeDogHandInstance;
        node.active = true;
        node.setScale(this.placeDogHandAnimScale, this.placeDogHandAnimScale, 1);
        if (node.parent) node.setSiblingIndex(node.parent.children.length - 1);

        if (this.cellWorldForHand(cell, this.placeDogHandAnimOffset)) {
            node.setWorldPosition(this.tempWorld);
        }

        playFrameAnimation(node, true);
    }

    private hidePlaceDogHand(): void {
        if (this.placeDogHandInstance?.isValid) this.placeDogHandInstance.active = false;
    }

    private pointHandAt(cell: number, offset: Vec3 = this.handOffset): void {
        const hand = this.hand;
        if (!hand) return;

        this.showHand();
        hand.paused = false;
        hand.node.setScale(this.handScale, this.handScale, 1);
        const opacity = hand.node.getComponent(UIOpacity) ?? hand.node.addComponent(UIOpacity);
        opacity.opacity = 255;
        if (this.cellWorldForHand(cell, offset)) hand.node.setWorldPosition(this.tempWorld);
        hand.setAnimation(HAND_TRACK, this.handTapAnim, true);
    }



  
    private startHandSweep(): void {
        const hand = this.hand;
        if (!hand) return;

        this.unschedule(this.startHandSweep);

        const remaining = this.unmarkedTargets();
        if (remaining.length === 0) return;

        this.showHand();
        hand.paused = false;
        hand.node.setScale(this.handScale, this.handScale, 1);
        const opacity = hand.node.getComponent(UIOpacity) ?? hand.node.addComponent(UIOpacity);
        opacity.opacity = 255;

        if (this.cellWorldForHand(remaining[0]!, this.sweepHandOffset)) {
            hand.node.setWorldPosition(this.tempWorld);
        }

        const chain = tween(hand.node);

  
        chain
            .call(() => {
                hand.setAnimation(HAND_TRACK, this.handTapAnim, false);
                hand.paused = true;
            })
            .delay(this.handTapSeconds);

        for (let i = 1; i < remaining.length; i++) {
            const local = this.cellLocalForHand(remaining[i]!, this.sweepHandOffset);
            if (local) chain.to(this.handMoveSeconds, { position: local }, { easing: 'linear' });
        }

        chain
            .delay(this.handHideHoldSeconds)
            .call(() => tween(opacity).to(this.handHideDuration, { opacity: 0 }).start())
            .to(this.handHideDuration, { scale: new Vec3(0, 0, 1) })
            .call(() => {
                hand.node.active = false;
                hand.node.setScale(this.handScale, this.handScale, 1);
                opacity.opacity = 255;
            })
            .start();

        const moveDuration = Math.max(0, remaining.length - 1) * this.handMoveSeconds;
        const hideSequenceSeconds =
            this.handTapSeconds + moveDuration + this.handHideHoldSeconds + this.handHideDuration;
        this.scheduleOnce(this.startHandSweep, hideSequenceSeconds + this.handRestSeconds);
    }

    /**
     * Dừng NGAY kiểu tay "lướt" (startHandSweep) và ẩn tay LUÔN — không chỉ dừng tween.
     * Nếu người chơi đánh dấu xong hết các ô TRƯỚC khi tay lướt hết vòng, tween lướt bị
     * dừng dở giữa chừng (chưa kịp chạy tới đoạn tự ẩn ở cuối chuỗi) — nếu chỉ dừng tween
     * mà không ẩn, tay sẽ đứng khựng lại tại chỗ và không biến mất nữa.
     */
    private stopHandTour(): void {
        this.unschedule(this.startHandSweep);

        const hand = this.hand;
        if (!hand?.node.isValid) return;

        Tween.stopAllByTarget(hand.node);
        hand.node.active = false;
        hand.node.setScale(this.handScale, this.handScale, 1);
        const opacity = hand.node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;
    }


    private unmarkedTargets(): number[] {
        const states = PuzzleSessionHolder.current?.cellStates;
        if (!states) return this.markTargets.slice();
        return this.markTargets.filter((cell) => states[cell] !== CellState.Mark);
    }

    private showHand(): void {
        const hand = this.hand;
        if (!hand) return;

        hand.node.active = true;
        hand.premultipliedAlpha = true;


        const parent = hand.node.parent;
        if (parent) hand.node.setSiblingIndex(parent.children.length - 1);
    }


    private cellWorldForHand(cell: number, offset: Vec3 = this.handOffset): boolean {
        const board = this.board;
        if (!board || cell < 0) return false;
        if (!board.getCellWorldPosition(cell, this.tempWorld)) return false;

        this.tempWorld.add(offset);
        return true;
    }


    private cellLocalForHand(cell: number, offset: Vec3 = this.handOffset): Vec3 | null {
        const parent = this.hand?.node.parent;
        if (!parent || !this.cellWorldForHand(cell, offset)) return null;

        const transform = parent.getComponent(UITransform);
        if (!transform) return null;

        const local = new Vec3();
        transform.convertToNodeSpaceAR(this.tempWorld, local);
        return local;
    }


    private showSpotlight(): void {
        if (this.spotlightRoot) this.spotlightRoot.active = true;

        const layer = this.ensureSpotlightLayer();
        layer.active = true;
        this.hand?.node.setParent(layer, true);

        this.ensureInputGate().node.active = true;
        this.hideBackButton();
    }

    /** Ẩn nút Back trong lúc dạy — người chơi không thoát ra giữa chừng được nữa. */
    private hideBackButton(): void {
        if (this.backButtonNode?.isValid) this.backButtonNode.active = false;
    }

    private restoreBackButton(): void {
        if (this.backButtonNode?.isValid) this.backButtonNode.active = true;
    }

    private setDim(active: boolean): void {
        const node = this.dimNode;
        if (!node) return;

        if (!active) {
            const opacity = node.getComponent(UIOpacity);
            if (opacity) Tween.stopAllByTarget(opacity);
            node.active = false;

            // Nền đen tắt (ví dụ đặt xong 1 con chó, hiện "Got it") — viền vàng của MỌI ô
            // đang nhấc phải tắt theo NGAY, không đợi tới bước kế tiếp mới dọn (trước đây
            // chỉ syncLiftedCells() ở bước MỚI mới tắt viền, nên viền vẫn treo lại suốt
            // khoảng nền đen tắt này dù không còn nền đen để "nhấc" lên trên nữa).
            this.board?.hideAllLiftBorders();
            return;
        }

        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        node.active = true;
        opacity.opacity = 0;
        tween(opacity).to(this.dimFadeInSeconds, { opacity: 255 }).start();
    }

    private hideSpotlight(): void {
        if (this.spotlightRoot) this.spotlightRoot.active = false;
        this.clearBorders();
        this.board?.restoreLiftedCells();
        this.stopHandTour();
        if (this.hand) this.hand.node.active = false;
        this.hidePlaceDogHand();
        if (this.inputGate) this.inputGate.node.active = false;
        if (this.spotlightLayer) this.spotlightLayer.active = false;
        this.hideGotIt();
    }


    private ensureSpotlightLayer(): Node {
        if (this.spotlightLayer) return this.spotlightLayer;

        const node = new Node('TutorialSpotlightLayer');
        node.layer = this.node.layer;
        node.addComponent(UITransform);
        node.setParent(this.node);
        node.setPosition(0, 0, 0);

        this.spotlightLayer = node;
        return node;
    }


    private ensureInputGate(): TutorialInputGate {
        if (this.inputGate) return this.inputGate;

        const node = new Node('TutorialInputGate');
        node.layer = this.node.layer;

        const size = view.getVisibleSize();
        const transform = node.addComponent(UITransform);
        transform.setContentSize(size.width * GATE_OVERSIZE, size.height * GATE_OVERSIZE);

        node.setParent(this.node);
        node.setPosition(0, 0, 0);

        this.inputGate = node.addComponent(TutorialInputGate);
        this.inputGate.setHoles(this.gateRects);
        return this.inputGate;
    }

    private hideAll(): void {
        this.hideSpotlight();
        this.restoreBackButton();
        if (this.textNode) this.textNode.active = false;
        if (this.subTextNode) this.subTextNode.active = false;
    }



    private setTopText(value: string): void {
        if (!this.textNode || !this.textLabel) return;
        if (!this.textOpacity) {
            this.textOpacity = this.textNode.getComponent(UIOpacity) ?? this.textNode.addComponent(UIOpacity);
        }
        this.crossfadeText(this.textNode, this.textOpacity, this.textLabel, value);
    }

    private hideTopText = (): void => {
        setActiveAnimated(this.textNode, false);
    };

    private showBottomText(value: string): void {
        if (this.subTextLabel) this.subTextLabel.string = value;
        setActiveAnimated(this.subTextNode, true);
    }

    private hideBottomText(): void {
        setActiveAnimated(this.subTextNode, false);
    }

    private crossfadeText(node: Node, opacity: UIOpacity, label: Label, value: string): void {
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);

        if (!node.active) {
            node.active = true;
            label.string = value;
            node.setScale(TEXT_FROM_SCALE, TEXT_FROM_SCALE, 1);
            opacity.opacity = 0;
            tween(node).to(TEXT_FADE_SECONDS, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).start();
            tween(opacity).to(TEXT_FADE_SECONDS, { opacity: 255 }).start();
            return;
        }

        tween(node)
            .to(TEXT_FADE_SECONDS, { scale: new Vec3(TEXT_FROM_SCALE, TEXT_FROM_SCALE, 1) }, { easing: 'quadIn' })
            .start();

        tween(opacity)
            .to(TEXT_FADE_SECONDS, { opacity: 0 })
            .call(() => {
                label.string = value;
                node.setScale(TEXT_FROM_SCALE, TEXT_FROM_SCALE, 1);
                tween(node).to(TEXT_FADE_SECONDS, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).start();
            })
            .to(TEXT_FADE_SECONDS, { opacity: 255 })
            .start();
    }



    private showGotIt(): void {
        const node = this.gotItButtonNode;
        if (!node) return;

 
        if (this.inputGate) this.inputGate.node.active = false;

        node.active = true;
        node.setScale(1, 1, 1);
        Tween.stopAllByTarget(node);

        tween(node)
            .repeatForever(
                tween<Node>()
                    .to(this.gotItPulseSeconds, { scale: new Vec3(this.gotItPulseScale, this.gotItPulseScale, 1) }, { easing: 'sineInOut' })
                    .to(this.gotItPulseSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' }),
            )
            .start();
    }

    private hideGotIt(): void {
        const node = this.gotItButtonNode;
        if (!node?.isValid) return;

        Tween.stopAllByTarget(node);
        node.active = false;
        node.setScale(1, 1, 1);
    }
}
