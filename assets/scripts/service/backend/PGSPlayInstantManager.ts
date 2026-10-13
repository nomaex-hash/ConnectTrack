import { BackendConfig } from '../../config/BackendConfig';
import { FBInstantManagerHolder } from '../platform/FBInstantManagerHolder';
import { IPGSPlayInstantManager } from './IPGSPlayInstantManager';

interface RequestInit {
    readonly method: 'GET' | 'POST' | 'PUT';
    readonly body?: string;
}


export class PGSPlayInstantManager implements IPGSPlayInstantManager {
    isAvailable(): boolean {
        return true;
    }

    get<T>(path: string, query?: Record<string, string>): Promise<T> {
        return this.request<T>(this.buildUrl(path, query), { method: 'GET' });
    }

    post<T>(path: string, body: unknown): Promise<T> {
        return this.request<T>(this.buildUrl(path), { method: 'POST', body: JSON.stringify(body) });
    }

    put<T>(path: string, body: unknown): Promise<T> {
        return this.request<T>(this.buildUrl(path), { method: 'PUT', body: JSON.stringify(body) });
    }

    private buildUrl(path: string, query?: Record<string, string>): string {
        const url = `${BackendConfig.baseUrl}${path}`;
        if (!query) return url;

        const params = new URLSearchParams(query).toString();
        return params ? `${url}?${params}` : url;
    }

    private async request<T>(url: string, init: RequestInit): Promise<T> {
        const signed = await FBInstantManagerHolder.current.getSignedPlayerInfo();
        if (!signed) {
            throw new Error(`[PGSPlayInstantManager] Không lấy được chữ ký người chơi — không thể gọi ${url}.`);
        }

        const response = await fetch(url, {
            method: init.method,
            headers: {
                'Content-Type': 'application/json',
                'x-signature': signed.signature,
                'x-id': BackendConfig.gameId,
            },
            body: init.body,
        });

        if (!response.ok) {
            throw new Error(`[PGSPlayInstantManager] ${init.method} ${url} thất bại: HTTP ${response.status}`);
        }
        return (await response.json()) as T;
    }
}
