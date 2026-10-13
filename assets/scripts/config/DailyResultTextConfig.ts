import { Localization } from '../localization/Localization';
import { L10N } from '../localization/LocalizationKeys';

export function pickRandomDailyText(): string {
    return Localization.getRandom(L10N.result.praiseTexts);
}
