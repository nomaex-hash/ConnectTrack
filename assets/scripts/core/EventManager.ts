type EventHandler<T = unknown> = (payload: T) => void;

interface Subscription {
    readonly handler: EventHandler;
    readonly target: object | undefined;
}


export class EventManager {
    private static _instance: EventManager | null = null;

    static get instance(): EventManager {
        if (!this._instance) {
            this._instance = new EventManager();
        }
        return this._instance;
    }

    private readonly listeners: Map<string, Subscription[]> = new Map();

    private constructor() {}

    on<T = unknown>(eventName: string, handler: EventHandler<T>, target?: object): void {
        let subs = this.listeners.get(eventName);
        if (!subs) {
            subs = [];
            this.listeners.set(eventName, subs);
        }
        const duplicated = subs.some((s) => s.handler === handler && s.target === target);
        if (duplicated) return;
        subs.push({ handler: handler as EventHandler, target });
    }

    off<T = unknown>(eventName: string, handler: EventHandler<T>, target?: object): void {
        const subs = this.listeners.get(eventName);
        if (!subs) return;
        const index = subs.findIndex((s) => s.handler === handler && s.target === target);
        if (index >= 0) subs.splice(index, 1);
        if (subs.length === 0) this.listeners.delete(eventName);
    }

    targetOff(target: object): void {
        for (const [eventName, subs] of this.listeners) {
            const remaining = subs.filter((s) => s.target !== target);
            if (remaining.length === 0) this.listeners.delete(eventName);
            else if (remaining.length !== subs.length) this.listeners.set(eventName, remaining);
        }
    }

    emit<T = unknown>(eventName: string, payload: T): void {
        const subs = this.listeners.get(eventName);
        if (!subs || subs.length === 0) return;
     
        for (const sub of subs.slice()) {
            sub.handler(payload);
        }
    }
}
