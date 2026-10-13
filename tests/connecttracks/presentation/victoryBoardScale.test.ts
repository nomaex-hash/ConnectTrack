import { expect, it, vi } from 'vitest';
vi.mock('cc', () => ({
    _decorator: { ccclass: () => (t: unknown) => t, property: () => () => {} },
    Component: class {}, NodePool: class {}, Color: class {}, Graphics: class {}, Label: class {},
    Node: class {}, Prefab: class {}, UIOpacity: class {}, UITransform: class {}, Tween: class {},
    Vec3: class {
        x = 0; y = 0; z = 0;
        set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    },
    isValid: (value: any) => !!value && value.isValid !== false,
}));
vi.mock('../../../assets/scripts/presentation/board/connectTracksCellView', () => ({ APPEAR_DURATION: .2, ConnectTracksCellView: class {} }));
vi.mock('../../../assets/scripts/presentation/board/connectTracksTrainView', () => ({ ConnectTracksTrainView: class {} }));
import { ConnectTracksBoardView } from '../../../assets/scripts/presentation/board/connectTracksBoardView';

function setup() {
    const view: any = new ConnectTracksBoardView();
    view.width = view.height = 6;
    view.cellSize = 100;
    // Non-unit board transform must not change the local footprint ratio.
    view.node = { inverseTransformPoint: (out: any, p: any) => out.set((p.x - 70) / .8, (p.y - 90) / .8, 0) };
    const clue = (x: number, y: number, active = true) => ({
        node: { activeInHierarchy: active },
        label: { node: { getComponent: () => ({
            width: 40, height: 40, anchorX: .5, anchorY: .5,
            convertToWorldSpaceAR: (p: any, out: any) => out.set((x + p.x) * .8 + 70, (y + p.y) * .8 + 90, 0),
        }) } },
    });
    view.clueLabels = [clue(-330, 0), clue(0, 330), clue(-2000, 2000, false)];
    return view;
}

it('includes the label size and gap on the left/top, ignoring hidden labels and board scale', () => {
    expect(setup().getVictoryScaleMultiplier()).toBeCloseTo(650 / 600);
});

it('does not stretch a rectangular board beyond the tighter axis', () => {
    const view = setup();
    view.width = 8;
    expect(view.getVictoryScaleMultiplier()).toBe(1);
});

it('keeps original size with no labels or no grid', () => {
    const view = setup();
    view.clueLabels = [];
    expect(view.getVictoryScaleMultiplier()).toBe(1);
    view.width = 0;
    expect(view.getVictoryScaleMultiplier()).toBe(1);
});
