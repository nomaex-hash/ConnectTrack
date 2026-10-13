// @ts-nocheck

import { _decorator, Component, Node, AudioSource, game, Enum } from 'cc';
import { localConfig } from '../localConfig';
import { configuration } from './configuration';
import { director } from 'cc';
import { AudioClip } from 'cc';
import { resourceUtil } from './resourceUtil';
import { warn } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MusicManager')
export class MusicManager extends Component {
    public static instance: MusicManager;
    @property(AudioSource)
    audioSource: AudioSource = null!;

    mapAudioClips:Map<MUSIC_NAME,AudioClip> = new Map<MUSIC_NAME,AudioClip>();

    onLoad(){
        director.addPersistRootNode(this.node);
        this.audioSource = this.node.getComponent(AudioSource);
        MusicManager.instance = this; 
    }

    start () {
        // [3]
        // this.initMusic();
    }

    loadMusic (music_name:MUSIC_NAME) {
            // if(!localConfig.instance.isMusic) return;
            let path = 'audios/music/';
            let name = music_name;
            if(this.mapAudioClips.has(name)){
                let clip = this.mapAudioClips.get(name);
                this.audioSource.clip = clip;
                // this.audioSource.play();
                this.initMusic();
                return;
            }
    
            resourceUtil.loadAudioClip(path + name, (err, clip)=> {
                if (err) {
                    warn('load audioClip failed: ', err);
                    //////console.log(path + name);
                    return;
                }
                this.mapAudioClips.set(MUSIC_NAME[music_name],clip);
                this.audioSource.clip = clip;
                // this.audioSource.play();
                // console.log(this.mapAudioClips);
                this.initMusic();
            });
        }

    initMusic(){
        if(!localConfig.instance.isMusic){
            this.closeMusic();
        }else{
            this.openMusic();
        }
    }

    // update (deltaTime: number) {
    //     // [4]
    // }

    openMusic () {
        //////console.log("openMusicopenMusicopenMusicopenMusic");
        // this.setMusicVolume(0.8);
        this.audioSource.volume = 1;
        if (!this.audioSource.playing) {
            this.audioSource.play();
        }
    }

    checkMusicPlaying(){
        return this.audioSource.playing;
    }

    closeMusic () {
        //////console.log("closeMusiccloseMusiccloseMusic");
        // this.setMusicVolume(0);
        this.audioSource.volume = 0;
        if (this.audioSource.playing) {
            this.audioSource.stop();
        }
    }

    pauseMusic(){
        if (this.audioSource.playing){
            this.audioSource.pause();
        }
    }

    resumeMusic(){
        if (localConfig.instance.isMusic){
            this.openMusic();
        }
    }

    
}

export enum MUSIC_NAME {
    MENU = 'menu',
    INGAME = 'ingame',
}
Enum(MUSIC_NAME);

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
