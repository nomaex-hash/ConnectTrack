import { describe, expect, it, vi } from 'vitest';

vi.mock('cc', () => {
    class Vec3 {
        constructor(public x = 0, public y = 0, public z = 0) {}
        clone() { return new Vec3(this.x, this.y, this.z); }
        static lerp(out: Vec3, a: Vec3, b: Vec3, t: number) {
            out.x = a.x + (b.x - a.x) * t; out.y = a.y + (b.y - a.y) * t; out.z = a.z + (b.z - a.z) * t; return out;
        }
        static multiplyScalar(out: Vec3, a: Vec3, t: number) { out.x = a.x * t; out.y = a.y * t; out.z = a.z * t; return out; }
    }
    class Node {
        active = true; isValid = true; layer = 1; children: Node[] = [];
        position = new Vec3(); scale = new Vec3(1, 1, 1);
        private parentNode: Node | null = null;
        private components = new Map<unknown, any>();
        constructor(public name = '') {}
        get parent() { return this.parentNode; }
        set parent(value: Node | null) { this.parentNode = value; value?.children.push(this); }
        get worldPosition() { return this.position; }
        setWorldPosition(value: Vec3) { this.position = value.clone(); }
        setPosition(value: Vec3) { this.position = value.clone(); }
        inverseTransformPoint(out: Vec3, point: Vec3) {
            out.x = (point.x - this.position.x) / this.scale.x;
            out.y = (point.y - this.position.y) / this.scale.y;
            out.z = (point.z - this.position.z) / this.scale.z;
            return out;
        }
        setScale(value: Vec3) { this.scale = value.clone(); }
        setSiblingIndex() {}
        getComponent(type: any) { return this.components.get(type) ?? null; }
        addComponent(type: any) { const c = new type(); c.node = this; this.components.set(type, c); return c; }
        getComponentsInChildren() { return []; }
        getChildByName(name: string) { return this.children.find(child => child.name === name) ?? null; }
        isChildOf(node: Node): boolean { return this.parentNode === node || !!this.parentNode?.isChildOf(node); }
        destroy() { this.isValid = false; }
        on() {} off() {}
    }
    class UITransform { contentSize = { width: 720, height: 1280 }; anchorPoint = { x: .5, y: .5 }; setContentSize() {} setAnchorPoint() {} }
    class Button { static EventType = { CLICK: 'click' }; node = new Node('next'); interactable = true; isValid = true; }
    class ChainableTween {
        to() { return this; } delay() { return this; } call(fn?: () => void) { fn?.(); return this; } start() { return this; }
        repeatForever() { return this; }
    }
    return {
        _decorator: { ccclass: () => (target: unknown) => target, property: () => () => {} },
        Node, Vec3, UITransform, Button, Component: class { node = new Node('sequence'); },
        UIOpacity: class { opacity = 255; }, Widget: class {}, Label: class {}, Prefab: class {}, Font: class {},
        Color: class { constructor(public r = 0, public g = 0, public b = 0, public a = 255) {} },
        BlockInputEvents: class {}, MotionStreak: class {}, ParticleSystem: class {}, sp: { Skeleton: class {} },
        tween: vi.fn(() => new ChainableTween()), Tween: class { static stopAllByTarget() {} },
        instantiate: vi.fn(() => new Node('star')), isValid: (item: any) => !!item && item.isValid !== false, warn: vi.fn(),
    };
});
vi.mock('../../../assets/scripts/presentation/board/connectTracksBoardView', () => ({ ConnectTracksBoardView: class {} }));
vi.mock('../../../assets/scripts/presentation/board/trainPath', () => ({ traceTrainPath: () => [0, 1, 2, 3, 4, 5, 6] }));

import { Button, Node, Prefab, UIOpacity, Vec3, instantiate, warn } from 'cc';
import { ConnectTracksVictoryView } from '../../../assets/scripts/presentation/board/connectTracksVictoryView';

function setup() {
    const view = new ConnectTracksVictoryView();
    const root = new Node('screen');
    view.node.parent = root;
    const boardNode = new Node('board'); boardNode.parent = root;
    boardNode.setPosition(new Vec3(10, 20));
    const hud = new Node('hud'); hud.parent = root;
    const background = new Node('Background'); background.parent = root;
    const board = { node: boardNode, isValid: true, setRailGlow: vi.fn(), setVictoryMarksFade: vi.fn(), setVictoryCluesFade: vi.fn(), stopVictory: vi.fn(),
        getVictoryScaleMultiplier: vi.fn(() => 1.2),
        getCellWorldPosition: (cell: number) => new Vec3(cell * 10, 0), playVictoryTrain: vi.fn() };
    view.railGroup = new Node('rail'); view.railGroup.parent = root;
    view.railLabel = { string: '', node: new Node('count') } as any;
    view.flightLayer = new Node('flights'); view.flightLayer.parent = root;
    view.starPrefab = {} as Prefab;
    view.boardCenterTarget = new Node('center'); view.boardCenterTarget.parent = root;
    view.boardCenterTarget.setWorldPosition(new Vec3(100, 200));
    view.nextButton = new Button(); view.nextButton.node.parent = root;
    // completed() now receives a `resume` callback (train is deferred until the caller signals
    // ready, see ConnectTracksVictoryView.run()) — default stub resumes immediately, matching the
    // old synchronous behavior these tests expect.
    const completed = vi.fn((resume: () => void) => resume()), next = vi.fn();
    const snapshot = { cellStates: ['Empty', 'Track', 'Track', 'Track', 'Track', 'Track', 'Empty'], mainTrackCells: [0, 6] };
    const begin = () => view.begin(board as any, snapshot as any, root, completed, next);
    return { view, board, hud, background, completed, next, begin };
}
async function advance(view: ConnectTracksVictoryView, frames: number) {
    for (let i = 0; i < frames; i++) { view.update(.01); await Promise.resolve(); await Promise.resolve(); }
}

describe('victory sequence with mocked Cocos', () => {
    it('zooms while moving using the captured clue footprint and restores scale on cancel', async () => {
        const { view, board, begin } = setup();
        board.node.setScale(new Vec3(.8, .8, 1));
        expect(begin()).toBe(true);
        expect(board.getVictoryScaleMultiplier).toHaveBeenCalledTimes(1);
        // Isolate the movement stage after begin captured the original footprint.
        for (const job of (view as any).jobs.splice(0)) job.finish(false);
        const move = (view as any).moveBoardToCenter();
        view.update(view.boardMoveSeconds / 2);
        expect(board.node.scale.x).toBeCloseTo(.88);
        expect(board.node.position.x).toBe(55);
        view.update(view.boardMoveSeconds / 2);
        expect(await move).toBe(true);
        expect(board.node.scale.x).toBeCloseTo(.96);
        expect(board.node.scale.z).toBe(1);
        view.cancel();
        expect(board.node.scale).toEqual(new Vec3(.8, .8, 1));
        expect(board.node.position).toEqual(new Vec3(10, 20));
    });
    it('moves in local space with a fixed destination and no per-frame world conversion', async () => {
        const { view, board } = setup();
        (view as any).board = board;
        const parent = board.node.parent!;
        parent.setPosition(new Vec3(20, 40));
        parent.setScale(new Vec3(2, 2, 1));
        const conversion = vi.spyOn(parent, 'inverseTransformPoint');
        const worldWrites = vi.spyOn(board.node, 'setWorldPosition');
        const move = (view as any).moveBoardToCenter();
        view.update(view.boardMoveSeconds / 2);
        expect(board.node.position).toEqual(new Vec3(25, 50));
        view.boardCenterTarget!.setWorldPosition(new Vec3(900, 900));
        view.update(view.boardMoveSeconds / 2);
        expect(await move).toBe(true);
        expect(board.node.position).toEqual(new Vec3(40, 80));
        expect(conversion).toHaveBeenCalledTimes(1);
        expect(worldWrites).not.toHaveBeenCalled();
    });
    it('runs 1 continuous wave spanning multiple cells at once, then clears all glow', async () => {
        const { view, board } = setup();
        (view as any).board = board;
        // Mỗi ô tự chạy 1 chu kỳ fade-out ĐỘC LẬP dài railGlowSeconds, trễ theo thứ tự trong path
        // (i * waveCellSeconds) — railGlowSeconds > waveCellSeconds (0.3 > 0.1) khiến các ô liền kề
        // chồng lấp thời gian chạy, TỰ KHẮC tạo ra >1 ô sáng cùng lúc, không cần "cửa sổ" cố định.
        view.railGlowSeconds = .3;
        const path = [0, 1, 2, 3, 4, 5];
        const wave = (view as any).playRailWave(path, 0, .1);

        // Giữa sóng, MỘT khung hình phải thắp sáng NHIỀU ô cùng lúc (khác hẳn kiểu pulse cũ, mỗi ô
        // tự chạy độc lập) — kiểm tra ít nhất 1 frame có >1 ô active=true cùng lúc.
        let sawMultiCellFrame = false;
        for (let i = 0; i < 90; i++) {
            const before = board.setRailGlow.mock.calls.length;
            view.update(.01);
            const litCells = new Set(
                board.setRailGlow.mock.calls.slice(before)
                    .filter((call: unknown[]) => call[1] === true)
                    .map((call: unknown[]) => call[0]),
            );
            if (litCells.size > 1) sawMultiCellFrame = true;
            await Promise.resolve(); await Promise.resolve();
        }
        expect(sawMultiCellFrame).toBe(true);

        await wave;
        for (const cell of path) {
            expect(board.setRailGlow).toHaveBeenCalledWith(cell, false);
        }
    });

    it('flies to the count Label world position rather than the RailGroup origin', async () => {
        const { view, board } = setup();
        (view as any).board = board;
        view.railLabel!.node.setWorldPosition(new Vec3(125, 230));
        view.railGroup!.setWorldPosition(new Vec3(10, 20));
        const flight = (view as any).flyStar(0, 3, 0);
        const star = vi.mocked(instantiate).mock.results.at(-1)!.value;
        view.update(view.starFlightSeconds);
        expect(star.worldPosition.x).toBeCloseTo(125);
        expect(star.worldPosition.y).toBeCloseTo(230);
        await advance(view, 30);
        expect(await flight).toBe(true);
    });

    it('waits .1s, sweeps, collects all rails, fades HUD, centres board, starts train and enables next without waiting for train', async () => {
        const { view, board, hud, background, completed, next, begin } = setup();
        expect(begin()).toBe(true);
        await advance(view, 9);
        expect(board.setRailGlow).not.toHaveBeenCalled();
        expect(view.railGroup!.active).toBe(false);
        await advance(view, 12);
        expect(board.setVictoryMarksFade).toHaveBeenCalledWith(0);
        expect(board.setRailGlow).not.toHaveBeenCalled();
        await advance(view, 25);
        expect(board.setVictoryMarksFade).toHaveBeenLastCalledWith(1);
        // Sóng glow liên tục (playRailWave) đã bắt đầu chạy — chi tiết hình dạng sóng (nhiều ô
        // sáng cùng lúc, độ sáng theo khoảng cách) được test riêng ở "runs 1 continuous wave...".
        expect(board.setRailGlow).toHaveBeenCalled();
        expect(completed).not.toHaveBeenCalled();
        await advance(view, 360);
        expect(view.railLabel!.string).toBe('7');
        expect(view.railGroup!.active).toBe(false);
        expect(hud.active).toBe(false);
        expect(board.setVictoryCluesFade).toHaveBeenCalledWith(0);
        expect(board.setVictoryCluesFade).toHaveBeenLastCalledWith(1);
        expect(background.active).toBe(true);
        expect(background.getComponent(UIOpacity)?.opacity ?? 255).toBe(255);
        expect(board.node.worldPosition).toEqual(new Vec3(100, 200));
        expect(board.playVictoryTrain).toHaveBeenCalledTimes(1);
        expect(view.nextButton!.node.active).toBe(true);
        expect(completed).toHaveBeenCalledTimes(1);
        board.playVictoryTrain.mock.calls[0][1]();
        await advance(view, 40);
        expect(completed).toHaveBeenCalledTimes(1);
        expect(view.nextButton!.interactable).toBe(true);
        (view as any).onNext(); (view as any).onNext();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('waits for slow flights after the wave before hiding Rail or moving the board', async () => {
        const { view, board, begin } = setup();
        view.starFlightSeconds = 2;
        begin(); await advance(view, 100);
        expect(view.railGroup!.active).toBe(true);
        expect(view.railLabel!.string).toBe('0');
        expect(board.playVictoryTrain).not.toHaveBeenCalled();
        expect(board.node.worldPosition).toEqual(new Vec3(10, 20));
        view.cancel();
    });

    it.each([5, 25, 70, 160, 260])('cancels at frame %i and restores state without a late completion', async frames => {
        const { view, board, hud, completed, begin } = setup();
        begin(); await advance(view, frames);
        const oldTrainCallback = board.playVictoryTrain.mock.calls[0]?.[1];
        view.cancel(); oldTrainCallback?.();
        await advance(view, 300);
        expect(completed).toHaveBeenCalledTimes(oldTrainCallback ? 1 : 0);
        expect(hud.active).toBe(true);
        expect(hud.getComponent(UIOpacity)?.opacity ?? 255).toBe(255);
        expect(board.node.position).toEqual(new Vec3(10, 20));
        expect(view.nextButton!.node.active).toBe(false);
        expect((view as any).flights.size).toBe(0);
        expect((view as any).jobs).toHaveLength(0);
    });

    it('can begin again after cancellation and resets Rail to zero', async () => {
        const { view, begin } = setup(); begin(); await advance(view, 100); view.cancel();
        expect(begin()).toBe(true); expect(view.railLabel!.string).toBe('0'); view.cancel();
    });

    it('finishes the victory flow even when the optional star prefab is unassigned', async () => {
        const { view, board, completed, next, begin } = setup();
        view.starPrefab = null;
        expect(begin()).toBe(true);
        await advance(view, 400);
        expect(view.railLabel!.string).toBe('7');
        expect((view as any).flights.size).toBe(0);
        expect(board.playVictoryTrain).toHaveBeenCalledTimes(1);
        board.playVictoryTrain.mock.calls[0][1]();
        await advance(view, 40);
        expect(completed).toHaveBeenCalledTimes(1);
        expect(view.nextButton!.interactable).toBe(true);
        (view as any).onNext();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('cancels pending arrivals safely when the star prefab is unassigned', async () => {
        const { view, board, completed, begin } = setup();
        view.starPrefab = null;
        begin(); await advance(view, 25); view.cancel();
        await advance(view, 300);
        expect(view.railLabel!.string).toBe('0');
        expect(board.playVictoryTrain).not.toHaveBeenCalled();
        expect(completed).not.toHaveBeenCalled();
    });

    it('reports missing required bindings without invoking completion', () => {
        const { view, completed, begin } = setup(); view.railLabel = null;
        expect(begin()).toBe(false); expect(warn).toHaveBeenCalled(); expect(completed).not.toHaveBeenCalled();
    });
});
