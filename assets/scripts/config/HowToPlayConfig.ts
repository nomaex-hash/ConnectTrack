import { L10N } from '../localization/LocalizationKeys';

export type HowToPlayIcon = 'none' | 'dog' | 'mark';

export interface HowToPlayPage {
    readonly captionKey: string;
    readonly icons: readonly HowToPlayIcon[];
}


export const HowToPlayPages: readonly HowToPlayPage[] = [
    {
        captionKey: L10N.howToPlay.page1,
        icons: ['dog', 'none', 'none', 'none', 'none', 'none'],
    },
    {
        captionKey: L10N.howToPlay.page2,
        icons: ['dog', 'mark', 'mark', 'mark', 'none', 'none'],
    },
    {
        captionKey: L10N.howToPlay.page3,
        icons: ['dog', 'mark', 'mark', 'mark', 'mark', 'none'],
    },
    {
        captionKey: L10N.howToPlay.page4,
        icons: ['dog', 'mark', 'mark', 'mark', 'mark', 'dog'],
    },
];
