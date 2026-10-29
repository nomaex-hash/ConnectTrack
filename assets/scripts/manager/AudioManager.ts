import { _decorator, AudioClip, AudioSource, Component, Input, Node, input } from 'cc';
import { CellState } from '../core/CellState';
import { GameSnapshot, GamePhase } from '../application/contracts/gameSnapshot';
import { EventManager } from '../core/EventManager';
import { AppState } from '../core/AppState';
import { APP_STATE_CHANGED_EVENT, AppStateChangedEventPayload } from '../event/AppStateChangedEvent';
import { SETTINGS_CHANGED_EVENT, SettingsChangedEventPayload } from '../event/AppEvents';
import {
    CELL_CHANGED_EVENT,
    CellChangedEventPayload,
    HINT_SHOWN_EVENT,
    HintShownEventPayload,
    PUZZLE_FAILED_EVENT,
    PUZZLE_READY_EVENT,
    PuzzleReadyEventPayload,
    RESULT_POPUP_SHOWN_EVENT,
    ResultPopupShownEventPayload,
    SCORE_CHANGED_EVENT,
    ScoreChangedEventPayload,
} from '../event/PuzzleEvents';

const { ccclass, property } = _decorator;


const SFX_THROTTLE_MS = 60;

@ccclass('AudioManager')
export class AudioManager extends Component {
    private static _instance: AudioManager | null = null;
    static get instance(): AudioManager {
        if (!this._instance) throw new Error('AudioManager chưa được khởi tạo.');
        return this._instance;
    }

    static get maybeInstance(): AudioManager | null {
        return this._instance;
    }

    @property({
        type: AudioClip,
        tooltip: 'Nhạc nền phát lặp, điều khiển bằng Music trong Settings. Để trống thì không phát nhạc nền. Chưa có file BGM mới được xác định; không gán hiệu ứng tàu vào đây.',
    })
    bgmClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Đặt mới Track Preview hoặc ray chưa đủ 2 kết nối. Gán AudioConnecTrack/create_preset_track.m4a. Để trống thì thao tác này không phát âm.' })
    createPreviewClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'Thay đổi ray đã có sang trạng thái preview hoặc chưa đủ 2 kết nối, kể cả Track ?. Gán AudioConnecTrack/switch_preset_track.m4a.' })
    switchPreviewClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'Đặt hoặc nối ray thành mảnh hoàn chỉnh có 2 kết nối. Gán AudioConnecTrack/create_real_track.m4a.' })
    createTrackClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'Đổi hướng mảnh ray đang có đủ 2 kết nối sang một hướng hoàn chỉnh khác. Gán AudioConnecTrack/switch_real_track.m4a.' })
    switchTrackClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'Tiếng tàu chạy, phát LẶP trong lúc tàu di chuyển sau chiến thắng. Dừng khi tàu kết thúc hoặc bị ẩn/dừng; âm lượng theo SFX. Gán AudioConnecTrack/train_run_a.m4a.' })
    trainRunClip: AudioClip | null = null;
    @property({ type: AudioClip, tooltip: 'Còi tàu phát một lần khi tàu bắt đầu chạy; không phát lặp. Gán AudioConnecTrack/train_whistle_c.m4a.' })
    trainWhistleClip: AudioClip | null = null;

    private trainSource: AudioSource | null = null;

    /** Compare accepted snapshots, never rendering/tween frames. */
    playTrackChanges(before: GameSnapshot, after: GameSnapshot): void {
        const clips = new Set<AudioClip | null>();
        if (after.mistakes > before.mistakes) clips.add(this.wrongClip);
        after.cellStates.forEach((state, i) => {
            if (after.mainTrackCells.indexOf(i) !== -1) return;
            const previous = before.cellStates[i];
            const links = after.cellLinks[i];
            const oldLinks = before.cellLinks[i];
            const changedLinks = links.length !== oldLinks.length || links.some(d => oldLinks.indexOf(d) === -1);
            if (state === previous && !changedLinks) return;
            if (state === 'X') clips.add(this.markClip);
            else if (state === 'Empty' && (previous === 'X' || previous === 'RedX')) clips.add(this.unmarkClip);
            else if (state === 'Track' || state === 'TrackPreview') {
                const wasRail = previous === 'Track' || previous === 'TrackPreview';
                clips.add(links.length === 2
                    ? (oldLinks.length === 2 ? this.switchTrackClip : this.createTrackClip)
                    : (wasRail ? this.switchPreviewClip : this.createPreviewClip));
            }
        });
        for (const clip of clips) this.play(clip);
        if (before.phase !== GamePhase.Won && after.phase === GamePhase.Won) this.play(this.levelWinClip);
    }

    startTrainSound(): void {
        this.stopTrainSound();
        if (!this.trainSource) {
            const node = new Node('TrainAudio');
            node.setParent(this.node);
            this.trainSource = node.addComponent(AudioSource);
            this.trainSource.playOnAwake = false;
        }
        this.trainSource.clip = this.trainRunClip;
        this.trainSource.loop = true;
        this.trainSource.volume = this.sfxVolume;
        if (this.trainRunClip) this.trainSource.play();
        this.play(this.trainWhistleClip);
    }

    stopTrainSound(): void { this.trainSource?.stop(); }

    @property({ type: AudioClip, tooltip: 'Âm vào bàn chơi khi nhận sự kiện bàn đã sẵn sàng. Gán AudioConnecTrack/board_enter_a.m4a.' })
    boardEnterClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Âm nhấn nút có bật hiệu ứng click. Giữ file cũ btn_click.m4a vì chưa có bản thay.' })
    buttonClickClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Âm dùng khi giao diện gọi hiệu ứng mở popup/hộp thoại. Giữ file cũ dlg_open_1.m4a vì chưa có bản thay.' })
    dialogOpenClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'ConnectTracks: phát khi bàn vừa chuyển sang thắng. Luồng Meowdoku cũ: phát khi popup thắng hiện. Gán AudioConnecTrack/level_win.m4a.' })
    levelWinClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Âm báo thua màn khi nhận sự kiện thất bại. Gán AudioConnecTrack/level_fail_a.m4a.' })
    levelFailClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Âm đặt chó của luồng Meowdoku cũ (mark_cat.m4a). Không phải âm đặt ray ConnectTracks; ray dùng Create Preview/Create Track Clip.' })
    placeDogClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Âm đánh dấu X lên ô. Gán AudioConnecTrack/mark_x.m4a.' })
    markClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Âm gỡ dấu X để ô trở về trống. Giữ file cũ unmark_x_2.m4a vì chưa có bản thay.' })
    unmarkClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Âm báo thao tác sai khi số lỗi của người chơi tăng. Gán AudioConnecTrack/mark_wrong_a.m4a.' })
    wrongClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Âm gợi ý của luồng sự kiện Hint cũ, chỉ phát khi sự kiện có dữ liệu hint. Giữ use_hint.m4a; không tự phát cho mọi lần bấm Hint ConnectTracks.' })
    hintClip: AudioClip | null = null;

    @property({
        type: [AudioClip],
        tooltip:
            'Danh sách giọng khen theo combo: phần tử đầu ứng với combo 1, tiếp theo combo 2… ' +
            'Vượt số phần tử thì dùng clip cuối. Phát khi có sự kiện cộng điểm hợp lệ; bỏ qua tutorial ' +
            'và booster Place Dog. Giữ các clip zoo_vo_* hiện tại; đây không phải âm đặt/đổi ray.',
    })
    praiseClips: AudioClip[] = [];

    private sfxSource: AudioSource | null = null;
    private bgmSource: AudioSource | null = null;
    private bgmVolume = 1;
    private sfxVolume = 1;
    private isTutorial = false;
    /** "Nhạc nền vẫn chạy ở tut và boot, khi nào vào main mới mở" (xác nhận từ user) — nhạc nền
     * KHÔNG được phát trong lúc Boot/tutorial, CHỈ bắt đầu từ lần đầu tiên AppState chuyển sang
     * MainMenu trở đi (xem onAppStateChanged()/applyBgmState()). */
    private hasReachedMainMenu = false;

    private readonly lastPlayedAt = new Map<AudioClip, number>();

    onLoad(): void {
        AudioManager._instance = this;

        this.sfxSource = this.getComponent(AudioSource) ?? this.addComponent(AudioSource);

        // BGM dùng nguồn RIÊNG trên node con: phát lặp, chỉnh/tắt độc lập với SFX.
        const bgmNode = new Node('Bgm');
        bgmNode.setParent(this.node);
        this.bgmSource = bgmNode.addComponent(AudioSource);
        this.bgmSource.loop = true;
        this.bgmSource.playOnAwake = false;
        if (this.bgmClip) this.bgmSource.clip = this.bgmClip;

        const bus = EventManager.instance;
        bus.on<CellChangedEventPayload>(CELL_CHANGED_EVENT, this.onCellChanged, this);
        bus.on<PuzzleReadyEventPayload>(PUZZLE_READY_EVENT, this.onBoardEnter, this);
        bus.on<ResultPopupShownEventPayload>(RESULT_POPUP_SHOWN_EVENT, this.onResultPopupShown, this);
        bus.on(PUZZLE_FAILED_EVENT, this.onFailed, this);
        bus.on<HintShownEventPayload>(HINT_SHOWN_EVENT, this.onHintShown, this);
        bus.on<ScoreChangedEventPayload>(SCORE_CHANGED_EVENT, this.onScoreChanged, this);
        bus.on<AppStateChangedEventPayload>(APP_STATE_CHANGED_EVENT, this.onAppStateChanged, this);

        // Trình duyệt web CHẶN audio tự phát khi chưa có "user gesture" (autoplay policy) — gọi
        // play() mà không hề có thao tác chạm/click nào trước đó coi như bị nuốt mất, không hề phát
        // ra tiếng, và KHÔNG có gì tự thử lại. Lắng nghe thao tác chạm/click ĐẦU TIÊN trong toàn bộ
        // app để tự gọi lại applyBgmState() — "mở khoá" audio context ngay khi trình duyệt cho phép.
        // applyBgmState() tự KHÔNG phát gì nếu hasReachedMainMenu vẫn false (xem field đó), nên
        // nghe sự kiện này suốt từ Boot không làm nhạc phát sớm hơn lúc vào Main.
        input.on(Input.EventType.TOUCH_START, this.onFirstGestureUnlockBgm, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onFirstGestureUnlockBgm, this);
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
        input.off(Input.EventType.TOUCH_START, this.onFirstGestureUnlockBgm, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onFirstGestureUnlockBgm, this);
        if (AudioManager._instance === this) AudioManager._instance = null;
    }

    private onFirstGestureUnlockBgm = (): void => {
        input.off(Input.EventType.TOUCH_START, this.onFirstGestureUnlockBgm, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onFirstGestureUnlockBgm, this);
        this.applyBgmState();
    };

    private onAppStateChanged = (payload: AppStateChangedEventPayload): void => {
        if (payload.to !== AppState.MainMenu || this.hasReachedMainMenu) return;
        this.hasReachedMainMenu = true;
        this.applyBgmState();
    };


    applyVolume(settings: { bgmVolume: number; sfxVolume: number }): void {
        this.bgmVolume = settings.bgmVolume;
        this.sfxVolume = settings.sfxVolume;
        if (this.trainSource) this.trainSource.volume = this.sfxVolume;
        this.applyBgmState();
    }

    /**
     * Đồng bộ nhạc nền với âm lượng hiện tại: >0 thì phát (lặp), =0 thì DỪNG hẳn
     * (đỡ tốn pin thay vì phát câm). Không có clip thì bỏ qua. "Nhạc nền vẫn chạy ở tut và boot,
     * khi nào vào main mới mở" (xác nhận từ user) — CHƯA từng vào MainMenu (hasReachedMainMenu
     * false, xem onAppStateChanged()) thì KHÔNG phát, bất kể bgmVolume > 0 hay đã có gesture chưa.
     */
    private applyBgmState(): void {
        const source = this.bgmSource;
        if (!source || !this.bgmClip) return;

        source.volume = this.bgmVolume;

        if (this.hasReachedMainMenu && this.bgmVolume > 0) {
            if (!source.playing) source.play();
        } else if (source.playing) {
            source.stop();
        }
    }

    subscribeSettingsChanges(): void {
        EventManager.instance.on<SettingsChangedEventPayload>(
            SETTINGS_CHANGED_EVENT,
            this.onSettingsChanged,
            this,
        );
    }


    playButtonClick(): void {
        this.play(this.buttonClickClip);
    }

    /** Mở popup/hộp thoại. */
    playDialogOpen(): void {
        this.play(this.dialogOpenClip);
    }


    private onBoardEnter = (payload: PuzzleReadyEventPayload): void => {
        this.isTutorial = payload.context === 'tutorial';
        // Tắt âm thanh "vào bàn/spawn" riêng cho MỌI tutorial (xác nhận từ user) — các âm thanh
        // khác (track, hint, thắng...) không đổi, vẫn phát bình thường trong tutorial.
        if (this.isTutorial) return;
        // BUG đã sửa (báo lỗi của user: "từ màn thắp chuỗi về campaign nghe thấy âm thanh spawn
        // cell dù board không hề được tạo lại") — payload.instant=true nghĩa là board hiện lại
        // ĐÚNG trạng thái cũ (vd quay lại Gameplay từ Streak), KHÔNG hề chạy lại hiệu ứng
        // scale/stagger "spawn" từng ô (xem comment payload.instant ở PuzzleEvents.ts và guard
        // tương tự ở GameplayScreen.onPuzzleReady) — âm thanh "vào bàn" phải bỏ qua trong trường
        // hợp này, không có gì để báo hiệu cả.
        if (payload.instant) return;
        this.play(this.boardEnterClip);
    };

    /** Âm thanh khen theo mức combo — chạy song song với placeDogClip, không thay thế. Booster
     * Place Dog tự đặt chó (không phải người chơi) — bỏ qua, giống hệt BoardView.spawnPraiseEffect. */
    private onScoreChanged = (payload: ScoreChangedEventPayload): void => {
        if (this.isTutorial) return;
        if (payload.gained <= 0 || payload.cell < 0 || this.praiseClips.length === 0) return;
        if (payload.viaPlaceDog) return;

        const level = Math.min(Math.max(payload.streak, 1), this.praiseClips.length);
        this.play(this.praiseClips[level - 1] ?? null);
    };

    /** Phát ĐÚNG lúc ResultPopup hiện lên (không phải ngay lúc PUZZLE_SOLVED_EVENT bắn — có thể còn
     * cách xa lúc popup thật sự mở, vd đợi hiệu ứng sóng/tim bay/màn Streak chen giữa). */
    private onResultPopupShown = (payload: ResultPopupShownEventPayload): void => {
        if (payload.outcome !== 'win') return;
        this.play(this.levelWinClip);
    };

    private onFailed = (): void => {
        this.play(this.levelFailClip);
    };

    private onHintShown = (payload: HintShownEventPayload): void => {
        if (payload.hint) this.play(this.hintClip);
    };

    private onCellChanged = (payload: CellChangedEventPayload): void => {
        switch (payload.state) {
            case CellState.Dog:
                this.play(this.placeDogClip);
                break;
            case CellState.Mark:
                this.play(this.markClip);
                break;
            case CellState.WrongMark:
                this.play(this.wrongClip);
                break;
            case CellState.Empty:
                this.play(this.unmarkClip);
                break;
        }
    };

    private onSettingsChanged = (payload: SettingsChangedEventPayload): void => {
        this.applyVolume({ bgmVolume: payload.bgmVolume, sfxVolume: payload.sfxVolume });
    };

    private play(clip: AudioClip | null): void {
        if (!clip || !this.sfxSource || this.sfxVolume <= 0) return;

        const now = Date.now();
        const last = this.lastPlayedAt.get(clip) ?? 0;
        if (now - last < SFX_THROTTLE_MS) return;
        this.lastPlayedAt.set(clip, now);

        this.sfxSource.playOneShot(clip, this.sfxVolume);
    }
}
