import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('cc', () => {
    class Vec3 { constructor(public x = 0, public y = 0, public z = 0) {} clone() { return new Vec3(this.x, this.y, this.z); } }
    class Node {
        parent: Node | null = null; active = true; isValid = true; layer = 1; index = 0;
        children: Node[] = [];
        position = new Vec3(); scale = new Vec3(1, 1, 1); worldRotation = {};
        components = new Map<any, any>();
        constructor(public name = '') {}
        get worldPosition() { return this.position; } get worldScale() { return this.scale; }
        setParent(p: Node) { this.parent = p; }
        setPosition(v: any, y?: number) { this.position = typeof v === 'number' ? new Vec3(v, y) : v.clone(); }
        setScale(v: Vec3 | number, y?: number, z?: number) { this.scale = typeof v === 'number' ? new Vec3(v, y, z) : v.clone(); }
        setWorldPosition(v: Vec3) { this.setPosition(v); } setWorldScale(v: Vec3) { this.setScale(v); }
        setWorldRotation() {} getSiblingIndex() { return this.index; } setSiblingIndex(i: number) { this.index = i; }
        getComponent(t: any) { return this.components.get(t); }
        getChildByName(name: string) { return this.children.find(c => c.name === name) ?? null; }
        getComponentsInChildren(t: any): any[] { return [...(this.components.has(t) ? [this.components.get(t)] : []), ...this.children.flatMap(c => c.getComponentsInChildren(t))]; }
        // Cocos singular API excludes self; plural API above includes self.
        getComponentInChildren(t: any) { return this.children.flatMap(c => c.getComponentsInChildren(t))[0] ?? null; }
        addComponent(t: any) { const c = new t(); this.components.set(t, c); return c; }
        destroy() { this.isValid = false; }
    }
    class Color {
        constructor(public r = 255, public g = 255, public b = 255, public a = 255) {}
        clone() { return new Color(this.r, this.g, this.b, this.a); }
    }
    class Sprite { static SizeMode = { CUSTOM: 0 }; color = new Color(); }
    return { _decorator: { ccclass: () => (t: any) => t, property: () => () => {} }, Node, Vec3,
        Component: class { node = new Node(); }, UITransform: class { width = 100; height = 100; anchorX = .5; anchorY = .5; setContentSize() {} },
        Graphics: class { moveTo() {} lineTo() {} rect() {} stroke() {} }, Color,
        Sprite, SpriteFrame: class {}, RichText: class {}, BlockInputEvents: class {},
        instantiate: vi.fn((source: Node) => {
            const clone = (src: Node): Node => {
                const n = new Node(src.name); n.active = src.active; n.scale = src.scale.clone();
                n.position = src.position.clone(); n.components = new Map([...src.components].map(([t, c]) => [t, Object.assign(Object.create(Object.getPrototypeOf(c)), c)]));
                n.children = src.children.map(clone); return n;
            };
            return clone(source);
        }),
        isValid: (n: any) => n?.isValid !== false && !!n, warn: vi.fn() };
});
vi.mock('../../../assets/scripts/presentation/board/connectTracksBoardView', () => ({ ConnectTracksBoardView: class {} }));
import { Node, Vec3, instantiate, UITransform, Sprite, Color } from 'cc';
import { ConnectTracksHintView } from '../../../assets/scripts/presentation/board/connectTracksHintView';

function setup() {
    const view = new ConnectTracksHintView();
    view.dimNode = new Node(); view.content = new Node(); view.textLabel = { string: '' } as any;
    view.previewNode = new Node('PreviewTemplate'); view.previewNode.active = false;
    view.previewNode.addComponent(UITransform);
    const parent = new Node(), cell = new Node(); cell.parent = parent;
    cell.setPosition(new Vec3(32, 64)); cell.setScale(new Vec3(.7, .7, 1)); cell.setSiblingIndex(5);
    const board = { node: parent, getHintCellNode: () => cell, getCellSize: () => 64, setHintTracksHidden: vi.fn(),
        showLineClueHighlight: vi.fn(), hideLineClueHighlight: vi.fn() } as any;
    const hint = { rule: 'A1', action: 'preview', targets: [0], lifted: [0], directions: [], text: 'hint', error: false } as any;
    return { view, cell, parent, board, hint };
}
it('shows without Apply and restores cell parent/order/transform before applying exactly once', () => {
    const { view, cell, parent, board, hint } = setup(); const dismiss = vi.fn();
    const apply = vi.fn(() => expect(cell.parent).toBe(parent));
    expect(view.show(hint, board, 3, 3, apply, dismiss)).toBe(true);
    expect(cell.parent).not.toBe(parent); expect(apply).not.toHaveBeenCalled();
    // hint.text không còn được đọc trực tiếp nữa (bug đã sửa: text domain hardcode tiếng Việt,
    // bỏ qua ngôn ngữ đang chọn) — giờ map qua rule 'A1' -> key localization tương ứng.
    expect(view.textLabel!.string).toBe('connectTracksHint.trackAtEdge');
    view.onTapApply(); view.onTapApply();
    expect(apply).toHaveBeenCalledTimes(1); expect(dismiss).not.toHaveBeenCalled();
    expect(cell.getSiblingIndex()).toBe(5); expect(cell.position).toEqual(new Vec3(32, 64));
    expect(cell.scale).toEqual(new Vec3(.7, .7, 1)); expect(view.showing).toBe(false);
});
it('cancel/destroy restores cells without applying; overlay can reopen', () => {
    const { view, cell, parent, board, hint } = setup(); const apply = vi.fn(), dismiss = vi.fn();
    view.show(hint, board, 3, 3, apply, dismiss); view.onDisable();
    expect(cell.parent).toBe(parent); expect(dismiss).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
    expect(view.show(hint, board, 3, 3, apply, dismiss)).toBe(true);
    view.onDestroy(); expect(cell.parent).toBe(parent);
});
beforeEach(() => vi.clearAllMocks());
it('missing template does not open or lift any cell', () => {
    const { view, cell, parent, board, hint } = setup(); view.previewNode = null;
    expect(view.show(hint, board, 3, 3, vi.fn(), vi.fn())).toBe(false);
    expect(cell.parent).toBe(parent); expect(view.showing).toBe(false);
});

it('fits each cloned template to the current cell while preserving source and child layout', () => {
    const { view, board, hint } = setup();
    const source = view.previewNode!;
    source.setScale(new Vec3(.7, .9, 1)); source.setPosition(new Vec3(3, 5));
    const transform = source.addComponent(UITransform);
    (transform as any).width = 42; (transform as any).height = 57;
    const child = new Node('Icon'); (source as any).children.push(child);
    view.show({ ...hint, targets: [0, 1] }, board, 3, 3, vi.fn(), vi.fn());
    const copies = vi.mocked(instantiate).mock.results.map(r => r.value as Node);
    expect(copies).toHaveLength(2); expect(copies[0]).not.toBe(copies[1]);
    expect(copies[0].scale).toEqual(new Vec3(64 / 42, 64 / 57, 1));
    expect(copies[0].getComponent(UITransform)!.width).toBe(42);
    expect(copies[0].getComponent(UITransform)!.height).toBe(57);
    expect(copies[0].position).toEqual(new Vec3(-64, 64));
    expect(copies[1].position).toEqual(new Vec3(0, 64));
    expect(copies[0].children[0].layer).toBe(board.node.layer);
    expect(copies[0].active).toBe(true); expect(source.active).toBe(false);
    expect(source.scale).toEqual(new Vec3(.7, .9, 1));
    view.close(); expect(source.isValid).toBe(true);
    board.getCellSize = () => 40;
    view.show(hint, board, 3, 3, vi.fn(), vi.fn());
    const smaller = vi.mocked(instantiate).mock.results[2].value as Node;
    expect(smaller.scale.x * 42).toBeCloseTo(40);
    expect(smaller.scale.y * 57).toBeCloseTo(40);
});

it('rejects zero-sized template before lifting cells', () => {
    const { view, cell, parent, board, hint } = setup();
    view.previewNode!.getComponent(UITransform)!.width = 0;
    expect(view.show(hint, board, 3, 3, vi.fn(), vi.fn())).toBe(false);
    expect(cell.parent).toBe(parent);
});

it.each([false, true])('tints only cloned target borders and fits them to cell (error=%s)', error => {
    const { view, board, hint } = setup();
    const border = new Node('WhiteBorder'); border.active = false;
    border.addComponent(UITransform);
    const icon = new Node('BorderSprite'); icon.addComponent(Sprite);
    (border as any).children.push(icon);
    view.targetBorderNode = border;
    view.previewNode!.addComponent(Sprite);
    expect(view.show({ ...hint, error }, board, 3, 3, vi.fn(), vi.fn())).toBe(true);
    const copies = vi.mocked(instantiate).mock.results.map(r => r.value as Node);
    const outline = copies.find(n => n.name === 'WhiteBorder')!;
    expect(outline.scale.x * outline.getComponent(UITransform)!.width).toBe(64);
    expect(outline.getComponentInChildren(Sprite)!.color).toEqual(error ? view.errorBorderColor : view.correctBorderColor);
    expect(icon.getComponent(Sprite)!.color).toEqual(new Color());
    expect(copies[0].getComponent(Sprite)!.color).toEqual(new Color());
    expect(border.active).toBe(false);
});

it('opens when border Sprite is on the template root, as in GameplayScreen.prefab', () => {
    const { view, board, hint } = setup();
    const border = new Node('Line'); border.addComponent(UITransform); border.addComponent(Sprite);
    view.targetBorderNode = border;
    expect(border.getComponentInChildren(Sprite)).toBe(null);
    expect(view.show({ ...hint, action: 'removeX', error: true }, board, 3, 3, vi.fn(), vi.fn())).toBe(true);
    const clone = vi.mocked(instantiate).mock.results[0].value as Node;
    expect(clone.getComponent(Sprite)!.color).toEqual(view.errorBorderColor);
    expect(view.showing).toBe(true);
});

it('still rejects a border without any Sprite before lifting a cell', () => {
    const { view, cell, parent, board, hint } = setup();
    const border = new Node('MissingSprite'); border.addComponent(UITransform);
    view.targetBorderNode = border;
    expect(view.show(hint, board, 3, 3, vi.fn(), vi.fn())).toBe(false);
    expect(cell.parent).toBe(parent);
    expect(view.showing).toBe(false);
});

it.each([false, true])('shows initially inactive Apply and hides it on close/reopens (explicit=%s)', explicit => {
    const { view, board, hint } = setup();
    const button = new Node('btnApply'); button.active = false;
    if (explicit) view.applyButtonNode = button;
    else (view.content as any).children.push(button);
    view.onLoad();
    expect(button.active).toBe(false);
    expect(view.show(hint, board, 3, 3, vi.fn(), vi.fn())).toBe(true);
    expect(button.active).toBe(true);
    view.onTapApply(); expect(button.active).toBe(false);
    view.show(hint, board, 3, 3, vi.fn(), vi.fn()); expect(button.active).toBe(true);
    view.onTapCancel(); expect(button.active).toBe(false);
});

it.each(['onTapApply', 'onTapCancel', 'onDisable'] as const)('B1 suppresses only target track art and restores before %s callback', method => {
    const { view, board, hint } = setup();
    view.straightHorizontalNode = view.previewNode;
    const completed = vi.fn(() => expect(board.setHintTracksHidden).toHaveBeenLastCalledWith([0], false));
    expect(view.show({ ...hint, action: 'shape', directions: [8, 2], targets: [0], lifted: [0, 1] },
        board, 3, 3, completed, completed)).toBe(true);
    expect(board.setHintTracksHidden).toHaveBeenLastCalledWith([0], true);
    view[method]();
    expect(completed).toHaveBeenCalledTimes(1);
});
