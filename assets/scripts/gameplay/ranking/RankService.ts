import { RankTier } from '../../core/RankTier';
import { RankConfig } from '../../config/RankConfig';


export class RankService {
 
    static evaluate(seconds: number, dogCount: number): RankTier {
        if (dogCount <= 0) return RankTier.Bronze;

        const perDog = Math.max(0, seconds) / dogCount;

        if (perDog <= RankConfig.goldSecondsPerDog) return RankTier.Gold;
        if (perDog <= RankConfig.silverSecondsPerDog) return RankTier.Silver;
        return RankTier.Bronze;
    }
}
