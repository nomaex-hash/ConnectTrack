import { _decorator, Component } from 'cc';
import { SaveData } from '../model/SaveData';
import { PlayerData } from '../model/PlayerData';
import { BoardSaveData } from '../model/BoardSaveData';
import { ISaveService } from '../service/ISaveService';
import { LocalSaveService } from '../service/LocalSaveService';
import {
    createDefaultSaveData,
    deserializeSaveData,
    serializeSaveData,
} from '../data/SaveDataSerializer';
import { EventManager } from '../core/EventManager';
import { PuzzleSessionHolder } from '../gameplay/PuzzleSessionHolder';
import {
    BOARD_RESTARTED_EVENT,
    CELL_CHANGED_EVENT,
    MISTAKE_CHANGED_EVENT,
    PLACE_DOG_USED_EVENT,
} from '../event/PuzzleEvents';
import {
    LEVEL_UNLOCKED_EVENT,
    SAVE_REQUESTED_EVENT,
    SETTINGS_CHANGED_EVENT,
} from '../event/AppEvents';

const { ccclass } = _decorator;


const BOARD_CHANGE_EVENTS: readonly string[] = [
    CELL_CHANGED_EVENT,
    MISTAKE_CHANGED_EVENT,
    PLACE_DOG_USED_EVENT,
    BOARD_RESTARTED_EVENT,
];


const PERSIST_ONLY_EVENTS: readonly string[] = [
    LEVEL_UNLOCKED_EVENT,
    SETTINGS_CHANGED_EVENT,
    SAVE_REQUESTED_EVENT,
];


@ccclass('SaveManager')
export class SaveManager extends Component {
    private static _instance: SaveManager | null = null;
    static get instance(): SaveManager {
        if (!this._instance) throw new Error('SaveManager chưa được khởi tạo.');
        return this._instance;
    }

    private readonly saveService: ISaveService = new LocalSaveService();
    private document: SaveData = createDefaultSaveData();

    private writing = false;
    private writeQueued = false;

    onLoad(): void {
        SaveManager._instance = this;
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
        if (SaveManager._instance === this) SaveManager._instance = null;
    }

    get playerData(): PlayerData {
        return this.document.playerData;
    }

    async load(): Promise<void> {
        const raw = await this.saveService.read();
        this.document = raw ? deserializeSaveData(raw) : createDefaultSaveData();
    }

  
    subscribeSaveTriggers(): void {
        const bus = EventManager.instance;

        for (const name of BOARD_CHANGE_EVENTS) {
            bus.on(name, this.onBoardChanged, this);
        }

    
        for (const name of PERSIST_ONLY_EVENTS) {
            bus.on(name, this.onSaveTrigger, this);
        }
    }

 
    private onBoardChanged = (): void => {
        const session = PuzzleSessionHolder.current;
        if (session) {
            const snapshot = session.createSnapshot();
      
            if (snapshot.context !== 'tutorial') this.attachBoardSnapshot(snapshot);
        }
        void this.persist();
    };

    private onSaveTrigger = (): void => {
        void this.persist();
    };

    
    attachBoardSnapshot(snapshot: BoardSaveData): void {
        this.document.playerData.boardInProgress = snapshot;
    }

  
    detachBoardSnapshot(): void {
        this.document.playerData.boardInProgress = null;
    }


    async persist(): Promise<void> {
        if (this.writing) {
            this.writeQueued = true;
            return;
        }
        this.writing = true;
        try {
            do {
                this.writeQueued = false;
                await this.saveService.write(serializeSaveData(this.document));
            } while (this.writeQueued);
        } catch (error: unknown) {
            console.error('[SaveManager] Ghi save thất bại:', error);
        } finally {
            this.writing = false;
        }
    }
}
