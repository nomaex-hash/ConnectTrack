import { _decorator, Component, Director, JsonAsset, Node, Prefab, ResolutionPolicy, director, view, resources, instantiate, isValid } from 'cc';
import { BootLoadingView } from '../ui/widget/BootLoadingView';
import { AppState } from '../core/AppState';
import { EventManager } from '../core/EventManager';
import { BOOT_PROGRESS_EVENT, BootProgressEventPayload } from '../event/AppEvents';
import { ResourceManager } from './ResourceManager';
import { SaveManager } from './SaveManager';
import { AudioManager } from './AudioManager';
import { GameManager } from './GameManager';
import { SceneManager } from './SceneManager';
import { UIManager } from './UIManager';
import { LocalizationManager } from '../localization/LocalizationManager';
import { FALLBACK_LANGUAGE } from '../localization/Language';
import { FBInstantManagerHolder } from '../service/platform/FBInstantManagerHolder';
import { FBInstantManager } from '../service/platform/FBInstantManager';
import '../service/platform/FBInstantTypes';
import { PGSPlayInstantManagerHolder } from '../service/backend/PGSPlayInstantManagerHolder';
import { PGSPlayInstantManager } from '../service/backend/PGSPlayInstantManager';
import { PaymentServiceHolder } from '../service/payment/PaymentServiceHolder';
import { FbPaymentService } from '../service/payment/FbPaymentService';
import { PreloadedLevelData } from '../application/session/preloadedLevelData';
import { CocosLevelDataAdapter } from '../infrastructure/content/cocosLevelDataAdapter';
import { ProgressionSystem } from '../gameplay/progression/ProgressionSystem';
import { setHardLevelIds } from '../config/LevelListConfig';
import { LAZY_SCREENS } from '../ui/lazyPrefabRegistry';

const { ccclass, property } = _decorator;


@ccclass('Bootloader')
export class Bootloader extends Component {
    @property({ type: Node, tooltip: 'Node AppManagers (Persist Root Node) chứa 6 manager component' })
    private appManagersNode: Node = null!;

    @property({ type: Node, tooltip: 'Canvas của Boot, chứa background hiển thị trước.' })
    bootUIParent: Node | null = null;

    @property({ tooltip: 'Đường dẫn prefab trong assets/resources, không có .prefab.' })
    bootPrefabPath = 'boot/Boot';

    @property({ min: 0, tooltip: 'Thời gian fade-in prefab Boot trước khi tải game (giây).' })
    bootFadeSeconds = 0.4;

    private bootView: BootLoadingView | null = null;
    private bootT0 = 0;
    private lastProgress = 0;

    /** Log mốc thời gian (ms) tính từ đầu runBootSequence — dùng để tìm bước boot chậm nhất. */
    private mark(label: string): void {
        console.log(`[Boot] +${Math.round(performance.now() - this.bootT0)}ms ${label}`);
    }

    start(): void {
        this.applyFixedHeightResolution();
        this.showBootThenLoad().catch((error: unknown) => {
            console.error('[Bootloader] Boot sequence thất bại:', error);
        });
    }

    private async showBootThenLoad(): Promise<void> {
        const parent = this.bootUIParent ?? this.node.scene?.getChildByName('Canvas');
        if (!parent) throw new Error('Boot thiếu Canvas/bootUIParent.');
        // Allow the background to be rendered before requesting the loading prefab.
        await new Promise<void>(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));
        if (!isValid(this, true)) return;
        const prefab = await new Promise<Prefab>((resolve, reject) => {
            resources.load(this.bootPrefabPath, Prefab, (error, asset) => {
                if (error || !asset) reject(error ?? new Error('Không tải được Boot prefab.'));
                else resolve(asset);
            });
        });
        if (!isValid(this, true) || !isValid(parent, true)) return;
        const node = instantiate(prefab);
        node.active = false;
        node.setParent(parent);
        node.setPosition(0, 0, 0);
        this.bootView = node.getComponent(BootLoadingView) ?? node.addComponent(BootLoadingView);
        this.bootView.prepare();
        node.active = true;
        if (!await this.bootView.reveal(this.bootFadeSeconds) || !isValid(this, true)) return;
        await this.runBootSequence();
    }


    private applyFixedHeightResolution(): void {
        const size = view.getDesignResolutionSize();
        view.setDesignResolutionSize(size.width, size.height, ResolutionPolicy.FIXED_HEIGHT);
    }

    private async runBootSequence(): Promise<void> {
        if (!this.appManagersNode) {
            throw new Error('[Bootloader] appManagersNode chưa được gán trong Inspector.');
        }

        
        director.addPersistRootNode(this.appManagersNode);
        this.bootT0 = performance.now();
        this.report(0.05, 'Chuẩn bị');

        const resourceManager = this.getManager(ResourceManager);
        const saveManager = this.getManager(SaveManager);
        const audioManager = this.getManager(AudioManager);
        const gameManager = this.getManager(GameManager);
        const sceneManager = this.getManager(SceneManager);
        const uiManager = this.getManager(UIManager);

        // CHẠY SONG SONG ngay từ đầu: tải màn chính (nặng nhất) và metadata level — không phụ thuộc
        // FBInstant/save/ngôn ngữ nên không cần đợi các bước đó xong mới bắt đầu.
        const scenePreload = sceneManager.preloadMainScene(progress => this.report(0.1 + progress * 0.6, 'Tải màn chính'));
        scenePreload.then(() => this.mark('preload màn chính xong'), () => undefined); // tránh unhandled rejection; lỗi vẫn ném ở await bên dưới
        const metadataReady = this.loadConnectTrackDifficultyMetadata().then(() => this.mark('metadata level xong'));

        const localizationManager =
            this.appManagersNode.getComponent(LocalizationManager) ??
            this.appManagersNode.addComponent(LocalizationManager);
        // Bắt đầu NẠP file ngôn ngữ (bản FALLBACK_LANGUAGE) NGAY TỪ ĐẦU boot, chạy SONG SONG với
        // resourceManager.init() — không cần đợi biết ngôn ngữ người chơi đã lưu (saveManager.load()
        // chạy SAU) mới bắt đầu tải, rút ngắn tổng thời gian boot. init() gọi lại lần 2 bên dưới
        // với ngôn ngữ THẬT của người chơi là AN TOÀN/idempotent — ensureLoaded() tự bỏ qua phần
        // đã cache (nếu ngôn ngữ thật trùng fallback thì gần như không mất thêm thời gian).
        const localizationReady = localizationManager.init(FALLBACK_LANGUAGE);

        // Facebook Instant Games yêu cầu gọi startGameAsync() CÀNG SỚM CÀNG TỐT để ẩn loading
        // screen của nền tảng. Không có FBInstant (Editor/preview) thì giữ nguyên Mock mặc định
        // của 2 Holder — toàn bộ game vẫn chạy được, chỉ mất phần gọi backend/nền tảng thật.
        if (typeof FBInstant !== 'undefined') {
            FBInstantManagerHolder.set(new FBInstantManager());
            PGSPlayInstantManagerHolder.set(new PGSPlayInstantManager());
            PaymentServiceHolder.set(new FbPaymentService());
        }
        await FBInstantManagerHolder.current.init();
        this.mark('FBInstant.init xong');
        this.report(0.1, 'Kết nối nền tảng');

        await Promise.all([resourceManager.init(), localizationReady]);
        this.mark('tài nguyên + ngôn ngữ xong');
        this.report(0.2, 'Tài nguyên');

        await saveManager.load();
        saveManager.subscribeSaveTriggers();
        this.mark('saveManager.load xong');
        this.report(0.4, 'Dữ liệu người chơi');

        await localizationManager.init(saveManager.playerData.settings.language);
        this.report(0.5, 'Ngôn ngữ');

        await metadataReady;

        audioManager.applyVolume(saveManager.playerData.settings);
        audioManager.subscribeSettingsChanges();
        this.report(0.55, 'Âm thanh');

       
        gameManager.initSystems();
        this.mark('initSystems xong');
        this.report(0.7, 'Hệ thống game');

        gameManager.changeState(AppState.Loading);

        // Warm the actual ConnectTracks data, not only the legacy Meowdoku puzzle provider.
        // Pass the same instance through UIManager so the first Gameplay consumes this result.
        const levels = new PreloadedLevelData(new CocosLevelDataAdapter());
        uiManager.setConnectTracksLevels(levels);
        const firstLevel = saveManager.playerData.hasSeenTutorial
            ? new ProgressionSystem(saveManager.playerData.progression).getCurrentLevel()
            : 0;
        const levelReady = levels.preload(String(firstLevel)).catch(error => {
            console.warn(`[Bootloader] Cannot preload ConnectTracks level ${firstLevel}; retry on entry.`, error);
        });

        // GameplayScreen nằm trong bundle lazy (không còn bị kéo theo bởi Main.scene). Yêu cầu: màn ĐẦU TIÊN người
        // chơi vào phải sẵn sàng TRƯỚC khi họ bấm Chơi — nên tải HẲN prefab (không chỉ download) cho MỌI người chơi,
        // song song với preload màn chính và tải level. Lỗi (vd bundle chưa tạo) chỉ cảnh báo; khi đó vào màn chơi
        // sẽ tải lúc cần.
        const gameplayRef = LAZY_SCREENS[AppState.Gameplay];
        const gameplayReady: Promise<void> = gameplayRef
            ? resourceManager.loadPrefabFromBundle(gameplayRef.bundle, gameplayRef.path).then(
                () => this.mark('prefab GameplayScreen đã nạp'),
                error => { console.warn('[Bootloader] Không nạp trước được GameplayScreen; sẽ tải khi vào màn chơi.', error); },
            )
            : Promise.resolve();
        // Puzzle của màn đầu (tutorial hoặc level hiện tại): đợi tải + parse + cache xong.
        const puzzleReady = gameManager.warmFirstPuzzle().then(
            () => this.mark('puzzle màn đầu đã cache'),
            error => { console.warn('[Bootloader] Không tải trước được puzzle màn đầu; sẽ tải khi vào màn chơi.', error); },
        );

        this.report(0.8, 'Vào màn chính');
        await Promise.all([scenePreload, levelReady, gameplayReady, puzzleReady]);
        this.mark('preload màn chính + level đầu sẵn sàng');
        if (!isValid(this, true)) return;
        if (this.bootView && !await this.bootView.complete()) return;
        await new Promise<void>(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));
        if (!isValid(this, true)) return;
        await sceneManager.loadMainScene();
        this.mark('loadMainScene xong');
        this.report(0.95, 'Dựng giao diện');

        uiManager.attachToScene();
        // Đưa prefab GameplayScreen (đã nằm trong cache asset của Cocos) vào UIRoot NGAY, trước khi hiện menu — để bấm
        // Chơi đi đường đồng bộ, không còn bước nạp bundle/overlay loading nào.
        await uiManager.prepareScreen(AppState.Gameplay).catch(error => {
            console.warn('[Bootloader] prepareScreen(Gameplay) thất bại; sẽ tải khi vào màn chơi.', error);
        });
        this.mark('GameplayScreen sẵn sàng trong UIRoot');

        // Lần đầu mở app (chưa xem tutorial): vào THẲNG tutorial, không qua MainMenu —
        // tránh nhấp nháy màn hình Menu rồi mới chuyển sang Gameplay.
        if (saveManager.playerData.hasSeenTutorial) {
            gameManager.changeState(AppState.MainMenu);
        } else {
            gameManager.startTutorial();
        }

        this.report(1, 'Xong');
        this.mark('HOÀN TẤT');
        console.log('[Bootloader] Boot sequence hoàn tất');
    }

    private async loadConnectTrackDifficultyMetadata(): Promise<void> {
        await new Promise<void>((resolve) => {
            resources.load('ConnectTrackData/tblevels_combined_0to200', JsonAsset, (error, asset) => {
                if (error || !asset || !Array.isArray(asset.json)) {
                    console.warn('[Bootloader] Không tải được metadata hard của ConnectTrack.');
                    setHardLevelIds([]);
                    resolve();
                    return;
                }
                const hardIds: number[] = [];
                for (const row of asset.json) {
                    if (typeof row !== 'object' || row === null) continue;
                    const record = row as Record<string, unknown>;
                    if (record.is_hard_level === true && typeof record.id === 'number') hardIds.push(record.id);
                }
                setHardLevelIds(hardIds);
                resolve();
            });
        });
    }

   

    private report(progress: number, step: string): void {
        // Chỉ tiến, không lùi: vài bước nay chạy song song nên có thể báo không theo thứ tự.
        progress = Math.max(progress, this.lastProgress);
        this.lastProgress = progress;
        if (isValid(this.bootView, true)) this.bootView!.setProgress(progress);
        const payload: BootProgressEventPayload = { progress, step };
        EventManager.instance.emit(BOOT_PROGRESS_EVENT, payload);
    }

    private getManager<T extends Component>(type: new () => T): T {
        const manager = this.appManagersNode.getComponent(type);
        if (!manager) {
            throw new Error(`[Bootloader] Thiếu component ${type.name} trên AppManagers node.`);
        }
        return manager;
    }
}
