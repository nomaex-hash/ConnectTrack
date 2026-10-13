import { describe, expect, it, vi } from 'vitest';
const animationTargets = vi.hoisted(() => [] as unknown[]);
vi.mock('cc', () => {
    class Vec3 { constructor(public x = 0, public y = 0, public z = 0) {} }
    class Node {
        active = true; isValid = true; children: Node[] = []; scale = new Vec3(1, 1, 1);
        private components = new Map<any, any>();
        constructor(public name = '') {}
        getComponent(type: any) { return this.components.get(type) ?? null; }
        addComponent(type: any) { const c = new type(); this.components.set(type, c); return c; }
        getChildByName(name: string) { return this.children.find(child => child.name === name) ?? null; }
        setScale(x: number | Vec3, y?: number, z?: number) {
            this.scale = typeof x === 'number' ? new Vec3(x, y, z) : x;
        }
    }
    return { _decorator: { ccclass: () => (t: unknown) => t, property: () => () => {} },
        Node, Vec3, Component: class { node = new Node('Cell'); },
        Color: class {}, Sprite: class {}, UITransform: class {}, UIOpacity: class { opacity = 255; },
        sp: { Skeleton: class {} }, isValid: (n: any) => !!n?.isValid,
        Tween: { stopAllByTarget: vi.fn() }, tween: (node: unknown) => {
            animationTargets.push(node);
            const chain: any = { delay: () => chain, to: () => chain, call: () => chain, start: () => chain };
            return chain;
        } };
});
import { Node, UIOpacity } from 'cc';
import { ConnectTracksCellView } from '../../../assets/scripts/presentation/board/connectTracksCellView';
import { buildBoardViewModel } from '../../../assets/scripts/presentation/board/boardViewModel';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { TEST_LEVEL } from '../domain/fixtures';

describe('cell spawn presentation', () => {
    it('hides underlying preview for Hint without hiding the background and restores on close/recycle', () => {
        const view = new ConnectTracksCellView();
        const preview = new Node('Preview'), track = new Node('Track'), bg = new Node('Background');
        track.active = false;
        Object.assign(view, { trackPreview: preview, straightHorizontal: track, background: bg });
        view.setHintTrackHidden(true); view.setHintTrackHidden(true);
        expect(preview.active).toBe(false); expect(bg.active).toBe(true);
        view.setHintTrackHidden(false);
        expect(preview.active).toBe(true); expect(track.active).toBe(false);
        view.setHintTrackHidden(true); view.recycle();
        expect(preview.active).toBe(true);
    });
    it('deactivates faded marks to stop Spine work and restores them on cancellation', () => {
        const view = new ConnectTracksCellView();
        const mark = new Node('mark');
        (view as any).markX = mark;
        for (const kind of ['correct', 'false']) {
            (view as any).markKind = kind;
            view.setVictoryMarkFade(.5);
            expect(mark.active).toBe(true);
            view.setVictoryMarkFade(1);
            expect(mark.active).toBe(false);
            expect(mark.getComponent(UIOpacity)!.opacity).toBe(0);
            view.restoreVictoryMark();
            expect(mark.active).toBe(true);
            expect(mark.getComponent(UIOpacity)!.opacity).toBe(255);
        }
    });
    it('prepares given track parts without separate tweens and gates them behind the root spawn opacity', () => {
        const view = new ConnectTracksCellView();
        const main = new Node('main');
        const sleeper = new Node('sleeper'), rail = new Node('rail');
        main.children.push(sleeper, rail);
        (view as any).mainStraightHorizontal = main;
        animationTargets.length = 0;
        view.playAppear(.2, 1);
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        view.render(buildBoardViewModel(session.snapshot()).cells[0]);
        expect(main.active).toBe(true);
        expect(sleeper.active).toBe(true);
        expect(rail.active).toBe(true);
        expect(view.node.getComponent(UIOpacity)!.opacity).toBe(0);
        expect(animationTargets).toEqual([view.node]);
    });

    it('restored preview joins the Cell spawn; later player placement still animates', () => {
        const view = new ConnectTracksCellView();
        const preview = new Node('preview');
        (view as any).trackPreview = preview;
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        session.dispatch({ type: 'doubleTapCell', cell: 1 });
        animationTargets.length = 0;
        view.playAppear(.2, 1);
        view.render(buildBoardViewModel(session.snapshot()).cells[1]);
        expect(preview.active).toBe(true);
        expect(animationTargets).toEqual([view.node]);
        session.dispatch({ type: 'restart' });
        view.render(buildBoardViewModel(session.snapshot()).cells[1]);
        session.dispatch({ type: 'doubleTapCell', cell: 1 });
        animationTargets.length = 0;
        view.render(buildBoardViewModel(session.snapshot()).cells[1]);
        expect(animationTargets).toContain(preview);
    });
});

it('restores the exact mirrored entrance pose after the train overlay before cell reuse', () => {
    const view = new ConnectTracksCellView() as any;
    const vector = (x: number, y: number, z: number): any => ({ x, y, z, clone: () => vector(x, y, z) });
    const parent = { isValid: true }, layer = { isValid: true };
    const gate: any = {
        active: true, isValid: true, parent,
        position: vector(0, 40, 0), scale: vector(1, -1, 1), eulerAngles: vector(0, 0, 0),
        getSiblingIndex: () => 2, setSiblingIndex: vi.fn(),
        setParent: (next: any, keepWorld?: boolean) => {
            gate.parent = next;
            if (keepWorld) { gate.scale = vector(-1, 1, 1); gate.eulerAngles = vector(0, 0, 180); }
        },
        setPosition: (v: any) => { gate.position = v; },
        setScale: (v: any) => { gate.scale = v; },
        setRotationFromEuler: (v: any) => { gate.eulerAngles = v; },
    };
    view.entranceIn = gate;
    for (let i = 0; i < 3; i++) {
        view.raiseEntrances(layer);
        view.restoreEntrances();
        expect(gate.parent).toBe(parent);
        expect([gate.scale.x, gate.scale.y, gate.scale.z]).toEqual([1, -1, 1]);
        expect(gate.eulerAngles.z).toBe(0);
        expect(gate.position.y).toBe(40);
    }
});
