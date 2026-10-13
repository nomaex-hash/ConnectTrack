// @ts-nocheck

import { _decorator, Component, Node, game, random, renderer, director } from 'cc';
import { clientEvent } from '../framework/clientEvent';
import { configuration } from '../framework/configuration';
import { AVATAR_TYPE, Constants, ENV_TYPE, GAME_MODE, SCENE_TYPE } from '../framework/constants';
import { lodash } from '../framework/lodash';
import { MusicManager } from '../framework/musicManager';
import { resourceUtil } from '../framework/resourceUtil';
import { localConfig } from '../localConfig';
import { PGSPlayInstantManager } from './PGSPlayInstantManager';
import { LeaderboardDataInfo } from './LeaderboardDataInfo';
import { LogEventManager } from './LogEventManager';
import { ItemRankInfo } from './ItemRankInfo';
import { WithFriendDataInfo } from './WithFriendDataInfo';
import { FriendAvatarInfo } from './FriendAvatarInfo';
import { ShopPackageDataConfig } from '../datainfo/ShopPackageDataConfig';
import { ShopIAPManager } from '../shop/ShopIAPManager';
import { ProfileManager } from '../profile/ProfileManager';
import { GoogleAnalyticsService } from './GoogleAnalyticsService';
const { ccclass, property } = _decorator;

@ccclass('FBInstantManager')
export class FBInstantManager extends Component {
    public static instance: FBInstantManager;
    public preloadedRewardedVideo = null;
    public preloadedInterstitial = null;

    TIME_NEXT_INTERSTITIAL = 45;
    isShowInterstitialAd = true;
    isCreateShortcutAvailable = false;

    isInitializeAsync = false;
    isFinishedLoadScene = false;

    entryPointData:string;

    // contextOptions: FBInstant.ContextOptions = {
    //     filters: ["NEW_CONTEXT_ONLY"],
    //     maxSize: 20,
    //     minSize: 1
    // };
    // currContext:

    isShowAds:boolean = false;
    onLoad(){
        director.addPersistRootNode(this.node);
        FBInstantManager.instance = this; 
        // localConfig.instance.envType = ENV_TYPE.TEST_AD;
        if(localConfig.instance.envType == ENV_TYPE.FB){
            // this.InitFBInstant();
            if(window.mobileCheck() == 1){
                localConfig.instance.isMobile = true;
            }else{
                localConfig.instance.isMobile = false;
            }
        }else{

        }

        //performance.now();
        //console.log(renderer.drawCalls);
    }

    testShareImage(){
       
    }

    start () {
        // [3]
        // FBInstant.onPause(function () {
        //     ////////console.log("FBInstant.onPause");
        //   });

        //   FBInstant.shareAsync()
        //console.log("FBInstantManagerFBInstantManagerFBInstantManager");
        //console.log("TIME:"+new Date().getTime());
    }

    update (deltaTime: number) {
        if (localConfig.instance.envType == ENV_TYPE.FB) {
            if (!this.isInitializeAsync) {
                ////console.log("isInitializeAsync:" + this.isInitializeAsync);
                // [4]
                if (window["phase"] === "fb_init") {
                    this.isInitializeAsync = true;
                    ////console.log("isInitializeAsync:" + this.isInitializeAsync);
                    this.setStartGame();
                }
            }
        }
    }


    onDestroy(){
        if(this.isInitializeAsync){
            FBInstant.quit();
        }
    }

    InitFBInstant_Finished(){
        //console.log("Time:"+new Date().getTime());
        ////console.log("InitFBInstantInitFBInstantInitFBInstantInitFBInstantInitFBInstant");

        // Many properties will be null until the initialization completes.
        // This is a good place to fetch them:
        var locale = FBInstant.getLocale(); // 'en_US'
        var platform = FBInstant.getPlatform(); // 'IOS'
        //console.log(platform);
        var sdkVersion = FBInstant.getSDKVersion(); // '3.0'
        var playerID = FBInstant.player.getID();

        localConfig.instance.playerID = playerID;
        
        if(localConfig.instance.FAN_enable){
            this.Load_Ad_SheduleOne();
            
        }
        FBInstant.getSupportedAPIs();
        // this.Create_Shortcut();


        let entryPointData = FBInstant.getEntryPointData();
        console.log(entryPointData);
        if(entryPointData != null){
            try {
                let entryPointDataPayLoad = JSON.parse(entryPointData);
                let campID:string = entryPointDataPayLoad.fb_instant_game_campaign_id;
                if(campID){
                    localConfig.instance.campID_session = campID;
                }

                let adsetID:string = entryPointDataPayLoad.fb_instant_game_adset_id;
                if(adsetID){
                    localConfig.instance.adsetID_session = adsetID;
                }

                let ads:string = entryPointDataPayLoad.fb_instant_game_ad_id;
                if(ads){
                    localConfig.instance.adsID_session = ads;
                }

                
            } catch (error) {
                if(lodash.isObject(entryPointData)){
                    // console.log(entryPointData.ad_id);
                    let campID:string = entryPointData.fb_instant_game_campaign_id;
                    if(campID){
                        localConfig.instance.campID_session = campID;
                    }

                    let adsetID:string = entryPointData.fb_instant_game_adset_id;
                    if(adsetID){
                        localConfig.instance.adsetID_session = adsetID;
                    }

                    let ads:string = entryPointData.fb_instant_game_ad_id;
                    if(ads){
                        localConfig.instance.adsID_session = ads;
                    }
                }
            }

            if(typeof entryPointData.withfriendData !== 'undefined'){
                if(entryPointData.withfriendData.length > 0){
                    try {
                        localConfig.instance.currWithFriendDataInfo = JSON.parse(entryPointData.withfriendData);
                        console.log(localConfig.instance.currWithFriendDataInfo);
                        // if (!localConfig.instance.currWithFriendDataInfo.levelIndex) {
                        //     localConfig.instance.currWithFriendDataInfo.levelIndex = lodash.random(10,20);
                        // }
                        // if (localConfig.instance.currWithFriendDataInfo.receiverID == FBInstantManager.instance.getID()) {
                        //     localConfig.instance.currWithFriendDataInfo.receiverID = FBInstantManager.instance.getID();
                        //     localConfig.instance.currWithFriendDataInfo.receiverAvatarURL = ProfileManager.instance.getAvatarURL();
                        //     localConfig.instance.currWithFriendDataInfo.receiverName = FBInstantManager.instance.getName();
                        //     if(localConfig.instance.currWithFriendDataInfo.senderAvatarURL.length == 0){
                        //         localConfig.instance.currWithFriendDataInfo.senderAvatarURL = ProfileManager.instance.getRandomAvatarURL();
                        //     }

                        // }else if(localConfig.instance.currWithFriendDataInfo.senderID == FBInstantManager.instance.getID()){
                        //     localConfig.instance.currWithFriendDataInfo.senderID = FBInstantManager.instance.getID();
                        //     localConfig.instance.currWithFriendDataInfo.senderAvatarURL = FBInstantManager.instance.getPhotoUrl();
                        //     localConfig.instance.currWithFriendDataInfo.senderName = FBInstantManager.instance.getName();
                        //     if(localConfig.instance.currWithFriendDataInfo.receiverAvatarURL.length == 0){
                        //         localConfig.instance.currWithFriendDataInfo.receiverAvatarURL = ProfileManager.instance.getRandomAvatarURL();
                        //     }
                        // }
                    } catch (error) {
                        localConfig.instance.currWithFriendDataInfo = null;
                    }
                    
                }
            }
            
        }

        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            // PlayFabManager.instance.LoginWithFBInstant(signature);
            // PGSPlayInstantManager.instance.LoginFBInstant();
            
        });


        // this.SubscribeBot();

        this.getTournament();

        this.GetListConnectPlayers();

        this.GetDataPlayer();

        this.GetASID();
        
        this.getIAP_AllPack();
    }

    Create_Shortcut(cb:FBInstantCommon_Callback222){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        let self = this;
        FBInstant.canCreateShortcutAsync().then( (canCreateShortcut) => {
            self.isCreateShortcutAvailable = canCreateShortcut;
            if(canCreateShortcut){
                FBInstant.createShortcutAsync()
                    .then(() => {
                        // Shortcut created
                        cb(null,Constants.FB_CALLBACK_SUCCESS);
                    })
                    .catch((e)=>{
                        cb(e,Constants.FB_CALLBACK_FAIL);
                    });
            }
        });
    }

    CheckCanCreateShortcut(cb:FBInstantCommon_Callback222){
        if(localConfig.instance.envType != ENV_TYPE.FB) return true;
        let self = this;
        FBInstant.canCreateShortcutAsync().then( (canCreateShortcut) =>{
            self.isCreateShortcutAvailable = canCreateShortcut;
            cb(null,Constants.FB_CALLBACK_SUCCESS);
        });
    }

    CreateShortcut(cb:FBInstantCommon_Callback222){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        FBInstant.createShortcutAsync()
        .then(() => {
            // Shortcut created
            cb(null,Constants.FB_CALLBACK_SUCCESS);
        })
        .catch((e)=>{
            console.error(e);
            cb(e,Constants.FB_CALLBACK_FAIL);
        });
    }

    SubscribeBot(){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        FBInstant.player.canSubscribeBotAsync().then((can_subscribe)=>{
            FBInstant.player.subscribeBotAsync().then(
                // Player is subscribed to the bot
              ).catch(function (e) {
                // Handle subscription failure
              });
        });
    }

    isFinishedLoad_InterstitialAd:boolean = false;
    Preload_InterstitialAdAsync(){
        this.preloadedInterstitial = null;
        let self = this;
        self.isFinishedLoad_InterstitialAd = false;
        if(localConfig.instance.isRemoveAd) return;
        let startTimeLoadInterstitial = new Date().getTime();
        FBInstant.getInterstitialAdAsync(
            Constants.FB_INTERSTITIAL_PLACEMENT_ID,
        ).then(function (interstitial) {
            self.preloadedInterstitial = interstitial;
            return self.preloadedInterstitial.loadAsync();
        }).then(function () {
            // Ad noT loaded
            self.isFinishedLoad_InterstitialAd = true;
            let endTimeLoadInterstitial = new Date().getTime();
            
        }).catch(function(){
            self.preloadedInterstitial = null;
            self.isFinishedLoad_InterstitialAd = false;
            let endTimeLoadInterstitial = new Date().getTime();
            
        });
    }

    fb_InterstitialAd_CallBack:FBIntanstAd_Callback = null;
    TIMEWAIT_INTERSTITIAL_AD:number = 2;

    Show_InterstitialAdAsync(location: string,button_name: string,cb?: FBIntanstAd_Callback) {
        let self = this;
        self.fb_InterstitialAd_CallBack = cb;
        
        clientEvent.dispatchEvent(Constants.SHOW_LOADING_AD_POPUP);
        if(localConfig.instance.isRemoveAd){
            self.fb_InterstitialAd_CallBack(null, Constants.FB_INTERSTITIAL_CALLBACK_SUCCESS);
            clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
            self.SetNextTime_ShowInterstitialAd();
        }
        // this.unschedule(this.timeWait_InterstitialAd_Callback);
        if(!localConfig.instance.FAN_enable){
            self.fb_InterstitialAd_CallBack(new Error("ERROR"), Constants.FB_INTERSTITIAL_CALLBACK_FAIL);
            clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
        }
        else if(localConfig.instance.envType == ENV_TYPE.TEST_AD){
            if (this.isShowInterstitialAd){
                if(self.fb_InterstitialAd_CallBack){
                    console.log("Show_InterstitialAdAsync TEST AD");
                    self.fb_InterstitialAd_CallBack(null, Constants.FB_INTERSTITIAL_CALLBACK_SUCCESS);
                    clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
                    self.SetNextTime_ShowInterstitialAd();
                }
            }else{
                if(self.fb_InterstitialAd_CallBack){
                    clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
                    self.fb_InterstitialAd_CallBack(new Error("next TIME!"), Constants.FB_INTERSTITIAL_CALLBACK_FAIL);
                }
            }
        } else {
            if (this.isInitializeAsync) {
                if (this.isShowInterstitialAd) {
                    if (this.preloadedInterstitial && this.isFinishedLoad_InterstitialAd) {
                        MusicManager.instance.pauseMusic();
                        this.preloadedInterstitial
                            .showAsync()
                            .then(function () {
                                LogEventManager.instance.logEvent_InterAd();
                                if(localConfig.instance.isPaidUser){
                                    LogEventManager.instance.logEvent_InterAd_Paid();
                                }else{
                                    LogEventManager.instance.logEvent_InterAd_Organic();
                                }
                                LogEventManager.instance.logCAMPID_INTER(localConfig.instance.log_CAMP_ID);
                                LogEventManager.instance.logADSETID_INTER(localConfig.instance.log_ADSET_ID);
                                LogEventManager.instance.logADID_INTER(localConfig.instance.log_ADS_ID);
                                LogEventManager.instance.logTOURID_INTER(localConfig.instance.tourID_session);
                                
                                clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
                                //////console.log("Interstitial ad finished successfully");
                                MusicManager.instance.resumeMusic();
                                self.SetNextTime_ShowInterstitialAd();
                                cb(null, Constants.FB_INTERSTITIAL_CALLBACK_SUCCESS);

                                self.Preload_InterstitialAdAsync();
                            })
                            .catch(function (e: any) {
                                LogEventManager.instance.logAd_Interstitial_Fail(location, button_name);
                                clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
                                //////console.log("FB_INTERSTITIAL_CALLBACK_FAILFB_INTERSTITIAL_CALLBACK_FAILFB_INTERSTITIAL_CALLBACK_FAIL");
                                console.error(e.message);
                                MusicManager.instance.resumeMusic();
                                cb(e.message, Constants.FB_INTERSTITIAL_CALLBACK_FAIL);
                                self.Preload_InterstitialAdAsync();
                            });
                    } else {
                        LogEventManager.instance.logAd_Interstitial_Fail(location, button_name);
                        clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
                        //////console.log("Show_InterstitialAdAsync preload fail!preload fail!preload fail!");
                        cb(new Error("preload fail!"), Constants.FB_INTERSTITIAL_CALLBACK_FAIL);
                        this.Preload_InterstitialAdAsync();
                    }

                    
                } else {
                    //////console.log("Show_InterstitialAdAsync next TIME!next TIME!next TIME!");
                    clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
                    self.fb_InterstitialAd_CallBack(new Error("next TIME!"), Constants.FB_INTERSTITIAL_CALLBACK_FAIL);
                }
            } else {
                //////console.log("Show_InterstitialAdAsync INIT FAIL!INIT FAIL!INIT FAIL!INIT FAIL!INIT FAIL!");
                clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
                self.fb_InterstitialAd_CallBack(new Error("INIT FAIL!"), Constants.FB_INTERSTITIAL_CALLBACK_FAIL);
            }
        }
    }


    timeWait_InterstitialAd_Callback(){
        // this.fb_InterstitialAd_CallBack(new Error("load FAIL"), Constants.FB_INTERSTITIAL_CALLBACK_FAIL);
        // clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
        // MusicManager.instance.resumeMusic();
        // this.fb_InterstitialAd_CallBack = null;
    }


    //#region reward video
    preloadAttemptCount_RewardVideo = 0;
    maxPreloadAttempts_RewardVideo = 3;
    isFinishedLoad_RewardedVideo: boolean = false;
    isLoading_RewardedVideo: boolean = false;

    private Preload_RewardAdAsync() {
        if (this.isLoading_RewardedVideo) {
            this.schedule(this.timeWait_Loading_RewardVideoAd, 1, 0, this.TIMEWAIT_LOADING_REWARDVIDEO_AD);
            return;
        }
        // if(localConfig.instance.isRemoveAd) return;
        this.isLoading_RewardedVideo = true;

        this.preloadedRewardedVideo = null;
        let self = this;
        self.isFinishedLoad_RewardedVideo = false;
        if (this.preloadAttemptCount_RewardVideo >= this.maxPreloadAttempts_RewardVideo) {
            console.error('Đã đạt đến số lần preload tối đa. Không cố gắng preload nữa.');
            return;
        }

        let startTimeLoadRewardVideo = new Date().getTime();
        FBInstant.getRewardedVideoAsync(
            Constants.FB_REWARDED_PLACEMENT_ID,
        ).then(function (rewardedVideo) {
            self.preloadedRewardedVideo = rewardedVideo;
            return self.preloadedRewardedVideo.loadAsync();
        }).then(function () {
            //Ad loaded
            self.unschedule(self.timeWait_Loading_RewardVideoAd);
            self.isLoading_RewardedVideo = false;
            self.isFinishedLoad_RewardedVideo = true;
            self.preloadAttemptCount_RewardVideo = 0;
            let endTimeLoadRewardVideo = new Date().getTime();
            
        }).catch(function (err) {
            self.unschedule(self.timeWait_Loading_RewardVideoAd);
            self.isLoading_RewardedVideo = false;
            self.preloadAttemptCount_RewardVideo++;
            self.preloadedRewardedVideo = null;
            self.isFinishedLoad_RewardedVideo = false;
            LogEventManager.instance.logAd_Reward_PreloadFail(err.message); 
            let endTimeLoadRewardVideo = new Date().getTime();
            
            self.Preload_RewardAdAsync();
        });
    }

    SetNextTime_ShowInterstitialAd(){
        // console.log(this.TIME_NEXT_INTERSTITIAL);
        this.isShowInterstitialAd = false;
        this.scheduleOnce(function() {
            // Here `this` is referring to the component
            this.isShowInterstitialAd = true;
        }, this.TIME_NEXT_INTERSTITIAL);
    }

    fb_RewardVideo_CallBack:FBIntanstAd_Callback = null;
    TIMEWAIT_REWARDVIDEO_AD:number = 6;
    TIMEWAIT_LOADING_REWARDVIDEO_AD: number = 6;

    // Show_RewardedVideoAsync(location: string, button_name: string, cb?: FBIntanstAd_Callback){
    //     LogEventManager.instance.logAd_Reward_Click(location, button_name);
    //     let self = this;
    //     self.fb_RewardVideo_CallBack = cb;
    //     clientEvent.dispatchEvent(Constants.SHOW_LOADING_AD_POPUP);
    //     this.unschedule(this.timeWait_RewardVideoAd_Callback);
    //     if(!localConfig.instance.FAN_enable){
    //         clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
    //         self.fb_RewardVideo_CallBack(new Error("load FAIL"), Constants.FB_REWARD_CALLBACK_FAIL);
    //         clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "No Ads Available!");
    //     }
    //     else if(localConfig.instance.envType == ENV_TYPE.TEST_AD ){
    //         // this.scheduleOnce(this.timeWait_RewardVideoAd_Callback,this.TIMEWAIT_REWARDVIDEO_AD);
    //         // clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, LanguageManager.instance.getText_byKey(ITEM_LANGUAGE_KEY_TYPE.no_ad));
    //         // this.schedule(this.timeWait_RewardVideoAd_Callback,1,0,this.TIMEWAIT_REWARDVIDEO_AD);
    //         clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
    //         cb(null, Constants.FB_REWARD_CALLBACK_SUCCESS);
    //     } else {
    //         if (this.isInitializeAsync) {
    //             MusicManager.instance.pauseMusic();
    //             this.schedule(this.timeWait_RewardVideoAd_Callback,1,0,this.TIMEWAIT_REWARDVIDEO_AD);
    //             FBInstant.getRewardedVideoAsync(
    //                 Constants.FB_REWARDED_PLACEMENT_ID,
    //             ).then(function (rewardedVideo) {
    //                 if (self.fb_RewardVideo_CallBack) {
    //                     self.preloadedRewardedVideo = rewardedVideo;
    //                     return self.preloadedRewardedVideo.loadAsync();
    //                 }
    //             }).then(function () {
    //                 self.preloadedRewardedVideo.showAsync()
    //                     .then(function () {
    //                         LogEventManager.instance.logAd_Reward_Scuccess(location, button_name);

    //                         LogEventManager.instance.logEvent_RewardAd();
    //                         LogEventManager.instance.logEvent_RewardAd_Completed();

    //                         if (localConfig.instance.isPaidUser) {
    //                             LogEventManager.instance.logEvent_RewardAd_Paid();
    //                         } else {
    //                             LogEventManager.instance.logEvent_RewardAd_Organic();
    //                         }

    //                         LogEventManager.instance.logCAMPID_REWARDED(localConfig.instance.log_CAMP_ID);
    //                         LogEventManager.instance.logADSETID_REWARDED(localConfig.instance.log_ADSET_ID);
    //                         LogEventManager.instance.logADID_REWARDED(localConfig.instance.log_ADS_ID);
    //                         LogEventManager.instance.logTOURID_REWARDED(localConfig.instance.tourID_session);

    //                         if (self.fb_RewardVideo_CallBack) {
    //                             self.unschedule(self.timeWait_RewardVideoAd_Callback);
    //                             // Ad watched
    //                             self.SetNextTime_ShowInterstitialAd();
    //                             clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
    //                             self.fb_RewardVideo_CallBack(null, Constants.FB_REWARD_CALLBACK_SUCCESS);
    //                             MusicManager.instance.resumeMusic();
    //                             LogEventManager.instance.logEvent_RewardAd_Completed();
    //                             self.fb_RewardVideo_CallBack = null;
    //                         }
    //                     }).catch(function (err) {
    //                         self.unschedule(self.timeWait_RewardVideoAd_Callback);
    //                         if (err.code == "USER_INPUT") {
    //                             LogEventManager.instance.logAd_Reward_Skip(location, button_name);
    //                             LogEventManager.instance.logEvent_RewardAd();

    //                             if (localConfig.instance.isPaidUser) {
    //                                 LogEventManager.instance.logEvent_RewardAd_Paid();
    //                             } else {
    //                                 LogEventManager.instance.logEvent_RewardAd_Organic();
    //                             }

    //                             LogEventManager.instance.logCAMPID_REWARDED(localConfig.instance.log_CAMP_ID);
    //                             LogEventManager.instance.logADSETID_REWARDED(localConfig.instance.log_ADSET_ID);
    //                             LogEventManager.instance.logADID_REWARDED(localConfig.instance.log_ADS_ID);
    //                             LogEventManager.instance.logTOURID_REWARDED(localConfig.instance.tourID_session);
    //                         } else {
    //                             LogEventManager.instance.logAd_Reward_Show_Fail(location, button_name,err.message);
    //                             clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "No Ads Available!");
    //                         }
    //                         if (self.fb_RewardVideo_CallBack) {
    //                             MusicManager.instance.resumeMusic();
    //                             clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
    //                             self.fb_RewardVideo_CallBack(new Error("load FAIL"), Constants.FB_REWARD_CALLBACK_FAIL);
    //                             self.fb_RewardVideo_CallBack = null;
    //                         }
    //                     });
    //             }).catch(function (err) {
    //                 LogEventManager.instance.logAd_Reward_Fail(location, button_name,err.message);
    //                 if (self.fb_RewardVideo_CallBack) {
    //                     self.unschedule(self.timeWait_RewardVideoAd_Callback);

    //                     MusicManager.instance.resumeMusic();
    //                     clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
    //                     self.fb_RewardVideo_CallBack(new Error("load FAIL"), Constants.FB_REWARD_CALLBACK_FAIL);
    //                     clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "No Ads Available!");
    //                     self.fb_RewardVideo_CallBack = null;
    //                 }
    //             });
    //         } else {
    //             LogEventManager.instance.logAd_Reward_InitFail(location, button_name);
    //             //////console.log("Show_RewardedVideoAsync INIT FAIL!INIT FAIL!INIT FAIL!INIT FAIL!INIT FAIL!");
    //             clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
    //             cb(new Error("INIT FAIL!"), Constants.FB_REWARD_CALLBACK_FAIL);
    //             clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "No Ads Available!");
    //         }
    //     }
    // }

    Show_RewardedVideoAsync(location: string, button_name: string, cb?: FBIntanstAd_Callback){
        LogEventManager.instance.logAd_Reward_Click(location, button_name);
        let self = this;
        self.fb_RewardVideo_CallBack = cb;
        clientEvent.dispatchEvent(Constants.SHOW_LOADING_AD_POPUP);
        // this.unschedule(this.timeWait_RewardVideoAd_Callback);
        if(!localConfig.instance.FAN_enable){
            clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
            self.fb_RewardVideo_CallBack(new Error("load FAIL"), Constants.FB_REWARD_CALLBACK_FAIL);
            clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "No Ads Available!");
        }
        else if(localConfig.instance.envType == ENV_TYPE.TEST_AD ){
            // this.scheduleOnce(this.timeWait_RewardVideoAd_Callback,this.TIMEWAIT_REWARDVIDEO_AD);
            // clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, LanguageManager.instance.getText_byKey(ITEM_LANGUAGE_KEY_TYPE.no_ad));
            // this.schedule(this.timeWait_RewardVideoAd_Callback,1,0,this.TIMEWAIT_REWARDVIDEO_AD);
            clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
            
            LogEventManager.instance.logAd_Reward_Scuccess(location, button_name);
            
            cb(null, Constants.FB_REWARD_CALLBACK_SUCCESS);
        } else {
            if (this.isInitializeAsync) {
                MusicManager.instance.pauseMusic();
                // this.schedule(this.timeWait_RewardVideoAd_Callback,1,0,this.TIMEWAIT_REWARDVIDEO_AD);
                if (this.preloadedRewardedVideo && this.isFinishedLoad_RewardedVideo) {
                    self.preloadedRewardedVideo.showAsync()
                        .then(function () {
                            
                            LogEventManager.instance.logAd_Reward_Scuccess(location, button_name);
                            
                            LogEventManager.instance.logEvent_RewardAd();
                            // LogEventManager.instance.logEvent_RewardAd_Completed();

                            if (localConfig.instance.isPaidUser) {
                                LogEventManager.instance.logEvent_RewardAd_Paid();
                            } else {
                                LogEventManager.instance.logEvent_RewardAd_Organic();
                            }

                            LogEventManager.instance.logCAMPID_REWARDED(localConfig.instance.log_CAMP_ID);
                            LogEventManager.instance.logADSETID_REWARDED(localConfig.instance.log_ADSET_ID);
                            LogEventManager.instance.logADID_REWARDED(localConfig.instance.log_ADS_ID);
                            LogEventManager.instance.logTOURID_REWARDED(localConfig.instance.tourID_session);

                            if (self.fb_RewardVideo_CallBack) {
                                // self.unschedule(self.timeWait_RewardVideoAd_Callback);
                                // Ad watched
                                self.SetNextTime_ShowInterstitialAd();
                                clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
                                self.fb_RewardVideo_CallBack(null, Constants.FB_REWARD_CALLBACK_SUCCESS);
                                MusicManager.instance.resumeMusic();
                                LogEventManager.instance.logEvent_RewardAd_Completed();
                                self.fb_RewardVideo_CallBack = null;
                            }

                            self.preloadAttemptCount_RewardVideo = 0;
                            self.Preload_RewardAdAsync();
                        }).catch(function (err) {
                            // self.unschedule(self.timeWait_RewardVideoAd_Callback);
                            if (err.code == "USER_INPUT") {
                                LogEventManager.instance.logAd_Reward_Skip(location, button_name);
                                LogEventManager.instance.logEvent_RewardAd();

                                if (localConfig.instance.isPaidUser) {
                                    LogEventManager.instance.logEvent_RewardAd_Paid();
                                } else {
                                    LogEventManager.instance.logEvent_RewardAd_Organic();
                                }

                                LogEventManager.instance.logCAMPID_REWARDED(localConfig.instance.log_CAMP_ID);
                                LogEventManager.instance.logADSETID_REWARDED(localConfig.instance.log_ADSET_ID);
                                LogEventManager.instance.logADID_REWARDED(localConfig.instance.log_ADS_ID);
                                LogEventManager.instance.logTOURID_REWARDED(localConfig.instance.tourID_session);
                            } else {
                                LogEventManager.instance.logAd_Reward_Show_Fail(location, button_name,err.message);
                                clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "No Ads Available!");
                            }
                            if (self.fb_RewardVideo_CallBack) {
                                MusicManager.instance.resumeMusic();
                                clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
                                self.fb_RewardVideo_CallBack(new Error("load FAIL"), Constants.FB_REWARD_CALLBACK_FAIL);
                                self.fb_RewardVideo_CallBack = null;
                            }
                            self.preloadAttemptCount_RewardVideo = 0;
                            self.Preload_RewardAdAsync();
                        });
                }else{
                    LogEventManager.instance.logAd_Reward_Fail(location, button_name,"preload RewardedVideo FAIL!");
                    if (self.fb_RewardVideo_CallBack) {
                        // self.unschedule(self.timeWait_RewardVideoAd_Callback);

                        MusicManager.instance.resumeMusic();
                        clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
                        self.fb_RewardVideo_CallBack(new Error("load FAIL"), Constants.FB_REWARD_CALLBACK_FAIL);
                        clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "No Ads Available!");
                        self.fb_RewardVideo_CallBack = null;
                    }
                    self.preloadAttemptCount_RewardVideo = 0;
                    self.Preload_RewardAdAsync();
                }
            } else {
                LogEventManager.instance.logAd_Reward_InitFail(location, button_name);
                //////console.log("Show_RewardedVideoAsync INIT FAIL!INIT FAIL!INIT FAIL!INIT FAIL!INIT FAIL!");
                clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
                cb(new Error("INIT FAIL!"), Constants.FB_REWARD_CALLBACK_FAIL);
                clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "No Ads Available!");
            }
        }
    }

    timeWait_RewardVideoAd_Callback(){
        this.fb_RewardVideo_CallBack(new Error("load FAIL"), Constants.FB_REWARD_CALLBACK_FAIL);
        clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "No Ads Available!");
        clientEvent.dispatchEvent(Constants.HIDE_LOADING_AD_POPUP);
        MusicManager.instance.resumeMusic();
        this.fb_RewardVideo_CallBack = null;
    }

    timeWait_Loading_RewardVideoAd() {
        this.isLoading_RewardedVideo = false;
    }
    
    Load_BannerAdAsync(){
        ////console.log("Load_BannerAdAsyncLoad_BannerAdAsync");
        // if(localConfig.instance.isRemoveAd) return;
        // if(!localConfig.instance.FAN_enable) return;
        // let strartTimeLoadBanner = new Date().getTime();
        // LogEventManager.instance.logAd_Banner_Show("");
        // FBInstant.loadBannerAdAsync(
        //     Constants.FB_BANNER_PLACEMENT_ID,
        // ).then(function(banner){
        //     ////console.log("Load_Banner SUCCESS");
        //     let endTimeLoadBanner = new Date().getTime();

        //     LogEventManager.instance.logAd_Banner_Success("");    
        //     LogEventManager.instance.logEvent_BannerAd();

        //     if (localConfig.instance.isPaidUser){
        //         LogEventManager.instance.logEvent_BannerAd_Paid();
        //     }else{
        //         LogEventManager.instance.logEvent_BannerAd_Organic();
        //     }

        //     LogEventManager.instance.logCAMPID_BANNER(localConfig.instance.log_CAMP_ID);
        //     LogEventManager.instance.logADSETID_BANNER(localConfig.instance.log_ADSET_ID);
        //     LogEventManager.instance.logADID_BANNER(localConfig.instance.log_ADS_ID);

        //     LogEventManager.instance.logTOURID_BANNER(localConfig.instance.tourID_session);

        // }).catch(function(err){
        //     ////console.log("Load_Banner FAIL");
        //     LogEventManager.instance.logAd_Banner_Fail("");
        //     let endTimeLoadBanner = new Date().getTime();
        // });
    }

    TIME_NEXT_RELOAD_BANNER:number = 30;
    isReloadBanner:boolean = true;
    isShowingBanner:boolean = false;

    Load_BannerAdAsync_SheduleOne(){
        // console.log("Load_BannerAdAsync_SheduleOneLoad_BannerAdAsync_SheduleOneLoad_BannerAdAsync_SheduleOne");
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        if(localConfig.instance.isRemoveAd) return;
        if(localConfig.instance.playerID){
            var platform = FBInstant.getPlatform();
            // if(platform === "IOS"){

            // }else{
                
            // } 
            this.isShowingBanner = true;
            if(this.isReloadBanner){
                this.scheduleOnce(function() {
                    // Here `this` is referring to the component
                    this.Load_BannerAdAsync();
                }, 0.2);
                this.SetNextTime_ReloadBanner();
            }else{
                console.log("NOT RELOAD!");
            }       
        }
    }

    HideBanner(){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        this.isShowingBanner = false;
        this.isReloadBanner = true;
        FBInstant.hideBannerAdAsync();
    }

    SetNextTime_ReloadBanner(){
        this.isReloadBanner = false;
        //Dang ơ Home thi ko goi load lai banner
        if(localConfig.instance.currSceneType === SCENE_TYPE.HOME){
            return;
        }
        this.scheduleOnce(function() {
            // Here `this` is referring to the component

            this.isReloadBanner = true;
            if(this.isShowingBanner){
                this.Load_BannerAdAsync_SheduleOne();
            }
        }, this.TIME_NEXT_RELOAD_BANNER);
    }

    Load_Ad_SheduleOne(){
        let self = this;
        // this.SetNextTime_ShowInterstitialAd();
        this.scheduleOnce(() => {
            // Here `this` is referring to the component
            self.Preload_InterstitialAdAsync();
            self.Preload_RewardAdAsync();
            // self.Load_BannerAdAsync_SheduleOne();
        }, 3);
    }
    

    shareImage(entryPointData:string ,base64Image:string,cb?: FBShare_Callback){
        FBInstant.shareAsync({
            intent: 'REQUEST',
            image: base64Image,
            text: "Play "+Constants.GAME_NAME_TITLE+" with me!",
            data: {entryPointData},
          }).then(function() {
            // continue with the game.
            cb();
          });
    }


    setStartGame(){
        GoogleAnalyticsService.Instance.setInitGoogleAnalytics();
        let self = this;
        ////console.log("setStartGame");
        ////console.log(this.isInitializeAsync);
        //console.log("Time setStartGame:"+new Date().getTime());
        FBInstant.startGameAsync().then(function() {
            //console.log("Time setStartGame Finished:"+new Date().getTime());
            //console.log("FBInstant.startGameAsyncFBInstant.startGameAsyncFBInstant.startGameAsync");
            clientEvent.dispatchEvent(Constants.FBINSTANT_INIT_SUCCESS);
            self.InitFBInstant_Finished();
          }).catch((e)=>{
            clientEvent.dispatchEvent(Constants.FBINSTANT_INIT_SUCCESS);
            self.InitFBInstant_Finished();
          });
    }

    getPhotoUrl(){
        ////console.log("getPhotoUrlgetPhotoUrlgetPhotoUrlgetPhotoUrl");
        ////console.log(FBInstant.player.getPhoto());
        if(localConfig.instance.envType == ENV_TYPE.FB){
            return FBInstant.player.getPhoto();
        }else{
            return "";
        }
        
    }

    getName(){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            return FBInstant.player.getName();
        }else{
            return "Water";
        }
    }

    getID(){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            return FBInstant.player.getID();
        }else{
            return "1";
        }
    }

    tournamentID:string = "";
    contextID:string = "";

    getTournament(){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            FBInstant.getTournamentAsync().then((tournament) => {
                FBInstantManager.instance.tournamentID = tournament.getID();
                FBInstantManager.instance.contextID = tournament.getContextID();
                localConfig.instance.tourID_session = tournament.getID();

                let tournamentPayLoad = tournament.getPayload();
                console.log(tournamentPayLoad);
                if(tournamentPayLoad && tournamentPayLoad.length > 0){
                    let payloadData = JSON.parse(tournament.getPayload());
                }
                
                localConfig.instance.isGetPayloadDataSuccess = true;
                clientEvent.dispatchEvent(Constants.GET_DATA_PAYLOAD_SUCCESS);
             }).catch(function (e){
                // console.log("tournament Not Found");
                localConfig.instance.isGetPayloadDataSuccess = true;
                clientEvent.dispatchEvent(Constants.GET_DATA_PAYLOAD_SUCCESS);
             });
        }else{
            localConfig.instance.isGetPayloadDataSuccess = true;
            clientEvent.dispatchEvent(Constants.GET_DATA_PAYLOAD_SUCCESS);
        }
    }

    getTournament_AfterJoinTournament(cb?: FBInstantCommon_Callback222){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            FBInstant.getTournamentAsync().then((tournament) => {
                // console.log("getTournament_AfterJoinTournament",tournament);
                let tournamentPayLoad = tournament.getPayload();
                // console.log("tournamentPayLoad",tournamentPayLoad);
                if(tournamentPayLoad && tournamentPayLoad.length > 0){
                    FBInstantManager.instance.tournamentID = tournament.getID();
                    let payloadData = JSON.parse(tournament.getPayload());

                    
                    
                    cb(null,Constants.FB_CALLBACK_SUCCESS);
                }else{
                    cb(new Error("FAIL"),Constants.FB_CALLBACK_FAIL);
                }
             }).catch(function (e){
                cb(new Error("FAIL"),Constants.FB_CALLBACK_FAIL);
             });
        }else{
            cb(new Error("FAIL"),Constants.FB_CALLBACK_FAIL);
        }
    }

    createTournament(score:number,cb?: FBInstantCommon_Callback222){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            let createTournamentConfig: FBInstant.CreateTournamentConfig = {
                title: Constants.GAME_NAME_TITLE+" Tournament",
            };
            
            const createTournamentPayload: FBInstant.CreateTournamentPayload = {
                initialScore: score,
                config: createTournamentConfig,
                data: { }
            };
            
            FBInstant.tournament.createAsync(createTournamentPayload)
                .then(tournament => {
                    // const contextId: string = tournament.getContextID();
                    // const endTime: number = tournament.getEndTime();
                    // const title: string = tournament.getTitle()!;
                    // const payload: any = tournament.getPayload();
                    const id: string = tournament.getID();
                    // console.log(id);
                    FBInstantManager.instance.tournamentID = id;
                    cb(null,Constants.FB_CALLBACK_SUCCESS);
                }).catch(function (e){
                    cb(null,Constants.FB_CALLBACK_FAIL);
                });
        }
    }


    GetLeaderBoard_TournamentPageHost(cb?: FBInstantCommon_Callback222){
        if(localConfig.instance.envType == ENV_TYPE.TEST_AD) {
            
        }

        // console.log("GetLeaderBoard");
        if(localConfig.instance.envType == ENV_TYPE.FB){
            if(FBInstant.context && FBInstant.context.getID()){
                FBInstant.getLeaderboardAsync('score.' + FBInstant.context.getID())
                    .then(leaderboard => leaderboard.getEntriesAsync(100, 0))
                    .then(entries => {
                        let arrListLeaderboard_Ranks : ItemRankInfo[] = [];
                    }).catch((error) =>{
                        
                    } );
            }
        }
    }

    UpdateContextLeaderBoard(){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            FBInstant.updateAsync({
                action: 'LEADERBOARD',
                name: 'score.' + FBInstant.context.getID()
              })
                .then(() => console.log('Update Posted'))
                .catch(error => console.error(error));
        }
    }

    resetContext(cb?: FBInstantCommon_Callback222){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            FBInstantManager.instance.tournamentID = "";
            // console.log("joinTournamentjoinTournamentjoinTournament"+contextID);
            if(FBInstant.context && FBInstant.context.getID() != null){
                // console.log("switchAsync SOLO");
                FBInstant.context.switchAsync('SOLO',true).then(() => {
                    // console.log("SOLO SUCCESS");
                    // console.log(FBInstant.context);
                    // console.log(FBInstant.context.getID());
                    cb!(null,Constants.FB_CALLBACK_SUCCESS);
                }).catch(function (e){
                    // console.log("SOLO ERROR");
                    // console.log(e);
                });
            }
        }else{
            cb(null,Constants.FB_CALLBACK_SUCCESS);
        }
    }

    joinTournament(contextID:string,cb?: FBInstantCommon_Callback222){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            // console.log("joinTournamentjoinTournamentjoinTournament"+contextID);
            FBInstant.context.switchAsync(contextID).then(() => {
                // console.log("joinTournament SUCCESS");
                cb(null,Constants.FB_CALLBACK_SUCCESS);
            }).catch(function (e){
               
                // console.log("joinTournament FAIL");
                // console.log(e);
                if(e.code == "SAME_CONTEXT" || e.code == "CLIENT_UNSUPPORTED_OPERATION"){
                    cb(null,Constants.FB_CALLBACK_SUCCESS);
                }else{
                    cb(new Error("FAIL"),Constants.FB_CALLBACK_FAIL);
                }
            });
        }else{
            cb(null,Constants.FB_CALLBACK_SUCCESS);
        }
    }

    shareTournament(score:number){
        // console.log("shareTournamentshareTournamentshareTournament");
        if(FBInstantManager.instance.tournamentID == ""){
            FBInstantManager.instance.createTournament(score,(err,success)=>{

            });
        }else{
            let shareTournamentPayload: FBInstant.ShareTournamentPayload = {
                score: score,
                data: { }
            };

            FBInstant.tournament.shareAsync(shareTournamentPayload).catch(()=>{

            });
        }
    }


    PostSessionScore(score:number){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            FBInstant.postSessionScoreAsync(score);
        }else{
            
        }
    }

    PostScoreTournament(score:number){
        // console.log("PostScoreTournamentPostScoreTournament");
        if(localConfig.instance.envType == ENV_TYPE.FB){
            if(FBInstantManager.instance.tournamentID == ""){
                FBInstantManager.instance.shareTournament(score);
            }else{
                FBInstant.tournament.postScoreAsync(score);
            }
        }else{
            
        }
    }

    PostScoreShareTournament(score:number,cb?: FBInstantCommon_Callback222){
        // console.log("PostScoreTournamentPostScoreTournament",score);
        // console.log("tournamentID",FBInstantManager.instance.tournamentID);
        if(localConfig.instance.envType == ENV_TYPE.FB){
            if(FBInstantManager.instance.tournamentID == ""){
                FBInstantManager.instance.createTournament(score,cb);
            }else{

                let shareTournamentPayload: FBInstant.ShareTournamentPayload = {
                    score: score
                };

                FBInstant.tournament.shareAsync(shareTournamentPayload).then(()=>{
                    console.log("PostScoreShareTournament Success!!!!");
                    cb!(null,Constants.FB_CALLBACK_SUCCESS);
                }).catch((err) => {
                    console.log(err);
                    cb!(err,Constants.FB_CALLBACK_FAIL);
                });
            }
        }else{
            cb!(new Error("A"),Constants.FB_CALLBACK_FAIL);
        }
    }

    ShareTournament(score:number,cb?: FBInstantCommon_Callback222){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            let shareTournamentPayload: FBInstant.ShareTournamentPayload = {
                score: score
            };

            FBInstant.tournament.shareAsync(shareTournamentPayload).then(()=>{
                console.log("PostScoreShareTournament Success!!!!");
                cb!(null,Constants.FB_CALLBACK_SUCCESS);
            }).catch((err) => {
                console.log(err);
                cb!(err,Constants.FB_CALLBACK_FAIL);
            });
        }else{
            cb!(new Error("A"),Constants.FB_CALLBACK_FAIL);
        }
    }

    // PostSessionScore(score:number){
    //     if(localConfig.instance.envType == ENV_TYPE.FB){
    //         FBInstant.postSessionScoreAsync(score);
    //     }else{
            
    //     }
        
    // }

    // PostScoreTournament(score:number){
    //     if(localConfig.instance.envType == ENV_TYPE.FB){
    //         FBInstant.tournament.postScoreAsync(score);
    //     }else{
            
    //     }
        
    // }


    PlayWithFriend(cb?: FBInstantCommon_Callback222){
        let self = this;
        // console.log("PlayWithFriendPlayWithFriendPlayWithFriend");
        if(localConfig.instance.envType == ENV_TYPE.FB){
            if(localConfig.instance.arrConnectedPlayerInfos.length > 0){
                let id:string = localConfig.instance.arrConnectedPlayerInfos[lodash.random(0,localConfig.instance.arrConnectedPlayerInfos.length)].id;
                // console.log("FBInstant.context.getID():"+FBInstant.context.getID());
                // console.log("id:"+id);
                
                FBInstant.context.createAsync(id)
                .then(() => {
                    cb(null,Constants.FB_CALLBACK_SUCCESS);
                }).catch(()=>{
                    // console.log("PlayWithFriend 2222222222");
                    FBInstant.context.chooseAsync()
                    .then(function() {
                        // console.log("PlayWithFriend 333333333");
                        cb(null,Constants.FB_CALLBACK_SUCCESS);
                    })			
                    .catch(function (e) {
                        // console.log("PlayWithFriend 44444444444");
                        cb(new Error("FAIL"),Constants.FB_CALLBACK_FAIL);
                    });
                });
            }else{
                FBInstant.context.chooseAsync()
                .then(function() {
                    cb(null,Constants.FB_CALLBACK_SUCCESS);
                })			
                .catch(function (e) {
                    cb(new Error("FAIL"),Constants.FB_CALLBACK_FAIL);
                });
            }
            
        }else{
            cb(new Error("FAIL"),Constants.FB_CALLBACK_FAIL);
        }
        
    }

    PlayWithFriend_ID(idFB:string,cb?: FBInstantCommon_Callback222){
        if (localConfig.instance.envType == ENV_TYPE.FB) {
            FBInstant.context.createAsync(idFB)
                .then(() => {
                    cb(null, Constants.FB_CALLBACK_SUCCESS);
                }).catch(() => {
                    cb(new Error("FAIL"), Constants.FB_CALLBACK_FAIL);
                });
        } else {
            cb(null, Constants.FB_CALLBACK_SUCCESS);
        }
    }

    PlayWithFriend_ChooseAsync(cb?: FBInstantCommon_Callback222){
        if (localConfig.instance.envType == ENV_TYPE.FB) {
            FBInstant.context.chooseAsync()
                .then(() => {
                    cb(null, Constants.FB_CALLBACK_SUCCESS);
                })
                .catch((e) => {
                    if (e.code == "SAME_CONTEXT" || e.code == "CLIENT_UNSUPPORTED_OPERATION") {
                        cb(null, Constants.FB_CALLBACK_SUCCESS);
                    } else {
                        cb(new Error("FAIL"), Constants.FB_CALLBACK_FAIL);
                    }
                });
        } else {
            cb(null, Constants.FB_CALLBACK_SUCCESS);
        }
    }
    

    UpdateContext(base64Picture:string){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            FBInstant.updateAsync({
                action: 'CUSTOM',
                cta: "▶️ Play Now!",
                image: base64Picture,
                text: {
                    default: 'Can you do better?',
                    localizations: {
                        ar_AR: 'هل يمكنك فعل ما هو أفضل؟',
                        ca_ES: '¿Puedes hacerlo mejor?',
                        pt_PT: 'Você pode fazer melhor?',
                        fr_FR: 'Peux-tu faire mieux ?',
                        id_ID: 'Bisakah Anda melakukan yang lebih baik?',
                        vi_VN: 'Bạn có thể làm tốt hơn không?',
                        th_TH: 'คุณทำได้ดีกว่านี้ไหม',
                        tr_TR: 'Daha iyisini yapabilir misin?',
                        de_DE: 'Kannst du es besser?',
                    }
                },
                template: 'test_template',
                strategy: 'IMMEDIATE',
                notification: 'PUSH',
            }).then(function() {
                // closes the game after the update is posted.
                //console.log("updateContext FINISHED");
            })
            .catch(function (e) {
                //console.log("updateContext FAIL");
            });
        }else{
        }
    }

    ShareInfoPlayerContext(base64Picture:string,contentShare:string,cb?: FBInstantCommon_Callback){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            FBInstant.shareAsync({
                intent: "INVITE" as "INVITE",
                image: base64Picture,
                text: contentShare
            }).then(function() {
                // closes the game after the update is posted.
                //console.log("ShareMyScore FINISHED");
                cb();
            })
            .catch(function (e) {
                //console.log("ShareMyScore FAIL");
                cb();
            });
        }else{
            cb();
        }
    }

    UpdateContext_WithFriend(base64Picture:string,withFriendDataInfo:WithFriendDataInfo,contentWithFriend:string,cb?: FBInstantCommon_Callback222){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            let withfriendData = JSON.stringify(withFriendDataInfo);
            // console.log("UpdateContext_WithFriend",withfriendData);
            if(FBInstant.context != null){
                FBInstant.updateAsync({
                    action: 'CUSTOM',
                    cta: "Play",
                    image: base64Picture,
                    text: contentWithFriend,
                    template: 'test_template',
                    strategy: 'IMMEDIATE',
                    notification: 'PUSH',
                    data:{withfriendData}
                }).then(() =>{
                    // closes the game after the update is posted.
                    //console.log("updateContext FINISHED");
                    cb(null,Constants.FB_CALLBACK_SUCCESS);
                })
                .catch((e) =>{
                    console.log("updateContext FAIL",e);
                    cb(new Error("Error!"),Constants.FB_CALLBACK_FAIL);
                });
            }else{
                cb(new Error("Error!"),Constants.FB_CALLBACK_FAIL);
            }
        }else{
            cb(new Error("Error!"),Constants.FB_CALLBACK_FAIL);
        }
        
    };

    ShareInfoPlayer(base64Picture:string,cb?: FBInstantCommon_Callback222){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            FBInstant.shareAsync({
                intent: "INVITE" as "INVITE",
                image: base64Picture,
                text: "Play Now"
            }).then(function() {
                // closes the game after the update is posted.
                //console.log("ShareMyScore FINISHED");
                cb(null,Constants.FB_CALLBACK_SUCCESS);
            })
            .catch(function (e) {
                //console.log("ShareMyScore FAIL");
                cb(new Error("Error!"),Constants.FB_CALLBACK_FAIL);
            });
        }else{
            cb(new Error("Error!"),Constants.FB_CALLBACK_FAIL);
        }
    }

    ShareBestLevel(base64Picture:string,cb?: FBInstantCommon_Callback222){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            FBInstant.shareAsync({
                intent: "INVITE" as "INVITE",
                image: base64Picture,
                text: "Play "+Constants.GAME_NAME_TITLE+" with me!"
            }).then(function() {
                // closes the game after the update is posted.
                //console.log("ShareMyScore FINISHED");
                cb(null,Constants.FB_CALLBACK_SUCCESS);
            })
            .catch(function (e) {
                //console.log("ShareMyScore FAIL");
                cb(new Error("Error!"),Constants.FB_CALLBACK_FAIL);
            });
        }else{
            cb(new Error("Error!"),Constants.FB_CALLBACK_FAIL);
        }
    }

    UpdateContext_Invite_222(base64Picture:string,cb?: FBInstantCommon_Callback222){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            if(FBInstant.context != null){
                FBInstant.updateAsync({
                    action: 'CUSTOM',
                    cta: "▶️ Play Now!",
                    image: base64Picture,
                    text: {
                        default: "Can you beat "+FBInstantManager.instance.getName()+" level?", //namePlayer + ' sloved your word!',
                        localizations: {
                        }
                    },
                    template: 'test_template',
                    strategy: 'IMMEDIATE',
                    notification: 'PUSH'
                }).then(function() {
                    // closes the game after the update is posted.
                    //console.log("updateContext FINISHED");
                    cb(null,Constants.FB_CALLBACK_SUCCESS);
                })
                .catch(function (e) {
                    //console.log("updateContext FAIL");
                    cb(new Error("Error!"),Constants.FB_CALLBACK_FAIL);
                });
            }else{
                cb(new Error("Error!"),Constants.FB_CALLBACK_FAIL);
            }
        }else{
            cb(new Error("Error!"),Constants.FB_CALLBACK_FAIL);
        }
        
    };

    // arrConnectedPlayers:FriendAvatarInfo[] = [];
    GetListConnectPlayers(){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            FBInstant.player.getConnectedPlayersAsync().then((connectedPlayers: FBInstant.ConnectedPlayer[]) => {
                    // const connectedPlayer: FBInstant.ConnectedPlayer = connectedPlayers[0];
                    // const id: string = connectedPlayer.getID();
                    // const name: string = connectedPlayer.getName()!;
                    // const photo: string = connectedPlayer.getPhoto()!;
                    //console.log(connectedPlayers);
                    let arrFriendIDs:string[] = [];
                    let arrFriendInfos:FriendAvatarInfo[] = [];
                    for(let i=0; i< connectedPlayers.length;i++){
                        
                        let connectedPlayer: FBInstant.ConnectedPlayer = connectedPlayers[i];
                        //console.log(connectedPlayer.getPhoto());
                        let friendInfo:FriendAvatarInfo = new FriendAvatarInfo();
                        friendInfo.id = connectedPlayer.getID();
                        friendInfo.type = AVATAR_TYPE.TYPE_WEB;
                        arrFriendInfos.push(friendInfo);
                        arrFriendIDs.push(friendInfo.id);
                    }
                    localConfig.instance.arrConnectedPlayerInfos = arrFriendInfos;

                    PGSPlayInstantManager.instance.GetPlayer_byPlayerIds(arrFriendIDs);
            });
        }
    }

    //#region INVITE
    inviteFriend_222(base64Picture: string,content:string, cb?: FBInstantCommon_Callback) {
        if (localConfig.instance.envType == ENV_TYPE.FB) {
            FBInstant.inviteAsync({
                action: 'CUSTOM',
                cta: "Play Now",
                image: base64Picture,
                text: {
                    default: content,
                    localizations: {
                    }
                }
            })
                .then(function () {
                    cb!();
                })
                .catch(function (e) {
                    cb!();
                });

        } else {
            cb!();
        }
    }
    //#endregion

    // FBInstant.matchPlayerAsync("matchTag", false, false).then(() => {});
    // FBInstant.checkCanPlayerMatchAsync().then((canPlayerMatchAsync: boolean) => {});

    SetDataPlayer(content:string){
        // console.log("SetDataPlayerSetDataPlayerSetDataPlayerSetDataPlayer");
        // console.log(content);

        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        if(!localConfig.instance.isGetPlayerDataSuccess) return;
        FBInstant.player.setDataAsync({data: content}).then(() => {
            // console.log("SetDataPlayer Finished");
        });
    }

    GetDataPlayer(){
        // console.log("GetDataPlayer"+new Date().getTime());
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        FBInstant.player.getDataAsync(["data"]).then(result => {
            // console.log("GetDataPlayer Finished");
            let data: string = result["data"];
            // console.log(data);
            if(typeof data === 'undefined'){
                //console.log("undefinedundefinedundefinedundefinedundefined");
                localConfig.instance.updatePlayerData_Finished();
            }else{
                configuration.instance.updateDataPlayer(data);
            }
        });
    }
    
    SendBotData(){
          
    }

    
    AddScoreToLeaderBoard(score:number,cb?: FBInstantCommon_Callback222){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            if(FBInstant.context.getID()){
                FBInstant.getLeaderboardAsync('score.'+ FBInstant.context.getID())
                .then(leaderboard => {
                    // console.log(leaderboard.getName());
                    return leaderboard.setScoreAsync(score);
                })
                .then(() =>{ 
                    // console.log('AddScoreToLeaderBoard Score saved');
                    cb(null, Constants.FB_CALLBACK_SUCCESS);
                })
                .catch(error => {
                    // console.error(error);
                    cb(new Error("Error!"),Constants.FB_CALLBACK_FAIL);
                });
            }
        }
    }

    GetLeaderBoard(cb?: FBInstantCommon_Callback222){
        if(localConfig.instance.envType == ENV_TYPE.TEST_AD) {
            let arrListLeaderboard_Ranks : ItemRankInfo[] = [];
            for(let i=0; i< 50;i++){
                let itemRankInfo:ItemRankInfo = new ItemRankInfo();
                itemRankInfo.userName = ""+FBInstantManager.instance.getName()+i;
                itemRankInfo.avatarType = AVATAR_TYPE.TYPE_LOCAL;
                itemRankInfo.userScore = 1000 - i;
                itemRankInfo.avatarURL = ""+lodash.random(1,20);
                itemRankInfo.indexRank = i + 1;

                if(i == 99){
                    itemRankInfo.isMyRank = true;
                }else{
                    itemRankInfo.isMyRank = false;
                }
                arrListLeaderboard_Ranks.push(itemRankInfo);
            }
        }

        // console.log("GetLeaderBoard");
        if(localConfig.instance.envType == ENV_TYPE.FB){
            if(FBInstant.context && FBInstant.context.getID()){
                FBInstant.getLeaderboardAsync('score.' + FBInstant.context.getID())
                    .then(leaderboard => leaderboard.getEntriesAsync(100, 0))
                    .then(entries => {
                        let arrListLeaderboard_Ranks : ItemRankInfo[] = [];

                        for (var i = 0; i < entries.length; i++) {
                            // console.log(
                            //     entries[i].getRank() + '. ' +
                            //     entries[i].getPlayer().getPhoto() + ': ' +
                            //     entries[i].getScore()
                            // );
                            let itemRankInfo:ItemRankInfo = new ItemRankInfo();
                            itemRankInfo.userName = entries[i].getPlayer().getName();
                            itemRankInfo.avatarType = AVATAR_TYPE.TYPE_WEB;
                            itemRankInfo.userScore = entries[i].getScore();
                            itemRankInfo.avatarURL = entries[i].getPlayer().getPhoto();
                            itemRankInfo.indexRank = entries[i].getRank();
                            itemRankInfo.isMyRank = entries[i].getPlayer().getID() == localConfig.instance.playerID;
                            itemRankInfo.idFB = entries[i].getPlayer().getID();
                            arrListLeaderboard_Ranks.push(itemRankInfo);
                        }
                        
                    }).catch((error) =>{
                        // console.log(error);
                        
                        
                    } );
            }
        }
    }

    asID:string = "";
    dataA2U = {};
    GetASID(){
        FBInstant.player.getASIDAsync().then(
            _asid => {
                console.log(_asid);
                let data = {
                    a2u: {
                        id: this.getID(),
                        asid: _asid,
                        index: -1,
                        page_key: "18",
                    },
                };
                console.log(data);
                this.asID = _asid;
                PGSPlayInstantManager.instance.CancelA2U();
            }
        );
    }

   sendA2U(data: any) {
        let request = new XMLHttpRequest();
        let path = "https://game3f.com:8000/webhook";
        request.open("POST", path, true);
        request.setRequestHeader(
            "Content-Type",
            "application/json; charset=UTF-8"
        );
        request.send(data);
    }

    
    //#region COMMUNITY
    followOfficialPage(){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            FBInstant.community.canFollowOfficialPageAsync()
                .then(function (canFollowOfficialPageAsync) {
                    if (canFollowOfficialPageAsync) {
                        // console.log(data);
                        FBInstant.community.followOfficialPageAsync();
                    }
                }).catch((e) => {
                    // console.log(e);
                });
        }
    }

    joinOfficialGroup(){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            FBInstant.community.canJoinOfficialGroupAsync()
                .then(function (canJoinOfficialGroupAsync) {
                    // console.log("joinOfficialGroup 1111");
                    if (canJoinOfficialGroupAsync) {
                        FBInstant.community.joinOfficialGroupAsync();
                    }
                }).catch((e) => {
                    // console.log(e);
                    // console.log("joinOfficialGroup 4444");
                });

        }
    }

    
    //#endregion

    arrCatalogInfos:CatalogInfo[] = [];
    isIAPInitSuccess:boolean = true;
    arrPurchaseInfos:PurchaseInfo[] = [];
    //#region IAP
    getIAP_AllPack(){
        FBInstantManager.instance.arrCatalogInfos = [];
        FBInstant.payments.getCatalogAsync().then((products: FBInstant.Product[]) => {
            console.log(products);
            for(let i=0; i< products.length;i++){
                let productID:string = products[i].productID;
                let price: string = products[i].price;

                let catalogInfo:CatalogInfo = new CatalogInfo(productID,price);
                // console.log(productID);
                // console.log(price);
                FBInstantManager.instance.arrCatalogInfos.push(catalogInfo);
            }

            FBInstantManager.instance.isIAPInitSuccess = true;
            clientEvent.dispatchEvent(Constants.IAP_INIT_SUCCESS);
        });        
    }

    
    checkHaveIAPPack_byProductID(packID:string){
        if(localConfig.instance.envType != ENV_TYPE.FB) return true;
        // console.log("packID:"+packID);
        // console.log("isIAPInitSuccess:"+FBInstantManager.instance.isIAPInitSuccess);
        // console.log("FBInstantManager.instance.arrCatalogInfos",FBInstantManager.instance.arrCatalogInfos);
        if(!FBInstantManager.instance.isIAPInitSuccess) return false;
        for(let i=0; i< FBInstantManager.instance.arrCatalogInfos.length;i++){
            if(FBInstantManager.instance.arrCatalogInfos[i].productID == packID){
                return true;
            }
        }
        return false;
    }


    getIAPPack_Price_byProductID(packID:string){
        if(!FBInstantManager.instance.isIAPInitSuccess) return "Loading...";
        // var platform = FBInstant.getPlatform();
        
        // if(platform === "IOS"){
        //     return "Unsupported";
        // }

        for(let i=0; i< FBInstantManager.instance.arrCatalogInfos.length;i++){
            if(FBInstantManager.instance.arrCatalogInfos[i].productID == packID){
                return FBInstantManager.instance.arrCatalogInfos[i].price;
            }
        }
    }

    buyIAP_consumePackID(shopPackageDataConfig:ShopPackageDataConfig,cb?: FBInstantCommon_Callback222){
        if(!FBInstantManager.instance.isIAPInitSuccess) {
            
            clientEvent.dispatchEvent(Constants.HIDE_LOADING_POPUP);
            cb(new Error("IAP Fail!"),Constants.FB_CALLBACK_FAIL);
            return;
        }

        clientEvent.dispatchEvent(Constants.SHOW_LOADING_POPUP);
        FBInstant.payments.purchaseAsync({
            productID: shopPackageDataConfig.packageId,
            developerPayload: 'pegasus',
        }).then(function (purchase) {
            FBInstantManager.instance.SetNextTime_ShowInterstitialAd();
            // console.log(purchase);
            // {productID: '12345', purchaseToken: '54321', developerPayload: 'foobar', ...}
            const valueIAP: number = shopPackageDataConfig.price_amount_cents/100;
            LogEventManager.instance.logEventIAP(purchase.paymentID, shopPackageDataConfig.packageId, valueIAP,localConfig.instance.isPaidUser);
            LogEventManager.instance.logCAMPID_PURCHASE(localConfig.instance.log_CAMP_ID);
            LogEventManager.instance.logADSETID_PURCHASE(localConfig.instance.log_ADSET_ID);
            LogEventManager.instance.logADID_PURCHASE(localConfig.instance.log_ADS_ID);
            ShopIAPManager.instance.addShopIAP(shopPackageDataConfig.packageId);
            clientEvent.dispatchEvent(Constants.HIDE_LOADING_POPUP);
            cb(null,Constants.FB_CALLBACK_SUCCESS);
            FBInstant.payments.consumePurchaseAsync(purchase.purchaseToken)
            .then(function () {
                // Purchase successfully consumed!
                // Game should now provision the product to the player
                // clientEvent.dispatchEvent(Constants.HIDE_LOADING_POPUP);
                // cb(null,Constants.FB_CALLBACK_SUCCESS);
            })
            .catch(function (e) {
                // Handle subscription failure
                // clientEvent.dispatchEvent(Constants.HIDE_LOADING_POPUP);
                // cb(new Error("IAP Fail!"),Constants.FB_CALLBACK_FAIL);
            });
            
        }).catch(function (e) {
            // Handle subscription failure
            clientEvent.dispatchEvent(Constants.HIDE_LOADING_POPUP);
            cb(new Error("IAP Fail!"),Constants.FB_CALLBACK_FAIL);
        });
        
    }

    iap_consumePackID(purchaseToken:string,cb?: FBInstantCommon_Callback222){
        if(!FBInstantManager.instance.isIAPInitSuccess) {
            cb(new Error("IAP Fail!"),Constants.FB_CALLBACK_FAIL);
            return;
        }
        
        clientEvent.dispatchEvent(Constants.SHOW_LOADING_POPUP);
        FBInstant.payments.consumePurchaseAsync(purchaseToken)
        .then(function () {
            // Purchase successfully consumed!
            // Game should now provision the product to the player
            clientEvent.dispatchEvent(Constants.HIDE_LOADING_POPUP);
            cb(null,Constants.FB_CALLBACK_SUCCESS);
        })
        .catch(function (e) {
            // Handle subscription failure
            clientEvent.dispatchEvent(Constants.HIDE_LOADING_POPUP);
            cb(new Error("IAP Fail!"),Constants.FB_CALLBACK_FAIL);
        });
    }

    iap_checkPurchaseInfo(packID:string){
        for(let i=0; i< FBInstantManager.instance.arrPurchaseInfos.length;i++){
            if(FBInstantManager.instance.arrPurchaseInfos[i].productID == packID){
                return FBInstantManager.instance.arrPurchaseInfos[i].purchaseToken;
            }
        }
        return "";
    }

    getListIAP_Purchase(cb?: FBInstantCommon_Callback222){
        clientEvent.dispatchEvent(Constants.SHOW_LOADING_POPUP);
        FBInstantManager.instance.arrPurchaseInfos = [];
        FBInstant.payments.getPurchasesAsync().then(function (purchases) {
            for(let i=0; i< purchases.length;i++){
                let productID:string = purchases[i].productID;
                let purchaseToken:string = purchases[i].purchaseToken;

                let purchaseInfo:PurchaseInfo = new PurchaseInfo(productID,purchaseToken);
                FBInstantManager.instance.arrPurchaseInfos.push(purchaseInfo);
            }
            cb(null,Constants.FB_CALLBACK_SUCCESS);
        }).catch(function(e){
            cb(new Error("IAP Fail!"),Constants.FB_CALLBACK_FAIL);
        });
    }
    
    //#endregion

    setHaptic(){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            if(localConfig.instance.isVibration == false) return;
            FBInstant.performHapticFeedbackAsync()
            .then(()=> {
                
            });
        }
    }

    checkPlatformWEB(){
        if(localConfig.instance.envType == ENV_TYPE.FB){
            return false;
        }else{
            return true;
        }
    }

    

}

export type FBIntanstAd_Callback = (error: Error | null, success: string) => void;

export type FBShare_Callback = () => void;

export type FBInstantCommon_Callback = () => void;

export type FBInstantCommon_Callback222 = (error: Error | null, success: string) => void;


@ccclass('CatalogInfo')
export class CatalogInfo {
    productID:string = "";
    price:string = "";
    price_amount_cents:number = 0;

    constructor(_productID:string,_price:string){
        this.productID = _productID;
        this.price = _price;
    }
}

@ccclass('PurchaseInfo')
export class PurchaseInfo {
    productID:string = "";
    purchaseToken:string = "";

    constructor(_productID:string,_purchaseToken:string){
        this.productID = _productID;
        this.purchaseToken = _purchaseToken;
    }
}
/**
 * [1] Class member could be defined like this.
 * [2] Use `property` decorator if your want the member to be serializable.
 * [3] Your initialization goes here.
 * [4] Your update function goes here.
 *
 * Learn more about scripting: https://docs.cocos.com/creator/3.0/manual/en/scripting/
 * Learn more about CCClass: https://docs.cocos.com/creator/3.0/manual/en/scripting/ccclass.html
 * Learn more about life-cycle callbacks: https://docs.cocos.com/creator/3.0/manual/en/scripting/life-cycle-callbacks.html
 */
