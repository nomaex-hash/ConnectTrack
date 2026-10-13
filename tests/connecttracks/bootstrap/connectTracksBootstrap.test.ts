import { beforeEach, describe, expect, it, vi } from 'vitest';

const { load, diagnosticError } = vi.hoisted(() => ({ load: vi.fn(), diagnosticError: vi.fn() }));
vi.mock('cc', () => ({
    _decorator: { ccclass: () => (target: unknown) => target, property: () => () => {} },
    Component: class Component { isValid = true; },
    JsonAsset: class JsonAsset {},
    resources: { load },
    error: diagnosticError,
}));
vi.mock('../../../assets/scripts/presentation/board/connectTracksBoardView', () => ({
    ConnectTracksBoardView: class ConnectTracksBoardView {},
}));
vi.mock('../../../assets/scripts/application/session/gameSession', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../assets/scripts/application/session/gameSession')>();
    return {
        ...actual,
        GameSession: vi.fn(function (options: ConstructorParameters<typeof actual.GameSession>[0]) {
            return new actual.GameSession(options);
        }),
    };
});

import { ConnectTracksBootstrap } from '../../../assets/scripts/bootstrap/connectTracksBootstrap';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { GamePhase } from '../../../assets/scripts/application/contracts/gameSnapshot';

/** Same shape as levelIndex.json / Level/*.json; a small in-test fixture, not the real project data. */
const INDEX = { '0': { stageLevelId: 12345, file: 'level_test' } };
const RECORD = { w: 3, h: 3, s: [0, 1, 2, 5, 8], g: [0, 8], a: 8, b: 4 };
const BATCH = { '12345': RECORD };

type Completion = (error: Error | null, asset: { json: unknown } | null) => void;

/**
 * Responds to resources.load based on the requested path (the adapter now loads the index, then
 * the matching batch file). A path with no entry never resolves, for checking mid-load state.
 */
function respondByPath(byPath: Record<string, { json: unknown } | Error>): void {
    load.mockImplementation((path: string, _type: unknown, done: Completion) => {
        const outcome = byPath[path];
        if (!outcome) {
            return;
        }
        queueMicrotask(() => {
            if (outcome instanceof Error) {
                done(outcome, null);
            } else {
                done(null, outcome);
            }
        });
    });
}

beforeEach(() => { vi.clearAllMocks(); load.mockReset(); });

function setup() {
    const bootstrap = new ConnectTracksBootstrap();
    const view = { isValid: true, render: vi.fn() };
    // Inject the serialized scene reference without changing the production public API.
    Object.assign(bootstrap, { boardView: view });
    bootstrap.onLoad();
    return { bootstrap, view };
}

describe('ConnectTracks bootstrap async composition', () => {
    it('ignores gestures while loading, then creates an Active session with the inferred requiredCells', async () => {
        respondByPath({
            'ConnectTrackData/levelIndex': { json: INDEX },
            'ConnectTrackData/Level/level_test': { json: BATCH },
        });
        const { bootstrap, view } = setup();
        bootstrap.applyGesture({ kind: 'tap', cell: 4 });
        expect(GameSession).not.toHaveBeenCalled();
        expect(view.render).not.toHaveBeenCalled();
        await vi.waitFor(() => expect(view.render).toHaveBeenCalledTimes(1));
        expect(GameSession).toHaveBeenCalledTimes(1);
        // requiredCells here is level.solutionPath minus its two Main Track endpoints (s[0], s[-1]):
        // an inferred bootstrap-level default, not a Domain/Application rule (see connectTracksBootstrap.ts).
        expect(vi.mocked(GameSession).mock.calls[0][0].requiredCells).toEqual([1, 2, 5]);
        expect(view.render.mock.calls[0][0]).toMatchObject({
            phase: GamePhase.Active, width: 3, height: 3, mainTrackCells: [0, 8], mistakes: 0,
        });
        bootstrap.applyGesture({ kind: 'tap', cell: 4 });
        expect(view.render).toHaveBeenCalledTimes(2);
        expect(diagnosticError).not.toHaveBeenCalled();
    });

    it('does not construct a session or render if the level index fails to load', async () => {
        respondByPath({ 'ConnectTrackData/levelIndex': new Error('Missing content') });
        const { bootstrap, view } = setup();
        await vi.waitFor(() => expect(diagnosticError).toHaveBeenCalledTimes(1));
        expect(diagnosticError.mock.calls[0][0]).toContain('level 0');
        bootstrap.applyGesture({ kind: 'tap', cell: 4 });
        expect(GameSession).not.toHaveBeenCalled();
        expect(view.render).not.toHaveBeenCalled();
    });

    it.each(['payload', 'geometry'])('does not construct a session or render after a batch-file %s failure', async (kind) => {
        respondByPath({
            'ConnectTrackData/levelIndex': { json: INDEX },
            'ConnectTrackData/Level/level_test': {
                json: kind === 'payload' ? null : { '12345': { ...RECORD, s: [0, 8] } },
            },
        });
        const { bootstrap, view } = setup();
        await vi.waitFor(() => expect(diagnosticError).toHaveBeenCalledTimes(1));
        bootstrap.applyGesture({ kind: 'tap', cell: 4 });
        expect(GameSession).not.toHaveBeenCalled();
        expect(view.render).not.toHaveBeenCalled();
    });

    it.each(['success', 'failure'])('ignores a late %s after destruction', async (outcome) => {
        respondByPath(
            outcome === 'success'
                ? { 'ConnectTrackData/levelIndex': { json: INDEX }, 'ConnectTrackData/Level/level_test': { json: BATCH } }
                : { 'ConnectTrackData/levelIndex': new Error('Late failure') },
        );
        const { bootstrap, view } = setup();
        bootstrap.onDestroy();
        // Drain both the adapter's and the bootstrap's Promise continuations.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        bootstrap.applyGesture({ kind: 'tap', cell: 4 });
        expect(GameSession).not.toHaveBeenCalled();
        expect(view.render).not.toHaveBeenCalled();
    });

    it('reports missing board wiring without starting a resource load', () => {
        new ConnectTracksBootstrap().onLoad();
        expect(load).not.toHaveBeenCalled();
        expect(GameSession).not.toHaveBeenCalled();
        expect(diagnosticError).toHaveBeenCalledTimes(1);
    });
});
