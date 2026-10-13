import { ISocialService, ShareContent } from './ISocialService';


export class MockSocialService implements ISocialService {
    isAvailable(): boolean {
        return true;
    }

    async share(content: ShareContent): Promise<void> {
        console.log('[MockSocial] share', content);
    }

    async challengeFriend(content: ShareContent): Promise<void> {
        console.log('[MockSocial] challengeFriend', content);
    }
}
