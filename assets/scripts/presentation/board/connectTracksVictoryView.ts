import { _decorator, BlockInputEvents, Button, Component, Label, MotionStreak, Node, ParticleSystem, Prefab, UITransform, UIOpacity, Vec3, Widget, instantiate, isValid, sp, warn } from 'cc';
import { GameSnapshot } from '../../application/contracts/gameSnapshot';
import { ConnectTracksBoardView } from './connectTracksBoardView';
import { traceTrainPath } from './trainPath';
import { railStarAmount } from './railVictoryPlan';

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
    @property({ min: 0.01, tooltip: 'Thời gian sóng đi qua mỗi ô (giây).' })
    waveCellSeconds = 0.07;
    @property({ min: 0.01, tooltip: 'Thời gian làm mờ tất cả dấu X và dấu sai trước khi sóng chạy.' })
    marksFadeSeconds = 0.25;
    @property({ min: 0.01, tooltip: 'Thời gian glow mỗi ô mờ lên 131 rồi mờ về 0; độc lập khoảng cách sóng giữa các ô.' })
    glowPulseSeconds = 0.25;
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
    @property({ min: 0.01 })
    hudFadeSeconds = 0.25;
    @property({ min: 0.01 })
    boardMoveSeconds = 0.4;
    @property({ min: 0.01 })
    nextFadeSeconds = 0.25;

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
    private railCount = 0;
    private pulseToken = 0;
    /** "Bỏ hiệu ứng sao bay, chỉ kích hoạt sau level 10" (xác nhận từ user) — begin()'s `starsEnabled`
     * gates BOTH the flying star AND its Rail counter reveal together (hiện Rail Group với số "0"
     * mãi mãi lúc sao bị tắt sẽ trông gãy). Sóng glow từng ô (pulseRail/setRailGlow) KHÔNG bị tắt —
     * đó là hiệu ứng sóng chạy dọc đường ray, không phải sao, vẫn giữ nguyên dù starsEnabled=false. */
    private starsEnabled = true;

    onLoad(): void {
        if (this.railGroup) this.railGroup.active = false;
        if (this.nextButton) this.nextButton.node.active = false;
    }

    update(dt: number): void {
        for (const job of [...this.jobs]) {
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
        const reveal = this.starsEnabled ? this.showRail(true) : Promise.resolve(true);
        const arrivals: Promise<boolean>[] = [];
        for (let index = 0; index < path.length; index++) {
            arrivals.push(this.pulseRail(path[index], token));
            if (this.starsEnabled) {
                const amount = railStarAmount(path.length, index);
                if (amount) arrivals.push(this.flyStar(path[index], amount, token));
            }
            if (!await this.animate(this.waveCellSeconds, () => {}) || token !== this.generation) return;
        }
        if (!(await Promise.all([reveal, ...arrivals])).every(Boolean) || token !== this.generation) return;
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
        // "Tàu hoãn chạy cho đến khi luồng thắng của các popup khác (Tournament/LeaderboardPreview)
        // chạy xong" (xác nhận từ user, đúng thứ tự ưu tiên ResultPopup thật) — completed() giờ
        // nhận `resume`, chỉ gọi khi THỰC SỰ sẵn sàng (đồng bộ nếu không có gì phải đợi, hoặc SAU
        // khi popup đóng hết) thay vì tàu tự chạy ngay sau completed() như trước. unlock next
        // level/label vẫn chạy ngay trong completed(), không phụ thuộc resume.
        await new Promise<void>(resolve => completed(resolve));
        if (token !== this.generation) return;
        this.board!.playVictoryTrain(snapshot, () => {});
        const button = this.nextButton!;
        button.node.active = true;
        button.node.setSiblingIndex(-1);
        if (!await this.animate(this.nextFadeSeconds, t => { this.opacity(button.node).opacity = t * 255; }) || token !== this.generation) return;
        button.interactable = true;
        if (this.blocker && isValid(this.blocker, true)) this.blocker.destroy();
        this.blocker = null;
        this.ready = true;
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
            this.railGroup!.setScale(Vec3.multiplyScalar(new Vec3(), this.railScale, 0.85 + 0.15 * progress));
        });
    }

    private async pulseRail(cell: number, token: number): Promise<boolean> {
        const done = await this.animate(this.glowPulseSeconds, t => {
            this.board!.setRailGlow(cell, true, 131 * (1 - Math.abs(2 * t - 1)));
        });
        if (!done || token !== this.generation) return false;
        this.board!.setRailGlow(cell, false);
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
        this.railLabel!.string = String(this.railCount);
        const pulse = ++this.pulseToken;
        return this.animate(this.railPulseSeconds, t => {
            if (pulse === this.pulseToken) this.railGroup!.setScale(Vec3.multiplyScalar(new Vec3(), this.railScale, 1 + 0.1 * Math.sin(Math.PI * t)));
        });
    }

    private animate(seconds: number, draw: (progress: number) => void): Promise<boolean> {
        draw(0);
        return new Promise(resolve => this.jobs.push({ elapsed: 0,
            duration: Number.isFinite(seconds) ? Math.max(0.001, seconds) : 0.2, draw, finish: resolve }));
    }

    private opacity(node: Node): UIOpacity {
        return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
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
        const protectedNodes = [background, this.board!.node, this.node, this.railGroup, this.flightLayer, this.boardCenterTarget, this.nextButton!.node, this.blocker];
        const visit = (node: Node): void => {
            if (protectedNodes.includes(node)) return;
            if (protectedNodes.some(kept => kept?.isChildOf(node))) {
                [...node.children].forEach(visit);
                return;
            }
            this.savedHud.push({ node, active: node.active, opacity: this.opacity(node).opacity });
        };
        [...root.children].forEach(visit);
    }

    private onNext = (): void => {
        if (!this.ready) return;
        this.ready = false;
        if (this.nextButton) this.nextButton.interactable = false;
        this.nextAction?.();
    };

    /** Safe for restart, close, repeated level loads, and destruction mid-flight. */
    cancel(): void {
        this.generation++;
        this.pulseToken++;
        this.ready = false;
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
        this.board = null;
        this.boardPosition = null;
        this.boardScale = null;
        this.boardScaleMultiplier = 1;
        this.boardWidget = null;
        this.nextAction = null;
    }

    onDisable(): void { this.cancel(); }
    onDestroy(): void { this.cancel(); }
}
