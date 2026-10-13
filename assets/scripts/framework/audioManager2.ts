// @ts-nocheck

import { _decorator, Component, Node, AudioSource, game, AudioClip, warn, Enum } from 'cc';
import { localConfig } from '../localConfig';
import { configuration } from './configuration';
import { lodash } from './lodash';
import { resourceUtil } from './resourceUtil';
import { director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('AudioManager2')
export class AudioManager2 extends Component {
    public static instance: AudioManager2;
    @property(AudioSource)
    audioSource: AudioSource = null!;

    mapAudioClips:Map<SOUND_NAME,AudioClip> = new Map<SOUND_NAME,AudioClip>();

    onLoad(){
        director.addPersistRootNode(this.node);
        this.audioSource = this.node.getComponent(AudioSource);
        AudioManager2.instance = this; 
    }

    start () {
        // [3]
    }

    // update (deltaTime: number) {
    //     // [4]
    // }

    playSound (sound_name:SOUND_NAME) {
        if(!localConfig.instance.isSound) return;
        let path = 'audios/sound/';
        let name = sound_name;
        if(this.mapAudioClips.has(name)){
            let clip = this.mapAudioClips.get(name);
            this.audioSource.playOneShot(clip, 1);
            return;
        }

        resourceUtil.loadAudioClip(path + name, (err, clip)=> {
            if (err) {
                warn('load audioClip failed: ', err);
                //////console.log(path + name);
                return;
            }
            this.mapAudioClips.set(sound_name,clip);
            // NOTE: the second parameter is volume scale.
            this.audioSource.playOneShot(clip, 1);
        });
    }
    
}

export enum SOUND_NAME {
    CLICK = 'click',
    CLAIM = 'sfx_claim',
    PICK_UP = 'pick-up',
    PICK_DOWN = 'pick-down',
    NOTIFICATION = 'notification',
    COIN_RECEIVE = 'coin_receive',
}

Enum(SOUND_NAME);



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
