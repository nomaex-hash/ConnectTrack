
export function toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    return `${year}-${month}-${day}`;
}


function pad2(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
}

export function today(): string {
    return toLocalDateString(new Date());
}


export function daysBetween(from: string, to: string): number {
    const a = parseLocalDate(from);
    const b = parseLocalDate(to);
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function parseLocalDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}


export function msUntilEndOfDay(now: Date = new Date()): number {
    const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        0,
    );
    return nextMidnight.getTime() - now.getTime();
}

export function weekdayOf(date: string): number {
    return parseLocalDate(date).getDay();
}

export function addDays(date: string, n: number): string {
    const d = parseLocalDate(date);
    d.setDate(d.getDate() + n);
    return toLocalDateString(d);
}

export function formatDayMonth(date: Date = new Date()): string {
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
}
