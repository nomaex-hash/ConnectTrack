// @ts-nocheck
import { _decorator, Component, director, Game, Node } from 'cc';
import { GameResourceSaveData } from './GameResourceSaveData';
import { configuration } from '../framework/configuration';
import { BoosterData } from '../datainfo/BoosterData';
import { ReadDataJsonCommon } from '../data/ReadDataJsonCommon';
import { BOOSTER_TYPE, CURRENCY_TYPE, RESOURCE_TYPE, SPECIAL_RESOURCE_TYPE } from '../framework/constants';
import { SpecialData } from '../datainfo/SpecialData';
import { GameResource } from '../datainfo/GameResource';
import { localConfig } from '../localConfig';
import { LogEventManager } from '../common/LogEventManager';
const { ccclass, property } = _decorator;

@ccclass('GameResourceConfigManager')
export class GameResourceConfigManager extends Component {
    public static instance: GameResourceConfigManager = null;
    protected onLoad(): void {
        director.addPersistRootNode(this.node);
        GameResourceConfigManager.instance = this;

        this.initGameResourceConfigManager();
    }

    gameResourceSaveData:GameResourceSaveData = null;
    arrBoosterDatas: BoosterData[] = [];
    arrSpecialDatas: SpecialData[] = [];
    initGameResourceConfigManager(){
        this.arrBoosterDatas = ReadDataJsonCommon.instance.readBoosterData();
        this.arrSpecialDatas = ReadDataJsonCommon.instance.readSpecialData();

        this.gameResourceSaveData = new GameResourceSaveData();
        this.gameResourceSaveData.initGameResourceData(configuration.instance.getData_GameResources());
        this.gameResourceSaveData.initGameResourceData_LastTime(configuration.instance.getData_GameResources_LastTime());
        this.gameResourceSaveData.initGameResourceData_Spent(configuration.instance.getData_GameResources_Spent());
        this.gameResourceSaveData.initBoosterUnlockeds(configuration.instance.getData_BoosterUnlocked());
        this.initDefaultGameResources();
        this.initExtraBooster();


        this.setGameResource(RESOURCE_TYPE.BOOSTER,BOOSTER_TYPE.UNDO,999);
        this.setGameResource(RESOURCE_TYPE.BOOSTER,BOOSTER_TYPE.SHUFFLE, 999);
        this.setGameResource(RESOURCE_TYPE.BOOSTER,BOOSTER_TYPE.ADD_COL,999);
    }


    getBoosterData(boosterType: BOOSTER_TYPE): BoosterData {
        for (let i = 0; i < this.arrBoosterDatas.length; i++) {
            if (this.arrBoosterDatas[i].BoosterType == boosterType) {
                return this.arrBoosterDatas[i];
            }
        }
        return null;
    }

    getBoosterUnlockLevel(boosterType: BOOSTER_TYPE): number {
        let boosterData = this.getBoosterData(boosterType);
        if (boosterData) {
            return boosterData.UnlockLevel;
        }
        return 0;
    }

    checkBoosterUnlocked(boosterType: BOOSTER_TYPE): boolean {
        if(this.gameResourceSaveData.arrBoosterUnlockeds.indexOf(boosterType) != -1) return true;
        return false;
    }

    setBoosterUnlocked(boosterType: BOOSTER_TYPE) {
        this.gameResourceSaveData.arrBoosterUnlockeds.push(boosterType);
        this.setSaveGameBoosterUnlockeds();
    }

    getSpecialData(boosterType: SPECIAL_RESOURCE_TYPE): SpecialData {
        for (let i = 0; i < this.arrSpecialDatas.length; i++) {
            if (this.arrSpecialDatas[i].BoosterType == boosterType) {
                return this.arrSpecialDatas[i];
            }
        }
        return null;
    }


    setSaveGameResourceData(){
        let strGameResourceData = this.gameResourceSaveData.getStrGameResourceData();
        configuration.instance.setData_GameResources(strGameResourceData);
    }

    setSaveGameResourceData_LastTime(){
        let strGameResourceData = this.gameResourceSaveData.getStrGameResourceData_LastTime();
        configuration.instance.setData_GameResources_LastTime(strGameResourceData);
    }

    

    setSaveGameBoosterUnlockeds(){
        let strGameBoosterUnlockeds = this.gameResourceSaveData.getStrBoosterUnlockeds();
        configuration.instance.setData_BoosterUnlocked(strGameBoosterUnlockeds);
    }

    getGameResource(type: RESOURCE_TYPE, specificType: number): GameResource {
        for (let i = 0; i < this.gameResourceSaveData.arrGameResources.length; i++) {
            if (this.gameResourceSaveData.arrGameResources[i].Type == type &&
                this.gameResourceSaveData.arrGameResources[i].SpecificType == specificType) {
                return this.gameResourceSaveData.arrGameResources[i];
            }
        }
        return null;
    }

    getValueGameResource(type: RESOURCE_TYPE, specificType: number): number {
        let gameResource = this.getGameResource(type, specificType);
        if (gameResource != null) {
            if(gameResource.Value.m_Value < 0) return 0;
            return gameResource.Value.m_Value;
        }
        return 0;
    }

    
    setGameResource(type: RESOURCE_TYPE, specificType: number, value: number) {
        let gameResource = this.getGameResource(type, specificType);
        if (gameResource == null) {
            gameResource = new GameResource(type, specificType, value);
            this.gameResourceSaveData.arrGameResources.push(gameResource);
        } else {
            gameResource.Value = { m_Value: value };
        }
        this.setSaveGameResourceData();
    }

    checkHaveGameResource(type: RESOURCE_TYPE, specificType: number): boolean {
        for (let i = 0; i < this.gameResourceSaveData.arrGameResources.length; i++) {
            if (this.gameResourceSaveData.arrGameResources[i].Type == type && this.gameResourceSaveData.arrGameResources[i].SpecificType == specificType) {
                return true;
            }
        }
        return false;
    }

  
    setSaveGameResourceData_Spent(){
        let strGameResourceData_Spent = this.gameResourceSaveData.getStrGameResourceData_Spent();
        configuration.instance.setData_GameResources_Spent(strGameResourceData_Spent);
    }

    getGameResource_Spent(type: RESOURCE_TYPE, specificType: number): GameResource {
        for (let i = 0; i < this.gameResourceSaveData.arrGameResources_Spent.length; i++) {
            if (this.gameResourceSaveData.arrGameResources_Spent[i].Type == type &&
                this.gameResourceSaveData.arrGameResources_Spent[i].SpecificType == specificType) {
                return this.gameResourceSaveData.arrGameResources_Spent[i];
            }
        }
        return null;
    }

    getValueGameResource_Spent(type: RESOURCE_TYPE, specificType: number): number {
        let gameResource_Spent = this.getGameResource_Spent(type, specificType);
        if (gameResource_Spent != null) {
            if(gameResource_Spent.Value.m_Value < 0) return 0;
            return gameResource_Spent.Value.m_Value;
        }
        return 0;
    }

    addValueGameResource_Spent(type: RESOURCE_TYPE, specificType: number, valueSpent: number) {
		let gameResource_Spent = this.getGameResource_Spent(type, specificType);
		if (gameResource_Spent == null) {
			gameResource_Spent = new GameResource(type, specificType, valueSpent);
			this.gameResourceSaveData.arrGameResources_Spent.push(gameResource_Spent);
		} else {
			let newValue = gameResource_Spent.Value.m_Value + valueSpent;
			gameResource_Spent.Value = { m_Value: newValue };
		}
		this.setSaveGameResourceData_Spent();
		if(type == RESOURCE_TYPE.CURRENCY && specificType == CURRENCY_TYPE.MONEY) {
			LogEventManager.instance.setUserProperties_Spent_Coin(gameResource_Spent.Value.m_Value);
		}else if(type == RESOURCE_TYPE.BOOSTER) {
			LogEventManager.instance.setUserProperties_Spent_Booster(specificType, gameResource_Spent.Value.m_Value);
		}
	}


    setGameResource_Spent(type: RESOURCE_TYPE, specificType: number, value: number) {
        let gameResource_Spent = this.getGameResource_Spent(type, specificType);
        if (gameResource_Spent == null) {
            gameResource_Spent = new GameResource(type, specificType, value);
            this.gameResourceSaveData.arrGameResources_Spent.push(gameResource_Spent);
        } else {
            gameResource_Spent.Value = { m_Value: value };
        }
        this.setSaveGameResourceData_Spent();
    }

    checkHaveGameResource_Spent(type: RESOURCE_TYPE, specificType: number): boolean {
        for (let i = 0; i < this.gameResourceSaveData.arrGameResources_Spent.length; i++) {
            if (this.gameResourceSaveData.arrGameResources_Spent[i].Type == type && this.gameResourceSaveData.arrGameResources_Spent[i].SpecificType == specificType) {
                return true;
            }
        }
        return false;
    }

    getGameResource_LastTime(type: RESOURCE_TYPE,specificType: number): GameResource {
        for (let i = 0; i < this.gameResourceSaveData.arrGameResources_LastTime.length; i++) {
            if (this.gameResourceSaveData.arrGameResources_LastTime[i].Type == type && this.gameResourceSaveData.arrGameResources_LastTime[i].SpecificType == specificType) {
                return this.gameResourceSaveData.arrGameResources_LastTime[i];
            }
        }
        return null;
    }

    getValueGameResource_LastTime(type: RESOURCE_TYPE,specificType: number): number {
        let gameResource = this.getGameResource_LastTime(type, specificType);
        if (gameResource != null) {
            return gameResource.Value.m_Value;
        }
        return 0;
    }

    setGameResource_LastTime(type: RESOURCE_TYPE, specificType: number, value: number) {
        let gameResource = this.getGameResource_LastTime(type, specificType);
        if (gameResource == null) {
            gameResource = new GameResource(type, specificType, value);
            this.gameResourceSaveData.arrGameResources_LastTime.push(gameResource);
        } else {
            gameResource.Value = { m_Value: value };
        }
        this.setSaveGameResourceData_LastTime();
    }

    //#endregion


    initDefaultGameResources() {
        let isSetDefaultGameResources = false;
        let moneyCurrencyGameResource = this.getGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.MONEY);
        let lifeCurrencyGameResource = this.getGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE);
        if (moneyCurrencyGameResource == null && lifeCurrencyGameResource == null) {
            isSetDefaultGameResources = true;
            let moneyCurrency = new GameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.MONEY,1000);
            this.gameResourceSaveData.arrGameResources.push(moneyCurrency);
            let lifeCurrency = new GameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE,5);
            this.gameResourceSaveData.arrGameResources.push(lifeCurrency);

            let boosterUndo = new GameResource(RESOURCE_TYPE.BOOSTER,BOOSTER_TYPE.UNDO,3);
            this.gameResourceSaveData.arrGameResources.push(boosterUndo);
            let boosterShuffle = new GameResource(RESOURCE_TYPE.BOOSTER,BOOSTER_TYPE.SHUFFLE,3);
            this.gameResourceSaveData.arrGameResources.push(boosterShuffle);
            let boosterAddCol = new GameResource(RESOURCE_TYPE.BOOSTER,BOOSTER_TYPE.ADD_COL,3);
            this.gameResourceSaveData.arrGameResources.push(boosterAddCol);
        }
        if (isSetDefaultGameResources) {
            this.setSaveGameResourceData();
        }
    }

    currHeartUnlimited_CountTime: number = 0;
    initExtraBooster() {

        let heartUnlimited_GameResource = this.getValueGameResource(RESOURCE_TYPE.SPECIAL,SPECIAL_RESOURCE_TYPE.INFINITE_LIFE);
        let heartUnlimited_GameResource_LastTime = this.getValueGameResource_LastTime(RESOURCE_TYPE.SPECIAL,SPECIAL_RESOURCE_TYPE.INFINITE_LIFE);
        this.currHeartUnlimited_CountTime = heartUnlimited_GameResource - (localConfig.instance.getCurrTimeSecond() - heartUnlimited_GameResource_LastTime);
        if (this.currHeartUnlimited_CountTime <= 0) {
            this.currHeartUnlimited_CountTime = 0;
        }
    }


    

    getPathIconGameResource(type: RESOURCE_TYPE, specificType: number) {
        if (type == RESOURCE_TYPE.CURRENCY) {
            return `gameresouces/currency_${CURRENCY_TYPE[specificType].toString().toLowerCase()}`;
        } else if (type == RESOURCE_TYPE.BOOSTER) {
            return `gameresouces/${this.getConnectTrackBoosterIconName(specificType, false)}`;
        } else if (type == RESOURCE_TYPE.SPECIAL) {
            return `gameresouces/special_${SPECIAL_RESOURCE_TYPE[specificType].toString().toLowerCase()}`;
        }
    }

    getPathIconGameResourceSmall(type: RESOURCE_TYPE, specificType: number) {
        if (type == RESOURCE_TYPE.CURRENCY) {
            return `gameresouces/currency_${CURRENCY_TYPE[specificType].toString().toLowerCase()}_2`;
        } else if (type == RESOURCE_TYPE.BOOSTER) {
            return `gameresouces/${this.getConnectTrackBoosterIconName(specificType, true)}`;
        } else if (type == RESOURCE_TYPE.SPECIAL) {
            return `gameresouces/special_${SPECIAL_RESOURCE_TYPE[specificType].toString().toLowerCase()}_2`;
        }
    }

    getPathIconGameResourceBig(type: RESOURCE_TYPE, specificType: number) {
        if (type == RESOURCE_TYPE.CURRENCY) {
            return `gameresouces/currency_${CURRENCY_TYPE[specificType].toString().toLowerCase()}_2`;
        } else if (type == RESOURCE_TYPE.BOOSTER) {
            return `gameresouces/${this.getConnectTrackBoosterIconName(specificType, false)}`;
        } else if (type == RESOURCE_TYPE.SPECIAL) {
            return `gameresouces/special_${SPECIAL_RESOURCE_TYPE[specificType].toString().toLowerCase()}_2`;
        }
    }

    private getConnectTrackBoosterIconName(specificType: number, small: boolean): string {
        const suffix = small ? '_2' : '';
        if (specificType == BOOSTER_TYPE.HINT) return `game_prop_hint${suffix}`;
        if (specificType == BOOSTER_TYPE.PLACE_DOG) return `item_hint_track${suffix}`;
        return `booster_${BOOSTER_TYPE[specificType].toString().toLowerCase()}${suffix}`;
    }


    getStrBoosterType(boosterType: BOOSTER_TYPE): string {
        if (boosterType == BOOSTER_TYPE.ADD_COL) {
            return "booster_addcol";
        }else if (boosterType == BOOSTER_TYPE.SHUFFLE) {
            return "booster_shuffle";
        }else if (boosterType == BOOSTER_TYPE.UNDO) {
            return "booster_undo";
        }else if (boosterType == BOOSTER_TYPE.HINT) {
            return "booster_hint";
        }else if (boosterType == BOOSTER_TYPE.PLACE_DOG) {
            return "booster_place_dog";
        }
        return "booster_unknown";
    }

    getStrResourceType(resourceType: RESOURCE_TYPE): string {
        return RESOURCE_TYPE[resourceType].toString().toLowerCase();
    }

    getStrResourceName(resourceType: RESOURCE_TYPE,specificType: number) {
        if (resourceType == RESOURCE_TYPE.CURRENCY) {
            return CURRENCY_TYPE[specificType].toString().toLowerCase();
        } else if (resourceType == RESOURCE_TYPE.BOOSTER) {
            return BOOSTER_TYPE[specificType].toString().toLowerCase();
        } else if (resourceType == RESOURCE_TYPE.SPECIAL) {
            return SPECIAL_RESOURCE_TYPE[specificType].toString().toLowerCase();
        }
    }

    clearData() {
        this.gameResourceSaveData = null;
        this.arrBoosterDatas = [];
        this.arrSpecialDatas = [];
    }

}


