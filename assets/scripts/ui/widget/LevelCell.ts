import { _decorator, Component, Label, Node, Button } from 'cc';

const { ccclass, property } = _decorator;

export enum LevelCellState {
    Locked = 'Locked',
    Current = 'Current',
    Completed = 'Completed',
}


@ccclass('LevelCell')
export class LevelCell extends Component {
    @property({ type: Label, tooltip: 'Số thứ tự level' })
    numberLabel: Label = null!;

    @property({ type: Node, tooltip: 'Icon ổ khóa — hiện khi level còn khóa' })
    lockIcon: Node | null = null;

    @property({ type: Node, tooltip: 'Icon dấu tick — hiện khi level đã hoàn thành' })
    completedIcon: Node | null = null;

    @property({ type: Button, tooltip: 'Button trên chính node này' })
    button: Button = null!;

    private levelId = 0;
    private onTap: ((levelId: number) => void) | null = null;

    onLoad(): void {
        this.node.on(Button.EventType.CLICK, this.handleClick, this);
    }

    onDestroy(): void {
        this.node.off(Button.EventType.CLICK, this.handleClick, this);
    }

    bind(levelId: number, state: LevelCellState, onTap: (levelId: number) => void): void {
        this.levelId = levelId;
        this.onTap = onTap;

        this.numberLabel.string = `${levelId}`;

        const locked = state === LevelCellState.Locked;
        if (this.lockIcon) this.lockIcon.active = locked;
        if (this.completedIcon) this.completedIcon.active = state === LevelCellState.Completed;

 
        this.button.interactable = !locked;
        this.numberLabel.node.active = !locked;
    }

    private handleClick(): void {
        if (this.onTap) this.onTap(this.levelId);
    }
}
