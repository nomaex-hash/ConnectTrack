// @ts-nocheck

import { _decorator, Component, Node, game, director, log } from 'cc';
import Utils from '../core/utils/Utils';
import { configuration } from '../framework/configuration';
import { localConfig } from '../localConfig';
import { BOOSTER_TYPE, Constants, ENV_TYPE, LE_ID_MODE, LE_RESULT_END_LEVEL, LevelType } from '../framework/constants';
import { FBInstantManager } from './FBInstantManager';
import { GoogleAnalyticsService } from './GoogleAnalyticsService';
const { ccclass, property } = _decorator;

/**
 * Predefined variables
 * Name = LogEventManager
 * DateTime = Wed Mar 30 2022 14:49:41 GMT+0700 (Indochina Time)
 * Author = tuzkekizer
 * FileBasename = LogEventManager.ts
 * FileBasenameNoExtension = LogEventManager
 * URL = db://assets/scripts/logEvent/LogEventManager.ts
 * ManualUrl = https://docs.cocos.com/creator/3.4/manual/en/
 *
 */
 
@ccclass('LogEventManager')
export class LogEventManager extends Component {
    public static instance: LogEventManager;
    onLoad(){
        director.addPersistRootNode(this.node);
        LogEventManager.instance = this; 
    }
    // [1]
    // dummy = '';

    // [2]
    // @property
    // serializableDummy = 0;
    start(){
        
    }

    update (deltaTime: number) {

    }
        
    logFIRST_OPEN(){
        let str:string = "pgs_first_open";//PGS_FIRST_OPEN
        LogEventManager.instance.logEvent(str);
    }

    logSESSION_BEGIN(){
        let str:string = "pgs_session_begin";//PGS_SESSION_BEGIN
        LogEventManager.instance.logEvent(str);
    }
    
    logEvent_BannerAd(){
        let str:string = "banner";
        LogEventManager.instance.logEvent(str);
    }

    logEvent_InterAd(){
        let str:string = "inter";
        LogEventManager.instance.logEvent(str);
    }

    logEvent_RewardAd(){
        let str:string = "rewarded";
        LogEventManager.instance.logEvent(str);
    }

    logEvent_RewardAd_Completed(){
        let str:string = "rewarded_completed";
        LogEventManager.instance.logEvent(str);
    }

    logEvent_BannerAd_Paid(){
        let str:string = "banner_paid";
        LogEventManager.instance.logEvent(str);
    }

    logEvent_InterAd_Paid(){
        let str:string = "inter_paid";//INTER_PAID
        LogEventManager.instance.logEvent(str);
    }

    logEvent_RewardAd_Paid(){
        let str:string = "rewarded_paid";//REWARD_PAID
        LogEventManager.instance.logEvent(str);
    }

    logEvent_RewardAd_Completed_Paid(){
        let str:string = "rewarded_completed_paid";//REWARD_COMPLETED_PAID
        LogEventManager.instance.logEvent(str);
    }

    logEvent_BannerAd_Organic(){
        let str:string = "banner_organic";//BANNER_ORGANIC
        LogEventManager.instance.logEvent(str);
    }

    logEvent_InterAd_Organic(){
        let str:string = "inter_organic";//INTER_ORGANIC
        LogEventManager.instance.logEvent(str);
    }

    logEvent_RewardAd_Organic(){
        let str:string = "rewarded_organic";//REWARD_ORGANIC
        LogEventManager.instance.logEvent(str);
    }

    logEvent_RewardAd_Completed_ORGANIC(){
        let str:string = "rewarded_completed_organic";//REWARD_COMPLETED_ORGANIC
        LogEventManager.instance.logEvent(str);
    }

    

    logCAMP_ID(campID:string){
        let str:string = "camp_"+campID;//CAMP_
        LogEventManager.instance.logEvent(str);
    }

    logADSET_ID(adsetID:string){
        let str:string = "adset_"+adsetID;//ADSET_
        LogEventManager.instance.logEvent(str);
    }

    logADS_ID(adsID:string){
        let str:string = "ads_"+adsID;//ADS_
        LogEventManager.instance.logEvent(str);
    }


    logCAMPID_BANNER(logCampID:string){
        if(logCampID && logCampID.length > 0){
            let str:string = "camp_"+logCampID+"_banner";//"CAMP_"+logCampID+"_BANNER"
            LogEventManager.instance.logEvent(str,false);
        }
    }

    logCAMPID_INTER(logCampID:string){
        if(logCampID && logCampID.length > 0){
            let str:string = "camp_"+logCampID+"_inter";//"CAMP_"+logCampID+"_INTER"
            LogEventManager.instance.logEvent(str,false);
        }
    }

    logCAMPID_REWARDED(logCampID:string){
        if(logCampID && logCampID.length > 0){
            let str:string = "camp_"+logCampID+"_rewarded";//"CAMP_"+logCampID+"_REWARDED"
            LogEventManager.instance.logEvent(str,false);
        }
    }

    logADSETID_BANNER(logAdsetID:string){
        if(logAdsetID && logAdsetID.length > 0){
            let str:string = "adset_"+logAdsetID+"_banner";//"ADSET_"+logAdsetID+"_BANNER"
            LogEventManager.instance.logEvent(str,false);
        }
    }

    logADSETID_INTER(logAdsetID:string){
        if(logAdsetID && logAdsetID.length > 0){
            let str:string = "adset_"+logAdsetID+"_inter";//"ADSET_"+logAdsetID+"_INTER"
            LogEventManager.instance.logEvent(str,false);
        }
    }

    logADSETID_REWARDED(logAdsetID:string){
        if(logAdsetID && logAdsetID.length > 0){
            let str:string = "adset_"+logAdsetID+"_rewarded";//"ADSET_"+logAdsetID+"_REWARDED"
            LogEventManager.instance.logEvent(str,false);
        }
    }


    logADID_BANNER(logAdID:string){
        if(logAdID && logAdID.length > 0){
            let str:string = "ad_"+logAdID+"_banner";//"AD_"+logAdID+"_BANNER"
            LogEventManager.instance.logEvent(str,false);
        }
    }

    logADID_INTER(logAdID:string){
        if(logAdID && logAdID.length > 0){
            let str:string = "ad_"+logAdID+"_inter";//"AD_"+logAdID+"_INTER"
            LogEventManager.instance.logEvent(str,false);
        }
    }

    logADID_REWARDED(logAdID:string){
        if(logAdID && logAdID.length > 0){
            let str:string = "ad_"+logAdID+"_rewarded";//"AD_"+logAdID+"_REWARDED"
            LogEventManager.instance.logEvent(str,false);
        }
    }

    logCAMPID_PURCHASE(logCampID:string){
        if(logCampID && logCampID.length > 0){
            let str:string = "camp_"+logCampID+"_purchase";//"CAMP_"+logCampID+"_PURCHASE"
            LogEventManager.instance.logEvent(str);
        }
    }

    logADSETID_PURCHASE(logAdsetID:string){
        if(logAdsetID && logAdsetID.length > 0){
            let str:string = "adset_"+logAdsetID+"_purchase";//"ADSET_"+logAdsetID+"_PURCHASE"
            LogEventManager.instance.logEvent(str);
        }
    }

    logADID_PURCHASE(logAdID:string){
        if(logAdID && logAdID.length > 0){
            let str:string = "ad_"+logAdID+"_purchase";//"AD_"+logAdID+"_PURCHASE"
            LogEventManager.instance.logEvent(str);
        }
    }

    logTour_ID(tourID_session:string){
        if(tourID_session && tourID_session.length > 0){
            let str:string = "tour_"+tourID_session; //"TOUR_"+tourID_session
            LogEventManager.instance.logEvent(str);
        }
    }


    logTOURID_BANNER(tourID_session:string){
        if(tourID_session && tourID_session.length > 0){
            let str:string = "tour_"+tourID_session+"_banner"; //"TOUR_"+tourID_session+"_BANNER"
            LogEventManager.instance.logEvent(str);
        }
    }

    logTOURID_INTER(tourID_session:string){
        if(tourID_session && tourID_session.length > 0){
            let str:string = "tour_"+tourID_session+"_inter";//"TOUR_"+tourID_session+"_INTER"
            LogEventManager.instance.logEvent(str);
        }
    }

    logTOURID_REWARDED(tourID_session:string){
        if(tourID_session && tourID_session.length > 0){
            let str:string = "tour_"+tourID_session+"_rewarded";//"TOUR_"+tourID_session+"_REWARDED"
            LogEventManager.instance.logEvent(str);
        }
    }    

    logEvent(str:string,isLogEventFB: boolean = true){
        // console.log("LOGEVENT:"+str);
        if(localConfig.instance.envType == ENV_TYPE.FB){
            if(isLogEventFB){
                FBInstant.logEvent(str.toLowerCase());
            }
        }
        GoogleAnalyticsService.Instance.setGALogEvent(str.toLowerCase());
    }

    logEventIAP(_transaction_id: string, _item_id: string, _value: number,isPaidUser: boolean) {
        let userID = FBInstantManager.instance.getID();
        if (localConfig.instance.envType == ENV_TYPE.TEST_AD) { 
            // console.error("LOG EVENT IAP",_transaction_id,_item_id,_value);
            return; 
        }
        // let parameters = {
        //         transaction_id: _transaction_id,
        //         value: _value,
        //         currency: 'USD',
        //         items: [
        //           {
        //             item_name: _item_id,
        //             item_id: _item_id,
        //             quantity: 1
        //           }
        //         ]
        //       };
        GoogleAnalyticsService.Instance.setGaLogEventIAP(_transaction_id, _item_id, _value)

        if (isPaidUser) {
            GoogleAnalyticsService.Instance.setGaLogEventIAP_Event(_transaction_id, _item_id, _value, "purchase_paid");
        } else{
            GoogleAnalyticsService.Instance.setGaLogEventIAP_Event(_transaction_id, _item_id, _value, "purchase_organic");
        }
    }

    public logEventCampIAP(_transaction_id: string, _item_id: string, _value: number, campId: string) {
        if (localConfig.instance.envType == ENV_TYPE.TEST_AD) {
            // console.error("LOG EVENT CAMP IAP", _transaction_id, _item_id, _value);
            return;
        }
        if(campId && campId !== ""){
            GoogleAnalyticsService.Instance.setGaLogEventCampIAP(_transaction_id, _item_id, _value, campId);
        }
    }

    public logEventAdsetIAP(_transaction_id: string, _item_id: string, _value: number, adsetId: string) {
        if (localConfig.instance.envType == ENV_TYPE.TEST_AD) {
            // console.error("LOG EVENT CAMP IAP", _transaction_id, _item_id, _value);
            return;
        }
        if(adsetId && adsetId !== ""){
            GoogleAnalyticsService.Instance.setGaLogEventAdsetIAP(_transaction_id, _item_id, _value, adsetId);
        }
    }

    public logEventAdIAP(_transaction_id: string, _item_id: string, _value: number, adId: string) {
        if (localConfig.instance.envType == ENV_TYPE.TEST_AD) {
            // console.error("LOG EVENT CAMP IAP", _transaction_id, _item_id, _value);
            return;
        }
        if(adId && adId !== ""){
            GoogleAnalyticsService.Instance.setGaLogEventAdIAP(_transaction_id, _item_id, _value, adId);
        }
    }

    public static logEventParameters(eventName: string, parameters?: any) {
        // console.error("LOG EVENT",eventName,parameters);
        if (localConfig.instance.envType == ENV_TYPE.TEST_AD) { 
            console.log("LOG EVENT", eventName, parameters);
            return; 
        }
        
        FBInstant.logEvent(eventName, 1, parameters);
        GoogleAnalyticsService.Instance.setGaLogEvent(eventName, parameters);
    }

    public logSplashToHome(time: number) {
        let str: string = "splash_to_home";
        let parameters = { "loading_time": "" + time };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logButtonClick(ui_name: string, location: string) {
        let str: string = "button_click";
        let parameters = {
            "button_name": ui_name,
            "location": location
        };
        LogEventManager.logEventParameters(str, parameters);
    }
    
    public logUserProperty(property_name: string, property_value: any) {
        if (localConfig.instance.envType == ENV_TYPE.TEST_AD) { 
            console.log("LOG EVENT", property_name, property_value);
            return;
        }
        let parameters = { [property_name]: property_value };
        GoogleAnalyticsService.Instance.setUserProperties(property_name, property_value);
    }

    
    


    public logCurrentLevel(level: number) {
        let property_name: string = "current_level";
        this.logUserProperty(property_name, level);
    }

    public logCurrentMode(mode: string) {
        let property_name: string = "current_mode";
        this.logUserProperty(property_name, mode);
    }

    public logIsIAPUser(isIAPUser: number) {
        let property_name: string = "is_iap_user_n";
        this.logUserProperty(property_name, isIAPUser);
    }

    public logIAPCount(count: number) {
        let property_name: string = "iap_count_n";
        this.logUserProperty(property_name, count);
    }

    public logWinStreak(streak: number) {
        let property_name: string = "win_streak_n";
        this.logUserProperty(property_name, streak);
    }

    public logLoseStreak(streak: number) {
        let property_name: string = "lose_streak_n";
        this.logUserProperty(property_name, streak);
    }

    public logBalanceCoin(balance: number) {
        let property_name: string = "balance_coin_n";
        this.logUserProperty(property_name, balance);
    }

    public logBoosterUndoCount(count: number) {
        let property_name: string = "undo_count_n";
        this.logUserProperty(property_name, count);
    }

    public logBoosterShuffleCount(count: number) {
        let property_name: string = "shuffle_count_n";
        this.logUserProperty(property_name, count);
    }

    public logBoosterAddColCount(count: number) {
        let property_name: string = "add_col_count_n";
        this.logUserProperty(property_name, count);
    }

    /**
        user_id: n,
        traffic_source: t,
        campaign_id: c,
        adset_id: o,
        ad_id: s
     */

    public logInitUserPropertysID(_user_id: string, _traffic_source: string, _campaign_id: string, _adset_id: string, _ad_id: string) {
        //ONLY DATABUCKETS
        let parameters = {
            user_id: _user_id,
            user_id_str: _user_id,
            traffic_source: _traffic_source,
            campaign_id: _campaign_id,
            adset_id: _adset_id,
            ad_id: _ad_id
        };

    }

    public logInitUserPropertys(_current_level: number, _isIAPUser: number, _iap_count: number, _win_streak: number, _lose_streak: number, _balance_coin: number, _undo_count: number, _shuffle_count: number, _add_col_count: number) {
        let parameters = {
            current_level: _current_level,
            is_iap_user_n: _isIAPUser,
            iap_count_n: _iap_count,
            win_streak_n: _win_streak,
            lose_streak_n: _lose_streak,
            balance_coin_n: _balance_coin,
            undo_count_n: _undo_count,
            shuffle_count_n: _shuffle_count,
            add_col_count_n: _add_col_count
        };
        for (let key in parameters) {
            GoogleAnalyticsService.Instance.setUserProperties(
                key,
                parameters[key].toString()
            );
        }
    }

    public LogUAFirstOpen(_ua_source:string,_ua_campaign_id:string,_ua_adset_id,_ua_ad_id:string) {
        const event_name: string = "ua_first_open";
        const param = {
            "ua_source": _ua_source,
            "ua_campaign_id": _ua_campaign_id,
            "ua_adset_id": _ua_adset_id,
            "ua_ad_id": _ua_ad_id,
        }
        LogEventManager.logEventParameters(event_name, param);
    }

    public LogUASessionStart(level: number,_ua_campaign_id:string,_ua_adset_id,_ua_ad_id:string) {
        const event_name: string = "ua_session_start";
        const param = {
            "level": level,
            "ua_campaign_id": _ua_campaign_id,
            "ua_adset_id": _ua_adset_id,
            "ua_ad_id": _ua_ad_id,
        };
        LogEventManager.logEventParameters(event_name, param);
    }

    public logUALevelStart(level: number, mode_id: LE_ID_MODE, attempt_no: number,levelType:LevelType) {
        let str: string = "level_start";
        let parameters = {
            "level": level,
            "attempt_no": attempt_no,
            "difficulty": LevelType[levelType].toLocaleLowerCase(),
            "mode": mode_id, 
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logUALevelEnd(level: number, mode_id: LE_ID_MODE, attempt_no: number, result: LE_RESULT_END_LEVEL, ingame_duration: number,fail_reason:string,revive_used:number,item_usage_seq:BOOSTER_TYPE[]) {
        let str: string = "level_end";
        // let array_move_seq = Utils.SplitArray(move_seqs, 20);

        let parameters = {
            "level": level,
            "attempt_no": attempt_no,
            "result": result,
            "duration_sec": ingame_duration,
            "fail_reason": fail_reason,
            "revive_used": revive_used,
            "mode": mode_id,
            "item_usage_seq": item_usage_seq.map(item => BOOSTER_TYPE[item].toLowerCase()).join(",")
        };

        // for (let i = 0; i < array_move_seq.length; i++) {
        //     parameters["move_seq" + (i+1)] = array_move_seq[i].join(",");
        // }
        LogEventManager.logEventParameters(str, parameters);
    }

    public logResourceEarned(resource_type: string,resource_name: string,resource_amount: number,placement: string,reason: string) {
        let str: string = "resource_earn";
        let parameters = {
            "resource_type": resource_type,
            "resource_name": resource_name,
            "resource_amount": resource_amount,
            "placement": placement,
            "reason": reason
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logResourceSpend(resource_type: string,resource_name: string,resource_amount: number,placement: string,reason: string) {
        let str: string = "resource_spend";
        let parameters = {
            "resource_type": resource_type,
            "resource_name": resource_name,
            "resource_amount": resource_amount,
            "placement": placement,
            "reason": reason
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logIAPShow(placement: string,show_type: string,pack_name: string) {
        let str: string = "iap_show";
        let parameters = {
            "placement": placement,
            "show_type": show_type,
            "pack_name": pack_name
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logIAPClick(placement: string,show_type: string,pack_name: string) {
        let str: string = "iap_click";
        let parameters = {
            "placement": placement,
            "show_type": show_type,
            "pack_name": pack_name
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logIAPPurchase(placement: string,show_type: string,pack_name: string,price: number,currency: string) {
        let str: string = "iap_purchase";
        let parameters = {
            "placement": placement,
            "pack_name": pack_name,
            "show_type": show_type,
            "price": price,
            "currency": currency
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAdRequest(ad_format: string,placement:string,is_load:number,load_time:number) {
        let str: string = "ad_request";
        let parameters = {
            "ad_format": ad_format,
            "ad_platform":"facebook",
            "ad_network":"facebook",
            "placement": placement,
            "is_load": is_load,
            "load_time": load_time
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAdImpression(ad_format: string,placement:string,is_show:number) {
        let str: string = "ad_impression";
        let parameters = {
            "ad_format": ad_format,
            "ad_platform":"facebook",
            "ad_network":"facebook",
            "placement": placement,
            "is_show": is_show
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAdComplete(ad_format: string,placement:string,end_type:string) {
        let str: string = "ad_complete";
        let parameters = {
            "ad_format": ad_format,
            "placement": placement,
            "ad_platform":"facebook",
            "ad_network":"facebook",
            "end_type": end_type
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logFeatureFirstShow(feature_name: string,placement:string) { 
        let str: string = "feature_first_show";
        let parameters = {
            "feature_name": feature_name,
            "placement": placement
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logFeatureOpen(feature_name: string,placement:string,open_index:number) {
        let str: string = "feature_open";
        let parameters = {
            "feature_name": feature_name,
            "placement": placement,
            "open_index": open_index
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logFeatureClose(feature_name: string,placement:string,open_index:number,feature_duration:number) {
        let str: string = "feature_close";
        let parameters = {
            "feature_name": feature_name,
            "placement": placement,
            "open_index": open_index,
            "feature_duration": feature_duration
        };
        LogEventManager.logEventParameters(str, parameters);
    }
    

    public logAd_Reward_Click(location: string, button_name: string) {
        let str: string = "ad_rv_click";
        let parameters = {
            "location": location,
            "button_name": button_name
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAd_Reward_Scuccess(location: string, button_name: string) {
        let str: string = "ad_rv_success";
        let parameters = {
            "location": location,
            "button_name": button_name
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAd_Reward_Fail(location: string, button_name: string,_reseaon: string) {
        let str: string = "ad_rv_fail";
        let parameters = {
            "location": location,
            "button_name": button_name,
            "reseaon": _reseaon
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAd_Reward_InitFail(location: string, button_name: string) {
        let str: string = "ad_rv_initfail";
        let parameters = {
            "location": location,
            "button_name": button_name
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAd_Reward_Show_Fail(location: string, button_name: string,_reseaon: string) {
        let str: string = "ad_rv_show_fail";
        let parameters = {
            "location": location,
            "button_name": button_name,
            "reseaon": _reseaon
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAd_Reward_Skip(location: string, button_name: string) {
        let str: string = "ad_rv_skip";
        let parameters = {
            "location": location,
            "button_name": button_name
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAd_Reward_PreloadFail(_reseaon: string) {
        let str: string = "ad_rv_preload_fail";
        let parameters = {
            "reseaon": _reseaon
        };
        LogEventManager.logEventParameters(str, parameters);
    }


    public logAd_Interstitial_Show(location: string, button_name: string) {
        let str: string = "ad_interstitial_show";
        let parameters = {
            "location": location,
            "button_name": button_name
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAd_Interstitial_Success(location: string, button_name: string) {
        let str: string = "ad_interstitial_success";
        let parameters = {
            "location": location,
            "button_name": button_name
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAd_Interstitial_Fail(location: string, button_name: string) {
        let str: string = "ad_interstitial_fail";
        let parameters = {
            "location": location,
            "button_name": button_name
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAd_Banner_Show(nameScene: string) {
        let str: string = "ad_banner_show";
        let parameters = {
            "location": nameScene,
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAd_Banner_Success(nameScene: string) {
        let str: string = "ad_banner_success";
        let parameters = {
            "location": nameScene,
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    public logAd_Banner_Fail(nameScene) {
        let str: string = "ad_banner_fail";
        let parameters = {
            "location": nameScene,
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    logTutorialStep(indexStep: number) {
        // console.log("logTutorialStep",indexStep);
        let str: string = "tutorial_step";
        let parameters = {
            "step": indexStep
        };
        LogEventManager.logEventParameters(str, parameters);
    }

    logTutorialIDSkewer(id: number) {
        // console.log("logTutorialIDSkewer",id);
        let str: string = "tutorial_id_skewer";
        let parameters = {
            "id": id
        };
        LogEventManager.logEventParameters(str, parameters);
    }

     public setUserProperties_CampaignId(campaignId: string){
        GoogleAnalyticsService.Instance.setUserProperties("ua_campaign_id", campaignId);
    }

    public setUserProperties_AdId(adId: string){
        GoogleAnalyticsService.Instance.setUserProperties("ua_ad_id", adId);
    }

    public setUserProperties_AdsetId(adsetId: string){
        GoogleAnalyticsService.Instance.setUserProperties("ua_adset_id", adsetId);
    }


    public setUserProperties_Source(source: string){
        GoogleAnalyticsService.Instance.setUserProperties("ua_source", source);
    }

    public setUserProperties_BestLevel(best_level: number){
        GoogleAnalyticsService.Instance.setUserProperties("best_level", best_level);
    }

    public setUserProperties_ActiveDay(active_day: number){
        GoogleAnalyticsService.Instance.setUserProperties("active_day", active_day);
    }

    public setUserProperties_IAPCount(iap_count: number){
        GoogleAnalyticsService.Instance.setUserProperties("iap_count", iap_count);
    }

    public setUserProperties_AdInterWatched(ad_inter_watched: number){
        GoogleAnalyticsService.Instance.setUserProperties("ad_inter_watched", ad_inter_watched);
    }

    public setUserProperties_AdRewardWatched(ad_reward_watched: number){
        GoogleAnalyticsService.Instance.setUserProperties("ad_reward_watched", ad_reward_watched);
    }

    public setUserProperties_Balance_Coin(value: number){
        GoogleAnalyticsService.Instance.setUserProperties("coin_balance", value);
    }

    public setUserProperties_Spent_Coin(value: number){
        GoogleAnalyticsService.Instance.setUserProperties("coin_spent", value);
    }
    
    public setUserProperties_Balance_Booster(boosterType: BOOSTER_TYPE, value: number){
        if(BOOSTER_TYPE[boosterType]){
            GoogleAnalyticsService.Instance.setUserProperties(BOOSTER_TYPE[boosterType].toLowerCase().toString()+"_balance", value);
        }
    }

    public setUserProperties_Spent_Booster(boosterType: BOOSTER_TYPE, value: number){
        if(BOOSTER_TYPE[boosterType]){
            GoogleAnalyticsService.Instance.setUserProperties(BOOSTER_TYPE[boosterType].toLowerCase().toString()+"_spent", value);
        }
    }


    public LogUA_AD_Impression(ad_format:string,placement:string,level:number,mode_id:LE_ID_MODE,status:string) {
        const event_name: string = "ua_ad_impression";
        const param = {
            "ad_format": ad_format,
            "placement": placement,
            "level": level,
            "mode": mode_id,
            "status": status
        };
        LogEventManager.logEventParameters(event_name, param);
    }

    public LogUA_AD_Reward(placement:string,level:number,mode_id:LE_ID_MODE) {
        const event_name: string = "ua_ad_reward";
        const param = {
            "placement": placement,
            "level": level,
            "mode": mode_id
        };
        LogEventManager.logEventParameters(event_name, param);

    }
}

