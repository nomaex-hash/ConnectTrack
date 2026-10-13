import { RankTier } from '../../core/RankTier';


export interface ShareContent {
    readonly text: string;
    readonly date: string; 
    readonly seconds: number;
    readonly rank: RankTier;
}


export interface ISocialService {

    isAvailable(): boolean;

  
    share(content: ShareContent): Promise<void>;

   
    challengeFriend(content: ShareContent): Promise<void>;
}
