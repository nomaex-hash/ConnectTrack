import { ISocialService } from './ISocialService';
import { MockSocialService } from './MockSocialService';


export class SocialServiceHolder {
    private static _current: ISocialService = new MockSocialService();

    static get current(): ISocialService {
        return this._current;
    }

    static set(service: ISocialService): void {
        this._current = service;
    }
}
