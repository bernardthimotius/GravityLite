import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { request } from '../../utils/request';
import { showToast } from '../common/ToastContainer';
import { Trash2, Power } from 'lucide-react';
import { ProxyPoolConfig, ProxyEntry } from '../../types/config';
import ProxyList from './proxy/ProxyList';
import ProxyEditModal from './proxy/ProxyEditModal';
import BatchImportModal from './proxy/BatchImportModal';
import ProxyBindingManager from './proxy/ProxyBindingManager';
import { useAccountStore } from '../../stores/useAccountStore';

interface ProxyPoolSettingsProps {
    config: ProxyPoolConfig;
    onChange: (config: ProxyPoolConfig, silent?: boolean) => void;
}

export default function ProxyPoolSettings({ config, onChange }: ProxyPoolSettingsProps) {
    const { t } = useTranslation();
    const { accounts, fetchAccounts } = useAccountStore();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
    const [isBindingManagerOpen, setIsBindingManagerOpen] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [accountBindings, setAccountBindings] = useState<Record<string, string>>({});
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Fetch bindings and accounts on mount
    useEffect(() => {
        fetchBindings();
        fetchAccounts();
    }, []);

    // Refresh bindings when manager closes
    useEffect(() => {
        if (!isBindingManagerOpen) {
            fetchBindings();
        }
    }, [isBindingManagerOpen]);

    // [FIX] Polling for proxy pool status
    // Now only updates volatile status (is_healthy, latency) to avoid race condition regressions
    useEffect(() => {
        let interval: any;
        if (config.enabled) { // Only poll if proxy pool is enabled
            interval = setInterval(async () => {
                try {
                    const liveConfig = await request<ProxyPoolConfig>('get_proxy_pool_config');
                    if (liveConfig && liveConfig.proxies) {
                        // Create a map for quick lookups
                        const liveMap = new Map(liveConfig.proxies.map(p => [p.id, p]));

                        // Check if any status actually changed
                        let hasChanges = false;
                        const updatedProxies = config.proxies.map(p => {
                            const live = liveMap.get(p.id);
                            if (live && (live.is_healthy !== p.is_healthy || live.latency !== p.latency || live.last_check_time !== p.last_check_time)) {
                                hasChanges = true;
                                return { ...p, is_healthy: live.is_healthy, latency: live.latency, last_check_time: live.last_check_time };
                            }
                            return p;
                        });

                        if (hasChanges) {
                            // Only update volatile status, DO NOT trigger heavy onChange which saves to disk
                            // This internal change will eventually be captured by next manual save or 
                            // simply keep the UI fresh without risking rolling back user's structural changes (add/delete)
                            onChange({ ...config, proxies: updatedProxies }, true); // Pass 'true' as silent flag if onChange supports it, or use a separate state
                        }
                    }
                } catch (e) {
                    // Ignore if service not running or other errors
                    console.error('Failed to poll proxy pool config:', e);
                }
            }, 5000); // Poll every 5s
        }
        return () => clearInterval(interval);
    }, [config.enabled, config.proxies]); // Depend on config.enabled and config.proxies to re-evaluate polling

    const fetchBindings = async () => {
        try {
            const bindings = await request<Record<string, string>>('get_all_account_bindings');
            if (bindings) setAccountBindings(bindings);
        } catch (e) {
            console.error('Fetch bindings failed:', e);
        }
    };

    const safeConfig: ProxyPoolConfig = {
        enabled: config?.enabled ?? false,
        proxies: config?.proxies ?? [],
        health_check_interval: config?.health_check_interval ?? 300,
        auto_failover: config?.auto_failover ?? true,
        strategy: config?.strategy ?? 'priority',
    };

    const handleUpdateProxies = (proxies: ProxyEntry[]) => {
        onChange({ ...safeConfig, proxies });
    };

    const handleAddProxy = (entry: ProxyEntry) => {
        onChange({
            ...safeConfig,
            proxies: [...safeConfig.proxies, entry]
        });
    };

    const handleBatchImport = async (newProxies: ProxyEntry[]) => {
        const updatedProxies = [...safeConfig.proxies, ...newProxies];
        await onChange({
            ...safeConfig,
            proxies: updatedProxies
        });

        // Auto-trigger test after import is fully committed
        handleTestAll();
    };

    const handleBatchDelete = () => {
        if (selectedIds.size === 0) return;
        if (confirm(t('settings.proxy_pool.confirm_batch_delete', 'Are you sure you want to delete selected proxies?'))) {
            const newProxies = safeConfig.proxies.filter(p => !selectedIds.has(p.id));
            onChange({ ...safeConfig, proxies: newProxies });
            setSelectedIds(new Set());
            showToast(t('common.deleted', 'Deleted successfully'), 'success');
        }
    };

    const handleBatchToggleEnabled = (enabled: boolean) => {
        if (selectedIds.size === 0) return;
        const newProxies = safeConfig.proxies.map(p =>
            selectedIds.has(p.id) ? { ...p, enabled } : p
        );
        onChange({ ...safeConfig, proxies: newProxies });
        showToast(t(enabled ? 'common.enabled' : 'common.disabled', enabled ? 'Enabled' : 'Disabled'), 'success');
    };

    const handleTestAll = async () => {
        setIsTesting(true);
        try {
            const liveConfig = await request<ProxyPoolConfig>('check_proxy_health');
            if (liveConfig && liveConfig.proxies) {
                // [FIX] Use incremental merge to prevent race condition rollbacks
                const liveMap = new Map(liveConfig.proxies.map(p => [p.id, p]));

                const updatedProxies = config.proxies.map(p => {
                    const live = liveMap.get(p.id);
                    if (live) {
                        return {
                            ...p,
                            is_healthy: live.is_healthy,
                            latency: live.latency,
                            last_check_time: live.last_check_time
                        };
                    }
                    return p;
                });

                // Update local UI state silently (syncing health stats only)
                onChange({ ...config, proxies: updatedProxies }, true);
            }
            showToast(t('settings.proxy_pool.test_completed', 'Health check completed'), 'success');
        } catch (error) {
            console.error('Test all failed:', error);
            showToast(t('settings.proxy_pool.test_failed', 'Health check failed'), 'error');
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Consolidated Header & Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-base-200 dark:bg-base-100">
                {/* Left: Component Identity & Feature Toggle */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 pr-3 border-r border-gray-100 dark:border-base-200">
                        <h3 className="text-xs font-black text-gray-900 dark:text-white whitespace-nowrap uppercase tracking-wider">
                            {t('settings.proxy_pool.title', 'Proxy Pool')}
                        </h3>
                        <label className="relative inline-flex items-center cursor-pointer ml-1">
                            <input
                                type="checkbox"
                                checked={safeConfig.enabled}
                                onChange={e => onChange({ ...safeConfig, enabled: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-sky-300 dark:peer-checked:bg-sky-400"></div>
                        </label>
                    </div>

                    {/* Middle: Configuration Parameters (Strategy & Interval) */}
                    <div className="flex flex-wrap items-center gap-2">

                        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-base-200 dark:bg-base-200/30">
                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-400">Strategy</span>
                            <select
                                value={safeConfig.strategy}
                                onChange={e => onChange({ ...safeConfig, strategy: e.target.value as any })}
                                className="bg-transparent p-0 pr-6 text-[10px] font-black uppercase tracking-tight text-gray-700 outline-none dark:text-gray-300"
                            >
                                <option value="priority">{t('settings.proxy_pool.strategy_priority', 'Priority')}</option>
                                <option value="round_robin">{t('settings.proxy_pool.strategy_round_robin', 'Round Robin')}</option>
                                <option value="random">{t('settings.proxy_pool.strategy_random', 'Random')}</option>
                                <option value="least_connections">{t('settings.proxy_pool.strategy_least_connections', 'Least Connections')}</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-base-200 dark:bg-base-200/30">
                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-400">Interval</span>
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    defaultValue={safeConfig.health_check_interval}
                                    onBlur={e => {
                                        const val = parseInt(e.target.value) || 60;
                                        if (val !== safeConfig.health_check_interval) {
                                            onChange({ ...safeConfig, health_check_interval: val });
                                        }
                                    }}
                                    className="w-10 bg-transparent p-0 text-right text-[10px] font-black text-gray-700 outline-none dark:text-gray-300"
                                />
                                <span className="text-[9px] text-gray-400 font-black uppercase tracking-tighter">{t('settings.proxy_pool.seconds', 'Sec')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Actions or Selection Toolbar */}
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 ? (
                        <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 animate-in zoom-in-95 duration-200 dark:border-base-200 dark:bg-base-200/30">
                            <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 mr-2 uppercase tracking-tight">
                                {selectedIds.size} {t('common.selected', 'Selected')}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleBatchToggleEnabled(true)}
                                    className="p-1.5 text-gray-500 hover:bg-white hover:text-gray-900 dark:hover:bg-base-100 rounded-lg transition-all active:scale-90"
                                    title={t('common.enable', 'Enable')}
                                >
                                    <Power size={14} />
                                </button>
                                <button
                                    onClick={() => handleBatchToggleEnabled(false)}
                                    className="p-1.5 text-gray-400 hover:bg-white hover:text-gray-700 dark:hover:bg-base-100 rounded-lg transition-all active:scale-90"
                                    title={t('common.disable', 'Disable')}
                                >
                                    <Power size={14} className="opacity-50" />
                                </button>
                                <button
                                    onClick={handleBatchDelete}
                                    className="p-1.5 text-rose-500 hover:bg-white dark:hover:bg-base-100 rounded-lg transition-all active:scale-90"
                                    title={t('common.delete', 'Delete')}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <div className="w-px h-4 bg-gray-200 dark:bg-base-300 mx-1"></div>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="text-[10px] font-black text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 uppercase px-2 py-1"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleTestAll}
                                    disabled={isTesting}
                                    className={`rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900 dark:border-base-200 dark:bg-base-100 dark:text-gray-400 dark:hover:bg-base-200 dark:hover:text-white ${isTesting ? 'opacity-50' : 'active:scale-95'}`}
                                    title={t('settings.proxy_pool.test_all', 'Test All')}
                                >
                                    {isTesting ? t('common.loading', 'Loading') : t('settings.proxy_pool.test_all', 'Test')}
                                </button>
                                <button
                                    onClick={() => setIsBindingManagerOpen(true)}
                                    className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900 dark:border-base-200 dark:bg-base-100 dark:text-gray-400 dark:hover:bg-base-200 dark:hover:text-white active:scale-95"
                                    title={t('settings.proxy_pool.binding_manager', 'Manage Bindings')}
                                >
                                    {t('settings.proxy_pool.binding_manager', 'Bindings')}
                                </button>
                                <button
                                    onClick={() => setIsBatchImportOpen(true)}
                                    className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900 dark:border-base-200 dark:bg-base-100 dark:text-gray-400 dark:hover:bg-base-200 dark:hover:text-white active:scale-95"
                                >
                                    {t('settings.proxy_pool.batch_import', 'Import')}
                                </button>
                                <button
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="rounded-xl bg-gray-950 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:bg-gray-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white active:scale-95"
                                >
                                    {t('settings.proxy_pool.add_proxy', 'Add')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Proxy List - Always visible, with status context */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 dark:border-base-200 dark:bg-base-100">
                {!safeConfig.enabled && (
                    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center border-b border-amber-100 bg-amber-50/80 px-3 py-1 backdrop-blur-[2px] dark:border-amber-900/20 dark:bg-amber-950/20">
                        <span className="text-[10px] font-black text-amber-600/80 dark:text-amber-400/80 uppercase tracking-[0.2em] pointer-events-none">
                            {t('settings.proxy_pool.inactive_notice', 'Proxy Pool Inactive')}
                        </span>
                    </div>
                )}
                <div className={!safeConfig.enabled ? 'pt-6 opacity-60' : ''}>
                    <ProxyList
                        proxies={safeConfig.proxies}
                        onUpdate={handleUpdateProxies}
                        accountBindings={accountBindings}
                        accounts={accounts}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                        isTesting={isTesting}
                    />
                </div>
            </div>

            {isAddModalOpen && (
                <ProxyEditModal
                    isOpen={isAddModalOpen}
                    onClose={() => setIsAddModalOpen(false)}
                    onSave={handleAddProxy}
                    isEditing={false}
                />
            )}

            {isBatchImportOpen && (
                <BatchImportModal
                    isOpen={isBatchImportOpen}
                    onClose={() => setIsBatchImportOpen(false)}
                    onImport={handleBatchImport}
                />
            )}

            {isBindingManagerOpen && (
                <ProxyBindingManager
                    isOpen={isBindingManagerOpen}
                    onClose={() => setIsBindingManagerOpen(false)}
                    proxies={safeConfig.proxies}
                />
            )}
        </div>
    );
}
