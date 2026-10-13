import { _decorator, Component, Director, Node, Prefab, ResolutionPolicy, director, view, resources, instantiate, isValid } from 'cc';
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
        this.report(0.05, 'Chuẩn bị');

        // Facebook Instant Games yêu cầu gọi startGameAsync() CÀNG SỚM CÀNG TỐT để ẩn loading
        // screen của nền tảng. Không có FBInstant (Editor/preview) thì giữ nguyên Mock mặc định
        // của 2 Holder — toàn bộ game vẫn chạy được, chỉ mất phần gọi backend/nền tảng thật.
        if (typeof FBInstant !== 'undefined') {
            FBInstantManagerHolder.set(new FBInstantManager());
            PGSPlayInstantManagerHolder.set(new PGSPlayInstantManager());
            PaymentServiceHolder.set(new FbPaymentService());
        }
        await FBInstantManagerHolder.current.init();
        this.report(0.1, 'Kết nối nền tảng');

        const resourceManager = this.getManager(ResourceManager);
        const saveManager = this.getManager(SaveManager);
        const audioManager = this.getManager(AudioManager);
        const gameManager = this.getManager(GameManager);
        const sceneManager = this.getManager(SceneManager);
        const uiManager = this.getManager(UIManager);

        const localizationManager =
            this.appManagersNode.getComponent(LocalizationManager) ??
            this.appManagersNode.addComponent(LocalizationManager);
        // Bắt đầu NẠP file ngôn ngữ (bản FALLBACK_LANGUAGE) NGAY TỪ ĐẦU boot, chạy SONG SONG với
        // resourceManager.init() — không cần đợi biết ngôn ngữ người chơi đã lưu (saveManager.load()
        // chạy SAU) mới bắt đầu tải, rút ngắn tổng thời gian boot. init() gọi lại lần 2 bên dưới
        // với ngôn ngữ THẬT của người chơi là AN TOÀN/idempotent — ensureLoaded() tự bỏ qua phần
        // đã cache (nếu ngôn ngữ thật trùng fallback thì gần như không mất thêm thời gian).
        const localizationReady = localizationManager.init(FALLBACK_LANGUAGE);

        await Promise.all([resourceManager.init(), localizationReady]);
        this.report(0.2, 'Tài nguyên');

        await saveManager.load();
        saveManager.subscribeSaveTriggers();
        this.report(0.4, 'Dữ liệu người chơi');

        await localizationManager.init(saveManager.playerData.settings.language);
        this.report(0.5, 'Ngôn ngữ');

        audioManager.applyVolume(saveManager.playerData.settings);
        audioManager.subscribeSettingsChanges();
        this.report(0.55, 'Âm thanh');

       
        gameManager.initSystems();
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

        this.report(0.8, 'Vào màn chính');
        await Promise.all([
            sceneManager.preloadMainScene(progress => this.report(0.8 + progress * 0.15, 'Tải màn chính')),
            levelReady,
        ]);
        if (!isValid(this, true)) return;
        if (this.bootView && !await this.bootView.complete()) return;
        await new Promise<void>(resolve => director.once(Director.EVENT_AFTER_DRAW, resolve));
        if (!isValid(this, true)) return;
        await sceneManager.loadMainScene();
        this.report(0.95, 'Dựng giao diện');

        uiManager.attachToScene();

        // Lần đầu mở app (chưa xem tutorial): vào THẲNG tutorial, không qua MainMenu —
        // tránh nhấp nháy màn hình Menu rồi mới chuyển sang Gameplay.
        if (saveManager.playerData.hasSeenTutorial) {
            gameManager.changeState(AppState.MainMenu);
        } else {
            gameManager.startTutorial();
        }

        this.report(1, 'Xong');
        console.log('[Bootloader] Boot sequence hoàn tất');
    }

   

    private report(progress: number, step: string): void {
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
