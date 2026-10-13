// @ts-nocheck
// Learn cc.Class:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/class.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/class.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/life-cycle-callbacks.html

import { clientEvent } from "./framework/clientEvent";
import { configuration } from "./framework/configuration";
import { FriendAvatarInfo } from "./common/FriendAvatarInfo";
import { GameResource } from "./datainfo/GameResource";
import { ShopPackageDataConfig } from "./datainfo/ShopPackageDataConfig";
import { BoosterData } from "./datainfo/BoosterData";
import { SpecialData } from "./datainfo/SpecialData";
import { WithFriendDataInfo } from "./common/WithFriendDataInfo";
import { _decorator, Color, Size, Vec3 } from "cc";
import { BACK_TO_HOME_TYPE, BOOSTER_TYPE, Constants, CURRENCY_TYPE, ENV_TYPE, EVENT_TYPE, GAME_MODE, GAME_STATE, IAP_PLACEMENT_TYPE, IAP_SHOW_TYPE, PackageName, RESOURCE_TYPE, SCENE_NAME, SCENE_TYPE, SPECIAL_RESOURCE_TYPE } from "./framework/constants";
import { LogEventManager } from "./common/LogEventManager";
const { ccclass, property } = _decorator;

@ccclass("localConfig")
export class localConfig {
	/* class member could be defined like this */
	static _instance: localConfig;
	static get instance() {
		if (this._instance) {
			return this._instance;
		}

		this._instance = new localConfig();
		configuration.instance.start();
		return this._instance;
	}
	isLevelEditor: boolean = false;
	//#region FBInstant
	playerID: string;
	envType: ENV_TYPE = ENV_TYPE.TEST_AD;
	FAN_enable: boolean = true;
	isMobile: boolean = true;
	isRemoveRiseUpToTest: boolean = false;
	isRemoveHotPotToTest: boolean = false;
	isRemoveBattlePassToTest: boolean = false;
	isRemoveDailyToTest: boolean = false;
	//#endregion

	updatePlayerData_Finished() {

		localConfig.instance.currLevelUnlock = configuration.instance.getData_LevelCurrentUnlock();
		console.log("currLevelUnlock", localConfig.instance.currLevelUnlock);
		if (this.envType == ENV_TYPE.TEST_AD) {
			localConfig.instance.currLevelUnlock = 71; //test
		}

		localConfig.instance.isSound = configuration.instance.getData_Sound() == 1;
		localConfig.instance.isMusic = configuration.instance.getData_Music() == 1;
		localConfig.instance.isVibration = configuration.instance.getData_Vibration() == 1;

		localConfig.instance.isRemoveAd = configuration.instance.getData_RemoveAd();
		if(localConfig.instance.isRemoveAd){
			localConfig.instance.isShowIconNoAds = false;
		}

		localConfig.instance.log_CAMP_ID = configuration.instance.getData_CampID();
		localConfig.instance.log_ADSET_ID =
			configuration.instance.getData_AdsetID();
		localConfig.instance.log_ADS_ID = configuration.instance.getData_AdsID();
		localConfig.instance.log_TOUR_ID = configuration.instance.getData_TourID();
		if (localConfig.instance.log_CAMP_ID && localConfig.instance.log_CAMP_ID.length > 0) {
			localConfig.instance.isPaidUser = true;
		}

		if (localConfig.instance.log_ADSET_ID && localConfig.instance.log_ADSET_ID.length > 0) {
			localConfig.instance.isPaidUser = true;
		}

		if (localConfig.instance.log_ADS_ID && localConfig.instance.log_ADS_ID.length > 0) {
			localConfig.instance.isPaidUser = true;
		}

		localConfig.instance.isGetPlayerDataSuccess = true;

		localConfig.instance.isSubscribeBot = configuration.instance.getData_SubscribeBot() == 1;
		// console.log("updatePlayerData_Finished");
		clientEvent.dispatchEvent(Constants.GET_DATA_PLAYER_SUCCESS);
	}

	isGetPlayerDataSuccess: boolean = false;
	isGetPayloadDataSuccess: boolean = false;
	isGetRemoteConfigDataSuccess: boolean = false;

	arrConnectedPlayerInfos: FriendAvatarInfo[] = [];

	currGameState: GAME_STATE = GAME_STATE.PRE_START;
	currGameMode: GAME_MODE = GAME_MODE.NORMAL;

	currSceneName: SCENE_NAME = SCENE_NAME.preloadscene;

	getString_EntryPointData() { }

	entryPointData: string = "";

	setInfo_EntryPointData() { }

	resetEntryPointData() {
		this.entryPointData = "";
	}

	//#region SOUND,MUSIC
	isSound: boolean = true;
	isMusic: boolean = false;
	isVibration: boolean = false;

	setSound(isSound: boolean) {
		this.isSound = isSound;
		configuration.instance.setData_Sound(this.isSound);
	}
	setMusic(isMusic: boolean) {
		this.isMusic = isMusic;
		configuration.instance.setData_Music(this.isMusic);
	}
	setVibration(isVibration: boolean) {
		this.isVibration = isVibration;
		configuration.instance.setData_Vibration(this.isVibration);
	}
	//#endregion

	//#region LEVEL
	currLevelUnlock: number = 1;
	public setCurrLevelUnlock() {
		LogEventManager.instance.setUserProperties_BestLevel(localConfig.instance.currLevelUnlock);
		configuration.instance.setData_LevelCurrentUnlock(localConfig.instance.currLevelUnlock);
	}
	//#endregion

	getCurrDay() {
		let date = new Date();
		let currDay =
			date.getFullYear() * 10000 + date.getMonth() * 100 + date.getDate();
		return currDay;
	}

	getCurrTime() {
		let date = new Date();
		return date.getTime();
	}

	getCurrTimeSecond() {
		let date = new Date();
		return Math.floor(date.getTime() / 1000);
	}
	//#endregion

	//#region TIME_NEXT_DAY
	getTimeToNextDay() {
		let currDate = new Date();
		//console.log("getTimeToNextDaygetTimeToNextDaygetTimeToNextDay");
		//console.log(currDate.getTime());
		let lastDate = new Date(
			currDate.getFullYear(),
			currDate.getMonth(),
			currDate.getDate(),
		);
		//console.log(lastDate.getTime());

		return Math.floor((lastDate.getTime() - currDate.getTime()) / 1000) + 86400;
	}
	//#endregion

	//#region SCREEN
	SCREEN_WIDTH_DEFAULT = 720;
	SCREEN_HEIGHT_DEFAULT = 1280;

	SCREEN_WIDTH = 720;
	SCREEN_HEIGHT = 1280;

	isFitHeight: boolean = false;
	//#endregion

	//#region SCENE TYPE
	currSceneType: SCENE_TYPE = SCENE_TYPE.HOME;

	getStrSceneType(sceneType: SCENE_TYPE) {
		return SCENE_TYPE[sceneType].toLowerCase().toString();
	}
	//#endregion

	//#region HOME TABS
	TAB_SELECTED_SCALE = 1.35;
	TAB_UNSELECTED_SCALE = 1;
	isSet: boolean = false;
	TAB_COUNT = 5;
	MAX_WIDTH_FOR_BOTTOM_TAB = 960;
	tab_Selected_Size: Size = new Size(720 / 5, 225);
	tab_Unselected_Size: Size = new Size(720 / 5, 225);
	initTabConfig() {
		let countScale = this.TAB_SELECTED_SCALE + (this.TAB_COUNT - 1) * this.TAB_UNSELECTED_SCALE;
		let maxWidthTab = this.SCREEN_WIDTH;
		if (maxWidthTab > this.MAX_WIDTH_FOR_BOTTOM_TAB){
			maxWidthTab = this.MAX_WIDTH_FOR_BOTTOM_TAB;
		}
		maxWidthTab += 18;
		this.tab_Selected_Size.x =(maxWidthTab / countScale) * this.TAB_SELECTED_SCALE;
		this.tab_Unselected_Size.x =(maxWidthTab / countScale) * this.TAB_UNSELECTED_SCALE;

		console.log("initTabConfig",this.tab_Selected_Size.x,this.tab_Unselected_Size.x);
	}

	getTabPosition(indexTab: number, indexTabSelected: number) {
		let maxWidthTab = this.SCREEN_WIDTH;
		if (maxWidthTab > this.MAX_WIDTH_FOR_BOTTOM_TAB){
			maxWidthTab = this.MAX_WIDTH_FOR_BOTTOM_TAB;
		}	
		maxWidthTab += 18;

		let posStartX = -maxWidthTab / 2;
		// console.log("getTabPosition",indexTab,indexTabSelected,posStartX);
		if (indexTab < indexTabSelected) {
			return new Vec3(
				posStartX + (indexTab + 0.5) * this.tab_Unselected_Size.x,
				0,
				0,
			);
		} else if (indexTab == indexTabSelected) {
			return new Vec3(
				posStartX +
				indexTab * this.tab_Unselected_Size.x +
				this.tab_Selected_Size.x / 2,
				0,
				0,
			);
		} else {
			return new Vec3(
				posStartX +
				(indexTab - 0.5) * this.tab_Unselected_Size.x +
				this.tab_Selected_Size.x,
				0,
				0,
			);
		}
	}
	//#endregion

	//#region LOG EVENT
	log_CAMP_ID: string = "";
	log_ADSET_ID: string = "";
	log_ADS_ID: string = "";

	isPaidUser: boolean = false;

	campID_session: string = "";
	adsetID_session: string = "";
	adsID_session: string = "";

	checkCampID(campID: string) {
		return this.log_CAMP_ID == campID;
	}

	addCampID(campID: string) {
		this.log_CAMP_ID = campID;
		configuration.instance.setData_CampID(this.log_CAMP_ID);
	}

	checkAdsetID(adsetID: string) {
		return this.log_ADSET_ID == adsetID;
	}

	addAdsetID(adsetID: string) {
		this.log_ADSET_ID = adsetID;
		configuration.instance.setData_AdsetID(this.log_ADSET_ID);
	}

	checkAdsID(adsID: string) {
		return this.log_ADS_ID == adsID;
	}

	addAdsID(adsID: string) {
		this.log_ADS_ID = adsID;
		configuration.instance.setData_AdID(this.log_ADS_ID);
	}

	log_TOUR_ID: string = "";
	tourID_session: string = "";

	checkTourID(tourID: string) {
		return this.log_TOUR_ID == tourID;
	}

	addTourID(tourID: string) {
		this.log_TOUR_ID = tourID;
		configuration.instance.setData_TourID(this.log_TOUR_ID);
	}

	//#endregion

	//#region IAP
	isRemoveAd: boolean = false;

	isShowIconNoAds: boolean = true;
	setRemoveAd(isRemoveAd: boolean) {
		this.isRemoveAd = isRemoveAd;
		configuration.instance.setData_RemoveAd(this.isRemoveAd);

		// FBInstantManager.instance.HideBanner();
	}

	setIsShowIconNoAds(isShowIconNoAds: boolean) {
		this.isShowIconNoAds = isShowIconNoAds;
	}
	//#endregion

	//#region DAILY GIFT
	arrDailyGiftRewards: GameResource[] = [];

	//#endregion

	//#region SHOP
	arrShopPackageDataConfigs: ShopPackageDataConfig[] = [];

	getShopPackageDataConfig(packageName: PackageName): ShopPackageDataConfig {
		for (let i = 0; i < this.arrShopPackageDataConfigs.length; i++) {
			if (this.arrShopPackageDataConfigs[i].packageName == packageName) {
				return this.arrShopPackageDataConfigs[i];
			}
		}
		return null;
	}

	getIAP_PlacementType(iapPlacementType: IAP_PLACEMENT_TYPE) {
        return IAP_PLACEMENT_TYPE[iapPlacementType].toLowerCase().toString();
    }

    getIAP_ShowType(iapShowType: IAP_SHOW_TYPE) {
        return IAP_SHOW_TYPE[iapShowType].toLowerCase().toString();
    }
	//#endregion

	//#region WITH FRIEND
	currWithFriendDataInfo: WithFriendDataInfo = null;
	//#endregion

	TIME_HOLD_SEE_FULL_GAME: number = 100;

	//#region INGAME DURATION
	ingameTimeStart: number = 0;
	//#endregion

	//#region SUB
	isSubscribeBot: boolean = false;

	setData_SubscribeBot(isSubscribeBot: boolean) {
		this.isSubscribeBot = isSubscribeBot;
		configuration.instance.setData_SubscribeBot(isSubscribeBot);
	}
	//#endregion

	
	//#endregion
}

export type GetBase64Image_Callback = (base64Image: string) => void;
