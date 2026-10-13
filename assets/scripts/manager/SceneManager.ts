import { _decorator, Component, director } from 'cc';

const { ccclass } = _decorator;

const MAIN_SCENE_NAME = 'Main';


@ccclass('SceneManager')
export class SceneManager extends Component {
    private static _instance: SceneManager | null = null;
    static get instance(): SceneManager {
        if (!this._instance) throw new Error('SceneManager chưa được khởi tạo.');
        return this._instance;
    }

    onLoad(): void {
        SceneManager._instance = this;
    }

    preloadMainScene(onProgress: (progress: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            director.preloadScene(MAIN_SCENE_NAME,
                (completed, total) => onProgress(total > 0 ? completed / total : 0),
                error => error ? reject(error) : resolve());
        });
    }

    loadMainScene(): Promise<void> {
        return new Promise((resolve) => {
            director.loadScene(MAIN_SCENE_NAME, () => resolve());
        });
    }
}
