// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ConstantKeySaves')
export class ConstantKeySaves {
    public static LOG_CAMPID:string = "log_campID";
    public static LOG_ADSET:string = "log_adset";
    public static LOG_ADS:string = "log_ads";
    public static LOG_TOUR:string = "log_tour";
    public static LOGGED_FIRST_SKEWER: string = "logged_first_skewer";
    public static SUBSCRIBE_BOT:string = "subscribeBOT";

    public static LEVEL_CURRENT_UNLOCK:string = "lvlu";

    public static COUNT_INTERSTITIAL_ADS: string = "inter";
    public static COUNT_REWARDED_ADS: string = "reward";
    public static COUNT_REWARDED_ADS_COMPLETED: string = "reward_completed";
    public static COUNT_BANNER_ADS: string = "banner";
    public static PGS_FIRST_OPEN: string = "PGS_FIRST_OPEN";

    //GAME RESOUCES
    public static GAMERESOURCES:string = "gars";
    public static GAMERESOURCES_LASTTIME:string = "garslt";
    public static GAMERESOURCES_SPENT:string = "garsp";
    public static GAMEBOOSTER_UNLOCKED:string = "gbu";

    //#region CONFIG
    public static SOUND:string = "s";
    public static MUSIC:string = "m";
    public static VIBRATION:string = "v";

    public static HEART_COUNT:string = "hc";
    public static HEART_LASTTIME:string = "hlt";
    public static HEART_UNLIMITED_COUNTTIME: string = "huct";
    public static HEART_UNLIMITED_LASTTIME: string = "hult";

    public static HEART_START_GAME:string = "hsg";
    public static HEART_START_GAME_LASTTIME:string = "hsglt";

    public static REMOVE_AD:string = "rad";
    public static NOADS_FIRST_SHOWN:string = "nfs";

    public static WIN_STREAK:string = "ws";
    public static MAX_WIN_STREAK:string = "mws";

    public static CAPYBARA_WIN_STREAK:string = "cws";
    public static CAPYBARA_MAX_WIN_STREAK:string = "cmws";

    public static DAILYREWARD:string = "dr";

    public static DAILYQUEST_PROGRESS:string = "dqp";
    public static DAILYQUEST_LASTTIME:string = "dqlt";
    public static DAILYQUEST_CLAIMED:string = "dqc";

    public static BATTLE_PASS:string = "bp";

    public static PROFILE:string = "prf";
    
    public static HOTPOT_QUEST:string = "hpq";
    public static RISEUP:string = "ru";

    public static SHOP_IAP:string = "iap";
    public static DAILYQUEST:string = "dqN";

    public static LEADERBOARD:string = "lb";
    public static TOURNAMENT:string = "tr";

    public static PLAYER_INFO:string = "pi";

    public static TUTORIAL_OBJ:string = "to";
}


