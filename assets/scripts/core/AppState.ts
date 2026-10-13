
export enum AppState {
    Boot = 'Boot',
    Loading = 'Loading',
    MainMenu = 'MainMenu',
    LevelSelect = 'LevelSelect',
    Gameplay = 'Gameplay',
    DailyStreak = 'DailyStreak',
}


const ALLOWED_TRANSITIONS: Readonly<Record<AppState, readonly AppState[]>> = {
    [AppState.Boot]: [AppState.Loading],
    [AppState.Loading]: [AppState.MainMenu, AppState.Gameplay],
    [AppState.MainMenu]: [AppState.LevelSelect, AppState.Gameplay, AppState.DailyStreak],
    [AppState.LevelSelect]: [AppState.Gameplay, AppState.MainMenu],
    [AppState.Gameplay]: [AppState.LevelSelect, AppState.MainMenu, AppState.DailyStreak],
    [AppState.DailyStreak]: [AppState.MainMenu, AppState.Gameplay],
};

export function canTransition(from: AppState, to: AppState): boolean {
    return ALLOWED_TRANSITIONS[from].indexOf(to) >= 0;
}
