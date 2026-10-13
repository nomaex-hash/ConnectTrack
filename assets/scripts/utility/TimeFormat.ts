
export function formatClock(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;

    const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

    return hours > 0
        ? `${hours}:${pad(minutes)}:${pad(seconds)}`
        : `${minutes}:${pad(seconds)}`;
}


export function formatCountdown(msRemaining: number): string {
    return formatClock(Math.ceil(Math.max(0, msRemaining) / 1000));
}

export function formatElapsed(secondsElapsed: number): string {
    return formatClock(secondsElapsed);
}
