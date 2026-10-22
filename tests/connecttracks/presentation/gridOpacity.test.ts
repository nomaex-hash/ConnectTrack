import { expect, it, vi } from 'vitest';
vi.mock('cc', () => ({
    _decorator: { ccclass: () => (t: unknown) => t, property: () => () => {} },
    Component: class {}, NodePool: class {},
    Color: class { constructor(public r = 0, public g = 0, public b = 0, public a = 255) {} },
    Graphics: class {}, Label: class {}, Node: class {}, Prefab: class {}, Font: class {},
    UIOpacity: class {}, UITransform: class {}, Vec3: class {}, Tween: class {},
    isValid: (value: any, strict: boolean) => !!value && value.isValid !== false && !(strict && value.destroying),
}));
vi.mock('../../../assets/scripts/presentation/board/connectTracksCellView', () => ({ APPEAR_DURATION: .2, ConnectTracksCellView: class {} }));
vi.mock('../../../assets/scripts/presentation/board/connectTracksTrainView', () => ({ ConnectTracksTrainView: class {} }));
vi.mock('../../../assets/scripts/presentation/board/connectTracksPraiseEffect', () => ({ ConnectTracksPraiseEffect: class {} }));
import { Color } from 'cc';
import { ConnectTracksBoardView } from '../../../assets/scripts/presentation/board/connectTracksBoardView';
import { GamePhase } from '../../../assets/scripts/application/contracts/gameSnapshot';

it('does not recycle destroyed child components or nodes when releasing the board', () => {
    const board = new ConnectTracksBoardView() as any;
    const recycled = vi.fn();
    const dead = { isValid: false, hintHiddenTracks: null,
        get node(): never { throw new Error('Destroyed component accessed'); }, recycle: recycled };
    const pending = { destroying: true,
        get node(): never { throw new Error('Destroying component accessed'); }, recycle: recycled };
    const deadNode = { node: { isValid: false }, recycle: recycled };
    const pendingNode = { node: { destroying: true }, recycle: recycled };
    board.pool = { put: vi.fn() };
    board.cellViews = [null, dead, pending, deadNode, pendingNode];
    expect(() => board.releaseAllCells()).not.toThrow();
    expect(recycled).not.toHaveBeenCalled();
    expect(board.pool.put).not.toHaveBeenCalled();
    expect(board.cellViews).toEqual([]);
});

it('still recycles live cells for reuse and releases each cell only once', () => {
    const board = new ConnectTracksBoardView() as any;
    const node = { isValid: true };
    const recycle = vi.fn();
    board.pool = { put: vi.fn() };
    board.cellViews = [{ isValid: true, node, recycle }];
    board.releaseAllCells();
    board.releaseAllCells();
    expect(recycle).toHaveBeenCalledTimes(1);
    expect(board.pool.put).toHaveBeenCalledExactlyOnceWith(node);
    expect(board.cellViews).toEqual([]);
});

it('selects newly placed preview, preserves rejected selection and closes after removal or win', () => {
    const view = new ConnectTracksBoardView() as any;
    const changed = vi.fn();
    view.setSelectedCellChangedHandler(changed);
    const snapshot = { phase: GamePhase.Active, cellStates: ['Empty', 'TrackPreview'] } as any;
    view.handlePreviewPlaced(1, snapshot, true);
    expect(changed).toHaveBeenLastCalledWith(1);
    view.handlePreviewPlaced(1, snapshot, true);
    expect(changed).toHaveBeenCalledTimes(1);
    view.handlePreviewPlaced(0, snapshot, false);
    expect(view.selectedCell).toBe(1);
    view.handlePreviewPlaced(1, { ...snapshot, cellStates: ['Empty', 'Empty'] }, true);
    expect(changed).toHaveBeenLastCalledWith(null);
    view.handlePreviewPlaced(1, snapshot, true);
    view.handlePreviewPlaced(1, { ...snapshot, phase: GamePhase.Won }, true);
    expect(view.selectedCell).toBe(null);
});

it('rebuilds both grid and border with progressively increasing stroke alpha without changing configured color', () => {
    const view = new ConnectTracksBoardView() as any;
    const strokes: number[] = [];
    const graphics = { clear: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), lineWidth: 0,
        strokeColor: new Color(), stroke: () => strokes.push(graphics.strokeColor.a) };
    view.gridGraphics = graphics;
    view.cellSize = 64;
    view.lineColor = new Color(52, 57, 72, 200);
    for (const alpha of [0, 127.5, 255]) view.drawGridStroke(3, 3, 192, 192, alpha);
    expect(strokes).toEqual([0, 0, 100, 100, 200, 200]);
    expect(graphics.clear).toHaveBeenCalledTimes(3);
    expect(view.lineColor.a).toBe(200);
});
