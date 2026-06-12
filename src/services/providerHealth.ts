import axios from 'axios';

export interface ProviderStatus {
    crafatar: boolean;
    minotar: boolean;
    lastChecked: number;
}

let cachedStatus: ProviderStatus | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Using a known UUID (Steve) for health checks to ensure the service is actually rendering
const STEVE_UUID = '8667ba71-b85a-4004-af54-457a9734eed7';

export async function getProviderStatus(): Promise<ProviderStatus> {
    const now = Date.now();

    if (cachedStatus && (now - cachedStatus.lastChecked) < CACHE_TTL) {
        return cachedStatus;
    }

    const [crafatar, minotar] = await Promise.all([
        checkCrafatar(),
        checkMinotar()
    ]);

    cachedStatus = {
        crafatar,
        minotar,
        lastChecked: now
    };

    return cachedStatus;
}

async function checkCrafatar(): Promise<boolean> {
    try {
        // Checking the actual render endpoint as requested
        const response = await axios.get(`https://crafatar.com/renders/body/${STEVE_UUID}`, { timeout: 5000 });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

async function checkMinotar(): Promise<boolean> {
    try {
        // Checking the actual render endpoint
        const response = await axios.get(`https://minotar.net/armor/body/${STEVE_UUID}/100.png`, { timeout: 5000 });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}
