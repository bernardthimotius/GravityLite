import { useEffect, useRef } from 'react';
import { useConfigStore } from '../../stores/useConfigStore';
import { useAccountStore } from '../../stores/useAccountStore';

function BackgroundTaskRunner() {
    const { config } = useConfigStore();
    const { refreshAllQuotas } = useAccountStore();

    const prevAutoRefreshRef = useRef(false);
    const prevAutoSyncRef = useRef(false);

    useEffect(() => {
        if (!config) return;

        let intervalId: ReturnType<typeof setTimeout> | null = null;
        const { auto_refresh, refresh_interval } = config;

        if (auto_refresh && !prevAutoRefreshRef.current) {
            refreshAllQuotas();
        }
        prevAutoRefreshRef.current = auto_refresh;

        if (auto_refresh && refresh_interval > 0) {
            intervalId = setInterval(() => {
                refreshAllQuotas();
            }, Math.min(refresh_interval * 60 * 1000, 2147483647));
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [config?.auto_refresh, config?.refresh_interval]);

    useEffect(() => {
        if (!config) return;

        let intervalId: ReturnType<typeof setTimeout> | null = null;
        const { auto_sync, sync_interval } = config;
        const { syncAccountFromDb } = useAccountStore.getState();

        if (auto_sync && !prevAutoSyncRef.current) {
            syncAccountFromDb();
        }
        prevAutoSyncRef.current = auto_sync;

        if (auto_sync && sync_interval > 0) {
            intervalId = setInterval(() => {
                syncAccountFromDb();
            }, Math.min(sync_interval * 60 * 1000, 2147483647));
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [config?.auto_sync, config?.sync_interval]);

    return null;
}

export default BackgroundTaskRunner;
