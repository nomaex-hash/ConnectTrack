// @ts-nocheck
import { Asset, log, sys, _decorator } from "cc";
import { localConfig } from "../localConfig";
// import { LANGUAGE } from "../scene/menu/ItemSelectLanguage";
import { clientEvent } from "./clientEvent";
import { Constants, ENV_TYPE } from "./constants";
import { lodash } from "./lodash";
import { InfoDay } from "../calendar/InfoDay";
import { ConstantKeySaves } from "../constantKeySaves";
import { FBInstantManager } from "../common/FBInstantManager";
import { GameResource } from "../datainfo/GameResource";
// import { EventScoreDataInfo } from "../tournament/EventScoreDataInfo";
const { ccclass } = _decorator;

declare const jsb: any;
export type ValueObj = { [name: string]: string };

export type Constructor<T = unknown> = new (...args: any[]) => T;
export type AssetType<T = Asset> = Constructor<T>;
export type LoadCompleteCallback<T> = (error: Error | null, asset: T) => void;

@ccclass("configuration")
export class configuration {
    static _instance: configuration;

    static get instance () {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new configuration();
        //this._instance.start();
        return this._instance;
    }

    jsonData: any = {};
    path: any = null;
    KEY_CONFIG: string = Constants.GAME_NAME;
    markSave: boolean = false;
    saveTimer: number = -1;

    start () {
        // sys.localStorage.clear();
        // this.jsonData = {
        // };

        if(localConfig.instance.envType == ENV_TYPE.TEST_AD){
            this.path = this.getConfigPath();

            let content;
            if (sys.isNative) {
                const valueObject = jsb.fileUtils.getValueMapFromFile(this.path);

                content = valueObject[this.KEY_CONFIG];
            } else {
                content = sys.localStorage.getItem(this.KEY_CONFIG);
            }
            // console.log("configurationconfigurationconfiguration");
            // console.log(content);
            if (content && content.length) {
                if (content.startsWith('@')) {
                    content = content.substring(1);
                }

                try {
                    //初始化操作
                    // const jsonData = JSON.parse(content);
                    // // console.log(jsonData);
                    // this.jsonData = jsonData;
                    this.updateDataPlayer(content);
                }catch (excepaiton) {

                }

            }else{
                localConfig.instance.updatePlayerData_Finished();
            }

            // //启动无限定时器，每1秒保存一次数据，而不是无限保存数据
            // this.saveTimer = setInterval(() =>{
            //     this.scheduleSave();
            // }, 500);
        }
    }

    updateDataPlayer(content:string){
        // console.log("updateDataPlayerupdateDataPlayerupdateDataPlayerupdateDataPlayer");
        // console.log(this.jsonData);
        try {
            // content = content.replace("\"","");
            this.jsonData = JSON.parse(content);
        } catch (error) {
            // console.error(error);
            if(lodash.isObject(content)){
                this.jsonData = content;
            }
        }
        localConfig.instance.updatePlayerData_Finished();
    }
    setGlobalData (key:string, value: any) {
        this.jsonData[key] = value;
        this.save();
    }

    scheduleSave () {
        if (!this.markSave) {
            return;
        }

        this.save();
    }

    /**
     * 标记为已修改
     */
    markModified () {
        this.markSave = true;
    }

    save () {
        // 写入文件
       if(configuration.instance.mySaveInterval){
            clearInterval(configuration.instance.mySaveInterval);
        }

        if(configuration.instance.isCheckSaveInterval){
            configuration.instance.isCheckSaveInterval = false;
        }

        configuration.instance.mySaveInterval = setInterval(configuration.instance.saveInterval,300);
    }

    mySaveInterval = null;
    isCheckSaveInterval:boolean = true;
    saveInterval(){
        clearInterval(configuration.instance.mySaveInterval);
        configuration.instance.mySaveInterval = null;

        let str = JSON.stringify(configuration.instance.jsonData);
        // console.log(str);

        if(localConfig.instance.envType == ENV_TYPE.TEST_AD ){
            // console.log(str);
            let zipStr = str;

            configuration.instance.markSave = false;

            if (!sys.isNative) {
                const ls = sys.localStorage;
                ls.setItem(configuration.instance.KEY_CONFIG, zipStr);
                return;
            }

            const valueObj: ValueObj = {};
            valueObj[configuration.instance.KEY_CONFIG] = zipStr;
            jsb.fileUtils.writeToFile(valueObj, configuration.instance.path);
        }

        FBInstantManager.instance.SetDataPlayer(str);
    }

    getConfigPath () {

        const platform = sys.platform;

        let path = "";

        if (sys.isNative) {
            path = jsb.fileUtils.getWritablePath();
            path = path + "conf";
        } else {
            path = "src/conf";
        }

        return path;
    }

    parseUrl (paramStr: string) {
        if (!paramStr || (typeof paramStr === 'string' && paramStr.length <= 0)) {
            // 没有带参数，直接忽略
            return;
        }

        let dictParam: any = {};
        if (typeof paramStr === 'string') {
            paramStr = paramStr.split('?')[1]; // 去除掉 ？号
            const arrParam = paramStr.split("&");
            arrParam.forEach(function (paramValue) {
                const idxEqual = paramValue.indexOf("=");
                if (idxEqual !== -1) {
                    const key = paramValue.substring(0, idxEqual);
                    dictParam[key] = paramValue.substring(idxEqual + 1);
                }
            });
        } else {
            dictParam = paramStr;
        }

        if (dictParam.action) {
            this.setGlobalData('urlParams', dictParam);
        }

        // todo：记录来源，以后用到
        if (dictParam.source) {
            this.setGlobalData('source', dictParam.source);
        }

        if (dictParam.adchannelid) {
            this.setGlobalData('adchannelid', dictParam.adchannelid);
        }
    }


    getGlobalData (key:string) {
        return this.jsonData[key];
    }

    hasGlobalData (key:string) {
        return this.jsonData.hasOwnProperty(key);
    }

    

    //#region LOG CAMPID
    setData_CampID(logCampID:string){
        this.jsonData[ConstantKeySaves.LOG_CAMPID] = logCampID;
        this.save();
    }

    getData_CampID(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.LOG_CAMPID)){
            return  this.jsonData[ConstantKeySaves.LOG_CAMPID];
        }
        return "";
    }
    //#endregion

    //#region NOADS FIRST SHOWN
    setData_NoAdsFirstShown(isShown:boolean){
        this.jsonData[ConstantKeySaves.NOADS_FIRST_SHOWN] = isShown;
        this.save();
    }

    getData_NoAdsFirstShown(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.NOADS_FIRST_SHOWN)){
            return this.jsonData[ConstantKeySaves.NOADS_FIRST_SHOWN];
        }
        return false;
    }
    //#endregion

    //#region LOG ADSET
    setData_AdsetID(logAdsetID:string){
        this.jsonData[ConstantKeySaves.LOG_ADSET] = logAdsetID;
        this.save();
    }

    getData_AdsetID(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.LOG_ADSET)){
            return  this.jsonData[ConstantKeySaves.LOG_ADSET];
        }
        return "";
    }
    //#endregion

    //#region LOG ADS
    setData_AdID(logAdID:string){
        this.jsonData[ConstantKeySaves.LOG_ADS] = logAdID;
        this.save();
    }

    getData_AdsID(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.LOG_ADS)){
            return  this.jsonData[ConstantKeySaves.LOG_ADS];
        }
        return "";
    }
    //#endregion

    //#region LOG TOUR
    setData_TourID(logTourID:string){
        this.jsonData[ConstantKeySaves.LOG_TOUR] = logTourID;
        this.save();
    }

    getData_TourID(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.LOG_TOUR)){
            return  this.jsonData[ConstantKeySaves.LOG_TOUR];
        }
        return "";
    }
    //#endregion

    //#region COUNT ADS
    setData_CountInterstitialAds(countInterAds:number){
        this.jsonData[ConstantKeySaves.COUNT_INTERSTITIAL_ADS] = countInterAds;
        this.save();
    }

    getData_CountInterstitialAds(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.COUNT_INTERSTITIAL_ADS)){
            return  this.jsonData[ConstantKeySaves.COUNT_INTERSTITIAL_ADS];
        }
        return 0;
    }

    setData_CountRewardedAds(countRewardedAds:number){
        this.jsonData[ConstantKeySaves.COUNT_REWARDED_ADS] = countRewardedAds;
        this.save();
    }

    getData_CountRewardedAds(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.COUNT_REWARDED_ADS)){
            return  this.jsonData[ConstantKeySaves.COUNT_REWARDED_ADS];
        }
        return 0;
    }

    setData_CountRewardedAds_Completed(countRewardedAdsCompleted:number){
        this.jsonData[ConstantKeySaves.COUNT_REWARDED_ADS_COMPLETED] = countRewardedAdsCompleted;
        this.save();
    }

    getData_CountRewardedAds_Completed(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.COUNT_REWARDED_ADS_COMPLETED)){
            return  this.jsonData[ConstantKeySaves.COUNT_REWARDED_ADS_COMPLETED];
        }
        return 0;
    }

    setData_CountBannerAds(countBannerAds:number){
        this.jsonData[ConstantKeySaves.COUNT_BANNER_ADS] = countBannerAds;
        this.save();
    }

    getData_CountBannerAds(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.COUNT_BANNER_ADS)){
            return  this.jsonData[ConstantKeySaves.COUNT_BANNER_ADS];
        }
        return 0;
    }
    //#endregion

    //#region GAMERESOURCES
    setData_GameResources(strGameResources:string){
        this.jsonData[ConstantKeySaves.GAMERESOURCES] = strGameResources;
        this.save();
    }

    getData_GameResources(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.GAMERESOURCES)){
            return  this.jsonData[ConstantKeySaves.GAMERESOURCES];
        }
        return "";
    }
    //#endregion

    //#region GAMERESOURCES
    setData_GameResources_LastTime(strGameResources_LastTime:string){
        this.jsonData[ConstantKeySaves.GAMERESOURCES_LASTTIME] = strGameResources_LastTime;
        this.save();
    }

    getData_GameResources_LastTime(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.GAMERESOURCES_LASTTIME)){
            return  this.jsonData[ConstantKeySaves.GAMERESOURCES_LASTTIME];
        }
        return "";
    }
    //#endregion

     //#region GAMERESOURCES SPENT
    setData_GameResources_Spent(strGameResourcesSpent:string){
        this.jsonData[ConstantKeySaves.GAMERESOURCES_SPENT] = strGameResourcesSpent;
        this.save();
    }

    getData_GameResources_Spent(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.GAMERESOURCES_SPENT)){
            return  this.jsonData[ConstantKeySaves.GAMERESOURCES_SPENT];
        }
        return "";
    }
    //#endregion

    //#region BOOSTER UNLOCKED
    setData_BoosterUnlocked(strBoosterUnlokcked:string) {
        this.jsonData[ConstantKeySaves.GAMEBOOSTER_UNLOCKED] = strBoosterUnlokcked;
        this.save();
    }

    getData_BoosterUnlocked() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.GAMEBOOSTER_UNLOCKED)) {
            return this.jsonData[ConstantKeySaves.GAMEBOOSTER_UNLOCKED];
        }
        return "";   
    }
    //#endregion

    //#region LEVEL UNLOCK
    setData_LevelCurrentUnlock(levelCurrentUnlock:number){
        // console.log("setData_LevelCurrentUnlock")
        this.jsonData[ConstantKeySaves.LEVEL_CURRENT_UNLOCK] = levelCurrentUnlock;
        this.save();
    }

    getData_LevelCurrentUnlock(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.LEVEL_CURRENT_UNLOCK)){
            return  this.jsonData[ConstantKeySaves.LEVEL_CURRENT_UNLOCK];
        }
        return 1;
    }
    //#endregion


    //#region SOUND
    setData_Sound(isSound:boolean){
        this.jsonData[Constants.SOUND] = isSound ? 1 : 0;
        this.save();
    }

    getData_Sound(){
        if(this.jsonData.hasOwnProperty(Constants.SOUND)){
            return  this.jsonData[Constants.SOUND];
        }
        return 1;
    }
    //#endregion

    //#region MUSIC
    setData_Music(isMusic:boolean){
        this.jsonData[Constants.MUSIC] = isMusic ? 1 : 0;
        this.save();
    }

    getData_Music(){
        if(this.jsonData.hasOwnProperty(Constants.MUSIC)){
            return  this.jsonData[Constants.MUSIC];
        }
        return 1;
    }
    //#endregion

    //#region VIBRATION
    setData_Vibration(isVibration:boolean){
        this.jsonData[Constants.VIBRATION] = isVibration ? 1 : 0;
        this.save();
    }

    getData_Vibration(){
        if(this.jsonData.hasOwnProperty(Constants.VIBRATION)){
            return  this.jsonData[Constants.VIBRATION];
        }
        return 0;
    }
    //#endregion

    //#region HEART
    // setData_HeartCount(count: number) {
    //     this.jsonData[ConstantKeySaves.HEART_COUNT] = count;
    //     this.save();
    // }

    // getData_HeartCount() {
    //     if (this.jsonData.hasOwnProperty(ConstantKeySaves.HEART_COUNT)) {
    //         return this.jsonData[ConstantKeySaves.HEART_COUNT];
    //     }
    //     return 5;
    // }

    setData_HeartLastTime(lastTime: number) {
        this.jsonData[ConstantKeySaves.HEART_LASTTIME] = lastTime;
        this.save();
    }

    getData_HeartLastTime() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.HEART_LASTTIME)) {
            return this.jsonData[ConstantKeySaves.HEART_LASTTIME];
        }
        return 0;
    }

    setData_HeartUnlimited(countTime: number) {
        this.jsonData[ConstantKeySaves.HEART_UNLIMITED_COUNTTIME] = countTime;
        this.save();
    }

    getData_HeartUnlimited() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.HEART_UNLIMITED_COUNTTIME)) {
            return this.jsonData[ConstantKeySaves.HEART_UNLIMITED_COUNTTIME];
        }
        return 0;
    }

    setData_HeartUnlimited_LastTime(lastTime: number) {
        this.jsonData[ConstantKeySaves.HEART_UNLIMITED_LASTTIME] = lastTime;
        this.save();
    }

    getData_HeartUnlimited_LastTime() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.HEART_UNLIMITED_LASTTIME)) {
            return this.jsonData[ConstantKeySaves.HEART_UNLIMITED_LASTTIME];
        }
        return 0;
    }

    setData_HeartStartGame(isStartGame: boolean) {
        this.jsonData[ConstantKeySaves.HEART_START_GAME] = isStartGame ? 1 : 0;
        this.save();
    }

    getData_HeartStartGame() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.HEART_START_GAME)) {
            return this.jsonData[ConstantKeySaves.HEART_START_GAME];
        }
        return 0;
    }

    setData_HeartStartGame_LastTime(lastTime: number) {
        this.jsonData[ConstantKeySaves.HEART_START_GAME_LASTTIME] = lastTime;
        this.save();
    }

    getData_HeartStartGame_LastTime() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.HEART_START_GAME_LASTTIME)) {
            return this.jsonData[ConstantKeySaves.HEART_START_GAME_LASTTIME];
        }
        return 0;
    }
    //#endregion

    //#region REMOVE AD
    setData_RemoveAd(isRemoveAd:boolean){
        this.jsonData[ConstantKeySaves.REMOVE_AD] = isRemoveAd;
        this.save();
    }

    getData_RemoveAd(){
        if(this.jsonData.hasOwnProperty(ConstantKeySaves.REMOVE_AD)){
            return  this.jsonData[ConstantKeySaves.REMOVE_AD];
        }
        return false;
    }
    //#endregion

    //#region  WIN STREAK
    setData_WinStreak(winStreak: number) {
        this.jsonData[ConstantKeySaves.WIN_STREAK] = winStreak;
        this.save();
    }

    getData_WinStreak() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.WIN_STREAK)) {
            return this.jsonData[ConstantKeySaves.WIN_STREAK];
        }
        return 0;
    }

    setData_Capybara_WinStreak(winStreak: number) {
        this.jsonData[ConstantKeySaves.CAPYBARA_WIN_STREAK] = winStreak;
        this.save();
    }

    getData_Capybara_WinStreak() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.CAPYBARA_WIN_STREAK)) {
            return this.jsonData[ConstantKeySaves.CAPYBARA_WIN_STREAK];
        }
        return 0;
    }
    //#endregion

    //#region DAILY REWARD
    setData_DailyReward(dataReward:string) {
        this.jsonData[ConstantKeySaves.DAILYREWARD] = dataReward;
        this.save();
    }

    getData_DailyReward() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.DAILYREWARD)) {
            return this.jsonData[ConstantKeySaves.DAILYREWARD];
        }
        return "";
    }

    //#endregion

    //#region DAILY QUEST
    setData_DailyQuest_Progress(dataQuestProgress:string) {
        this.jsonData[ConstantKeySaves.DAILYQUEST_PROGRESS] = dataQuestProgress;
        this.save();
    }

    getData_DailyQuest_Progress() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.DAILYQUEST_PROGRESS)) {
            return this.jsonData[ConstantKeySaves.DAILYQUEST_PROGRESS];
        }
        return "";
    }

    setData_DailyQuest_LastTime(lastTime: number) {
        this.jsonData[ConstantKeySaves.DAILYQUEST_LASTTIME] = lastTime;
        this.save();
    }

    getData_DailyQuest_LastTime() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.DAILYQUEST_LASTTIME)) {
            return this.jsonData[ConstantKeySaves.DAILYQUEST_LASTTIME];
        }
        return 0;
    }

    setData_DailyQuest_Claimed(dataClaimed:string) {
        this.jsonData[ConstantKeySaves.DAILYQUEST_CLAIMED] = dataClaimed;
        this.save();
    }

    getData_DailyQuest_Claimed() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.DAILYQUEST_CLAIMED)) {
            return this.jsonData[ConstantKeySaves.DAILYQUEST_CLAIMED];
        }
        return "";
    }
    //#endregion


    //#region BATTLE PASS
    setData_BattlePass(dataBattlePass:string) {
        this.jsonData[ConstantKeySaves.BATTLE_PASS] = dataBattlePass;
        this.save();
    }

    getData_BattlePass() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.BATTLE_PASS)) {
            return this.jsonData[ConstantKeySaves.BATTLE_PASS];
        }
        return "";
    }
    //#endregion

    //#region  PROFILE
    setData_Profile(dataProfile:string) {
        this.jsonData[ConstantKeySaves.PROFILE] = dataProfile;
        this.save();
    }

    getData_Profile() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.PROFILE)) {
            return this.jsonData[ConstantKeySaves.PROFILE];
        }
        return "";
    }

    //#endregion


   

    //#region  HOTPOT QUEST
    setData_HotPotQuest(dataHotPotQuest:string) {
        this.jsonData[ConstantKeySaves.HOTPOT_QUEST] = dataHotPotQuest;
        this.save();
    }

    getData_HotPotQuest() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.HOTPOT_QUEST)) {
            return this.jsonData[ConstantKeySaves.HOTPOT_QUEST];
        }
        return "";
    }
    //#endregion

    //#region RISEUP
    setData_RiseUp(dataRiseUp:string) {
        this.jsonData[ConstantKeySaves.RISEUP] = dataRiseUp;
        this.save();
    }

    getData_RiseUp() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.RISEUP)) {
            return this.jsonData[ConstantKeySaves.RISEUP];
        }
        return "";
    }
    //#endregion

    //#region SHOP IAP
    setData_ShopIAP(dataShopIAP:string) {
        this.jsonData[ConstantKeySaves.SHOP_IAP] = dataShopIAP;
        this.save();
    }

    getData_ShopIAP() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.SHOP_IAP)) {
            return this.jsonData[ConstantKeySaves.SHOP_IAP];
        }
        return "";
    }
    //#endregion

    //#region DAILYQUEST
    setData_DailyQuest(dataDailyQuest:string) {
        this.jsonData[ConstantKeySaves.DAILYQUEST] = dataDailyQuest;
        this.save();
    }

    getData_DailyQuest() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.DAILYQUEST)) {
            return this.jsonData[ConstantKeySaves.DAILYQUEST];
        }
        return "";
    }
    //#endregion

    //#region LEADERBOARD
    setData_Leaderboard(dataLeaderboard:string) {
        this.jsonData[ConstantKeySaves.LEADERBOARD] = dataLeaderboard;
        this.save();
    }

    getData_Leaderboard() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.LEADERBOARD)) {
            return this.jsonData[ConstantKeySaves.LEADERBOARD];
        }
        return "";
    }
    //#endregion

    //#region TOURNAMENT
    setData_Tournament(dataTournament:string) {
        this.jsonData[ConstantKeySaves.TOURNAMENT] = dataTournament;
        this.save();
    }

    getData_Tournament() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.TOURNAMENT)) {
            return this.jsonData[ConstantKeySaves.TOURNAMENT];
        }
        return "";
    }
    //#endregion

    //#region PLAYER INFO
    setData_PlayerInfo(dataPlayerInfo:string) {
        this.jsonData[ConstantKeySaves.PLAYER_INFO] = dataPlayerInfo;
        this.save();
    }

    getData_PlayerInfo() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.PLAYER_INFO)) {
            return this.jsonData[ConstantKeySaves.PLAYER_INFO];
        }
        return "";
    }
    //#endregion

    //#region SUBSCRIBE BOT
    setData_SubscribeBot(isSubscribeBot:boolean) {
        this.jsonData[ConstantKeySaves.SUBSCRIBE_BOT] = isSubscribeBot? 1: 0;
        this.save();
    }

    getData_SubscribeBot() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.SUBSCRIBE_BOT)) {
            return this.jsonData[ConstantKeySaves.SUBSCRIBE_BOT];
        }
        return 0;
    }

    //#region LOG FIRST SKEWER
    setData_LoggedFirstSkewer() {
        this.jsonData[ConstantKeySaves.LOGGED_FIRST_SKEWER] = 1;
        this.save();
    }

    getData_LoggedFirstSkewer(): boolean {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.LOGGED_FIRST_SKEWER)) {
            return this.jsonData[ConstantKeySaves.LOGGED_FIRST_SKEWER] == 1;
        }
        return false;
    }
    //#endregion

    //#region TUTORIAL OBJ
    setData_TutorialObj(dataTutorialObj:string) {
        this.jsonData[ConstantKeySaves.TUTORIAL_OBJ] = dataTutorialObj;
        this.save();
    }

    getData_TutorialObj() {
        if (this.jsonData.hasOwnProperty(ConstantKeySaves.TUTORIAL_OBJ)) {
            return this.jsonData[ConstantKeySaves.TUTORIAL_OBJ];
        }
        return "";
    }
    //#endregion
}
