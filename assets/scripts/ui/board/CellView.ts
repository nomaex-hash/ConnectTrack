import {
    _decorator,
    Color,
    Component,
    Node,
    ParticleSystem,
    sp,
    Sprite,
    SpriteFrame,
    Tween,
    tween,
    UIOpacity,
    UITransform,
    Vec3,
} from 'cc';
import { CellState } from '../../core/CellState';
import { DogSpineProvider } from './DogSpineProvider';
import { DogView } from './DogView';

const { ccclass, property } = _decorator;


export const CELL_FILL_RATIO = 0.94;


export const APPEAR_DURATION = 0.22;


const VANISH_DURATION = 0.1;

const HIGHLIGHT_SCALE = 1.06;

const PRESS_SCALE = 0.9;

const PRESS_DURATION = 0.07;

const BORDER_BLINK_HALF_SECONDS = 0.4;

const BORDER_BLINK_MIN_OPACITY = 70;

const BORDER_BLINK_MIN_SCALE = 0.9;

// Tên animation trong atlas icon_X / icon_heart.
const SPINE_TRACK = 0;
const MARK_ANIM_APPEAR = 'Active_correct';
const MARK_ANIM_IDLE = 'Idle_correct';
const WRONG_ANIM_APPEAR = 'Active_false';
const WRONG_ANIM_IDLE = 'Idle_false';
const HEART_ANIM_APPEAR = 'Active';


@ccclass('CellView')
export class CellView extends Component {
    @property({ tooltip: 'B?t log ch?n ?o?n hi?u ?ng t?ng ? (ch? d?ng khi debug).' })
    debugEffects = false;


    @property({
        type: Sprite,
        tooltip:
            'Sprite nền ô. Ảnh vùng lấy từ BoardView.regionSprites (ảnh đã có màu sẵn) — ' +
            'code KHÔNG tô màu nữa.',
    })
    background: Sprite = null!;

    @property({ type: Sprite, tooltip: 'Sprite icon — Dog / Mark / Wrong Mark' })
    icon: Sprite = null!;

    @property({ type: Node, tooltip: 'Lớp phủ cho ô khóa (pre-placed). Có thể để trống.' })
    lockedOverlay: Node | null = null;

    @property({
        type: Sprite,
        tooltip:
            'Sprite viền vàng — dùng cho tutorial (ô cần hướng dẫn). Ẩn sẵn; ' +
            'setGoldBorder() bật/tắt + nhấp nháy mờ-đậm liên tục. Có thể để trống.',
    })
    goldBorder: Sprite | null = null;

    @property({
        type: ParticleSystem,
        tooltip:
            'Particle bắn ra khi đặt ĐÚNG mèo (người chơi thao tác thật — KHÔNG hiện lúc resume/khôi ' +
            'phục ván chơi dở, animate=false). Có thể để làm con của CHÍNH node ô này, node particle ' +
            'tự bật/tắt qua script. Để trống thì bỏ qua, không crash.',
    })
    placeDogParticle: ParticleSystem | null = null;

    @property({
        tooltip:
            'Particle đặt mèo: tự ẨN sau bao lâu (giây) kể từ lúc bắn — PHÒNG KHI asset particle bị ' +
            'lặp/duration dài khiến nó không tự biến mất. Nên đặt bằng hoặc hơi dài hơn Duration thật.',
    })
    placeDogParticleHideSeconds = 1;

    @property({
        tooltip:
            'Cạnh ô THAM CHIẾU (px, = visualSize) lúc particle đặt mèo được tune vừa mắt trong Editor ' +
            '(giữ scale gốc của node particle trong prefab) — dùng để co giãn particle theo tỉ lệ ' +
            'visualSize thực tế / giá trị này, tránh particle nhỏ quá (màn ít ô, ô/mèo to) hoặc to ' +
            'quá (màn nhiều ô, ô/mèo nhỏ) so với mèo thật.',
    })
    placeDogParticleDesignSize = 90;

    @property({
        type: Sprite,
        tooltip:
            'Sprite "sóng" (vàng) — chớp nhoáng khi hiệu ứng Clear hàng/cột/vùng quét qua ô này ' +
            '(xem playWaveVisit(), BoardView.playWaveSteps()). Đặt SAU background, TRƯỚC icon ' +
            'trong Hierarchy (Sibling Index) để nằm ĐÚNG dưới icon mèo/X. Ẩn sẵn; có thể để trống ' +
            '(vẫn còn hiệu ứng phóng to icon, chỉ thiếu ánh sáng vàng).',
    })
    waveOverlay: Sprite | null = null;


    @property({
        type: SpriteFrame,
        tooltip:
            'Icon con chó — CHỈ dùng khi BoardView chưa gán DogSpine.prefab. Có spine thì ' +
            'ảnh này không bao giờ hiện.',
    })
    dogSprite: SpriteFrame = null!;

    @property({ type: SpriteFrame, tooltip: 'Icon dấu X — ghi chú của người chơi' })
    markSprite: SpriteFrame = null!;

    @property({ type: SpriteFrame, tooltip: 'Icon đánh dấu đặt sai' })
    wrongMarkSprite: SpriteFrame = null!;

    @property({
        type: sp.Skeleton,
        tooltip:
            'Spine icon_X cho dấu X. Có gán thì DÙNG SPINE thay cho ảnh tĩnh: đánh dấu ' +
            'thường chạy Active_correct, đặt sai chạy Active_false (X đỏ). Trống thì lui về ảnh.',
    })
    markSpine: sp.Skeleton | null = null;

    @property({
        type: sp.Skeleton,
        tooltip: 'Spine icon_heart — nháy lên TRƯỚC khi hiện X đỏ lúc đặt sai. Có thể trống.',
    })
    heartSpine: sp.Skeleton | null = null;

    @property({ tooltip: 'Trái tim hiện bao lâu (giây) rồi mới tới X đỏ.' })
    heartLeadSeconds = 0.4;

    @property({
        tooltip:
            'X đỏ (spine Active_false) chạy hết bao lâu (giây) SAU khi trái tim hiện xong — dùng để ' +
            'BoardView biết lúc nào toàn bộ animation đặt sai (tim + X) mới thực sự xong hẳn, tránh ' +
            'sóng Clear của 1 hành động ĐÚNG khác chạy đè lên lúc animation này còn đang chạy dở. ' +
            'Đặt đúng bằng thời lượng thật của clip Active_false trong Spine.',
    })
    wrongMarkRevealSeconds = 0.3;

    /** Tổng thời lượng animation đặt SAI (tim nháy + X đỏ) — BoardView dùng để biết lúc nào
     * animation này mới thực sự xong hẳn (xem wrongMarkBusyUntilMs/computeWaveInitialDelay). */
    get wrongMarkAnimationSeconds(): number {
        if (!this.markSpine) return this.markPopSeconds;
        const duration = this.markSpine.findAnimation(WRONG_ANIM_APPEAR)?.duration ?? this.wrongMarkRevealSeconds;
        const speed = this.markSpine.timeScale;
        return (this.heartSpine ? this.heartLeadSeconds : 0) + duration / Math.max(speed, 0.001);
    }

    @property({
        tooltip:
            'Cạnh khung hình GỐC (px) của spine icon_X ở scale 1 — dùng để co spine vừa theo ' +
            'markSizeRatio × cạnh ô, giống hệt nhánh ảnh tĩnh. Đặt đúng kích thước gốc trong ' +
            'file spine (xem export hoặc thử tăng/giảm cho khớp).',
    })
    markSpineDesignSize = 100;

    @property({
        tooltip: 'Cạnh khung hình GỐC (px) của spine icon_heart ở scale 1 — cùng ý nghĩa như trên.',
    })
    heartSpineDesignSize = 100;

    @property({
        range: [0.1, 1, 0.01],
        slide: true,
        tooltip: 'Đặt mèo (Dog): scale bắt đầu (nhỏ) lúc vừa đặt, trước khi phóng lên dogPopPeakScale.',
    })
    dogPopFromScale = 0.25;

    @property({
        range: [1, 1.6, 0.01],
        slide: true,
        tooltip: 'Đặt mèo (Dog): scale ĐỈNH — phóng to HƠN cả ô, trước khi đứng yên rồi đập xuống scale gốc (1).',
    })
    dogPopPeakScale = 1.2;

    @property({ tooltip: 'Đặt mèo (Dog): thời gian phóng to từ dogPopFromScale lên dogPopPeakScale (giây).' })
    dogPopUpSeconds = 0.16;

    @property({ tooltip: 'Đặt mèo (Dog): đứng yên ở đỉnh (dogPopPeakScale) bao lâu trước khi đập xuống (giây).' })
    dogPopHoldSeconds = 0.08;

    @property({ tooltip: 'Đặt mèo (Dog): thời gian đập xuống từ dogPopPeakScale về dogPopSquashScale (giây).' })
    dogPopSettleSeconds = 0.12;

    @property({
        range: [0.5, 1, 0.01],
        slide: true,
        tooltip:
            'Đặt mèo (Dog): đập xuống LÚN QUÁ scale gốc một chút (nhỏ hơn 1) trước khi nảy lại về ' +
            'đúng scale gốc (1) — mô phỏng lực rơi thật. Để = 1 thì tắt hẳn bước lún (đập xuống ' +
            'thẳng về 1 như cũ).',
    })
    dogPopSquashScale = 0.92;

    @property({ tooltip: 'Đặt mèo (Dog): thời gian nảy lại từ dogPopSquashScale về đúng scale gốc (1) (giây).' })
    dogPopSquashSeconds = 0.1;

    @property({
        range: [0.1, 1, 0.01],
        slide: true,
        tooltip: 'Đánh dấu (Mark): scale bắt đầu (nhỏ) lúc vừa đặt, cũng là scale kết thúc lúc vừa bỏ đánh dấu.',
    })
    markPopFromScale = 0.4;

    @property({ tooltip: 'Đánh dấu (Mark): thời gian hiệu ứng scale + mờ/đậm (giây) — dùng cho cả lúc đặt và lúc bỏ.' })
    markPopSeconds = 0.22;


    @property({
        tooltip:
            'BẬT: code tô màu icon theo 3 màu dưới — dùng khi sprite là ảnh trắng/đơn sắc. ' +
            'TẮT: giữ nguyên màu gốc của sprite — dùng khi sprite của bạn đã có màu sẵn.',
    })
    tintIcon = true;

    @property({ visible(this: CellView) { return this.tintIcon; }, tooltip: 'Màu icon Dog' })
    dogColor: Color = new Color(255, 255, 255);

    @property({ visible(this: CellView) { return this.tintIcon; }, tooltip: 'Màu dấu X ghi chú' })
    markColor: Color = new Color(255, 255, 255);


    @property({ visible(this: CellView) { return this.tintIcon; }, tooltip: 'Màu đánh dấu sai' })
    wrongMarkColor: Color = new Color(255, 40, 40);

    @property({
        range: [0.3, 1, 0.01],
        slide: true,
        tooltip: 'Con chó chiếm bao nhiêu phần cạnh ô.',
    })
    dogSizeRatio = 0.9;

    @property({
        range: [0.3, 1, 0.01],
        slide: true,
        tooltip: 'Dấu X (Mark và Wrong Mark) chiếm bao nhiêu phần cạnh ô.',
    })
    markSizeRatio = 0.7;

    @property({
        type: Node,
        tooltip:
            'Sprite chim cánh cụt TĨNH (không animation) — CHỈ hiện khi RESUME ván đang chơi ' +
            'dở và ô này đã có sẵn chó, thay cho việc tạo/chạy DogView animation. Ẩn sẵn; ' +
            'script tự bật/tắt. Nếu người chơi thắng/thua sau đó, tự động chuyển sang DogView ' +
            'thật để chạy animation ăn mừng/buồn (script tự lo, không cần làm gì thêm).',
    })
    staticDogSprite: Node | null = null;

    private usingStaticDog = false;

    cellIndex = -1;

    private transform: UITransform | null = null;

    private visualSize = 0;
    private placeDogParticleBaseScale: Vec3 | null = null;

    private iconOpacity: UIOpacity | null = null;
    private markSpineOpacity: UIOpacity | null = null;
    private goldBorderOpacity: UIOpacity | null = null;
    private waveOverlayOpacity: UIOpacity | null = null;

    private state: CellState = CellState.Empty;
    private locked = false;


    private highlighted = false;
    private pressed = false;

    private readonly localPos = new Vec3();

    private spineProvider: DogSpineProvider | null = null;

    /** Nhớ cha gốc của node đã bị "nâng lên trên lớp chó" tạm thời, để trả lại đúng chỗ. */
    private readonly dogRaisedHomeParents = new Map<Node, Node>();
    private dogSpine: DogView | null = null;

    /** Sibling index GỐC của CHÍNH node ô này trước khi bị raiseCellAboveNeighbors() đẩy lên
     * cuối danh sách (vẽ trên cùng) — null nghĩa là đang KHÔNG bị nâng. */
    private cellSiblingIndexBeforeRaise: number | null = null;

    /** MỌI ô đang có mèo (state Dog) — luôn phải vẽ TRÊN CÙNG các ô khác, kể cả khi sóng
     * (playWaveVisit) đi qua ô lân cận và nâng/hạ ô đó (xem retopDogs). */
    private static readonly poppingDogCells = new Set<CellView>();

    private readonly scaleTarget = new Vec3();

    private static readonly TEMP_POS = new Vec3();

    onLoad(): void {
        this.transform = this.getComponent(UITransform);

        const missing: string[] = [];
        if (!this.background) missing.push('background (kéo node Background vào)');
        if (!this.icon) missing.push('icon (kéo node Icon vào)');
        // Có Spine thì cả Mark/WrongMark đều được render bằng Spine trong setState().
        // Chỉ bắt buộc sprite dự phòng khi không gán Spine, tránh dừng onLoad trước khi setup hiệu ứng.
        if (!this.markSpine) {
            if (!this.markSprite) missing.push('markSprite (hoặc gán markSpine)');
            if (!this.wrongMarkSprite) missing.push('wrongMarkSprite (hoặc gán markSpine)');
        }

        if (missing.length > 0) {
            throw new Error(
                `[CellView] Cell.prefab chưa cấu hình đủ:\n  - ${missing.join('\n  - ')}`,
            );
        }

        const iconNode = this.icon.node;
        this.iconOpacity = iconNode.getComponent(UIOpacity) ?? iconNode.addComponent(UIOpacity);

        if (this.goldBorder) {
            const borderNode = this.goldBorder.node;
            this.goldBorderOpacity = borderNode.getComponent(UIOpacity) ?? borderNode.addComponent(UIOpacity);
            borderNode.active = false;
        }

        if (this.waveOverlay) {
            const waveNode = this.waveOverlay.node;
            this.waveOverlayOpacity = waveNode.getComponent(UIOpacity) ?? waveNode.addComponent(UIOpacity);
            waveNode.active = false;
        }
        // LOG TẠM ĐỂ DEBUG — xoá sau khi tìm ra nguyên nhân viền vàng của sóng không hiện.
        if (this.debugEffects) console.log('[CellView.onLoad] waveOverlay setup', {
            hasWaveOverlay: !!this.waveOverlay,
            hasOpacity: !!this.waveOverlayOpacity,
            waveOverlayNodeName: this.waveOverlay?.node?.name,
            waveOverlayNodeUuid: this.waveOverlay?.node?.uuid,
        });

        // cc.ParticleSystem mặc định playOnAwake=true — nếu KHÔNG tắt node ngay từ đây, particle
        // sẽ tự bắn NGAY LÚC ô vừa được tạo/kích hoạt (tức MỌI ô trên board, đồng loạt, ngay lúc
        // vừa vào màn), chứ không đợi playPlaceDogParticle() gọi tới (bug đã gặp).
        if (this.placeDogParticle) this.placeDogParticle.node.active = false;
        // LOG TẠM ĐỂ DEBUG — xoá sau khi tìm ra nguyên nhân particle đặt mèo không hiện. Log này
        // CHẠY SAU waveOverlay ở trên — nếu log waveOverlay bên trên hiện ra nhưng log này KHÔNG
        // bao giờ chạy, nghĩa là có exception ném ra giữa chừng trong onLoad() (rất có thể đúng
        // nguyên nhân của CẢ 2 bug — sóng lẫn particle — cùng lúc).
        if (this.debugEffects) console.log('[CellView.onLoad] placeDogParticle setup', {
            hasParticle: !!this.placeDogParticle,
            particleNodeActive: this.placeDogParticle?.node?.active,
            particleNodeName: this.placeDogParticle?.node?.name,
        });
    }


    attachSpineProvider(provider: DogSpineProvider | null): void {
        this.spineProvider = provider;
    }

 
    bind(
        cellIndex: number,
        row: number,
        col: number,
        size: number,
        regionColor: Color | null,
        state: CellState,
        locked: boolean,
        boardSize: number,
    ): void {
        this.cellIndex = cellIndex;


        Tween.stopAllByTarget(this.node);
        this.node.setScale(1, 1, 1);

        const visual = size * CELL_FILL_RATIO;
        this.visualSize = visual;

        if (this.transform) {
            this.transform.setContentSize(size, size);
        }
        this.resizeChild(this.background.node, visual);
        if (this.lockedOverlay) {
            this.resizeChild(this.lockedOverlay, visual);
        }
        if (this.goldBorder) {
            this.resizeChild(this.goldBorder.node, visual);
        }
        if (this.staticDogSprite) {
            this.resizeChild(this.staticDogSprite, visual * this.dogSizeRatio);
        }
        if (this.placeDogParticle) {
            // Giữ scale đã tune trong prefab; cache một lần để tái sử dụng ô không nhân dồn scale.
            const particleNode = this.placeDogParticle.node;
            const baseScale = this.placeDogParticleBaseScale ??= particleNode.scale.clone();
            const particleScale = this.placeDogParticleDesignSize > 0
                ? visual / this.placeDogParticleDesignSize
                : 1;
            particleNode.setScale(
                baseScale.x * particleScale,
                baseScale.y * particleScale,
                baseScale.z * particleScale,
            );
        }
        // Build/rebuild lại ô (kể cả reuse từ pool) LUÔN tắt viền vàng trước — chỉ
        // TutorialController mới được bật lại đúng ô cần dạy.
        this.setGoldBorder(false);
        this.usingStaticDog = false;
        if (this.staticDogSprite) this.staticDogSprite.active = false;
        // Build/rebuild lại ô LUÔN tắt sóng trước — phòng hờ, KHÔNG chỉ dựa vào onLoad() (chỉ
        // chạy 1 LẦN lúc node vừa tạo, không chạy lại khi ô này được tái sử dụng từ pool cho
        // puzzle mới) hay lúc tween trước đó lỡ bị ngắt giữa chừng chưa kịp tự ẩn.
        this.hideWaveOverlay();
        this.unschedule(this.hidePlaceDogParticle);
        this.hidePlaceDogParticle();

        const half = (boardSize * size) / 2;
        CellView.TEMP_POS.set(
            col * size - half + size / 2,
            half - row * size - size / 2,
            0,
        );
        this.node.setPosition(CellView.TEMP_POS);
        this.localPos.set(CellView.TEMP_POS);

        // Không còn 12 sprite riêng — background dùng 1 sprite trắng cố định (gán sẵn trong
        // Cell.prefab), tô màu vùng bằng regionColor (bảng RegionColors của BoardView).
        this.background.color = regionColor ?? Color.WHITE;

        this.pressed = false;
        this.setState(state);
        this.setLocked(locked);
        this.setHighlighted(false);
    }


    recycle(): void {
        this.dogPopPlaying = false;
        this.unschedule(this.showWrongMarkSpine);
        this.hideMarkSpines();
        this.releaseSpine();
        this.pressed = false;
        this.highlighted = false;
        this.setGoldBorder(false);
        this.usingStaticDog = false;
        if (this.staticDogSprite) this.staticDogSprite.active = false;
        this.hideWaveOverlay();
        this.unschedule(this.hidePlaceDogParticle);
        this.hidePlaceDogParticle();
        // Không setSiblingIndex ở đây — pool.put()/acquireCell() tự tháo/gắn lại node vào
        // cellContainer (tự có sibling index mới đúng vị trí), chỉ cần xoá cờ để lần dùng SAU
        // không lỡ gọi restoreCellSiblingIndex() với chỉ số CŨ (của puzzle trước, đã sai nghĩa).
        this.cellSiblingIndexBeforeRaise = null;
        CellView.poppingDogCells.delete(this);
    }

    /** Tắt NGAY waveOverlay (huỷ tween dở, nếu có) — gọi ở onLoad() (mặc định ẩn) VÀ recycle()
     * (ô được lấy lại từ pool cho ô khác — không được để sót trạng thái "đang hiện" dở dang từ
     * lần dùng trước, kể cả khi playWaveVisit() bị ngắt giữa chừng vì lý do gì đó). */
    private hideWaveOverlay(): void {
        if (!this.waveOverlay?.isValid) return;
        const node = this.waveOverlay.node;
        Tween.stopAllByTarget(node);
        if (this.waveOverlayOpacity) Tween.stopAllByTarget(this.waveOverlayOpacity);
        node.active = false;
    }

    onDestroy(): void {
        CellView.poppingDogCells.delete(this);
        this.releaseSpine();
        if (this.goldBorderOpacity?.isValid) Tween.stopAllByTarget(this.goldBorderOpacity);
    }


    /** Co node con vừa `size` (cạnh dài nhất) — GIỮ ĐÚNG tỉ lệ khung hình gốc của spriteFrame
     * thay vì ép cứng thành hình vuông (size×size). Sprite chữ nhật (vd icon mèo không vuông)
     * mà set contentSize vuông sẽ bị KÉO MÉO — cùng bug đã gặp và fix ở HintController.
     * showPreviewSprite()/BoardView.spawnLateMarkHintEffect(). Gọi SAU KHI đã gán spriteFrame. */
    private resizeChild(node: Node, size: number): void {
        const transform = node.getComponent(UITransform);
        const sprite = node.getComponent(Sprite);
        if (sprite) sprite.sizeMode = Sprite.SizeMode.CUSTOM;

        if (transform) {
            const rect = sprite?.spriteFrame?.rect;
            const width = rect?.width ?? 0;
            const height = rect?.height ?? 0;
            if (width > 0 && height > 0) {
                const fitScale = size / Math.max(width, height);
                transform.setContentSize(width * fitScale, height * fitScale);
            } else {
                transform.setContentSize(size, size);
            }
        }

        node.setPosition(0, 0, 0);
    }

   
    setState(state: CellState, animate = false, onDogSettled?: () => void): void {
        // LOG TẠM ĐỂ DEBUG — bug "đánh dấu lần đầu trong tut bị lag, phải ấn lại". Xoá sau khi
        // tìm ra nguyên nhân.
        if (state === CellState.Mark) {
            if (this.debugEffects) console.log('[CellView.setState] gọi Mark', { cellIndex: this.cellIndex, animate, prevState: this.state });
        }
        const iconNode = this.icon.node;
        const wasVisible = iconNode.active;
        const markSpineWasVisible = this.markSpine?.node.active ?? false;

        this.state = state;


        if (this.pressed && !this.pressable) {
            this.pressed = false;
            this.applyScale();
        }

        // Tween đặt mèo (kèm .call dọn dẹp) bị huỷ ngay dưới — tự dọn cờ "đang phóng to" ở đây,
        // không thì ô kẹt ở trạng thái đã nâng. poppingDogCells giờ chứa MỌI ô đang là mèo (không
        // chỉ lúc pop-in) — cập nhật theo state mới ngay tại đây.
        if (state === CellState.Dog) CellView.poppingDogCells.add(this);
        else CellView.poppingDogCells.delete(this);
        this.restoreCellSiblingIndex();
        Tween.stopAllByTarget(iconNode);
        this.dogPopPlaying = false;
        if (this.iconOpacity) Tween.stopAllByTarget(this.iconOpacity);
        iconNode.setPosition(0, 0, 0);
        iconNode.setScale(1, 1, 1);

        if (state !== CellState.Dog) {
            this.releaseSpine();
            // Sprite chim cánh cụt TĨNH (showStaticDog(), dùng khi resume ván chơi dở) chỉ
            // được BoardView bật cho đúng lúc bind() — không thứ gì tự tắt nó khi cell đổi
            // sang trạng thái khác (ví dụ bấm Restart) nếu không xử lý ở đây, nên sprite cũ
            // vẫn treo lại trên ô dù state đã về Empty.
            this.hideStaticDog();
        }

        // Mọi lần đổi trạng thái đều dọn dấu X / trái tim của trạng thái trước. Trái tim
        // luôn tắt ngay; riêng dấu X (mark) đúng — CHỈ khi người chơi TỰ BỎ đánh dấu (Mark →
        // Empty, có animate) thì tắt CÓ hiệu ứng thu nhỏ + mờ dần, mọi trường hợp khác tắt
        // NGAY LẬP TỨC. Đặc biệt QUAN TRỌNG với Mark → Dog (đặt mèo vào đúng ô đã lỡ đánh dấu
        // X trước đó) — nếu vẫn dùng hiệu ứng mờ dần 0.22s ở đây, dấu X (markSpine, node RIÊNG
        // với icon) sẽ chồng lên hiệu ứng pop-in của mèo đang chạy CÙNG LÚC, trông như "X đè
        // lên mèo" (bug đã gặp).
        this.unschedule(this.showWrongMarkSpine);
        if (this.heartSpine) {
            this.heartSpine.node.active = false;
            this.restoreFromDogLayer(this.heartSpine.node);
        }

        const shouldAnimateMarkExit = animate && markSpineWasVisible && state === CellState.Empty;
        if (shouldAnimateMarkExit) {
            this.playMarkSpineExit();
        } else if (this.markSpine) {
            Tween.stopAllByTarget(this.markSpine.node);
            if (this.markSpineOpacity) {
                Tween.stopAllByTarget(this.markSpineOpacity);
                this.markSpineOpacity.opacity = 255; // dừng giữa chừng thì trả về ĐẬM hẳn, không giữ dở dang
            }
            this.markSpine.node.active = false;
            this.restoreFromDogLayer(this.markSpine.node);
        }

        // Có gán spine icon_X thì dùng spine thay cho ảnh tĩnh.
        if (state === CellState.Mark && this.markSpine) {
            iconNode.active = false;
            this.playMarkSpineCorrect(animate);
            return;
        }
        if (state === CellState.WrongMark && this.markSpine) {
            iconNode.active = false;
            if (animate) {
                this.playWrongSequence();
            } else {
                // Khôi phục màn đang chơi dở (resume/tải lại): hiện thẳng khung X đỏ,
                // KHÔNG phát lại hiệu ứng tim vỡ như lúc vừa đặt sai.
                this.showWrongMarkIdleOnly();
            }
            return;
        }

        if (state === CellState.Empty) {
            if (animate && wasVisible && this.iconOpacity) {
                this.playVanish();
            } else {
                iconNode.active = false;
                if (this.iconOpacity) this.iconOpacity.opacity = 255;
            }
            return;
        }

        if (state === CellState.Dog && this.showDogSpine(animate, onDogSettled)) {
            iconNode.active = false;
            if (this.iconOpacity) this.iconOpacity.opacity = 255;
            return;
        }

        if (this.iconOpacity) this.iconOpacity.opacity = 255;

        let ratio = this.markSizeRatio;

        switch (state) {
            case CellState.Mark:
                this.icon.spriteFrame = this.markSprite;
                if (this.tintIcon) this.icon.color = this.markColor;
                ratio = this.markSizeRatio;
                break;

            case CellState.Dog:
                this.icon.spriteFrame = this.dogSprite;
                if (this.tintIcon) this.icon.color = this.dogColor;
                ratio = this.dogSizeRatio;
                break;

            case CellState.WrongMark:
                this.icon.spriteFrame = this.wrongMarkSprite;
                if (this.tintIcon) this.icon.color = this.wrongMarkColor;
                ratio = this.markSizeRatio;
                break;
        }

        this.resizeChild(iconNode, this.visualSize * ratio);


        if (!this.tintIcon) this.icon.color = Color.WHITE;

        iconNode.active = true;

        // showDogSpine() ở trên trả false khi spineProvider trống (BoardView.dogSpinePrefab để
        // trống — dùng sprite chó TĨNH, không Spine) nên rơi xuống đây, KHÔNG còn cơ hội nào khác
        // gọi onDogSettled — nếu bỏ sót, mọi thứ đợi DOG_SETTLED_EVENT (vd TutorialController bước
        // PlaceDog2 chờ đúng sự kiện này mới sang bước kế) sẽ ĐỨNG HÌNH VĨNH VIỄN. Có animate thì
        // đợi hiệu ứng phồng-to (playPlaceEffect) chạy xong hẳn mới gọi, giống hệt thời điểm
        // playAppear(onSettled) gọi ở nhánh Spine; không animate (khôi phục ván dở) thì gọi NGAY.
        if (animate) {
            this.playPlaceEffect(state, state === CellState.Dog ? onDogSettled : undefined);
        } else if (state === CellState.Dog) {
            onDogSettled?.();
        }
    }

 
    private showDogSpine(animate: boolean, onSettled?: () => void): boolean {
        if (!this.spineProvider) return false;

        if (!this.dogSpine) {
            this.dogSpine = this.spineProvider.acquire(
                this.localPos,
                this.visualSize * this.dogSizeRatio,
            );
        }

        if (animate) {
            this.dogSpine.playAppear(onSettled);
        } else {
            this.dogSpine.playIdle();
        }
        return true;
    }

    /** Ẩn NGAY (không hiệu ứng) cả spine dấu X lẫn trái tim — dùng lúc thu hồi ô về pool. */
    private hideMarkSpines(): void {
        if (this.markSpine) {
            Tween.stopAllByTarget(this.markSpine.node);
            if (this.markSpineOpacity) {
                Tween.stopAllByTarget(this.markSpineOpacity);
                this.markSpineOpacity.opacity = 255;
            }
            this.markSpine.node.active = false;
            this.restoreFromDogLayer(this.markSpine.node);
        }
        if (this.heartSpine) {
            this.heartSpine.node.active = false;
            this.restoreFromDogLayer(this.heartSpine.node);
        }
    }

    private playMarkSpine(appear: string, idle: string): void {
        const spine = this.markSpine;
        if (!spine) return;

        this.applySpineScale(spine.node, this.markSpineDesignSize);
        this.resetMarkSpineOpacity(spine.node);

        spine.node.active = true;
        spine.premultipliedAlpha = true;
        spine.setAnimation(SPINE_TRACK, appear, false);
        spine.addAnimation(SPINE_TRACK, idle, true);

        // Dấu X đặt sai vừa kích hoạt SAU (chó đã đặt trước đó) — nổi lên trên lớp chó.
        this.raiseAboveDogLayer(spine.node);
    }

    /** Ép opacity dấu X về ĐẬM HẲN (255) — phòng khi còn dở dang từ lần dùng trước (node bị pool). */
    private resetMarkSpineOpacity(node: Node): void {
        Tween.stopAllByTarget(node);
        const opacity = this.resolveMarkSpineOpacity(node);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;
    }

    private resolveMarkSpineOpacity(node: Node): UIOpacity {
        if (!this.markSpineOpacity || !this.markSpineOpacity.isValid) {
            this.markSpineOpacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        }
        return this.markSpineOpacity;
    }

    /**
     * Đặt dấu ĐÚNG (Mark): chạy animation spine như cũ, cộng thêm hiệu ứng scale nhỏ→lớn
     * + mờ→đậm đè lên trên. `animate=false` (khôi phục ván chơi dở) thì hiện thẳng, không
     * hiệu ứng — giống quy ước của playAppear/playRevealAppear bên chó.
     */
    private playMarkSpineCorrect(animate: boolean): void {
        const spine = this.markSpine;
        // LOG TẠM ĐỂ DEBUG — bug "đánh dấu lần đầu trong tut bị lag, phải ấn lại". Xoá sau khi
        // tìm ra nguyên nhân.
        if (this.debugEffects) console.log('[CellView.playMarkSpineCorrect] gọi', {
            cellIndex: this.cellIndex, animate, hasSpine: !!spine,
            spineNodeActive: spine?.node?.active, spineValid: spine?.node?.isValid,
        });
        if (!spine) return;

        this.applySpineScale(spine.node, this.markSpineDesignSize);
        const finalScale = new Vec3(spine.node.scale.x, spine.node.scale.y, 1);

        spine.node.active = true;
        spine.premultipliedAlpha = true;

        if (!animate) {
            // Resume/khôi phục ván chơi dở — KHÔNG chạy animation Active_correct, hiện
            // thẳng Idle theo đúng ô, giống quy ước showWrongMarkIdleOnly() bên dưới.
            spine.setAnimation(SPINE_TRACK, MARK_ANIM_IDLE, true);
            this.resetMarkSpineOpacity(spine.node);
            return;
        }

        spine.setAnimation(SPINE_TRACK, MARK_ANIM_APPEAR, false);
        spine.addAnimation(SPINE_TRACK, MARK_ANIM_IDLE, true);

        const opacity = this.resolveMarkSpineOpacity(spine.node);
        Tween.stopAllByTarget(spine.node);
        Tween.stopAllByTarget(opacity);

        spine.node.setScale(finalScale.x * this.markPopFromScale, finalScale.y * this.markPopFromScale, 1);
        opacity.opacity = 0;

        // LOG TẠM ĐỂ DEBUG — xác nhận tween thật sự start() được gọi + giá trị scale trước/sau.
        if (this.debugEffects) console.log('[CellView.playMarkSpineCorrect] bắt đầu tween scale', {
            cellIndex: this.cellIndex,
            fromScale: { x: finalScale.x * this.markPopFromScale, y: finalScale.y * this.markPopFromScale },
            toScale: { x: finalScale.x, y: finalScale.y },
            markPopSeconds: this.markPopSeconds,
        });
        tween(spine.node)
            .to(this.markPopSeconds, { scale: finalScale }, { easing: 'backOut' })
            .call(() => {
                if (this.debugEffects) console.log('[CellView.playMarkSpineCorrect] tween scale XONG', { cellIndex: this.cellIndex, finalScale: spine.node.scale });
            })
            .start();
        tween(opacity).to(this.markPopSeconds, { opacity: 255 }).start();
    }

    /** Bỏ đánh dấu: thu nhỏ dần + mờ dần rồi mới thực sự ẩn — ngược lại của playMarkSpineCorrect. */
    private playMarkSpineExit(): void {
        const spine = this.markSpine;
        if (!spine) return;

        const node = spine.node;
        const finalScale = new Vec3(node.scale.x, node.scale.y, 1);
        const shrink = new Vec3(finalScale.x * this.markPopFromScale, finalScale.y * this.markPopFromScale, 1);
        const opacity = this.resolveMarkSpineOpacity(node);

        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;

        tween(node).to(this.markPopSeconds, { scale: shrink }, { easing: 'quadIn' }).start();
        tween(opacity)
            .to(this.markPopSeconds, { opacity: 0 })
            .call(() => {
                node.active = false;
                node.setScale(finalScale);
                opacity.opacity = 255;
                this.restoreFromDogLayer(node);
            })
            .start();
    }

    /** Hiện thẳng khung Idle của X đỏ, không tim vỡ, không animation Active. */
    private showWrongMarkIdleOnly(): void {
        const spine = this.markSpine;
        if (!spine) return;

        this.applySpineScale(spine.node, this.markSpineDesignSize);
        this.resetMarkSpineOpacity(spine.node);
        spine.node.active = true;
        spine.premultipliedAlpha = true;
        spine.setAnimation(SPINE_TRACK, WRONG_ANIM_IDLE, true);
        this.raiseAboveDogLayer(spine.node);
    }

    /** Đặt sai: trái tim nháy lên trước, hết `heartLeadSeconds` mới hiện X đỏ. */
    private playWrongSequence(): void {
        if (!this.heartSpine) {
            this.showWrongMarkSpine();
            return;
        }

        this.applySpineScale(this.heartSpine.node, this.heartSpineDesignSize);

        this.heartSpine.node.active = true;
        this.heartSpine.premultipliedAlpha = true;
        this.heartSpine.setAnimation(SPINE_TRACK, HEART_ANIM_APPEAR, false);

        // Trái tim vừa kích hoạt SAU (chó đã đặt trước đó) — nổi lên trên lớp chó.
        this.raiseAboveDogLayer(this.heartSpine.node);

        this.scheduleOnce(this.showWrongMarkSpine, this.heartLeadSeconds);
    }

    /**
     * Co node spine (icon_X / icon_heart) cho vừa markSizeRatio × cạnh ô — CÙNG công
     * thức với nhánh ảnh tĩnh (resizeChild). Không có bước này thì spine luôn giữ
     * scale gốc cố định, không theo kích thước ô (ô to thì X nhỏ, ô nhỏ thì X to).
     */
    private applySpineScale(node: Node, designSize: number): void {
        const target = this.visualSize * this.markSizeRatio;
        const scale = designSize > 0 ? target / designSize : 1;
        node.setScale(scale, scale, 1);
    }

    /**
     * Nâng `node` (trái tim / dấu X) lên trên TOÀN BỘ lớp chó — dùng khi nó vừa được kích
     * hoạt SAU một con chó đã đặt, để không bị con chó (ở ô lân cận, ảnh tràn ra ngoài ô)
     * che mất. Nhớ lại cha gốc để restoreFromDogLayer() trả về đúng chỗ sau đó.
     *
     * BUG ĐÃ SỬA: cơ chế qua spineProvider.raiseAboveDogs() CHỈ hoạt động khi có Spine chó thật
     * (BoardView.dogSpineReady — cần dogSpinePrefab đã gán). Dự án hiện dùng sprite mèo TĨNH
     * (dogSpinePrefab để trống trong Board.prefab), nên spineProvider LUÔN null — hàm này trước
     * đây LUÔN no-op, trái tim/X không bao giờ thực sự nổi lên, trong khi ô mèo đúng kề bên (đã
     * được raiseCellAboveNeighbors() nâng lúc đặt mèo, giữ NGUYÊN vĩnh viễn — xem
     * restoreCellSiblingIndex()) vẫn đè lên (đúng bug đã báo, kèm ảnh). Rơi về ĐÚNG cơ chế nâng
     * CẢ Ô (raiseCellAboveNeighbors — luôn hoạt động, không phụ thuộc Spine) khi không có
     * spineProvider — đúng nguyên tắc "kích hoạt SAU thì nổi lên trên".
     */
    private raiseAboveDogLayer(node: Node): void {
        if (!this.spineProvider) {
            // raiseCellAboveNeighbors() KHÔNG dùng được ở đây — retopDogs() của nó tự đẩy ngay
            // mọi ô đang có mèo lên trên cùng lại, phản tác dụng với chính việc nâng ô này. Dùng
            // raiseCellAboveEverything() (không gọi retopDogs()) để thật sự vượt qua cả ô mèo.
            this.raiseCellAboveEverything();
            return;
        }
        if (!this.dogRaisedHomeParents.has(node)) {
            const home = node.parent;
            if (home) this.dogRaisedHomeParents.set(node, home);
        }
        this.spineProvider.raiseAboveDogs(node, this.node);
    }

    /** Trả `node` về đúng cha gốc trước khi bị raiseAboveDogLayer() nâng lên (nếu có). */
    private restoreFromDogLayer(node: Node): void {
        if (!this.spineProvider) {
            this.restoreCellSiblingIndex();
            return;
        }
        const home = this.dogRaisedHomeParents.get(node);
        if (home?.isValid && node.isValid && node.parent !== home) {
            node.setParent(home, true);
        }
    }

    /**
     * Đẩy CHÍNH node ô này (this.node) ra CUỐI danh sách con của cha (cellContainer) — vẽ TRÊN
     * CÙNG mọi ô khác — dùng khi icon của ô đang phóng to VƯỢT khỏi biên ô (đặt mèo/hiệu ứng
     * sóng), tránh bị ô lân cận (vẽ SAU trong cellContainer, index lớn hơn) đè lên phần tràn ra.
     * KHÁC raiseAboveDogLayer() (chỉ nâng 1 node con qua spineProvider, phụ thuộc dogSpinePrefab
     * đã gán hay chưa) — đổi thẳng sibling index của CHÍNH ô, không phụ thuộc gì cả, luôn hoạt
     * động kể cả ở chế độ sprite tĩnh (không Spine) hiện tại của dự án.
     */
    /** Bắn particle đặt mèo (nếu có gán) — dừng/xoá particle CŨ trước (phòng bắn liên tiếp quá
     * nhanh) rồi phát lại từ đầu. Tự ẩn sau placeDogParticleHideSeconds làm lưới an toàn. */
    private playPlaceDogParticle(): void {
        const particle = this.placeDogParticle;
        // LOG TẠM ĐỂ DEBUG — xoá sau khi tìm ra nguyên nhân particle đặt mèo không hiện.
        if (this.debugEffects) console.log('[CellView.playPlaceDogParticle] gọi', {
            cellIndex: this.cellIndex,
            hasParticle: !!particle,
            nodeActiveBefore: particle?.node?.active,
            nodeValid: particle?.node?.isValid,
        });
        if (!particle) return;

        this.unschedule(this.hidePlaceDogParticle);
        particle.node.active = true;
        particle.stop();
        particle.clear();
        particle.play();
        this.scheduleOnce(this.hidePlaceDogParticle, this.placeDogParticleHideSeconds);
    }

    private hidePlaceDogParticle = (): void => {
        const particle = this.placeDogParticle;
        if (!particle?.node.isValid) return;

        particle.stop();
        particle.clear();
        particle.node.active = false;
    };

    private raiseCellAboveNeighbors(): void {
        if (this.cellSiblingIndexBeforeRaise === null) {
            this.cellSiblingIndexBeforeRaise = this.node.getSiblingIndex();
        }
        this.node.setSiblingIndex(-1);
        CellView.retopDogs();
    }

    /** Nâng CHÍNH ô này lên trên cùng TUYỆT ĐỐI — KHÁC raiseCellAboveNeighbors() ở chỗ KHÔNG gọi
     * retopDogs() sau đó. Dùng cho ô KHÔNG PHẢI mèo nhưng cần nổi lên trên MỌI ô khác (kể cả ô
     * đang có mèo) ngay lúc này — ví dụ trái tim/X đặt sai, kích hoạt SAU 1 con mèo đã đặt ở ô
     * lân cận (xem raiseAboveDogLayer()). Gọi raiseCellAboveNeighbors() ở trường hợp này sẽ tự
     * phản tác dụng: retopDogs() của chính nó đẩy NGAY mọi ô đang có mèo lên trên cùng lại, huỷ
     * luôn kết quả vừa nâng (đúng bug đã báo "trái tim vẫn bị node trên đè lên"). */
    private raiseCellAboveEverything(): void {
        if (this.cellSiblingIndexBeforeRaise === null) {
            this.cellSiblingIndexBeforeRaise = this.node.getSiblingIndex();
        }
        this.node.setSiblingIndex(-1);
    }

    /** Đẩy TOÀN BỘ ô đang có mèo lên cuối danh sách (trên cùng) — mèo LUÔN vẽ trên mọi ô khác,
     * bất kể ô lân cận nào đang được nâng lên/hạ xuống bởi sóng/pop (gọi sau MỖI lần nâng/hạ). */
    private static retopDogs(): void {
        const byParent = new Map<Node, Node[]>();
        for (const cell of CellView.poppingDogCells) {
            // Ô đã bị huỷ (đổi màn/scene, component.node = null) mà chưa kịp gỡ khỏi set tĩnh —
            // bỏ luôn ở đây thay vì crash "Cannot read properties of null (reading 'isValid')".
            if (!cell.isValid || !cell.node?.isValid) {
                CellView.poppingDogCells.delete(cell);
                continue;
            }
            const parent = cell.node.parent;
            if (!parent) continue;
            const nodes = byParent.get(parent) ?? [];
            nodes.push(cell.node);
            byParent.set(parent, nodes);
        }
        for (const [parent, nodes] of byParent) {
            // Đi từ cuối lên để giữ nguyên thứ tự mèo, không xáo lại cả nhóm mỗi lần.
            for (let i = nodes.length - 1; i >= 0; i--) {
                const index = parent.children.length - nodes.length + i;
                if (nodes[i].getSiblingIndex() !== index) nodes[i].setSiblingIndex(index);
            }
        }
    }

    /** Trả CHÍNH node ô này về sibling index gốc trước khi bị raiseCellAboveNeighbors() nâng lên.
     * Ô đang có MÈO thì KHÔNG trả về (ở lại trên cùng vĩnh viễn — mèo luôn nằm trên ô khác), chỉ
     * xoá cờ. Sau khi hạ ô thường xuống, retopDogs() đảm bảo mèo vẫn ở trên cùng (chỉ số cũ đã
     * lưu có thể lệch sau nhiều lần nâng/hạ chồng nhau). */
    private restoreCellSiblingIndex(): void {
        const index = this.cellSiblingIndexBeforeRaise;
        this.cellSiblingIndexBeforeRaise = null;
        if (index !== null && this.node.isValid && this.state !== CellState.Dog) {
            this.node.setSiblingIndex(index);
        }
        CellView.retopDogs();
    }

    private showWrongMarkSpine = (): void => {
        if (this.heartSpine) {
            this.heartSpine.node.active = false;
            this.restoreFromDogLayer(this.heartSpine.node);
        }
        this.playMarkSpine(WRONG_ANIM_APPEAR, WRONG_ANIM_IDLE);
    };

    private releaseSpine(): void {
        if (!this.dogSpine) return;

        this.spineProvider?.release(this.dogSpine);
        this.dogSpine = null;
    }

    /** Node hiển thị con chó/chim cánh cụt đang đứng trong ô này (nếu có). */
    getDogNode(): Node | null {
        return this.dogSpine?.node ?? null;
    }

 
    setDogVisible(visible: boolean): void {
        if (this.dogSpine) this.dogSpine.node.active = visible;
    }

    /** Board vừa dựng xong (vào màn MỚI) — ô đã có sẵn chó, KHÔNG phải vừa đặt. */
    playDogAppear(): void {
        if (!this.dogSpine) return;

        this.dogSpine.node.active = true;
        this.dogSpine.playRevealAppear();
    }

    /**
     * RESUME ván đang chơi dở: hiện sprite chim cánh cụt TĨNH thay cho DogView — DogView
     * thật (đã tạo sẵn từ bind()/setState(), luôn có nếu ô này là Dog) tiếp tục nằm ẩn,
     * KHÔNG chạy animation gì. Chỉ hiện lại DogView thật nếu sau này cần chạy animation
     * cảm xúc (frustrated/cry/celebrate) — xem ensureRealDogSpine().
     */
    showStaticDog(): void {
        if (!this.staticDogSprite) return;
        this.usingStaticDog = true;
        this.staticDogSprite.active = true;
    }

    private hideStaticDog(): void {
        if (!this.usingStaticDog) return;
        this.usingStaticDog = false;
        if (this.staticDogSprite) this.staticDogSprite.active = false;
    }

    /**
     * Đang hiện sprite tĩnh (resume) mà cần chạy animation cảm xúc thật — tạo/hiện DogView
     * (không animation, đứng Idle) rồi ẩn sprite tĩnh đi, để lệnh emotion gọi NGAY sau đó
     * chạy đúng trên DogView thật. Trả về false nếu ô này vốn không có chó.
     */
    private ensureRealDogSpine(): boolean {
        if (!this.dogSpine) {
            if (this.state !== CellState.Dog) return false;
            if (!this.showDogSpine(false)) return false;
        }

        // dogSpine (nếu resume) đã được tạo sẵn từ bind()/setState() nhưng node đang ẩn
        // (đứng sau sprite tĩnh) — bật lại để animation cảm xúc sắp gọi chạy đúng chỗ.
        this.dogSpine!.node.active = true;
        this.hideStaticDog();
        return true;
    }

    playDogFrustrated(): void {
        if (this.ensureRealDogSpine()) this.dogSpine?.playFrustrated();
    }


    playDogCry(): void {
        if (this.ensureRealDogSpine()) this.dogSpine?.playCry();
    }


    playDogCelebrate(): void {
        if (this.ensureRealDogSpine()) this.dogSpine?.playCelebrate();
    }

    /** Áp LẠI hiệu ứng "vừa đặt mèo" (phồng to → đập xuống + particle, playPlaceEffect) lên CHÍNH
     * ô này — dùng để ăn mừng lúc đặt xong con mèo CUỐI CÙNG của màn (BoardView.celebrateDogs()),
     * CHỈ chạy nếu ô đang thực sự có mèo. Đây là hiệu ứng THẬT trên sprite tĩnh (particle + scale);
     * khác playDogCelebrate() ở trên (CHỈ chạy khi có Spine thật — dự án hiện dùng sprite chó
     * TĨNH, dogSpinePrefab để trống, nên playDogCelebrate() luôn no-op, xem ensureRealDogSpine()). */
    private dogPopPlaying = false;

    replayPlaceDogEffect(): void {
        // Khi đặt liên tục, các mèo trước cũng còn tween đặt. Không cắt tween và
        // callback onSettled của chúng để phát lại từ scale nhỏ lúc thắng màn.
        if (this.state !== CellState.Dog || this.dogPopPlaying) return;
        // spawnParticle=false — hiệu ứng ăn mừng CHỈ áp dụng phần phồng to/đập xuống của mèo, KHÔNG
        // bắn lại particle đặt mèo (đã bắn đúng 1 lần lúc đặt thật, bắn lại hàng loạt trông rối mắt).
        this.playPlaceEffect(CellState.Dog, undefined, false, true);
    }

    private playVanish(): void {
        const iconNode = this.icon.node;
        const opacity = this.iconOpacity!;

        tween(opacity)
            .to(VANISH_DURATION, { opacity: 0 })
            .call(() => {
                iconNode.active = false;
                opacity.opacity = 255;
            })
            .start();

        tween(iconNode)
            .to(VANISH_DURATION, { scale: new Vec3(0.6, 0.6, 1) }, { easing: 'quadIn' })
            .call(() => iconNode.setScale(1, 1, 1))
            .start();
    }

    private playPlaceEffect(state: CellState, onSettled?: () => void, spawnParticle = true, celebrating = false): void {
        const node = this.icon.node;

        switch (state) {
            case CellState.Dog:
                // Phóng to LÊN QUÁ scale gốc (dogPopPeakScale, lớn hơn cả ô) → đứng yên 1 lúc →
                // "đập xuống" về scale gốc (1) — 3 chặng, KHÁC hẳn pop-in đơn giản của Mark. Vượt
                // khỏi biên ô thì phải NÂNG CẢ Ô lên trên các ô lân cận (raiseCellAboveNeighbors),
                // không thì bị ô bên cạnh (vẽ SAU trong cellContainer) đè lên phần tràn ra.
                //
                // stopAllByTarget PHÒNG lúc gọi TRÙNG với chính hiệu ứng đặt mèo tự nhiên của ô này
                // (celebrateDogs() giờ chạy NGAY LÚC đặt xong con cuối, ĐỒNG THỜI với animation đặt
                // mèo của CHÍNH con cuối đó — replayPlaceDogEffect() gọi lại đúng hàm này lần 2 —
                // không dừng tween cũ trước thì 2 tween cùng ghi scale trên CÙNG node, đánh nhau).
                Tween.stopAllByTarget(node);
                this.dogPopPlaying = true;
                // Mèo ăn mừng đã nằm trên sẵn; giữ đầy đủ nhịp scale như lúc đặt.
                if (!celebrating) {
                    this.raiseCellAboveNeighbors();
                }
                node.setScale(this.dogPopFromScale, this.dogPopFromScale, 1);
                if (spawnParticle) this.playPlaceDogParticle();
                tween(node)
                    .to(this.dogPopUpSeconds, { scale: new Vec3(this.dogPopPeakScale, this.dogPopPeakScale, 1) }, { easing: 'backOut' })
                    .delay(this.dogPopHoldSeconds)
                    // 'quadInOut' cho CẢ 2 chặng (không phải quadIn/quadOut như trước) — đảm bảo
                    // vận tốc ~0 ở CẢ 3 điểm nối: lúc vừa hết hold (đứng yên) bắt đầu lún xuống,
                    // lúc lún tới đáy rồi đổi chiều bật lên, và lúc bật lên tới scale gốc thì dừng
                    // hẳn. quadIn/quadOut cũ khiến vận tốc BỊ ĐẢO CHIỀU đột ngột ngay tại điểm lún
                    // sâu nhất (quadIn kết thúc ở vận tốc CAO, quadOut lại bắt đầu ở vận tốc CAO
                    // theo chiều ngược lại) — đúng nguyên nhân "giật" đã báo.
                    .to(this.dogPopSettleSeconds, { scale: new Vec3(this.dogPopSquashScale, this.dogPopSquashScale, 1) }, { easing: 'quadInOut' })
                    .to(this.dogPopSquashSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'quadInOut' })
                    .call(() => {
                        this.dogPopPlaying = false;
                        this.restoreCellSiblingIndex();
                        onSettled?.();
                    })
                    .start();
                break;

            case CellState.Mark:
                            node.setScale(0.55, 0.55, 1);

                tween(node)
                    .to(0.11, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                    .start();
                break;

            case CellState.WrongMark:
                this.playShake();
                break;

            case CellState.Empty:
                break;
        }
    }


    private playShake(): void {
        const node = this.icon.node;
        const amp = this.visualSize * 0.14;

        node.setScale(1.15, 1.15, 1);

        tween(node)
            .to(0.04, { position: new Vec3(amp, 0, 0) })
            .to(0.06, { position: new Vec3(-amp, 0, 0) })
            .to(0.05, { position: new Vec3(amp * 0.5, 0, 0) })
            .to(0.04, { position: new Vec3(0, 0, 0) })
            .start();

        tween(node).to(0.19, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).start();
    }


    /**
     * Ô + mọi thứ là CON của ô (sprite tĩnh, dấu X đúng...) đều tự ăn theo scale này —
     * LUÔN chạy hiệu ứng scale nhỏ→lớn theo stagger, kể cả lúc RESUME ván đang chơi dở
     * (chỉ animation RIÊNG của DogView thật mới bị tắt lúc resume — xem BoardView).
     *
     * `animate = false`: hiện THẲNG ở scale cuối, không chạy hiệu ứng gì — dùng khi board
     * quay lại ĐÚNG trạng thái vừa rời đi (ví dụ về Gameplay sau màn Streak ăn mừng).
     */
    playAppear(delay: number, animate = true): void {
        Tween.stopAllByTarget(this.node);

        if (!animate) {
            this.node.setScale(1, 1, 1);
            this.playRevealMarkScaleIn(delay, false);
            return;
        }

        this.node.setScale(0, 0, 1);

        tween(this.node)
            .delay(delay)
            .to(APPEAR_DURATION, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();

        this.playRevealMarkScaleIn(delay, true);
    }

    /**
     * WrongMark hiển thị bằng spine bị raiseAboveDogLayer() NHẤC RA khỏi cây con của chính
     * ô (để vẽ đè lên chó) nên KHÔNG còn tự động scale theo ô qua quan hệ cha-con nữa như
     * Mark đúng (vẫn là con bình thường, tự ăn theo playAppear() ở trên). Ô resume có sẵn
     * WrongMark thì phải tự cho spine đó scale-in ĐÚNG NHỊP với ô (cùng delay/thời lượng/easing).
     */
    private playRevealMarkScaleIn(delay: number, animate = true): void {
        if (this.state !== CellState.WrongMark) return;

        const spine = this.markSpine;
        if (!spine?.node.active) return;

        const node = spine.node;

        Tween.stopAllByTarget(node);
        if (!animate) return; // scale đã đúng sẵn (bind() không hề zero-out spine này) — không cần chỉnh gì.

        const target = new Vec3(node.scale.x, node.scale.y, 1);
        node.setScale(0, 0, 1);
        tween(node).delay(delay).to(APPEAR_DURATION, { scale: target }, { easing: 'backOut' }).start();
    }

    setLocked(locked: boolean): void {
        this.locked = locked;
        if (this.lockedOverlay) {
            this.lockedOverlay.active = locked;
        }
    }


    get pressable(): boolean {
        if (this.locked) return false;
        return this.state === CellState.Empty || this.state === CellState.Mark;
    }

    setPressed(pressed: boolean): void {
        if (pressed && !this.pressable) return;
        if (this.pressed === pressed) return;

        this.pressed = pressed;
        this.applyScale();
    }

   
    setHighlighted(highlighted: boolean): void {
        this.highlighted = highlighted;
        this.applyScale();
    }

    /** Bật/tắt viền vàng tutorial — bật thì nhấp nháy mờ dần/đậm dần liên tục. */
    setGoldBorder(active: boolean): void {
        const node = this.goldBorder?.node;
        const opacity = this.goldBorderOpacity;
        if (!node || !opacity) return;

        Tween.stopAllByTarget(opacity);
        Tween.stopAllByTarget(node);
        opacity.opacity = 255;
        node.setScale(1, 1, 1);
        node.active = active;
        if (!active) return;

        tween(opacity)
            .repeatForever(
                tween<UIOpacity>()
                    .to(BORDER_BLINK_HALF_SECONDS, { opacity: BORDER_BLINK_MIN_OPACITY })
                    .to(BORDER_BLINK_HALF_SECONDS, { opacity: 255 }),
            )
            .start();

        tween(node)
            .repeatForever(
                tween<Node>()
                    .to(BORDER_BLINK_HALF_SECONDS, { scale: new Vec3(BORDER_BLINK_MIN_SCALE, BORDER_BLINK_MIN_SCALE, 1) })
                    .to(BORDER_BLINK_HALF_SECONDS, { scale: new Vec3(1, 1, 1) }),
            )
            .start();
    }

    /**
     * Hiệu ứng "sóng" quét qua ô — dùng cho Clear hàng/cột/vùng (xem BoardView.playWaveSteps()):
     * scale CẢ Ô (this.node — background/icon/waveOverlay đều là con, tự phóng to/thu lại CÙNG
     * NHAU theo cha, KHÔNG chỉ riêng icon), ĐỒNG THỜI waveOverlay (nếu có gán) mờ dần vào rồi ra.
     * KHÔNG đổi spriteFrame/trạng thái gì cả — thuần hiệu ứng thị giác, an toàn gọi bất kỳ lúc
     * nào (this.node luôn có baseline scale=1, xem bind() reset scale mỗi lần dựng ô, nên KHÔNG
     * có rủi ro "chốt sai baseline" như vụ logo Main Menu/sprite Result trước đó).
     */
    playWaveVisit(
        waveFrame: SpriteFrame | null,
        peakScale: number,
        popSeconds: number,
        holdSeconds: number,
        fadeSeconds: number,
        overlaySizeRatio: number,
    ): void {
        const cellNode = this.node;
        Tween.stopAllByTarget(cellNode);
        cellNode.setScale(1, 1, 1);
        // peakScale > 1 thì CẢ Ô tràn ra ngoài biên ô lân cận — nâng nó lên trên, tránh bị đè
        // (cùng lý do/cơ chế với playPlaceEffect() lúc đặt mèo).
        this.raiseCellAboveNeighbors();
        tween(cellNode)
            .to(popSeconds, { scale: new Vec3(peakScale, peakScale, 1) }, { easing: 'sineOut' })
            .to(popSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'sineIn' })
            .call(() => this.restoreCellSiblingIndex())
            .start();

        if (!this.waveOverlay || !this.waveOverlayOpacity || !waveFrame) {
            // LOG TẠM ĐỂ DEBUG — xoá sau khi tìm ra nguyên nhân viền vàng của sóng không hiện.
            if (this.debugEffects) console.log('[CellView.playWaveVisit] BỎ QUA — thiếu', {
                cellIndex: this.cellIndex,
                hasWaveOverlay: !!this.waveOverlay,
                hasOpacity: !!this.waveOverlayOpacity,
                hasWaveFrame: !!waveFrame,
                waveOverlayNodeUuid: this.waveOverlay?.node?.uuid,
                thisUuid: this.node?.uuid,
            });
            return;
        }

        const node = this.waveOverlay.node;
        const opacity = this.waveOverlayOpacity;
        this.waveOverlay.spriteFrame = waveFrame;
        // Ép SIMPLE (không cắt lát 9-slice) — sprite gán trong Editor có thể đang để SLICED mặc
        // định (kế thừa từ prefab), nếu ảnh không có border cắt lát hợp lệ sẽ hiện sai/không hiện.
        this.waveOverlay.type = Sprite.Type.SIMPLE;
        // Kích thước node này PHẢI luôn tính theo visualSize (cạnh ô hiện tại), KHÔNG giữ
        // contentSize thiết kế sẵn trong Editor (không co giãn theo board). overlaySizeRatio cho
        // phép sprite LỚN HƠN ô (BoardView.waveOverlaySizeRatio) — cần thiết vì node này nằm
        // DƯỚI icon mèo/X, phải to hơn ô mới lộ ra thành viền sáng rõ quanh icon thay vì bị icon
        // che gần hết diện tích.
        this.resizeChild(node, this.visualSize * overlaySizeRatio);

        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);
        node.active = true;
        node.setScale(1, 1, 1);
        opacity.opacity = 0;

        // LOG TẠM ĐỂ DEBUG — xoá sau khi tìm ra nguyên nhân viền vàng của sóng không hiện.
        if (this.debugEffects) console.log('[CellView.playWaveVisit] chạy', {
            cellIndex: this.cellIndex,
            visualSize: this.visualSize,
            overlaySizeRatio,
            contentSize: node.getComponent(UITransform)?.contentSize,
            nodeActive: node.active,
            nodeSiblingIndex: node.getSiblingIndex(),
            spriteFrameName: this.waveOverlay.spriteFrame?.name,
            spriteType: this.waveOverlay.type,
            color: this.waveOverlay.color,
        });

        tween(opacity)
            .to(popSeconds, { opacity: 255 })
            .delay(holdSeconds)
            .to(fadeSeconds, { opacity: 0 })
            .call(() => {
                if (node.isValid) node.active = false;
            })
            .start();
    }

    private applyScale(): void {
        const factor =
            (this.highlighted ? HIGHLIGHT_SCALE : 1) * (this.pressed ? PRESS_SCALE : 1);

        Tween.stopAllByTarget(this.node);
        this.scaleTarget.set(factor, factor, 1);

        tween(this.node)
            .to(PRESS_DURATION, { scale: this.scaleTarget }, { easing: 'quadOut' })
            .start();
    }
}
