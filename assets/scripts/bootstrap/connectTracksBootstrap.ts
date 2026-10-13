import { _decorator, Component, error } from 'cc';
import { LevelDataPort } from '../application/ports/levelDataPort';
import { CocosLevelDataAdapter } from '../infrastructure/content/cocosLevelDataAdapter';
import { GameSession } from '../application/session/gameSession';
import { requiredCellsFor } from '../application/session/requiredCells';
import { ConnectTracksBoardView } from '../presentation/board/connectTracksBoardView';
import { gestureToCommand, PlayerGesture } from '../presentation/input/gestureCommandMapper';

const { ccclass, property } = _decorator;

/**
 * Composition root for the ConnectTracks presentation entry. It creates the session, shows its
 * snapshot, and routes semantic gestures through the neutral command mapping.
 * It holds no gameplay rules: the session decides outcomes.
 */
@ccclass('ConnectTracksBootstrap')
export class ConnectTracksBootstrap extends Component {
    @property({ type: ConnectTracksBoardView, tooltip: 'Node board có gắn component ConnectTracksBoardView. Bắt buộc phải gán: nếu thiếu sẽ không tạo được session.' })
    private boardView: ConnectTracksBoardView | null = null;

    @property({ tooltip: 'Campaign level id cần load, theo field "id" trong tblevels_combined_0to200.json (hiện là "0".."200"). Mặc định "0" là level đầu tiên.' })
    private levelId = '0';

    private session: GameSession | null = null;
    private destroyed = false;

    onLoad(): void {
        if (!this.boardView) {
            error('[ConnectTracksBootstrap] boardView is not assigned in the scene.');
            return;
        }
        const levels: LevelDataPort = new CocosLevelDataAdapter();
        void this.initialize(levels);
    }

    private async initialize(levels: LevelDataPort): Promise<void> {
        try {
            const level = await levels.loadLevel(this.levelId);
            if (this.destroyed || !this.isValid || !this.boardView?.isValid) return;
            this.session = new GameSession({ level, requiredCells: requiredCellsFor(level) });
            this.refresh();
        } catch (failure) {
            this.session = null;
            if (!this.destroyed && this.isValid) {
                error(`[ConnectTracksBootstrap] Failed to initialize level ${this.levelId}.`, failure);
            }
        }
    }

    onDestroy(): void {
        this.destroyed = true;
        this.session = null;
    }

    /** Entry point for the input layer. Applies one semantic gesture and redraws the board. */
    applyGesture(gesture: PlayerGesture): void {
        if (!this.session) {
            return;
        }
        this.session.dispatch(gestureToCommand(gesture));
        this.refresh();
    }

    private refresh(): void {
        if (this.session && this.boardView) {
            this.boardView.render(this.session.snapshot());
        }
    }
}
