import { _decorator, BlockInputEvents, Button, Component, Label, MotionStreak, Node, ParticleSystem, Prefab, Tween, UITransform, UIOpacity, Vec3, Widget, instantiate, isValid, sp, tween, warn } from 'cc';
import { GameSnapshot } from '../../application/contracts/gameSnapshot';
import { ConnectTracksBoardView } from './connectTracksBoardView';
import { traceTrainPath } from './trainPath';
import { railStarAmount } from './railVictoryPlan';
import { WinTextArc } from '../../animation/WinTextArc';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';

const { ccclass, property } = _decorator;
interface AnimationJob {
    elapsed: number;
    duration: number;
    draw: (progress: number) => void;
    finish: (completed: boolean) => void;
}
interface SavedNode {
    node: Node;
    active: boolean;
    opacity: number;
}

/** Presentation only: cancellable end-of-level sequence. No scoring or progression decisions. */
@ccclass('ConnectTracksVictoryView')
export class ConnectTracksVictoryView extends Component {
    @property({ type: Node, tooltip: 'Background giữ lại khi thắng. Nếu chưa gán, dùng node Background trực tiếp dưới GameplayScreen.' })
    background: Node | null = null;
    @property({ type: Node, tooltip: 'Cụm Rail gồm bg, icon, Label. Cùng cấp với Board; không đặt trong Board.' })
    railGroup: Node | null = null;
    @property({
        tooltip:
            'railGroup tự định vị CAO HƠN viền trên của board đúng N px (world) ngay lúc bật hiện —' +
            ' KHÔNG còn dùng vị trí Y cố định gán sẵn trong Editor nữa (sai lệch khi board đổi kích ' +
            'thước theo từng level, xem ConnectTracksBoardView.getTopEdgeWorldY()). CHỈ đổi Y, giữ ' +
            'nguyên X đã canh trong Editor.',
    })
    railGroupHeightAboveBoard = 40;
    @property(Label)
    railLabel: Label | null = null;
    @property({ type: Prefab, tooltip: 'Prefab ngôi sao có MotionStreak. Vị trí bay lấy từ ô tới Rail Group.' })
    starPrefab: Prefab | null = null;
    @property({ type: Node, tooltip: 'Node UI chứa sao bay, ngoài mọi Mask. Không đặt trong Board hoặc Rail Group.' })
    flightLayer: Node | null = null;
    @property({ type: Node, tooltip: 'Node trống căn giữa màn hình; Board sẽ di chuyển tới vị trí world của node này.' })
    boardCenterTarget: Node | null = null;
    @property({ type: Button, tooltip: 'Nút sao chép từ ResultPopup sang GameplayScreen, không gắn click event cũ.' })
    nextButton: Button | null = null;
    @property(Label)
    nextLabel: Label | null = null;
    @property({
        min: 0.01,
        tooltip:
            'Giống hệt hiệu ứng nút "Tiếp theo" ở Tutorial (xác nhận từ user) — thời gian (giây) ' +
            'MỖI CHIỀU của 1 nhịp nhấp nháy scale nút qua màn tiếp theo (to lên rồi về lại = 2 lần ' +
            'giá trị này), chạy LIÊN TỤC suốt lúc nút đang hiện (từ lúc fade-in xong cho tới lúc bấm).',
    })
    nextButtonBlinkSpeed = 0.5;
    @property({ min: 1, tooltip: 'Scale TO NHẤT của nút qua màn tiếp theo lúc nhấp nháy (1 = không đổi gì) — cùng ý nghĩa với Tutorial.' })
    nextButtonBlinkScale = 1.08;
    @property({
        min: 0.01,
        tooltip:
            'Tổng thời gian MONG MUỐN (giây) để sóng đi hết TOÀN BỘ đường ray — thời gian mỗi ô ' +
            '= waveTotalSeconds / (số ô - 1), rồi bị giới hạn trong [waveCellSecondsMin, ' +
            'waveCellSecondsMax] (xem 2 field đó). Màn có NHIỀU ô sẽ tự động chạy NHANH hơn mỗi ô ' +
            '(ăn vào waveCellSecondsMin) để tổng thời gian không quá dài; màn có ÍT ô sẽ chạy CHẬM ' +
            'hơn mỗi ô (ăn vào waveCellSecondsMax) để không trông quá nhanh/giật.',
    })
    waveTotalSeconds = 0.6;
    @property({ min: 0.01, tooltip: 'Thời gian sóng đi qua mỗi ô (giây) — GIỚI HẠN DƯỚI (nhanh nhất), dùng khi màn có nhiều ô.' })
    waveCellSecondsMin = 0.04;
    @property({ min: 0.01, tooltip: 'Thời gian sóng đi qua mỗi ô (giây) — GIỚI HẠN TRÊN (chậm nhất), dùng khi màn có ít ô.' })
    waveCellSecondsMax = 0.12;
    @property({ min: 0.01, tooltip: 'Thời gian làm mờ tất cả dấu X và dấu sai trước khi sóng chạy.' })
    marksFadeSeconds = 0.25;
    @property({
        min: 0.01,
        tooltip:
            'BUG đã sửa (xác nhận từ user: "không mặc định xử lý trong 5 ô nữa") — thời gian (giây) ' +
            'của MỖI ô đường ray, tính từ lúc sóng vừa chạm tới (xuất hiện, sáng nhất — opacity 255) ' +
            'cho tới lúc mờ hẳn (opacity 0). KHÔNG còn khái niệm "cửa sổ N ô sáng cùng lúc" cố định ' +
            '— mỗi ô cứ chạy đúng khoảng thời gian này kể từ lúc sóng chạm tới nó; ô nào có thời gian ' +
            'chạy CHỒNG LẤP với ô khác (tuỳ thời gian/ô hiệu lực — xem waveTotalSeconds — so với giá ' +
            'trị này) sẽ TỰ KHẮC tạo thành ' +
            'hiệu ứng sóng — không cần đếm/ép buộc số ô sáng cùng lúc.',
    })
    railGlowSeconds = 0.35;
    @property({ tooltip: 'Animation Spine trong prefab sao bay.' })
    starSpineAnimation = 'star';
    @property({ min: 0.01 })
    starFlightSeconds = 0.45;
    @property({ tooltip: 'Độ cong bay lên của sao, đơn vị world UI.' })
    starArcHeight = 80;
    @property({ min: 0.01 })
    railRevealSeconds = 0.2;
    @property({ min: 0.01 })
    railPulseSeconds = 0.16;
    @property({
        min: 0.01,
        tooltip:
            'Số đếm ở Rail Group: thời gian (giây) giữa mỗi lần tick số lên — số đếm lên TUẦN TỰ, ' +
            'KHÔNG nhảy thẳng lên đích ngay khi nhiều sao cùng tới 1 lúc (xác nhận từ user). Mỗi ' +
            'tick nhảy BAO NHIÊU đơn vị tuỳ railCountCatchUpDivisor bên dưới — field này chỉ quyết ' +
            'định NHỊP (tick nhanh/chậm), không còn cố định +1/tick nữa.',
    })
    railCountStepSeconds = 0.08;
    @property({
        min: 1,
        tooltip:
            'BUG đã sửa ("màn nhiều track, số tăng quá chậm, không theo kịp sao bay vào") — số đang ' +
            'thiếu bao nhiêu đơn vị (gap = đích - số đang hiện) thì mỗi tick nhảy lên ' +
            'ceil(gap / field này), KHÔNG còn cố định +1/tick nữa — gap càng lớn (màn nhiều track, ' +
            'nhiều sao dồn tới cùng lúc) thì mỗi tick nhảy càng nhiều, tự rút ngắn lại về +1/tick khi ' +
            'gap gần hết (mượt dần, không giật khi gần đích). Giá trị CÀNG NHỎ = bắt kịp CÀNG NHANH ' +
            '(1 = luôn nhảy thẳng tới đích ngay tick đầu). Giá trị lớn gần như giữ nguyên hành vi cũ ' +
            '(+1/tick).',
    })
    railCountCatchUpDivisor = 4;
    @property({ min: 0.01 })
    hudFadeSeconds = 0.25;
    @property({ min: 0.01 })
    boardMoveSeconds = 0.4;
    @property({ min: 0.01 })
    nextFadeSeconds = 0.25;

    @property({
        type: WinTextArc,
        tooltip: 'Node chữ chúc mừng (cong theo cung tròn, từng ký tự bật ra lần lượt + viền/bóng/màu ' +
            'tự vẽ) hiện NGAY khi board vừa vào giữa màn hình. Nội dung chọn ngẫu nhiên từ ' +
            'result.winTexts mỗi lần thắng. Ẩn mặc định (begin() tự ẩn qua cancel()) — giữ hiện ' +
            'XUYÊN SUỐT (qua cả lúc tàu chạy + chờ bấm "Tiếp theo"), CHỈ tắt lúc thực sự load màn kế ' +
            'tiếp.',
    })
    winEffectText: WinTextArc | null = null;
    @property({
        tooltip:
            'winEffectText tự định vị CAO HƠN viền trên của board (SAU KHI đã di chuyển vào giữa ' +
            'màn hình) đúng N px (world) ngay lúc playWinEffect() chạy — KHÔNG còn dùng vị trí Y cố ' +
            'định gán sẵn trong Editor nữa. CHỈ đổi Y, giữ nguyên X đã canh trong Editor.',
    })
    winTextHeightAboveBoard = 60;

    @property({
        type: ParticleSystem,
        tooltip: 'Particle pháo giấy rơi, bật ĐỒNG THỜI với winEffectText (one-shot, Play On Awake ' +
            'nên TẮT trong Inspector — code tự play()). Giữ hiện XUYÊN SUỐT như winEffectText, chỉ ' +
            'tắt lúc thực sự load màn kế tiếp.',
    })
    winEffectConfetti: ParticleSystem | null = null;

    @property({ min: 0.01, tooltip: 'Board vào giữa màn hình xong thì chờ bao lâu (giây) rồi mới tiếp tục khoảng dừng 0.3s + chuỗi popup (Tournament/Streak/LeaderboardPreview) phía sau — KHÔNG liên quan tới việc ẩn winEffectText/confetti (chúng vẫn hiện tiếp sau đó, xem comment ở 2 property trên).' })
    winEffectSeconds = 1.2;

    private jobs: AnimationJob[] = [];
    private generation = 0;
    private board: ConnectTracksBoardView | null = null;
    private savedHud: SavedNode[] = [];
    private flights = new Set<Node>();
    private railScale = new Vec3(1, 1, 1);
    private boardPosition: Vec3 | null = null;
    private boardScale: Vec3 | null = null;
    private boardScaleMultiplier = 1;
    private boardWidget: Widget | null = null;
    private boardWidgetEnabled = false;
    private blocker: Node | null = null;
    private nextAction: (() => void) | null = null;
    private ready = false;
    /** Giá trị ĐÍCH thật (tổng đã cộng dồn) — khác với railDisplayedCount (số đang HIỂN THỊ,
     * đuổi theo railCount TUẦN TỰ từng đơn vị một qua tickRailCount(), xem flyStar()). */
    private railCount = 0;
    private railDisplayedCount = 0;
    /** Promise CHUNG của vòng đếm số ĐANG chạy (chỉ 1 vòng tại 1 thời điểm) — flyStar() của mọi
     * ngôi sao tới GẦN NHƯ CÙNG LÚC đều await chung promise này, đảm bảo Promise.all(arrivals) ở
     * run() THỰC SỰ đợi đếm số xong hẳn rồi mới ẩn Rail Group (showRail(false)) — không hiện tượng
     * số bị cắt ngang/ẩn giữa chừng lúc đang đếm. */
    private railCountTickPromise: Promise<void> | null = null;
    private pulseToken = 0;
    /** BUG đã sửa ("sau khi thắp chuỗi ở màn 5 lại bắt chơi lại từ đầu"): UIManager TẠM ẨN
     * (node.active=false) cả cây GameplayScreen khi chuyển sang màn Streak giữa lúc victory
     * sequence đang await resume() — Cocos tự gọi onDisable() của MỌI component active trong
     * node đó, trong đó onDisable() cũ GỌI LUÔN cancel() (tăng generation, RESET board về vị trí
     * trước thắng, bật lại HUD đã ẩn...) — y hệt như huỷ hẳn ván thắng, dù chỉ ẩn tạm 1 lúc.
     * setSuspended(true)/false() cho UIManager đánh dấu "đây là ẩn tạm, không phải đóng thật" để
     * onDisable() bỏ qua cancel() — xem onDisable() bên dưới. */
    private suspended = false;
    /** "Bỏ hiệu ứng sao bay, chỉ kích hoạt sau level 10" (xác nhận từ user) — begin()'s `starsEnabled`
     * gates BOTH the flying star AND its Rail counter reveal together (hiện Rail Group với số "0"
     * mãi mãi lúc sao bị tắt sẽ trông gãy). Sóng glow chạy dọc path (playRailWave/setRailGlow) KHÔNG bị tắt —
     * đó là hiệu ứng sóng chạy dọc đường ray, không phải sao, vẫn giữ nguyên dù starsEnabled=false. */
    private starsEnabled = true;

    onLoad(): void {
        if (this.railGroup) this.railGroup.active = false;
        if (this.nextButton) this.nextButton.node.active = false;
    }

    update(dt: number): void {
        for (const job of this.jobs.slice()) {
            if (!this.jobs.includes(job)) continue;
            job.elapsed += Math.max(0, dt);
            const t = Math.min(1, job.elapsed / job.duration);
            job.draw(t);
            if (t === 1) {
                this.jobs.splice(this.jobs.indexOf(job), 1);
                job.finish(true);
            }
        }
    }

    begin(board: ConnectTracksBoardView, snapshot: GameSnapshot, gameplayRoot: Node,
        completed: (resume: () => void) => void, next: () => void, starsEnabled = true): boolean {
        this.cancel();
        this.starsEnabled = starsEnabled;
        const path = traceTrainPath(snapshot);
        const trackedCells = snapshot.cellStates.filter(state => state === 'Track').length + snapshot.mainTrackCells.length;
        if (!path || path.length !== trackedCells) {
            warn('[ConnectTracksVictoryView] Cannot celebrate: tracks do not form one complete entrance-to-exit path.');
            return false;
        }
        if (!this.railGroup || !this.railLabel || !this.flightLayer || !this.boardCenterTarget || !this.nextButton) {
            warn('[ConnectTracksVictoryView] Assign Rail Group/Label, Flight Layer, Board Center Target and Next Button.');
            return false;
        }
        if (!this.starPrefab) {
            warn('[ConnectTracksVictoryView] Star Prefab is missing: continuing Rail count and victory sequence without the flying star visual.');
        }
        this.board = board;
        this.boardPosition = board.node.position.clone();
        this.boardScale = board.node.scale.clone();
        this.boardScaleMultiplier = board.getVictoryScaleMultiplier();
        this.boardWidget = board.node.getComponent(Widget);
        this.boardWidgetEnabled = this.boardWidget?.enabled ?? false;
        this.railScale = this.railGroup.scale.clone();
        this.railCount = 0;
        this.railDisplayedCount = 0;
        this.railCountTickPromise = null;
        this.railLabel.string = '0';
        this.nextAction = next;
        this.nextButton.node.on(Button.EventType.CLICK, this.onNext, this);
        this.nextButton.interactable = false;
        this.nextButton.node.active = false;
        this.installBlocker(gameplayRoot);
        const token = this.generation;
        void this.run(path, snapshot, gameplayRoot, token, completed).catch(failure => {
            if (token !== this.generation) return;
            warn('[ConnectTracksVictoryView] Victory sequence failed.', failure);
            this.cancel();
        });
        return true;
    }

    private async run(path: readonly number[], snapshot: GameSnapshot, root: Node, token: number, completed: (resume: () => void) => void): Promise<void> {
        if (!await this.animate(0.1, () => {}) || token !== this.generation) return;
        if (!await this.animate(this.marksFadeSeconds, t => this.board!.setVictoryMarksFade(t))
            || token !== this.generation) return;
        this.railGroup!.active = this.starsEnabled;
        if (this.starsEnabled) this.positionAboveBoard(this.railGroup!, this.railGroupHeightAboveBoard);
        const reveal = this.starsEnabled ? this.showRail(true) : Promise.resolve(true);
        const arrivals: Promise<boolean>[] = [];
        const waveCellSeconds = this.effectiveWaveCellSeconds(path.length);
        // 1 sóng glow LIÊN TỤC chạy dọc hết path (xem playRailWave) — chạy SONG SONG với vòng lặp
        // bên dưới (vẫn giữ nguyên để tàu sao bay — flyStar — stagger theo đúng waveCellSeconds như
        // trước, KHÔNG liên quan tới glow nữa).
        arrivals.push(this.playRailWave(path, token, waveCellSeconds));
        for (let index = 0; index < path.length; index++) {
            if (this.starsEnabled) {
                const amount = railStarAmount(path.length, index);
                if (amount) arrivals.push(this.flyStar(path[index], amount, token));
            }
            if (!await this.animate(waveCellSeconds, () => {}) || token !== this.generation) return;
        }
        if (!(await Promise.all([reveal].concat(arrivals))).every(Boolean) || token !== this.generation) return;
        if (this.starsEnabled) {
            if (!await this.showRail(false) || token !== this.generation) return;
            this.railGroup!.active = false;
        }
        this.collectHud(root);
        if (!await this.animate(this.hudFadeSeconds, t => {
            this.board!.setVictoryCluesFade(t);
            for (const item of this.savedHud) if (isValid(item.node)) this.opacity(item.node).opacity = item.opacity * (1 - t);
        }) || token !== this.generation) return;
        for (const item of this.savedHud) if (isValid(item.node)) item.node.active = false;
        if (this.boardWidget) this.boardWidget.enabled = false;
        if (!await this.moveBoardToCenter() || token !== this.generation) return;
        // "Chèn hiệu ứng thắng (chữ chúc mừng ngẫu nhiên + pháo giấy) ngay khi board vừa vào giữa
        // màn hình, luồng phía sau lùi lại sau hiệu ứng này" (xác nhận từ user) — giữ hiện đúng
        // winEffectSeconds rồi mới chạy tiếp khoảng dừng 0.3s + chuỗi popup như cũ.
        this.playWinEffect();
        if (!await this.animate(this.winEffectSeconds, () => {}) || token !== this.generation) return;
        // "Đợi board ra giữa bàn xong và dừng 0.3s rồi mới thực hiện chuỗi popup" (xác nhận từ user)
        // — khoảng dừng thuần tuý để mắt người chơi kịp nhận ra board đã vào vị trí trước khi
        // Tournament/Streak/LeaderboardPreview chồng lên.
        if (!await this.animate(0.3, () => {}) || token !== this.generation) return;
        // "Tàu hoãn chạy cho đến khi luồng thắng của các popup khác (Tournament/LeaderboardPreview)
        // chạy xong" (xác nhận từ user, đúng thứ tự ưu tiên ResultPopup thật) — completed() giờ
        // nhận `resume`, chỉ gọi khi THỰC SỰ sẵn sàng (đồng bộ nếu không có gì phải đợi, hoặc SAU
        // khi popup đóng hết) thay vì tàu tự chạy ngay sau completed() như trước. unlock next
        // level/label vẫn chạy ngay trong completed(), không phụ thuộc resume.
        await new Promise<void>(resolve => completed(resolve));
        if (token !== this.generation) return;
        // SỬA (xác nhận lại từ user): hiệu ứng thắng (chữ + pháo giấy) phải ĐỨNG YÊN, không tự tắt
        // lúc tàu chạy — giữ bật xuyên suốt tàu chạy + chờ người chơi bấm "Tiếp theo", CHỈ tắt lúc
        // THỰC SỰ sang màn mới (cancel() ở trên, gọi từ GameplayScreen khi puzzle kế tiếp bắt đầu
        // load, đã tự hideWinEffect() — không cần gọi tay ở đây nữa).
        this.board!.playVictoryTrain(snapshot, () => {});
        const button = this.nextButton!;
        button.node.active = true;
        button.node.setSiblingIndex(-1);
        if (!await this.animate(this.nextFadeSeconds, t => { this.opacity(button.node).opacity = t * 255; }) || token !== this.generation) return;
        button.interactable = true;
        if (this.blocker && isValid(this.blocker, true)) this.blocker.destroy();
        this.blocker = null;
        this.ready = true;
        this.startNextButtonBlink();
    }

    /** Nhấp nháy scale LIÊN TỤC trên nút qua màn tiếp theo, y hệt hiệu ứng nút "Tiếp theo" ở
     * Tutorial (xác nhận từ user) — xem ConnectTracksTutorialController.startButtonBlink(). */
    private startNextButtonBlink(): void {
        const node = this.nextButton?.node;
        if (!node) return;
        Tween.stopAllByTarget(node);
        node.setScale(new Vec3(1, 1, 1));
        const s = this.nextButtonBlinkScale;
        tween(node)
            .repeatForever(
                tween<Node>()
                    .to(this.nextButtonBlinkSpeed, { scale: new Vec3(s, s, 1) }, { easing: 'sineInOut' })
                    .to(this.nextButtonBlinkSpeed, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' }),
            )
            .start();
    }

    private stopNextButtonBlink(): void {
        const node = this.nextButton?.node;
        if (!node || !isValid(node, true)) return;
        Tween.stopAllByTarget(node);
        node.setScale(new Vec3(1, 1, 1));
    }

    private moveBoardToCenter(): Promise<boolean> {
        const node = this.board!.node;
        const from = node.position.clone();
        const fromScale = node.scale.clone();
        const targetScale = fromScale.clone();
        targetScale.x *= this.boardScaleMultiplier;
        targetScale.y *= this.boardScaleMultiplier;
        // Resolve the anchor after its Widget alignment, then keep one fixed local destination.
        this.boardCenterTarget!.getComponent(Widget)?.updateAlignment();
        const target = this.boardCenterTarget!.worldPosition.clone();
        if (node.parent) node.parent.inverseTransformPoint(target, target);
        const position = new Vec3();
        const scale = new Vec3();
        return this.animate(this.boardMoveSeconds, t => {
            const eased = t * t * (3 - 2 * t);
            Vec3.lerp(position, from, target, eased);
            Vec3.lerp(scale, fromScale, targetScale, eased);
            node.setPosition(position);
            node.setScale(scale);
        });
    }

    private showRail(visible: boolean): Promise<boolean> {
        return this.animate(this.railRevealSeconds, t => {
            const progress = visible ? t : 1 - t;
            this.opacity(this.railGroup!).opacity = 255 * progress;
            // Hiện: pop nhẹ 0.85→1.0 (giữ nguyên như cũ). "Biến mất: scale VÀ opacity đi" (xác nhận
            // từ user) — scale phải co hẳn về 0 lúc ẩn, không chỉ nhích nhẹ xuống 0.85 như trước
            // (gần như không thấy co lại gì cả).
            const scaleFactor = visible ? 0.85 + 0.15 * progress : progress;
            this.railGroup!.setScale(Vec3.multiplyScalar(new Vec3(), this.railScale, scaleFactor));
        });
    }

    /** "Sóng chạy qua đường ray phải giống sóng thật hơn — không mặc định xử lý trong 5 ô (hay bất kỳ
     * số ô cố định nào) nữa, mỗi ô chạy đúng 1 khoảng thời gian railGlowSeconds kể từ lúc sóng chạm
     * tới, ô nào chồng lấp thời gian thì TỰ KHẮC thành hiệu ứng sóng" (xác nhận từ user) — thay cho
     * cách cũ (1 "cửa sổ N ô sáng cùng lúc" cố định, tính lại độ sáng MỌI ô mỗi khung hình). Giờ MỖI
     * ô trong path là 1 job ĐỘC LẬP: trễ `i * waveCellSeconds` (waveCellSeconds hiệu lực — xem
     * effectiveWaveCellSeconds() — đúng nhịp sóng "quét" qua từng ô theo thứ tự, không đổi) rồi tự
     * chạy riêng 1 chu kỳ fade-out dài railGlowSeconds — xuất hiện NGAY ở độ sáng cao nhất (opacity
     * 255, không có đoạn "sáng dần" riêng — "sóng vừa chạm tới" là mốc sáng nhất), mờ dần tuyến tính
     * về 0 trong suốt railGlowSeconds đó. KHÔNG có khái niệm số ô sáng cùng lúc — bao nhiêu ô đang
     * "chồng" job tại 1 thời điểm hoàn toàn do tỉ lệ railGlowSeconds / waveCellSeconds quyết định
     * tự nhiên. */
    private async playRailWave(path: readonly number[], token: number, waveCellSeconds: number): Promise<boolean> {
        const results = await Promise.all(path.map((cell, i) => this.glowOneRail(cell, i * waveCellSeconds, token)));
        if (token !== this.generation || !this.board) return false;
        return results.every(ok => ok);
    }

    /** "Tốc độ sóng (giây/ô) giới hạn trong 1 khoảng min/max tuỳ màn phải đi qua nhiều ô hay không"
     * (xác nhận từ user) — màn NHIỀU ô (path dài) tự chạy NHANH hơn mỗi ô (ăn vào
     * waveCellSecondsMin) để tổng thời gian sóng không kéo quá dài; màn ÍT ô (path ngắn) tự chạy
     * CHẬM hơn mỗi ô (ăn vào waveCellSecondsMax) để không trông quá nhanh/giật. */
    private effectiveWaveCellSeconds(cellCount: number): number {
        const raw = this.waveTotalSeconds / Math.max(1, cellCount - 1);
        return Math.min(this.waveCellSecondsMax, Math.max(this.waveCellSecondsMin, raw));
    }

    /** 1 ô đường ray: đợi `delaySeconds` (vị trí của nó trong path — "sóng" quét tới đúng lúc này),
     * rồi tự chạy riêng 1 chu kỳ fade-out dài railGlowSeconds (xem playRailWave()). Trả về false
     * (không đụng board nữa) nếu bị cancel() giữa chừng (done=false ở animate() nào đó, hoặc
     * generation đổi) — board có thể đã bị null hoá đồng bộ TRƯỚC khi microtask này kịp chạy tiếp,
     * y hệt pattern mọi chỗ khác dùng animate() trong file này. */
    private async glowOneRail(cell: number, delaySeconds: number, token: number): Promise<boolean> {
        if (delaySeconds > 0) {
            if (!await this.animate(delaySeconds, () => {}) || token !== this.generation || !this.board) return false;
        }
        const done = await this.animate(this.railGlowSeconds, t => {
            const opacity = Math.round(255 * (1 - t));
            this.board?.setRailGlow(cell, opacity > 0, opacity);
        });
        if (!done || token !== this.generation || !this.board) return false;
        this.board.setRailGlow(cell, false);
        return true;
    }

    private async flyStar(cell: number, amount: number, token: number): Promise<boolean> {
        const start = this.board!.getCellWorldPosition(cell);
        if (!start) throw new Error(`Missing cell ${cell}`);
        // A missing cosmetic asset must not strand an already-won session.
        // Keep arrival timing/counting identical, even when no star can be drawn.
        const node = this.starPrefab ? instantiate(this.starPrefab) : null;
        if (node) {
            node.parent = this.flightLayer;
            node.active = true;
            const layer = this.flightLayer!.layer;
            const setLayer = (child: Node): void => { child.layer = layer; child.children.forEach(setLayer); };
            setLayer(node);
            node.setWorldPosition(start);
            node.getComponentsInChildren(MotionStreak).forEach(streak => streak.reset());
            node.getComponentsInChildren(sp.Skeleton).forEach(skeleton => {
                if (skeleton.findAnimation(this.starSpineAnimation)) {
                    skeleton.setAnimation(0, this.starSpineAnimation, true);
                } else {
                    warn(`[ConnectTracksVictoryView] Missing star Spine animation: ${this.starSpineAnimation}`);
                }
            });
            node.getComponentsInChildren(ParticleSystem).forEach(particles => {
                particles.stop();
                particles.play();
            });
            this.flights.add(node);
        }
        if (!await this.animate(this.starFlightSeconds, t => {
            if (!node) return;
            const point = Vec3.lerp(new Vec3(), start, this.railLabel!.node.worldPosition, t);
            point.y += Math.sin(Math.PI * t) * this.starArcHeight;
            node.setWorldPosition(point);
        }) || token !== this.generation) return false;
        if (node) {
            this.flights.delete(node);
            node.destroy();
        }
        this.railCount += amount;
        const pulse = ++this.pulseToken;
        // "Promise.all(arrivals) ở run() phải đợi đếm số xong hẳn rồi mới ẩn Rail Group" — await
        // CẢ hiệu ứng nảy (pulse bump) LẪN tickRailCount() (có thể đang đếm dở từ 1 ngôi sao khác
        // tới trước đó), không trả về ngay sau khi pulse bump xong như trước.
        const [pulseDone] = await Promise.all([
            this.animate(this.railPulseSeconds, t => {
                if (pulse === this.pulseToken) this.railGroup!.setScale(Vec3.multiplyScalar(new Vec3(), this.railScale, 1 + 0.1 * Math.sin(Math.PI * t)));
            }),
            this.tickRailCount(),
        ]);
        return pulseDone;
    }

    /** "Số tăng TUẦN TỰ từng số một, không nhảy thẳng" (xác nhận từ user — nhiều sao có thể tới
     * railLabel GẦN NHƯ CÙNG LÚC, amount có thể >1 mỗi sao) — railCount là ĐÍCH thật (cộng dồn
     * ngay lập tức ở flyStar()), railDisplayedCount mới là số đang hiển thị, tự đuổi theo railCount
     * từng +1 một. CHỈ 1 vòng đếm chạy tại 1 thời điểm (railCountTickPromise) — gọi thêm lần nữa
     * lúc target vừa tăng tiếp (sao khác tới) chỉ TRẢ VỀ promise của vòng ĐANG chạy, không chạy
     * chồng; promise đó tự nối dài thêm vì while loop bên trong đọc railCount MỚI NHẤT mỗi vòng. */
    private tickRailCount(): Promise<void> {
        if (!this.railCountTickPromise) {
            // .then() chứ không .finally() (lib target của project chưa có Promise.finally) —
            // an toàn vì stepRailCount() không bao giờ throw/reject.
            this.railCountTickPromise = this.stepRailCount().then(() => {
                this.railCountTickPromise = null;
            });
        }
        return this.railCountTickPromise;
    }

    private async stepRailCount(): Promise<void> {
        while (this.railDisplayedCount < this.railCount) {
            if (!await this.animate(this.railCountStepSeconds, () => {})) return;
            const gap = this.railCount - this.railDisplayedCount;
            const step = Math.max(1, Math.ceil(gap / this.railCountCatchUpDivisor));
            this.railDisplayedCount = Math.min(this.railCount, this.railDisplayedCount + step);
            if (this.railLabel) this.railLabel.string = String(this.railDisplayedCount);
        }
    }

    private animate(seconds: number, draw: (progress: number) => void): Promise<boolean> {
        draw(0);
        return new Promise(resolve => this.jobs.push({ elapsed: 0,
            duration: Number.isFinite(seconds) ? Math.max(0.001, seconds) : 0.2, draw, finish: resolve }));
    }

    private opacity(node: Node): UIOpacity {
        return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    }

    /** Định vị `node` CAO HƠN viền trên của board (ĐÚNG LÚC gọi — xem
     * ConnectTracksBoardView.getTopEdgeWorldY()) đúng `heightAbove` px (world), CHỈ đổi Y — giữ
     * nguyên X/Z hiện tại của node (đã canh ngang sẵn trong Editor). Không làm gì nếu thiếu board
     * hoặc node không có node cha (không có không gian local nào để quy đổi về). */
    private positionAboveBoard(node: Node, heightAbove: number): void {
        if (!this.board || !node.parent) return;
        const parentUI = node.parent.getComponent(UITransform);
        if (!parentUI) return;
        const targetWorldY = this.board.getTopEdgeWorldY() + heightAbove;
        const worldPoint = node.worldPosition.clone();
        worldPoint.y = targetWorldY;
        const localPoint = parentUI.convertToNodeSpaceAR(worldPoint);
        node.setPosition(node.position.x, localPoint.y, node.position.z);
    }

    private installBlocker(root: Node): void {
        const node = new Node('VictoryInputBlocker');
        node.layer = root.layer;
        node.parent = root;
        const rect = root.getComponent(UITransform);
        const ui = node.addComponent(UITransform);
        ui.setContentSize(rect?.contentSize.width ?? 2000, rect?.contentSize.height ?? 2000);
        if (rect) ui.setAnchorPoint(rect.anchorPoint);
        node.addComponent(BlockInputEvents);
        this.blocker = node;
    }

    private collectHud(root: Node): void {
        const background = this.background ?? root.getChildByName('Background');
        // winEffectText/winEffectConfetti PHẢI nằm trong danh sách này — nếu không, lúc HUD fade
        // quét toàn bộ con của root (trừ các node được bảo vệ) để ẨN HẲN và chỉ khôi phục lúc
        // cancel(), node cha chứa winEffectText/confetti (nếu KHÔNG phải 1 trong các node bảo vệ ở
        // trên) sẽ bị tắt active — dù playWinEffect() sau đó có set active=true cho chính node đó,
        // activeInHierarchy vẫn false vì cha nó đã bị ẩn, nên hiệu ứng không bao giờ thấy được.
        const protectedNodes = [background, this.board!.node, this.node, this.railGroup, this.flightLayer, this.boardCenterTarget, this.nextButton!.node, this.blocker, this.winEffectText?.node ?? null, this.winEffectConfetti?.node ?? null];
        const visit = (node: Node): void => {
            if (protectedNodes.includes(node)) return;
            if (protectedNodes.some(kept => kept?.isChildOf(node))) {
                node.children.slice().forEach(visit);
                return;
            }
            this.savedHud.push({ node, active: node.active, opacity: this.opacity(node).opacity });
        };
        root.children.slice().forEach(visit);
    }

    private onNext = (): void => {
        if (!this.ready) return;
        this.ready = false;
        if (this.nextButton) this.nextButton.interactable = false;
        this.stopNextButtonBlink();
        this.nextAction?.();
    };

    /** Hiện chữ chúc mừng ngẫu nhiên (result.winTexts) + bật pháo giấy rơi, gọi ngay khi board vừa
     * vào giữa màn hình. */
    private playWinEffect(): void {
        if (this.winEffectText) {
            this.positionAboveBoard(this.winEffectText.node, this.winTextHeightAboveBoard);
            this.winEffectText.node.active = true;
            void this.winEffectText.play(Localization.getRandom(L10N.result.winTexts));
        }
        if (this.winEffectConfetti) {
            this.winEffectConfetti.node.active = true;
            this.winEffectConfetti.stop();
            this.winEffectConfetti.clear();
            this.winEffectConfetti.play();
        }
    }

    /** Tắt chữ chúc mừng + pháo giấy — gọi lúc tàu bắt đầu chạy, và từ cancel() để đảm bảo mặc
     * định luôn ẩn (restart/đóng giữa lúc hiệu ứng còn đang hiện). BUG đã sửa ("Cannot set
     * properties of null (setting 'active')"): cancel() cũng chạy từ onDestroy() — lúc đó node con
     * (winEffectText/winEffectConfetti) có thể đã bị huỷ TRƯỚC node này trong cùng 1 đợt destroy
     * cascade của cả cây GameplayScreen, khiến `.node` của component đã trở thành null dù biến
     * field vẫn còn tham chiếu object component cũ — PHẢI kiểm tra isValid(..., true) (y như mọi
     * chỗ khác trong cancel()) trước khi đụng vào `.node`. */
    private hideWinEffect(): void {
        if (this.winEffectText && isValid(this.winEffectText.node, true)) {
            this.winEffectText.clear();
            this.winEffectText.node.active = false;
        }
        if (this.winEffectConfetti && isValid(this.winEffectConfetti.node, true)) {
            this.winEffectConfetti.stop();
            this.winEffectConfetti.clear();
            this.winEffectConfetti.node.active = false;
        }
    }

    /** Safe for restart, close, repeated level loads, and destruction mid-flight. */
    cancel(): void {
        this.generation++;
        this.pulseToken++;
        this.ready = false;
        this.hideWinEffect();
        for (const job of this.jobs.splice(0)) job.finish(false);
        if (this.board && isValid(this.board, true)) {
            this.board.stopVictory();
            if (this.boardPosition) this.board.node.setPosition(this.boardPosition);
            if (this.boardScale) this.board.node.setScale(this.boardScale);
        }
        if (this.boardWidget && isValid(this.boardWidget, true)) this.boardWidget.enabled = this.boardWidgetEnabled;
        for (const item of this.savedHud) if (isValid(item.node, true)) {
            item.node.active = item.active;
            this.opacity(item.node).opacity = item.opacity;
        }
        this.savedHud = [];
        for (const node of this.flights) if (isValid(node, true)) node.destroy();
        this.flights.clear();
        if (this.blocker && isValid(this.blocker, true)) this.blocker.destroy();
        this.blocker = null;
        if (this.railGroup && isValid(this.railGroup, true)) {
            this.railGroup.active = false;
            if (this.board) this.railGroup.setScale(this.railScale);
        }
        if (this.nextButton && isValid(this.nextButton, true)) {
            this.nextButton.node.off(Button.EventType.CLICK, this.onNext, this);
            this.nextButton.node.active = false;
        }
        this.stopNextButtonBlink();
        this.board = null;
        this.boardPosition = null;
        this.boardScale = null;
        this.boardScaleMultiplier = 1;
        this.boardWidget = null;
        this.nextAction = null;
    }

    /** Dùng khi GameplayScreen bị UIManager tạm ẩn (active=false) để quay lại nguyên vẹn sau màn
     * Streak — KHÔNG được coi là đóng thật, xem comment ở field `suspended`. */
    setSuspended(suspended: boolean): void { this.suspended = suspended; }

    onDisable(): void { if (!this.suspended) this.cancel(); }
    onDestroy(): void { this.cancel(); }
}
