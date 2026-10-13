import { expect, it, vi } from 'vitest';

vi.mock('cc', () => ({
    _decorator: { ccclass: () => (t: unknown) => t, property: () => () => {} },
    Component: class {}, Node: class {}, UIOpacity: class { opacity = 255; },
    Tween: { stopAllByTarget: vi.fn() },
    tween: (target: any) => {
        const steps: (() => void)[] = [];
        const chain = {
            to: (_: number, props: object) => { steps.push(() => Object.assign(target, props)); return chain; },
            call: (callback: () => void) => { steps.push(callback); return chain; },
            start: () => { steps.forEach(step => step()); return chain; },
        };
        return chain;
    },
}));
import { ConnectTracksOptionMenuView } from '../../../assets/scripts/presentation/board/connectTracksOptionMenuView';

function setup(initiallyActive = false) {
    const view = new ConnectTracksOptionMenuView();
    let active = initiallyActive, loaded = false;
    let opacity: any = null;
    const node = {
        get active() { return active; },
        set active(value: boolean) {
            active = value;
            // Cocos defers onLoad for an inactive prefab until its first activation.
            if (value && !loaded) { loaded = true; view.onLoad(); }
        },
        getComponent: () => opacity,
        addComponent: () => opacity = { opacity: 255 },
    };
    view.node = node as any;
    if (initiallyActive) { loaded = true; view.onLoad(); }
    const validity: any = { current: 'trackPreview' };
    return { view, node, validity };
}

it('opens on the first selection even when onLoad runs inside show()', () => {
    const { view, node, validity } = setup();
    view.hideInstant();
    view.show(validity);
    expect(node.active).toBe(true);
    expect(node.getComponent().opacity).toBe(255);
    view.show(validity);
    expect(node.active).toBe(true);
});

it('starts hidden when initially active and supports close/reopen and level reset', () => {
    const { view, node, validity } = setup(true);
    expect(node.active).toBe(false);
    view.show(validity);
    expect(node.active).toBe(true);
    view.hide();
    expect(node.active).toBe(false);
    view.show(validity);
    expect(node.active).toBe(true);
    view.hideInstant();
    view.show(validity);
    expect(node.active).toBe(true);
    expect(node.getComponent().opacity).toBe(255);
});
