// @ts-nocheck
import { _decorator, Component, director, Node } from 'cc';
import { PGSPlayInstantManager } from './PGSPlayInstantManager';
import { localConfig } from '../localConfig';
import { BOOSTER_TYPE, ENV_TYPE, RESOURCE_TYPE } from '../framework/constants';
const { ccclass, property } = _decorator;

@ccclass('GoogleAnalyticsService')
export class GoogleAnalyticsService extends Component {
    public static Instance: GoogleAnalyticsService = null;
    
    public static PGS_GAME_ID: string = "";
    public static GA_MEASUREMENT_ID: string = "";
    public static GAME_NAME: string = "MagicSort";
    public static BUILD_VERSION: string = "1";

    public mapUserProperties: Map<string, any> = new Map();

    gaSessionId :string = null;
    gaSessionNumber  :string = null;
    clientId :string = null;

    protected onLoad(): void {
        if (GoogleAnalyticsService.Instance == null) {
            GoogleAnalyticsService.Instance = this;
        }
        director.addPersistRootNode(this.node);
    }

    public setInitGoogleAnalytics(){
        let userId = FBInstant.player.getID();
        FBInstant.getEntryPointAsync().then((trafficSource) => {
            this.initGoogleAnalytics(userId, trafficSource)
        }).catch(()=> {
            this.initGoogleAnalytics(userId, "no_entry");
        });
    }

    public initGoogleAnalytics(userId: string,trafficSource: string){
        // Lấy data từ FBInstant
        const measurementId = GoogleAnalyticsService.GA_MEASUREMENT_ID;
        const entryData = FBInstant.getEntryPointData() || {};
        const adId = (entryData && entryData.fb_instant_game_ad_id) || "";
        const adsetId = (entryData && entryData.fb_instant_game_adset_id) || "";
        const campaignId = (entryData && entryData.fb_instant_game_campaign_id) || "";

        this.initPlayinstantTracker();


        // Nếu không có measurementId thì bỏ qua
        if (!measurementId || measurementId === "null") return;

        if (typeof gtag !== 'undefined') {
            // Init GA
            gtag("js", new Date());
            gtag("config", measurementId, {
                cookie_flags: "SameSite=None;Secure",
                build: GoogleAnalyticsService.BUILD_VERSION,
                medium: trafficSource,
                campaign: campaignId
            });
            gtag('set', 'user_id', userId);
            // gtag("set", "user_properties", mapToObject(this.mapUserProperties));
            this.setUserProperties("user_id", userId);
            this.setUserProperties("ua_source", trafficSource);
            this.setUserProperties("ua_ad_id", adId);
            this.setUserProperties("ua_adset_id", adsetId);
            this.setUserProperties("ua_campaign_id", campaignId);

            // Event launch app
            gtag("event", "app_launch");

            // this.getGaTrackingInfo(measurementId);
        }
        
    }

    private async initPlayinstantTracker(){
        if(localConfig.instance.envType == ENV_TYPE.FB && typeof playinstantTracker !== 'undefined'){
            playinstantTracker.init({
                gameId: GoogleAnalyticsService.PGS_GAME_ID,
                measurementId: GoogleAnalyticsService.GA_MEASUREMENT_ID,
                userId: FBInstant.player.getID(),
                getSignature: async function () {
                    const signedInfo = await FBInstant.player.getSignedPlayerInfoAsync();
                    return signedInfo.getSignature();
                },
                debug: false,
                iosOnly: true,
            });

            // playinstantTracker.setDebug(true);
        }
    }


    public setUserProperties(property_name: string, property_value: any) {
        this.mapUserProperties.set(property_name, property_value);

        // console.log("setUserProperties", property_name, property_value,this.mapUserProperties,mapToObject(this.mapUserProperties));
        if (typeof gtag !== 'undefined') {
            let user_properties = mapToObject(this.mapUserProperties);
            // console.log("user_properties", user_properties);
            gtag("set", "user_properties", user_properties);
        }

        if(localConfig.instance.envType == ENV_TYPE.FB && typeof playinstantTracker !== 'undefined'){
            playinstantTracker.setUserProperties(mapToObject(this.mapUserProperties));
        }
    }

    public setGALogEvent(eventName: string) {
        if (typeof gtag !== 'undefined') {
            if(this.isIOS()){
                this.TrackEvent(eventName,{});
            }else{
                gtag('event', eventName.toLowerCase());
            }
        }
    }

    public setGaLogEvent(eventName: string, params: any) {
        if (typeof gtag !== 'undefined') {
            if(this.isIOS()){
                this.TrackEvent(eventName,params);
            }else{
                gtag('event', eventName.toLowerCase(), params);
            }
        }
    }

    public setGaLogEventIAP(_transaction_id: string, _item_id: string, _value: number) {
        if (typeof gtag !== 'undefined') {
            if(this.isIOS()){
                // this.TrackEvent(eventName,params);
                let iapParams = {
                    transaction_id: _transaction_id,
                    value: _value,
                    currency: 'USD',
                    items: [
                        {
                            item_name: _item_id,
                            item_id: _item_id,
                            quantity: 1
                        }
                    ]};

                this.TrackEvent("purchase",iapParams);    
            }else{
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'purchase', {
                        transaction_id: _transaction_id,
                        value: _value,
                        currency: 'USD',
                        items: [
                            {
                                item_name: _item_id,
                                item_id: _item_id,
                                quantity: 1
                            }
                        ]
                    });
                }
            }
        }
    }

    setGaLogEventIAP_Event(_transaction_id: string, _item_id: string, _value: number, _eventName: string) {
        // this.setGaLogEventIAP(_transaction_id, _item_id, _value);
        // Log sự kiện IAP cho người dùng đã trả tiền   
        if (typeof gtag !== 'undefined') {
            if(this.isIOS()){
                // this.TrackEvent(eventName,params);
                let iapParams = {
                    transaction_id: _transaction_id,
                    value: _value,
                    currency: 'USD',
                    items: [
                        {
                            item_name: _item_id,
                            item_id: _item_id,
                            quantity: 1
                        }
                    ]};

                this.TrackEvent("purchase",iapParams);    
            }else{
                if (typeof gtag !== 'undefined') {
                    gtag('event', _eventName, {
                        transaction_id: _transaction_id,
                        value: _value,
                        currency: 'USD',
                        items: [
                            {
                                item_name: _item_id,
                                item_id: _item_id,
                                quantity: 1
                            }
                        ]
                    });
                }
            }
        }
    }
    public setGaLogEventCampIAP(_transaction_id: string, _item_id: string, _value: number,_campaignId: string) {
        if (typeof gtag !== 'undefined') {
            if(this.isIOS()){
                // this.TrackEvent(eventName,params);
                let iapParams = {
                    transaction_id: _transaction_id,
                    value: _value,
                    currency: 'USD',
                    items: [
                        {
                            item_name: _item_id,
                            item_id: _item_id,
                            quantity: 1
                        }
                    ]};

                this.TrackEvent(`camp_${_campaignId}_purchase`,iapParams);    
            }else{
                if (typeof gtag !== 'undefined') {
                    gtag('event', `camp_${_campaignId}_purchase`, {
                        transaction_id: _transaction_id,
                        value: _value,
                        currency: 'USD',
                        items: [
                            {
                                item_name: _item_id,
                                item_id: _item_id,
                                quantity: 1
                            }
                        ]
                    });
                }
            }
        }
    }

    public setGaLogEventAdsetIAP(_transaction_id: string, _item_id: string, _value: number,_adsetId: string) {
        if (typeof gtag !== 'undefined') {
            if(this.isIOS()){
                // this.TrackEvent(eventName,params);
                let iapParams = {
                    transaction_id: _transaction_id,
                    value: _value,
                    currency: 'USD',
                    items: [
                        {
                            item_name: _item_id,
                            item_id: _item_id,
                            quantity: 1
                        }
                    ]};

                this.TrackEvent(`adset_${_adsetId}_purchase`,iapParams);    
            }else{
                if (typeof gtag !== 'undefined') {
                    gtag('event', `adset_${_adsetId}_purchase`, {
                        transaction_id: _transaction_id,
                        value: _value,
                        currency: 'USD',
                        items: [
                            {
                                item_name: _item_id,
                                item_id: _item_id,
                                quantity: 1
                            }
                        ]
                    });
                }
            }
        }
    }

    public setGaLogEventAdIAP(_transaction_id: string, _item_id: string, _value: number,_adId: string) {
        if (typeof gtag !== 'undefined') {
            if(this.isIOS()){
                // this.TrackEvent(eventName,params);
                let iapParams = {
                    transaction_id: _transaction_id,
                    value: _value,
                    currency: 'USD',
                    items: [
                        {
                            item_name: _item_id,
                            item_id: _item_id,
                            quantity: 1
                        }
                    ]};

                this.TrackEvent(`ad_${_adId}_purchase`,iapParams);    
            }else{
                if (typeof gtag !== 'undefined') {
                    gtag('event', `ad_${_adId}_purchase`, {
                        transaction_id: _transaction_id,
                        value: _value,
                        currency: 'USD',
                        items: [
                            {
                                item_name: _item_id,
                                item_id: _item_id,
                                quantity: 1
                            }
                        ]
                    });
                }
            }
        }
    }

    isIOS() {
        // return true;
        if(localConfig.instance.envType !== ENV_TYPE.FB){
            return false;
        }
        let platform = FBInstant.getPlatform();
        if (platform === "IOS") {
            return true;
        }
        return false;
    }

    public TrackEvent(eventName: string, params: any) {
        // let userProperties = mapToObject(this.mapUserProperties);
        // params.ga_session_id = this.gaSessionId;
        // params.ga_session_number = this.gaSessionNumber;
        // PGSPlayInstantManager.instance.TrackEvent(this.clientId, eventName,params, userProperties);

        if(localConfig.instance.envType == ENV_TYPE.FB && typeof playinstantTracker !== 'undefined'){
            playinstantTracker.track(eventName, params);
        }
    }

}

function mapToObject(map) {
  const obj = {};
  for (const [key, value] of map) {
    obj[key] = value;
  }
  return obj;
}


