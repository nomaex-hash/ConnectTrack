import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('cc', () => ({
    _decorator: { ccclass: () => (t: unknown) => t, requireComponent: () => (t: unknown) => t,
        property: () => () => {} },
    Component: class {}, Canvas: class {}, Node: class {}, UITransform: class {}, Widget: class {},
    Enum: (value: unknown) => value,
    Vec3: class {
        constructor(public x = 0, public y = 0, public z = 0) {}
        set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
        clone() { return new (this.constructor as any)(this.x, this.y, this.z); }
    },
    screen: { windowSize: { width: 360, height: 1280 } }, warn: vi.fn(),
}));
import { Canvas, UITransform, Vec3, screen, warn } from 'cc';
import { ResponsiveUI } from '../../../assets/scripts/presentation/ui/responsiveUI';

function setup(attached = true) {
    const camera = {
        rect: { x: 0, y: 0, width: 1, height: 1 },
        worldToScreen: (_: unknown, out: Vec3) => out.set(0, 0, 0),
        screenToWorld: (p: Vec3, out: Vec3) => out.set(
            p.x - screen.windowSize.width / 2, p.y - screen.windowSize.height / 2, 0),
    };
    const parent: any = { parent: null, worldPosition: new Vec3(),
        getComponent: (type: unknown) => attached && type === Canvas ? { cameraComponent: camera } : null,
        inverseTransformPoint: (out: Vec3, p: Vec3) => out.set(p.x, p.y, p.z) };
    const node: any = { parent, scale: new Vec3(1, 1, 1), position: new Vec3(0, -37, 0),
        setScale: vi.fn((x: number, y: number, z: number) => node.scale.set(x, y, z)),
        setPosition: vi.fn((x: number, y: number, z: number) => node.position.set(x, y, z)) };
    const rect: any = { node, width: 720, height: 1280, anchorX: .5, anchorY: .5 };
    const component: any = new ResponsiveUI();
    component.node = node;
    component.getComponent = (type: unknown) => type === UITransform ? rect : null;
    component.onLoad();
    component.onEnable();
    return { component, node, rect, camera, attach: () => { attached = true; } };
}

beforeEach(() => {
    screen.windowSize.width = 360;
    screen.windowSize.height = 1280;
    vi.clearAllMocks();
});

it('self Target Area falls back to viewport and warns once, without progressive shrinking', () => {
    const { component, node, rect } = setup();
    component.targetArea = rect;
    for (let i = 0; i < 20; i++) component.lateUpdate();
    expect(node.scale.x).toBe(.5);
    expect(node.position.y).toBe(0);
    expect(node.setScale).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
});

it('updates on live width/height/viewport changes and restores at most original scale', () => {
    const { component, node, camera } = setup();
    component.lateUpdate();
    expect(node.scale.x).toBe(.5);
    screen.windowSize.width = 1440;
    component.lateUpdate();
    expect(node.scale.x).toBe(1);
    screen.windowSize.height = 320;
    component.lateUpdate();
    expect(node.scale.x).toBe(.25);
    screen.windowSize.height = 2560;
    camera.rect.width = .125;
    component.lateUpdate();
    expect(node.scale.x).toBe(.25);
    expect(node.position.x).toBe(-630);
});

it('discovers Canvas added after onLoad without reloading or re-enabling', () => {
    const { component, node, attach } = setup(false);
    component.lateUpdate();
    expect(node.setScale).not.toHaveBeenCalled();
    attach();
    component.lateUpdate();
    expect(node.scale.x).toBe(.5);
});

it('uses viewport for a descendant Target Area too', () => {
    const { component, node } = setup();
    component.targetArea = { node: { isChildOf: (other: unknown) => other === node } };
    component.lateUpdate();
    expect(node.scale.x).toBe(.5);
});
