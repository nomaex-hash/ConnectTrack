import { _decorator, instantiate, Node, Prefab, ScrollView, UITransform, Vec3 } from 'cc';
import { UIScreen } from '../UIScreen';
import { LevelCell, LevelCellState } from '../widget/LevelCell';
import { EventManager } from '../../core/EventManager';
import { AppState } from '../../core/AppState';
import {
    LEVEL_SELECTED_EVENT,
    LEVEL_UNLOCKED_EVENT,
    LevelSelectedEventPayload,
    NAVIGATE_REQUESTED_EVENT,
    NavigateRequestedEventPayload,
} from '../../event/AppEvents';
import { ProgressionHolder } from '../../gameplay/progression/ProgressionHolder';

const { ccclass, property } = _decorator;


@ccclass('LevelSelectScreen')
export class LevelSelectScreen extends UIScreen {
    @property({ type: ScrollView, tooltip: 'ScrollView chứa lưới level' })
    scrollView: ScrollView = null!;

    @property({ type: Prefab, tooltip: 'LevelCell.prefab' })
    levelCellPrefab: Prefab = null!;

    @property({ tooltip: 'Số cột trong lưới' })
    columns = 5;

    @property({ tooltip: 'Cạnh một ô level (px)' })
    cellSize = 110;

    @property({ tooltip: 'Khoảng cách giữa các ô (px)' })
    spacing = 16;

    private content: Node = null!;
    private readonly cells: LevelCell[] = [];

    private firstVisibleRow = -1;
    private totalRows = 0;

    private static readonly TEMP_POS = new Vec3();

    protected onOpen(): void {
        this.content = this.scrollView.content!;

        EventManager.instance.on(LEVEL_UNLOCKED_EVENT, this.onLevelUnlocked, this);
        this.scrollView.node.on('scrolling', this.refreshVisibleCells, this);

        this.build();
    }

    protected onClose(): void {
        EventManager.instance.targetOff(this);
        this.scrollView.node.off('scrolling', this.refreshVisibleCells, this);
    }


    private build(): void {
        const progression = ProgressionHolder.current;
        if (!progression) {
            console.warn('[LevelSelectScreen] ProgressionSystem chưa sẵn sàng.');
            return;
        }

        const total = progression.totalLevels;
        this.totalRows = Math.ceil(total / this.columns);

        const contentHeight = this.totalRows * this.rowHeight();
        const contentTransform = this.content.getComponent(UITransform);
        if (contentTransform) {
            contentTransform.height = contentHeight;
        }

        this.ensureCellPool();
        this.firstVisibleRow = -1;
        this.refreshVisibleCells();

        this.scrollToCurrentLevel(progression.getCurrentLevel());
    }

    private rowHeight(): number {
        return this.cellSize + this.spacing;
    }

    private visibleRowCount(): number {
        const viewTransform = this.scrollView.node.getComponent(UITransform);
        const viewHeight = viewTransform ? viewTransform.height : 0;
        return Math.ceil(viewHeight / this.rowHeight()) + 2;
    }

    private ensureCellPool(): void {
        const needed = this.visibleRowCount() * this.columns;

        while (this.cells.length < needed) {
            const node = instantiate(this.levelCellPrefab);
            node.parent = this.content;

            const cell = node.getComponent(LevelCell);
            if (!cell) throw new Error('[LevelSelectScreen] LevelCell.prefab thiếu LevelCell.');
            this.cells.push(cell);
        }
    }


    private refreshVisibleCells = (): void => {
        const progression = ProgressionHolder.current;
        if (!progression || this.cells.length === 0) return;

        const scrolledY = this.content.position.y;
        let firstRow = Math.floor(scrolledY / this.rowHeight()) - 1;
        firstRow = Math.max(0, Math.min(firstRow, Math.max(0, this.totalRows - this.visibleRowCount())));

        if (firstRow === this.firstVisibleRow) return;
        this.firstVisibleRow = firstRow;

        const total = progression.totalLevels;
        const currentLevel = progression.getCurrentLevel();

        for (let i = 0; i < this.cells.length; i++) {
            const row = firstRow + Math.floor(i / this.columns);
            const col = i % this.columns;
            const levelId = row * this.columns + col + 1;

            const cell = this.cells[i];

            if (levelId > total) {
                cell.node.active = false;
                continue;
            }
            cell.node.active = true;

            cell.node.setPosition(this.positionOf(row, col));
            cell.bind(levelId, this.stateOf(levelId, currentLevel, progression), this.onTapLevel);
        }
    };

    private stateOf(
        levelId: number,
        currentLevel: number | null,
        progression: NonNullable<typeof ProgressionHolder.current>,
    ): LevelCellState {
        if (progression.isCompleted(levelId)) return LevelCellState.Completed;
        if (levelId === currentLevel || progression.isUnlocked(levelId)) {
            return LevelCellState.Current;
        }
        return LevelCellState.Locked;
    }

    private positionOf(row: number, col: number): Vec3 {
        const contentTransform = this.content.getComponent(UITransform);
        const width = contentTransform ? contentTransform.width : 0;

        const gridWidth = this.columns * this.cellSize + (this.columns - 1) * this.spacing;
        const startX = -width / 2 + (width - gridWidth) / 2 + this.cellSize / 2;

        return LevelSelectScreen.TEMP_POS.set(
            startX + col * (this.cellSize + this.spacing),
            -(row * this.rowHeight() + this.cellSize / 2),
            0,
        );
    }

    private scrollToCurrentLevel(currentLevel: number | null): void {
        if (currentLevel === null) return;

        const row = Math.floor((currentLevel - 1) / this.columns);
        const contentHeight = this.totalRows * this.rowHeight();
        if (contentHeight <= 0) return;

        const ratio = Math.max(0, Math.min(1, ((row - 1) * this.rowHeight()) / contentHeight));
        this.scrollView.scrollToPercentVertical(ratio, 0);

        this.firstVisibleRow = -1;
        this.scheduleOnce(this.refreshVisibleCells, 0);
    }


    private onTapLevel = (levelId: number): void => {
        const payload: LevelSelectedEventPayload = { context: 'campaign', levelId };
        EventManager.instance.emit(LEVEL_SELECTED_EVENT, payload);
    };

    onTapBack(): void {
        const payload: NavigateRequestedEventPayload = { to: AppState.MainMenu };
        EventManager.instance.emit(NAVIGATE_REQUESTED_EVENT, payload);
    }

    private onLevelUnlocked = (): void => {
        this.firstVisibleRow = -1;
        this.refreshVisibleCells();
    };
}
