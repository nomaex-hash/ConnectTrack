// @ts-nocheck
import { Enum } from "cc";
import { HeartManager } from "../common/HeartManager";

export class Constants {
	public static GAME_NAME: string = "MagicSort";

	public static GAME_NAME_TITLE: string = "Magic Sort";

	public static SOUND: string = "sound";
	public static MUSIC: string = "music";
	public static VIBRATION: string = "vibration";

	public static SHOW_LOADING_NOW: string = "showLoadingNow";
	public static HIDE_LOADING: string = "hideloading";
	public static HIDE_LOADING2: string = "hideloading2";
	public static SHOW_NOTIFICATION: string = "showNotification";
	public static SHOW_NOTIFICATION_FOR_PROFILE: string = "showNotification_for_profile";

	public static FBINSTANT_INIT_SUCCESS: string = "fbInstant_Init_Success";

	

	public static PLAYFAB_TITLE: string = "";
	public static PGS_GAMEID: string = "6914079402807ab84b75b6e4";
	public static PGS_REMOTECONFIG_SUCCESS: string = "pgs_remoteconfig_success";

	public static BUNDLE_RESOURCES: string = "resources";
	public static BUNDLE_ITEMS: string = "items";

	public static GET_DATA_PLAYER_SUCCESS: string = "get_data_player_success";
	public static GET_DATA_PAYLOAD_SUCCESS: string = "get_data_payload_success";

	public static SHOW_LOADING_POPUP: string = "showLoadingPopup";
	public static HIDE_LOADING_POPUP: string = "hideLoadingPopup";

	public static SHOW_LOADING_AD_POPUP: string = "showLoadingAdPopup";
	public static HIDE_LOADING_AD_POPUP: string = "hideLoadingAdPopup";

	public static SHOW_LOADING_CHANGESCENE_POPUP: string = "showLoadingChangeScenePopup";
  	public static HIDE_LOADING_CHANGESCENE_POPUP: string = "hideLoadingChangeScenePopup";


	public static FB_INTERSTITIAL_PLACEMENT_ID: string = "1322842612329132_1333678931245500";
	public static FB_REWARDED_PLACEMENT_ID: string = "1322842612329132_1333679011245492";

	public static FB_INTERSTITIAL_CALLBACK_SUCCESS: string = "fb_interstitial_callback_success";
	public static FB_INTERSTITIAL_CALLBACK_FAIL: string = "fb_interstitial_callback_fail";
	public static FB_REWARD_CALLBACK_SUCCESS: string = "fb_reward_callback_success";
	public static FB_REWARD_CALLBACK_FAIL: string = "fb_reward_callback_fail";
	public static FB_REWARD_CALLBACK_NOTFINISH: string = "fb_reward_callback_notFinish";

	public static FB_CALLBACK_SUCCESS: string = "fb_callback_success";
	public static FB_CALLBACK_FAIL: string = "fb_callback_success";

	public static SHARE_UPDATECONTEXT_POPUP: string = "shareUpdateContextPopup";
	public static SHARE_INVITE_POPUP: string = "shareInvitePopup";

	public static SHOW_SHARE_CONTEXT_POPUP: string = "show_share_context_popup";
	public static SHOW_SHARE_INVITE_POPUP: string = "show_share_invite_popup";

	public static SHOW_UPDATECONTEXT_WITHFRIEND_POPUP: string ="show_updateContext_withfriend_popup";

	public static COIN: string = "coin";
	public static COIN_UPDATE: string = "coin_update";

	public static ADDCOIN: string = "addCoin";
	public static SHOW_ADDCOIN: string = "showAddCoin";
	public static SHOW_ADDCOIN_WORLDPOS: string = "showAddCoin_WorldPos";
	public static UPDATE_COIN_TARGETPOS: string = "update_Coin_TargetPos";
	public static UPDATE_COIN_STARTPOS: string = "update_Coin_StartPos";

	public static SHOW_EFX_COIN_RECEIVE: string = "show_efx_coin_receive";

	public static SCORE: string = "score";
	public static SCORE_UPDATE: string = "score_update";

	public static SHOW_ADDHEART_UNLIMITED: string = "showAddHeartUnlimited";
	public static UPDATE_HEART_TARGETPOS: string = "update_Heart_TargetPos";
	public static UPDATE_HEART_STARTPOS: string = "update_Heart_StartPos";
	public static HANDLE_LOSE_HEART: string = "handle_lose_heart";

	public static HEART_COUNT_UPDATE: string = "heart_count_update";
	public static HEART_UNLIMITED_UPDATE: string = "heart_unlimited_update";
	public static HEART_UNLIMITED_START: string = "heart_unlimited_start";
	public static HEART_UPDATE: string = "heart_update";

	public static SHOW_REFILLHEART_POPUP:string = "show_refillheart_popup";

	

	public static SHOW_WEEKLY_REWARD_RECEIVE_POPUP: string = "show_weekly_reward_receive_popup";
	public static CONFIRM_OK: string = "confirm_ok";

	public static TOUCH_TAB: string = "touch_tab";
	public static TAB_UPDATE: string = "tab_update";

	public static SHOW_SHOP_GROUP: string = "show_shop_group";
	public static SHOW_SHOP_POPUP: string = "show_shop_popup";
	public static SHOW_SHOP_ITEM_POPUP: string = "show_shop_item_popup";
	public static GOTO_TOURNAMENT: string = "goto_tournament";

	public static SHOW_BATTLEPASS_POPUP: string = "show_battlepass_popup";
	public static BATTLEPASS_COUNT_UPDATE: string = "battlepass_count_update";
	public static SHOW_BATTLEPASS_INFO_POPUP: string = "show_battlepass_info_popup";
	public static SHOW_BATTLEPASS_DETAIL_POPUP: string = "show_battlepass_detail_popup";
	public static BATTLEPASS_ACTIVATE_SUCCESS: string = "battlepass_activate_success";
	public static BATTLEPASS_DETAIL_TOUCH_ITEM: string = "battlepass_detail_touch_item";

	public static SHOW_HOTPOT_QUEST_POPUP: string = "show_hotpot_quest_popup";
	public static SHOW_HOTPOT_QUEST_INFO_POPUP: string = "show_hotpot_quest_info_popup";
	public static SHOW_HOTPOT_QUEST_START_POPUP: string = "show_hotpot_quest_start_popup";
	public static SHOW_HOTPOT_QUEST_FIND_POPUP: string = "show_hotpot_quest_find_popup";
	public static SHOW_HOTPOT_QUEST_WIN_POPUP: string = "show_hotpot_quest_win_popup";
	public static SHOW_HOTPOT_QUEST_END_POPUP: string = "show_hotpot_quest_end_popup";
	public static SHOW_HOTPOT_QUEST_NEXT_TIME_POPUP: string = "show_hotpot_quest_next_time_popup";
	public static HOTPOT_QUEST_UPDATE: string = "hotpot_quest_update";


	public static SHOW_RISEUP_POPUP: string = "show_riseup_popup";
	public static SHOW_RISEUP_INFO_POPUP: string = "show_riseup_info_popup";
	public static RISEUP_COUNT_UPDATE: string = "riseup_count_update";


	public static SHOW_PROFILE_POPUP: string = "show_profile_popup";
	public static SHOW_PROFILE_EDIT_POPUP: string = "show_profile_edit_popup";
	public static PROFILE_UPDATE: string = "profile_update";
	public static PROFILE_POPUP_TOUCH_TAB: string = "profile_popup_touch_tab";
	public static PROFILE_POPUP_SELECT_ITEM: string = "profile_popup_select_item";

	public static SHOW_REWARD_RECEIVE_POPUP:string = "show_reward_receive_popup";

	public static CLICK: string = "click";
	public static TUBE_SELECT = "tube_select";
	public static TUBE_SHUFFLE_START = "tube_shuffle_start";
	public static TUBE_SHUFFLE_FINISHED = "tube_shuffle_finished";

	public static SHOW_EFFECT_WATER = "show_effect_water";

	public static BOOSTER_UPDATE: string = "booster_update";

	public static TUBE_FULL: string = "tube_full";
	public static TUBE_EMPTY: string = "tube_empty";

	public static SHOW_WIN_POPUP: string = "show_win_popup";


	public static SHOP_IAP_UPDATE: string = "shop_iap_update";
	public static IAP_INIT_SUCCESS: string = "iap_init_success";
	public static REMOVE_AD_UPDATE: string = "remove_ad_update";

	public static DAILY_REWARD_INDEX_UPDATE: string = "daily_reward_index_update";


	public static DAILYQUEST_UPDATE: string = "dailyquest_update";
	public static SHOW_DAILY_POPUP: string = "show_daily_popup";


	public static LEADERBOARD_POPUP_TOUCH_TAB: string = "leaderboard_popup_touch_tab";
	
    public static BOOSTER_COUNT_UPDATE:string = "booster_count_update";
    public static BOOSTER_CLICK:string = "booster_click";

	public static HOME_TOUCH_LEVEL: string = "home_touch_level";


	public static SHOW_EFX_OBIM_FINSIHED = "showEfxOBIMFinished";
    public static SHOW_EFX_CLAY_FINSIHED = "showEfxClayFinished";
    public static SHOW_EFX_PLASTER_FINSIHED = "showEfxPlasterFinished";
    public static SHOW_EFX_QUESTION = "showEfxQuestion";

	public static SHUFFLE_GROUP_TOUCH_CANCEL: string = "shuffle_group_touch_cancel";
	public static SHUFFLE_TUBE_FINISHED: string = "shuffle_tube_finished";
	

	public static TUBE_OBIM_DONE: string = "tube_obim_done";
	public static TUBE_CLAY_DONE: string = "tube_clay_done";
	public static TUBE_PLASTER_DONE: string = "tube_plaster_done";

	public static SHOW_TUT_CURTAIN_POPUP:string = "show_tut_curtain_popup";
	public static SHOW_TUT_CLAY_POPUP:string = "show_tut_clay_popup";
	public static SHOW_TUT_PLASTER_POPUP:string = "show_tut_plaster_popup";

	public static SHOW_SETTING_POPUP: string = "showSetting_Popup";
	public static HIDE_PAUSE_POPUP_NOW: string = "hide_pause_popup_now";

	//Leaderboard
	public static PGS_RECEIVE_LISTRANK_LEADERBOARD: string = "pgs_receive_listrank_leaderboard";
	public static LEADERBOARD_SHOW_DETAIL_REWARD: string = "leaderboard_show_detail_reward";
	public static SHOW_LEADERBOARD_INFO_POPUP:string = "pgs_leaderboard_info_popup";

	//Tournament
	public static TOURNAMENT_CLAIMED_UPDATE:string = "tournament_claimed_update";
	public static SHOW_TOURNAMENT_DETAIL_POPUP:string = "show_tournament_detail_popup";

	public static SHOW_BATTLE_PASS_POPUP:string = "show_battle_pass_popup";

	//WITHFRIEND
	public static WITHFRIEND_PLAY_START:string = "withfriend_play_start";
	public static WITHFRIEND_START_GAME:string = "withfriend_start_game";

}

export const enum GAME_STATE {
	PRE_START,
	PLAY,
	ENDGAME,
	WIN,
	LOSE,
	PAUSE,
	GAME_OVER,
	SHUFFLE,
	NO_MOVES
}

export const enum EFX_TYPE {
	COIN,
	ICON_EVENT,
}

export const enum SCENE_NAME {
	preloadscene,
	loadscene,
}

export const enum ENV_TYPE {
	FB,
	TEST_AD
}

export const enum CONFIRM_OK_TYPE {
	TYPE_1,
}

export const enum AVATAR_TYPE {
	TYPE_WEB,
	TYPE_LOCAL,
}

export enum GAME_MODE {
	NONE,
	NORMAL,
	TOURNAMENT,
	DAILY_CHALLENGE,
	TOURNAMENT_PAGEHOST,
	WITH_FRIEND,
}

Enum(GAME_MODE);

export enum SHOP_IAP_PACK {
	REMOVE_AD,
	PACK1,
	PACK2,
	PACK3,
	PACK4,
	REMOVE_AD_PACK,
}

Enum(SHOP_IAP_PACK);

export enum TAB_TYPE {
	SHOP,
	SOCIAL,
	HOME,
	LEADERBOARD,
	TOURNAMENT,
}
Enum(TAB_TYPE);

export enum SCENE_TYPE {
	HOME,
	GAME,
}
Enum(SCENE_TYPE);

export enum RESOURCE_TYPE {
	NONE = 0,
	CURRENCY = 1,
	BOOSTER = 2,
	SPECIAL = 3,
}
Enum(RESOURCE_TYPE);

export enum SPECIAL_RESOURCE_TYPE {
	NONE = 0,
	NOADS = 1,
	INFINITE_LIFE = 3,
	BATTLE_PASS = 4,
	FRAME_PROFILE = 16,
	AVATAR_PROFILE = 17
}
Enum(SPECIAL_RESOURCE_TYPE);

export enum CURRENCY_TYPE {
	NONE = 0,
	MONEY = 1,
	GEM = 2,
	STAR = 3,
	LIFE = 4,
}
Enum(CURRENCY_TYPE);

export enum BOOSTER_TYPE {
	NONE = 0,
	ADD_COL = 1,
	SHUFFLE = 2,
	UNDO = 3,
	// Dogdoku chỉ có 2 loại booster thật (Hint, Place Dog) — ADD_COL/SHUFFLE/UNDO là booster
	// xếp-bài của game gốc MagicSort, không dùng trong shopData.json của Dogdoku nữa.
	HINT = 4,
	PLACE_DOG = 5,
}
Enum(BOOSTER_TYPE);

export enum LevelType {
	Normal = 1,
	Hard = 2,
	SuperHard = 3,
}
Enum(LevelType);

export enum PackageName {
	None = 0,
	coin1 = 101,
	coin2 = 102,
	coin3 = 103,
	coin4 = 104,
	coin5 = 105,
	coin6 = 106,

	starterbundle = 201,

	smallbundle = 301,
	mediumbundle = 302,
	largebundle = 303,
	bigbundle = 304,
	megabundle = 305,

	battlepass = 401,
}
Enum(PackageName);

export enum PriceType {
	IAP = 0,
	ADS = 1,
	COIN = 2,
}
Enum(PriceType);

export enum BACK_TO_HOME_TYPE {
	NONE = 0,
	WIN = 1
}
Enum(BACK_TO_HOME_TYPE);

export enum DAILY_TAB_TYPE {
	QUEST = 0,
	REWARD = 1
}
Enum(DAILY_TAB_TYPE);


export enum EVENT_TYPE {
	DAILY = "daily",
}
Enum(EVENT_TYPE);

export enum QUEST_TYPE {
	PASS_LEVEL = 0
}

Enum(QUEST_TYPE);


export enum SCENE_NAME_GA {
	HOME = "home",
	PLAY = "play",
}

export enum WATER_STATE {
	NONE,
	LOCK
}

Enum(WATER_STATE);

export enum ITEM_TUBE_STATE {
	NONE,
	SELECT,
	UNSELECT,
	DONE,
	ON,
	OFF,
	UNLOCK,
	ADDCOL,
	WAITTING,
	OBIM,//Đang bị che
	PLASTER,//Đang bị che
	MOVE_IN,
	MOVE_OUT,
}

Enum(ITEM_TUBE_STATE);

export enum LE_ID_MODE {
    NORMAL = 'normal',
    DAILY_CHALLENGE = 'dailychallenge',
    TOURNAMENT = 'tournament',
    TOURNAMENT_PAGEHOST = 'tournament_pagehost',
    WITH_FRIEND = 'withfriend',
    NONE = 'none'
}
Enum(LE_ID_MODE);


export enum LE_RESULT_END_LEVEL {
    WIN = 'win',
    LOSE = 'lose',
    QUIT = 'quit',
    RESET = 'reset'
}
Enum(LE_RESULT_END_LEVEL);

export enum IAP_PLACEMENT_TYPE{
    HOME_SHOP,
    HOME_POPUP,
    INGAME_POPUP
}
Enum(IAP_PLACEMENT_TYPE);

export enum IAP_SHOW_TYPE{
    SHOP,
    PACK
}
Enum(IAP_SHOW_TYPE);