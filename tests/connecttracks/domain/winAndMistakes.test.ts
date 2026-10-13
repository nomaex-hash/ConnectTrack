import { describe, expect, it } from 'vitest';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { PlayerCellState } from '../../../assets/scripts/domain/board/playerCellState';
import { MAX_MISTAKES, MistakeCounter } from '../../../assets/scripts/domain/rules/mistakeCounter';
import { isWon } from '../../../assets/scripts/domain/rules/winRule';
import { emptyBoard } from './fixtures';

/** Solution path tracks on the test level: cells 1, 2 and 5. */
const REQUIRED = [1, 2, 5];

function solvedBoard() {
    return emptyBoard()
        .withTrack(1, Direction.Left, Direction.Right)
        .withTrack(2, Direction.Left, Direction.Down)
        .withTrack(5, Direction.Up, Direction.Down);
}

describe('win predicate', () => {
    it('is won when every required Track has two connections', () => {
        expect(isWon(solvedBoard(), REQUIRED)).toBe(true);
    });

    it('is not won when one required Track has only one connection', () => {
        // Cell 5 drops its Down connection to the Main Track end at cell 8; only Up to cell 2 remains.
        const board = emptyBoard()
            .withTrack(1, Direction.Left, Direction.Right)
            .withTrack(2, Direction.Left, Direction.Down)
            .withLink(5, Direction.Up);
        expect(isWon(board, REQUIRED)).toBe(false);
    });

    it('is not won when a required cell is only a TrackPreview or X', () => {
        const preview = solvedBoard().withState(2, PlayerCellState.TrackPreview);
        const marked = solvedBoard().withState(2, PlayerCellState.X);
        expect(isWon(preview, REQUIRED)).toBe(false);
        expect(isWon(marked, REQUIRED)).toBe(false);
    });

    it('does not require all Tracks to form one connected path', () => {
        // An extra, unconnected Track elsewhere does not block the win.
        const board = solvedBoard().withTrack(7, Direction.Left, Direction.Right);
        expect(isWon(board, REQUIRED)).toBe(true);
    });

    it('judges only the caller-supplied requiredCells, never the full solution path', () => {
        // Cell 1 has two connections: Main Track on its left, and cell 2 on its right (2 points back Left).
        // Cell 2's Down leads to empty cell 5, which is a solution cell that is not listed as required.
        const board = emptyBoard()
            .withTrack(1, Direction.Left, Direction.Right)
            .withTrack(2, Direction.Left, Direction.Down);
        expect(isWon(board, [1])).toBe(true);
        expect(isWon(board, [1, 5])).toBe(false);
    });

    it('does not count a Main Track endpoint as required unless the caller lists it', () => {
        // Cell 0 is a Main Track endpoint and never holds a Player Track, so listing it blocks the win.
        expect(isWon(solvedBoard(), [1, 2, 5])).toBe(true);
        expect(isWon(solvedBoard(), [0, 1, 2, 5])).toBe(false);
    });

    it('does not treat a connected path with a single Track as won', () => {
        const board = emptyBoard().withTrack(1, Direction.Left, Direction.Right);
        expect(isWon(board, REQUIRED)).toBe(false);
    });
});

describe('mistake counter', () => {
    it('allows three mistakes; the third one loses', () => {
        expect(MAX_MISTAKES).toBe(3);
        let counter = MistakeCounter.initial();
        expect(counter.isLost).toBe(false);
        counter = counter.recordMistake();
        counter = counter.recordMistake();
        expect(counter.count).toBe(2);
        expect(counter.isLost).toBe(false);
        counter = counter.recordMistake();
        expect(counter.count).toBe(3);
        expect(counter.isLost).toBe(true);
    });

    it('stays at the maximum once lost', () => {
        const lost = MistakeCounter.initial()
            .recordMistake()
            .recordMistake()
            .recordMistake()
            .recordMistake();
        expect(lost.count).toBe(MAX_MISTAKES);
        expect(lost.isLost).toBe(true);
    });

    it('is immutable', () => {
        const first = MistakeCounter.initial();
        first.recordMistake();
        expect(first.count).toBe(0);
    });
});
