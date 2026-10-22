// @ts-nocheck
import { _decorator, Component, Node, Prefab, SpriteFrame } from 'cc';
import { LoadCompleteCallback } from './configuration';
import { resourceUtil } from './resourceUtil';
import { PROFILE_TAB_TYPE } from '../profile/ProfileManager';
const { ccclass, property } = _decorator;

@ccclass('MConfigResourceUtils')
export class MConfigResourceUtils {
    //#region PREFAB UI
    static mapLoadedPrefabUI: Map<string, Prefab> = new Map<string, Prefab>();

    public static loadPrefabUI_Bundle(uiPopupName: string,cb: LoadCompleteCallback<Prefab>){
        if(MConfigResourceUtils.mapLoadedPrefabUI.has(uiPopupName))
        {
            cb(null, MConfigResourceUtils.mapLoadedPrefabUI.get(uiPopupName));                             
        }else{
            resourceUtil.loadPrefabUI_Bundle(uiPopupName,(err,Prefab)=>{
                if(err){
                    cb(err,null);
                }else{
                    MConfigResourceUtils.mapLoadedPrefabUI.set(uiPopupName,Prefab);
                    cb(null,Prefab);
                }
            });
        }
    }

    public static loadPrefabUI_Bundle_Promise(uiPopupName: string,cb: LoadCompleteCallback<Prefab>){
        // return new Promise((resolve, reject) => {
        //     if (MConfigResourceUtils.mapLoadedPrefabUI.has(uiPopupName)) {
        //         cb(null, MConfigResourceUtils.mapLoadedPrefabUI.get(uiPopupName));
        //         resolve && resolve(MConfigResourceUtils.mapLoadedPrefabUI.get(uiPopupName));
        //     } else {
        //         resourceUtil.loadPrefabUI_Bundle(uiPopupName, (err, Prefab) => {
        //             if (err) {
        //                 cb(err, null);
        //                 reject(null);
        //             } else {
        //                 MConfigResourceUtils.mapLoadedPrefabUI.set(uiPopupName, Prefab);
        //                 cb(null, Prefab);
        //                 resolve && resolve(Prefab);
        //             }
        //         });
        //     }
        // });
    }


    //#region AVATAR & FRAME
    static mapLoadedAvatars: Map<string, SpriteFrame> = new Map<string, SpriteFrame>();
    static mapLoadedFrames: Map<string, SpriteFrame> = new Map<string, SpriteFrame>();

    /** Đọc THẲNG cache (mapLoadedAvatars/mapLoadedFrames), KHÔNG tải gì cả — cho nơi gọi biết TRƯỚC
     * (đồng bộ, không cần callback/Promise) ảnh này có sẵn hay chưa, để tự quyết định có cần hiện
     * loadingIcon/xoá sprite tạm thời hay không (xem ItemLeaderboardBase.loadAvatar()). Trả về
     * SpriteFrame nếu có trong cache, null nếu chưa. */
    public static peekCachedProfileSpriteFrame(profileTabType: PROFILE_TAB_TYPE, path: string): SpriteFrame | null {
        const map = profileTabType == PROFILE_TAB_TYPE.AVATAR
            ? MConfigResourceUtils.mapLoadedAvatars
            : MConfigResourceUtils.mapLoadedFrames;
        return map.get(path) ?? null;
    }

    public static getProfileSpriteFrame(profileTabType:PROFILE_TAB_TYPE,path: string, cb: LoadCompleteCallback<SpriteFrame>) {
        if(profileTabType == PROFILE_TAB_TYPE.AVATAR){
            if(MConfigResourceUtils.mapLoadedAvatars.has(path))
            {
                cb(null, MConfigResourceUtils.mapLoadedAvatars.get(path));                             
            }else{
                resourceUtil.getSpriteFrame(path,(err,spriteFrame)=>{
                    if(err){
                        cb(err,null);
                    }else{
                        MConfigResourceUtils.mapLoadedAvatars.set(path,spriteFrame);
                        cb(null,spriteFrame);
                    }
                });
            }
        }else if(profileTabType == PROFILE_TAB_TYPE.FRAME){
            if(MConfigResourceUtils.mapLoadedFrames.has(path))
            {
                cb(null, MConfigResourceUtils.mapLoadedFrames.get(path));                             
            }else{
                resourceUtil.getSpriteFrame(path,(err,spriteFrame)=>{
                    if(err){
                        cb(err,null);
                    }else{
                        MConfigResourceUtils.mapLoadedFrames.set(path,spriteFrame);
                        cb(null,spriteFrame);
                    }
                });
            }

        }
    } 

    public static getProfileSpriteFrame_Promise(profileTabType:PROFILE_TAB_TYPE,path: string, cb: LoadCompleteCallback<SpriteFrame>) { 
        
        return new Promise((resolve, reject) => {
            if (profileTabType == PROFILE_TAB_TYPE.AVATAR) {
                if (MConfigResourceUtils.mapLoadedAvatars.has(path)) {
                    cb(null, MConfigResourceUtils.mapLoadedAvatars.get(path));
                    resolve && resolve(MConfigResourceUtils.mapLoadedAvatars.get(path));
                } else {
                    resourceUtil.getSpriteFrame(path, (err, spriteFrame) => {
                        if (err) {
                            cb(err, null);
                            reject(null);
                        } else {
                            MConfigResourceUtils.mapLoadedAvatars.set(path, spriteFrame);
                            cb(null, spriteFrame);
                            resolve && resolve(spriteFrame);
                        }
                    });
                }
            } else if (profileTabType == PROFILE_TAB_TYPE.FRAME) {
                if (MConfigResourceUtils.mapLoadedFrames.has(path)) {
                    cb(null, MConfigResourceUtils.mapLoadedFrames.get(path));
                    resolve && resolve(MConfigResourceUtils.mapLoadedFrames.get(path));
                } else {
                    resourceUtil.getSpriteFrame(path, (err, spriteFrame) => {
                        if (err) {
                            cb(err, null);
                            reject(null);
                        } else {
                            MConfigResourceUtils.mapLoadedFrames.set(path, spriteFrame);
                            cb(null, spriteFrame);
                            resolve && resolve(spriteFrame);
                        }
                    });
                }

            }
        });
        
    } 
    //#endregion

    //#region GAME RESOURCE
    static mapLoadedGameResources: Map<string, SpriteFrame> = new Map<string, SpriteFrame>();

    public static getGameResourceSpriteFrame(path: string, cb: LoadCompleteCallback<SpriteFrame>) {
        if (MConfigResourceUtils.mapLoadedGameResources.has(path)) {
            cb(null, MConfigResourceUtils.mapLoadedGameResources.get(path));
        } else {
            resourceUtil.getSpriteFrame(path, (err, spriteFrame) => {
                if (err) {
                    cb(err, null);
                } else {
                    MConfigResourceUtils.mapLoadedGameResources.set(path, spriteFrame);
                    cb(null, spriteFrame);
                }
            });
        }
    }
    //#endregion
}


