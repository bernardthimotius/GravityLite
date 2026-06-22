import { useState, useEffect } from 'react';
import { Save, User, RefreshCw, LayoutDashboard, Users, Network, Activity, BarChart3, Settings as SettingsIcon, CheckCircle2, Globe, ExternalLink } from 'lucide-react';
import { request as invoke } from '../utils/request';
import { open } from '@tauri-apps/plugin-dialog';
import { useConfigStore } from '../stores/useConfigStore';
import { AppConfig } from '../types/config';
import ModalDialog from '../components/common/ModalDialog';
import { showToast } from '../components/common/ToastContainer';
// import SmartWarmup from '../components/settings/SmartWarmup';
import PinnedQuotaModels from '../components/settings/PinnedQuotaModels';
import { useDebugConsole } from '../stores/useDebugConsole';

import { useTranslation } from 'react-i18next';
import { isTauri } from '../utils/env';
import packageJson from '../../package.json';

import DebugConsole from '../components/debug/DebugConsole';
import ProxyPoolSettings from '../components/settings/ProxyPoolSettings';


function Settings() {
    const { t, i18n } = useTranslation();
    const { config, loadConfig, saveConfig, updateLanguage, updateTheme } = useConfigStore();
    const { enable, disable, isEnabled } = useDebugConsole();
    const [activeTab, setActiveTab] = useState<'general' | 'account' | 'proxy' | 'advanced' | 'debug' | 'about'>('general');
    const [formData, setFormData] = useState<AppConfig>({
        language: 'zh',
        theme: 'system',
        auto_refresh: false,
        refresh_interval: 15,
        auto_sync: false,
        sync_interval: 5,
        proxy: {
            enabled: false,
            port: 8080,
            api_key: '',
            auto_start: false,
            request_timeout: 120,
            enable_logging: false,
            upstream_proxy: {
                enabled: false,
                url: ''
            },
            debug_logging: {
                enabled: false,
                output_dir: undefined
            } as { enabled: boolean; output_dir?: string },
            proxy_pool: {
                enabled: false,
                proxies: [],
                health_check_interval: 300,
                auto_failover: true,
                strategy: 'priority',
                account_bindings: {}
            }
        },
        scheduled_warmup: {
            enabled: false,
            monitored_models: []
        },
        quota_protection: {
            enabled: false,
            threshold_percentage: 10,
            monitored_models: []
        },
        pinned_quota_models: {
            models: ['gemini-3.1-pro-high', 'gemini-3-flash', 'gemini-3.1-flash-image', 'claude-opus-4-6-thinking']
        },
        cloudflared: {
            enabled: false,
            mode: 'quick',
            port: 7860,
            use_http2: true
        },
        circuit_breaker: {
            enabled: false,
            backoff_steps: [30, 60, 120, 300, 600]
        },
        hidden_menu_items: [],  // 菜单显示设置：默认不隐藏任何菜单项

    });

    // Dialog state
    // Dialog state
    const [isClearLogsOpen, setIsClearLogsOpen] = useState(false);
    const [dataDirPath, setDataDirPath] = useState<string>('~/.antigravity_tools/');

    // Antigravity cache clearing state
    const [isClearCacheOpen, setIsClearCacheOpen] = useState(false);
    const [cachePaths, setCachePaths] = useState<string[]>([]);
    const [isClearingCache, setIsClearingCache] = useState(false);

    useEffect(() => {
        loadConfig();

        // 获取真实数据目录路径
        invoke<string>('get_data_dir_path')
            .then(path => setDataDirPath(path))
            .catch(err => console.error('Failed to get data dir:', err));

        // 获取真实的开机自启状态
        invoke<boolean>('is_auto_launch_enabled')
            .then(enabled => {
                setFormData(prev => ({ ...prev, auto_launch: enabled }));
            })
            .catch(err => console.error('Failed to get auto launch status:', err));

    }, [loadConfig]);

    useEffect(() => {
        if (config) {
            setFormData(config);
        }
    }, [config]);

    // 删除自动启用调试控制台的逻辑 - 改为用户手动控制

    const handleSave = async () => {
        try {
            // 校验：如果启用了上游代理但没有填写地址，给出提示
            const proxyEnabled = formData.proxy?.upstream_proxy?.enabled;
            const proxyUrl = formData.proxy?.upstream_proxy?.url?.trim();
            if (proxyEnabled && !proxyUrl) {
                showToast(t('proxy.config.upstream_proxy.validation_error'), 'error');
                return;
            }

            await saveConfig(formData);
            showToast(t('common.saved'), 'success');

            // 如果修改了代理配置，提示用户需要重启
            if (proxyEnabled && proxyUrl) {
                showToast(t('proxy.config.upstream_proxy.restart_hint'), 'info');
            }
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const confirmClearLogs = async () => {
        try {
            await invoke('clear_log_cache');
            showToast(t('settings.advanced.logs_cleared'), 'success');
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
        setIsClearLogsOpen(false);
    };

    const handleOpenDataDir = async () => {
        try {
            await invoke('open_data_folder');
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleSelectExportPath = async () => {
        try {
            // @ts-ignore
            const selected = await open({
                directory: true,
                multiple: false,
                title: t('settings.advanced.export_path'),
            });
            if (selected && typeof selected === 'string') {
                setFormData({ ...formData, default_export_path: selected });
            }
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleSelectAntigravityPath = async () => {
        try {
            const selected = await open({
                directory: false,
                multiple: false,
                title: t('settings.advanced.antigravity_path_select'),
            });
            if (selected && typeof selected === 'string') {
                setFormData({ ...formData, antigravity_executable: selected });
            }
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleSelectAntigravityIdePath = async () => {
        try {
            const selected = await open({
                directory: false,
                multiple: false,
                title: t('settings.advanced.antigravity_ide_path_select', 'Select Antigravity IDE Executable'),
            });
            if (selected && typeof selected === 'string') {
                setFormData({ ...formData, antigravity_ide_executable: selected });
            }
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleSelectDebugLogDir = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: t('settings.advanced.debug_log_dir_select'),
            });
            if (selected && typeof selected === 'string') {
                setFormData({
                    ...formData,
                    proxy: {
                        ...formData.proxy,
                        debug_logging: {
                            enabled: formData.proxy?.debug_logging?.enabled ?? false,
                            output_dir: selected,
                        },
                    },
                });
            }
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleDetectAntigravityPath = async () => {
        try {
            const command = isTauri() ? 'get_antigravity_path' : 'get_antigravity_path'; // 后端已统一
            const path = await invoke<string>(command, { bypassConfig: true });
            setFormData({ ...formData, antigravity_executable: path });
            showToast(t('settings.advanced.antigravity_path_detected'), 'success');
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    // Handle opening cache clear dialog
    const handleOpenClearCacheDialog = async () => {
        try {
            const paths = await invoke<string[]>('get_antigravity_cache_paths');
            setCachePaths(paths);
            setIsClearCacheOpen(true);
        } catch (error) {
            // If no cache paths found, still allow opening the dialog
            setCachePaths([]);
            setIsClearCacheOpen(true);
        }
    };

    // Handle clearing Antigravity cache
    const confirmClearAntigravityCache = async () => {
        setIsClearingCache(true);
        try {
            const result = await invoke<{
                cleared_paths: string[];
                total_size_freed: number;
                errors: string[];
            }>('clear_antigravity_cache');

            const sizeMB = (result.total_size_freed / 1024 / 1024).toFixed(2);

            if (result.cleared_paths.length > 0) {
                showToast(t('settings.advanced.cache_cleared_success', { size: sizeMB }), 'success');
            } else if (result.errors.length > 0) {
                showToast(`${t('common.error')}: ${result.errors[0]}`, 'error');
            } else {
                showToast(t('settings.advanced.cache_not_found'), 'info');
            }
        } catch (error) {
            showToast(`${t('common.error')}: ${error}`, 'error');
        } finally {
            setIsClearingCache(false);
            setIsClearCacheOpen(false);
        }
    };

    const handleOpenExternal = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-5 space-y-4 max-w-7xl mx-auto">
                <div className="flex justify-between items-center border-b border-gray-250 dark:border-base-200 pb-3">
                    <div className="flex items-center gap-0.5 border border-gray-200 dark:border-base-200 bg-gray-50 dark:bg-base-200 p-0.5 rounded-md w-fit">
                        <button
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === 'general'
                                ? 'bg-white dark:bg-base-100 text-gray-950 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            onClick={() => setActiveTab('general')}
                        >
                            {t('settings.tabs.general')}
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === 'account'
                                ? 'bg-white dark:bg-base-100 text-gray-950 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            onClick={() => setActiveTab('account')}
                        >
                            {t('settings.tabs.account')}
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === 'proxy'
                                ? 'bg-white dark:bg-base-100 text-gray-950 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            onClick={() => setActiveTab('proxy')}
                        >
                            {t('settings.tabs.proxy')}
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === 'advanced'
                                ? 'bg-white dark:bg-base-100 text-gray-950 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            onClick={() => setActiveTab('advanced')}
                        >
                            {t('settings.tabs.advanced')}
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === 'debug'
                                ? 'bg-white dark:bg-base-100 text-gray-950 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            onClick={() => setActiveTab('debug')}
                        >
                            {t('settings.tabs.debug')}
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === 'about'
                                ? 'bg-white dark:bg-base-100 text-gray-950 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            onClick={() => setActiveTab('about')}
                        >
                            {t('settings.tabs.about')}
                        </button>
                    </div>

                    <button
                        className="px-3 py-1.5 bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white text-xs font-semibold rounded-md transition-colors flex items-center gap-2 shadow-sm active:scale-[0.98]"
                        onClick={handleSave}
                    >
                        <Save className="w-3.5 h-3.5" />
                        {t('settings.save')}
                    </button>
                </div>

                {/* 设置表单 */}
                <div className="bg-white dark:bg-base-100 rounded-lg p-5 border border-gray-200 dark:border-base-200">
                    {/* 通用设置 */}
                    {activeTab === 'general' && (
                        <div className="space-y-4">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{t('settings.general.title')}</h2>

                            {/* 语言选择 */}
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">{t('settings.general.language')}</label>
                                <select
                                    className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded bg-white dark:bg-base-200 text-xs text-gray-900 dark:text-base-content focus:ring-1 focus:ring-zinc-950 focus:border-transparent outline-none"
                                    value={formData.language}
                                    onChange={(e) => {
                                        const newLang = e.target.value;
                                        setFormData({ ...formData, language: newLang });
                                        i18n.changeLanguage(newLang);
                                        updateLanguage(newLang);
                                    }}
                                >
                                    <option value="zh">简体中文</option>
                                    <option value="zh-TW">繁體中文</option>
                                    <option value="en">English</option>
                                    <option value="ja">日本語</option>
                                    <option value="tr">Türkçe</option>
                                    <option value="vi">Tiếng Việt</option>
                                    <option value="pt">Português</option>
                                    <option value="ko">한국어</option>
                                    <option value="ru">Русский</option>
                                    <option value="ar">العربية</option>
                                </select>
                            </div>

                            {/* 主题选择 */}
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">{t('settings.general.theme')}</label>
                                <select
                                    className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded bg-white dark:bg-base-200 text-xs text-gray-900 dark:text-base-content focus:ring-1 focus:ring-zinc-950 focus:border-transparent outline-none"
                                    value={formData.theme}
                                    onChange={(e) => {
                                        const newTheme = e.target.value;
                                        setFormData({ ...formData, theme: newTheme });
                                        updateTheme(newTheme);
                                    }}
                                >
                                    <option value="light">{t('settings.general.theme_light')}</option>
                                    <option value="dark">{t('settings.general.theme_dark')}</option>
                                    <option value="system">{t('settings.general.theme_system')}</option>
                                </select>
                            </div>

                            {/* 开机自动启动 */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('settings.general.auto_launch')}</label>
                                    {!isTauri() && (
                                        <span className="text-[10px] text-gray-400">
                                            {t('settings.web_mode_limitation', '(Web 模式不支持)')}
                                        </span>
                                    )}
                                </div>
                                <select
                                    className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded bg-white dark:bg-base-200 text-xs text-gray-900 dark:text-base-content focus:ring-1 focus:ring-zinc-950 focus:border-transparent outline-none"
                                    value={formData.auto_launch ? 'enabled' : 'disabled'}
                                    onChange={async (e) => {
                                        const enabled = e.target.value === 'enabled';
                                        try {
                                            await invoke('toggle_auto_launch', { enable: enabled });
                                            setFormData({ ...formData, auto_launch: enabled });
                                            showToast(enabled ? t('settings.general.auto_launch_enabled') : t('settings.general.auto_launch_disabled'), 'success');
                                        } catch (error) {
                                            showToast(`${t('common.error')}: ${error}`, 'error');
                                        }
                                    }}
                                >
                                    <option value="disabled">{t('settings.general.auto_launch_disabled')}</option>
                                    <option value="enabled" disabled={!isTauri()}>{t('settings.general.auto_launch_enabled')}</option>
                                </select>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{t('settings.general.auto_launch_desc')}</p>
                            </div>

                            {/* 菜单显示设置 */}
                            <div className="border-t border-gray-250 dark:border-base-200 pt-4 mt-4">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">{t('settings.menu.title')}</h3>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3">
                                    {t('settings.menu.desc')}
                                </p>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                    {[
                                        { path: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
                                        { path: '/accounts', label: t('nav.accounts'), icon: Users },
                                        { path: '/api-proxy', label: t('nav.proxy'), icon: Network },
                                        { path: '/monitor', label: t('nav.call_records'), icon: Activity },
                                        { path: '/token-stats', label: t('nav.token_stats'), icon: BarChart3 },
                                        { path: '/user-token', label: t('nav.user_token', 'User Tokens'), icon: Users },
                                        { path: '/settings', label: t('nav.settings'), icon: SettingsIcon },
                                    ].map((item) => {
                                        const hiddenItems = formData.hidden_menu_items || [];
                                        const isVisible = !hiddenItems.includes(item.path);
                                        const isSettings = item.path === '/settings';

                                        return (
                                            <div
                                                key={item.path}
                                                onClick={async () => {
                                                    if (!isSettings) {
                                                        const originalConfig = { ...formData };
                                                        const hiddenItems = formData.hidden_menu_items || [];
                                                        const newHiddenItems = isVisible
                                                            ? [...hiddenItems, item.path]
                                                            : hiddenItems.filter(p => p !== item.path);

                                                        // 乐观更新 UI
                                                        const newConfig = {
                                                            ...formData,
                                                            hidden_menu_items: newHiddenItems
                                                        };
                                                        setFormData(newConfig);

                                                        // 尝试保存
                                                        try {
                                                            await saveConfig(newConfig);
                                                        } catch (error) {
                                                            // 保存失败，回滚到原始快照
                                                            setFormData(originalConfig);
                                                            showToast(`保存失败，已恢复设置: ${error}`, 'error');
                                                        }
                                                    }
                                                }}
                                                className={`
                                                    relative flex flex-col items-center justify-center gap-2 p-3 rounded border transition-all cursor-pointer select-none
                                                    ${isSettings
                                                        ? 'bg-gray-50 dark:bg-base-200 border-gray-200 dark:border-base-300 opacity-50 cursor-not-allowed'
                                                        : isVisible
                                                            ? 'bg-gray-50 dark:bg-base-200 border-zinc-950 dark:border-zinc-200 shadow-sm'
                                                            : 'bg-white dark:bg-base-100 border-gray-205 dark:border-base-300 hover:border-gray-300 dark:hover:border-base-content/20 text-gray-500'
                                                    }
                                                `}
                                            >
                                                {/* 选中标记 */}
                                                {isVisible && (
                                                    <div className="absolute top-1.5 right-1.5 text-zinc-950 dark:text-zinc-200">
                                                        <CheckCircle2 size={13} />
                                                    </div>
                                                )}

                                                {isSettings && (
                                                    <div className="absolute top-1.5 right-1.5 text-[9px] font-semibold text-gray-400 bg-gray-200 dark:bg-base-300 px-1 rounded">
                                                        {t('settings.menu.required')}
                                                    </div>
                                                )}

                                                <div className={`
                                                    p-2 rounded transition-colors
                                                    ${isVisible
                                                        ? 'bg-gray-200/50 dark:bg-base-300 text-gray-900 dark:text-gray-100'
                                                        : 'bg-gray-100 dark:bg-base-200 text-gray-400 dark:text-base-content/50'
                                                    }
                                                `}>
                                                    <item.icon size={18} />
                                                </div>

                                                <span className={`font-semibold text-xs ${isVisible ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
                                                    {item.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                                    {t('settings.menu.selected_items_note')}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 账号设置 */}
                    {activeTab === 'account' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* 自动刷新配额 */}
                            <div className="bg-white dark:bg-base-100 rounded-lg p-4 border border-gray-200 dark:border-base-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-gray-50 dark:bg-base-250 flex items-center justify-center text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-base-300">
                                            <RefreshCw size={15} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold text-gray-900 dark:text-gray-150">{t('settings.account.auto_refresh')}</div>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{t('settings.account.auto_refresh_desc')}</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                            checked={formData.auto_refresh}
                                            onChange={async (e) => {
                                                const enabled = e.target.checked;
                                                const newConfig = { ...formData, auto_refresh: enabled };
                                                setFormData(newConfig);
                                                try {
                                                    await saveConfig(newConfig);
                                                } catch (error) {
                                                    showToast(`${t('common.error')}: ${error}`, 'error');
                                                }
                                            }}
                                        />
                                    </label>
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-base-200 flex items-center gap-3 animate-in slide-in-from-top-1 duration-200">
                                    <label className="text-[10px] font-bold text-zinc-450 dark:text-zinc-400 uppercase tracking-wider">{t('settings.account.refresh_interval')}</label>
                                    <input
                                        type="number"
                                        className="w-20 px-2 py-1 bg-white dark:bg-base-200 border border-gray-200 dark:border-base-300 rounded text-xs focus:ring-1 focus:ring-zinc-950 focus:border-transparent outline-none text-zinc-950 dark:text-zinc-50 font-mono"
                                        min="1"
                                        max="35791"
                                        value={formData.refresh_interval}
                                        onChange={(e) => setFormData({ ...formData, refresh_interval: isNaN(parseInt(e.target.value)) ? 1 : Math.min(Math.max(parseInt(e.target.value), 1), 35791) })}
                                    />
                                </div>
                            </div>

                            {/* 自动获取当前账号 */}
                            <div className="bg-white dark:bg-base-100 rounded-lg p-4 border border-gray-200 dark:border-base-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-gray-50 dark:bg-base-250 flex items-center justify-center text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-base-300">
                                            <User size={15} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold text-gray-900 dark:text-gray-150">{t('settings.account.auto_sync')}</div>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{t('settings.account.auto_sync_desc')}</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                            checked={formData.auto_sync}
                                            onChange={(e) => setFormData({ ...formData, auto_sync: e.target.checked })}
                                        />
                                    </label>
                                </div>

                                {formData.auto_sync && (
                                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-base-200 flex items-center gap-3 animate-in slide-in-from-top-1 duration-200">
                                        <label className="text-[10px] font-bold text-zinc-450 dark:text-zinc-400 uppercase tracking-wider">{t('settings.account.sync_interval')}</label>
                                        <input
                                            type="number"
                                            className="w-20 px-2 py-1 bg-white dark:bg-base-200 border border-gray-200 dark:border-base-300 rounded text-xs focus:ring-1 focus:ring-zinc-950 focus:border-transparent outline-none text-zinc-950 dark:text-zinc-50 font-mono"
                                            min="1"
                                            max="35791"
                                            value={formData.sync_interval}
                                            onChange={(e) => setFormData({ ...formData, sync_interval: isNaN(parseInt(e.target.value)) ? 1 : Math.min(Math.max(parseInt(e.target.value), 1), 35791) })}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* 配额关注列表 (Pinned Quota Models) */}
                            <div className="bg-white dark:bg-base-100 rounded-lg p-4 border border-gray-200 dark:border-base-200">
                                <PinnedQuotaModels
                                    config={formData.pinned_quota_models}
                                    onChange={(newConfig) => setFormData({
                                        ...formData,
                                        pinned_quota_models: newConfig
                                    })}
                                />
                            </div>
                        </div>
                    )}

                    {/* 高级设置 */}
                    {activeTab === 'advanced' && (
                        <>
                            <div className="space-y-4">
                                {/* 默认导出路径 */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">{t('settings.advanced.export_path')}</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded bg-gray-50 dark:bg-base-200 text-xs text-gray-700 dark:text-gray-400 font-mono outline-none"
                                            value={formData.default_export_path || t('settings.advanced.export_path_placeholder')}
                                            readOnly
                                        />
                                        {formData.default_export_path && (
                                            <button
                                                className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 text-xs text-zinc-950 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-base-200 transition-colors rounded-md font-semibold"
                                                onClick={() => setFormData({ ...formData, default_export_path: undefined })}
                                            >
                                                {t('common.clear')}
                                            </button>
                                        )}
                                        {isTauri() ? (
                                            <button
                                                className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 text-xs text-gray-750 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-base-200 transition-colors font-semibold"
                                                onClick={handleSelectExportPath}
                                            >
                                                {t('settings.advanced.select_btn')}
                                            </button>
                                        ) : (
                                            <span className="self-center text-[10px] text-gray-400 dark:text-gray-500 italic px-2">
                                                {t('settings.web_mode_limitation', '(Web 模式不支持)')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{t('settings.advanced.default_export_path_desc')}</p>
                                </div>

                                {/* 数据目录 */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">{t('settings.advanced.data_dir')}</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded bg-gray-50 dark:bg-base-200 text-xs text-gray-700 dark:text-gray-400 font-mono outline-none"
                                            value={dataDirPath}
                                            readOnly
                                        />
                                        {isTauri() ? (
                                            <button
                                                className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 text-xs text-gray-750 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-base-200 transition-colors font-semibold"
                                                onClick={handleOpenDataDir}
                                            >
                                                {t('settings.advanced.open_btn')}
                                            </button>
                                        ) : (
                                            <span className="self-center text-[10px] text-gray-400 dark:text-gray-500 italic px-2">
                                                {t('settings.web_mode_limitation', '(Web 模式不支持)')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{t('settings.advanced.data_dir_desc')}</p>
                                </div>

                                {/* 反重力程序路径 */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                                        {t('settings.advanced.antigravity_path')}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded bg-white dark:bg-base-200 text-xs text-gray-900 dark:text-base-content font-mono outline-none focus:ring-1 focus:ring-zinc-950 focus:border-transparent"
                                            value={formData.antigravity_executable || ''}
                                            placeholder={t('settings.advanced.antigravity_path_placeholder')}
                                            onChange={(e) => setFormData({ ...formData, antigravity_executable: e.target.value })}
                                        />
                                        {formData.antigravity_executable && (
                                            <button
                                                className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 text-xs text-zinc-950 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-base-200 transition-colors rounded-md font-semibold"
                                                onClick={() => setFormData({ ...formData, antigravity_executable: undefined })}
                                            >
                                                {t('common.clear')}
                                            </button>
                                        )}
                                        <button
                                            className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 text-xs text-gray-755 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-base-200 transition-colors font-semibold"
                                            onClick={handleDetectAntigravityPath}
                                        >
                                            {t('settings.advanced.detect_btn')}
                                        </button>
                                        {isTauri() ? (
                                            <button
                                                className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 text-xs text-gray-750 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-base-200 transition-colors font-semibold"
                                                onClick={handleSelectAntigravityPath}
                                            >
                                                {t('settings.advanced.select_btn')}
                                            </button>
                                        ) : (
                                            <span className="self-center text-[10px] text-gray-400 dark:text-gray-500 italic px-2">
                                                {t('settings.web_mode_limitation', '(Web 模式不支持)')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                                        {t('settings.advanced.antigravity_path_desc')}
                                    </p>
                                </div>

                                {/* Antigravity IDE 程序路径 */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                                        {t('settings.advanced.antigravity_ide_path', 'Antigravity IDE Path')}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded bg-white dark:bg-base-200 text-xs text-gray-900 dark:text-base-content font-mono outline-none focus:ring-1 focus:ring-zinc-950 focus:border-transparent"
                                            value={formData.antigravity_ide_executable || ''}
                                            placeholder={t('settings.advanced.antigravity_ide_path_placeholder', 'D:\\Antigravity\\Antigravity.exe')}
                                            onChange={(e) => setFormData({ ...formData, antigravity_ide_executable: e.target.value })}
                                        />
                                        {formData.antigravity_ide_executable && (
                                            <button
                                                className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 text-xs text-zinc-950 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-base-200 transition-colors rounded-md font-semibold"
                                                onClick={() => setFormData({ ...formData, antigravity_ide_executable: undefined })}
                                            >
                                                {t('common.clear')}
                                            </button>
                                        )}
                                        {isTauri() ? (
                                            <button
                                                className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 text-xs text-gray-750 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-base-200 transition-colors font-semibold"
                                                onClick={handleSelectAntigravityIdePath}
                                            >
                                                {t('settings.advanced.select_btn')}
                                            </button>
                                        ) : (
                                            <span className="self-center text-[10px] text-gray-400 dark:text-gray-500 italic px-2">
                                                {t('settings.web_mode_limitation', '(Web 模式不支持)')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                                        {t('settings.advanced.antigravity_ide_path_desc', 'Specify the executable path for Antigravity IDE (code editor). Once set, account switching will strictly protect processes at this path from being terminated.')}
                                    </p>
                                </div>

                                {/* 反重力程序启动参数 */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                                        {t('settings.advanced.antigravity_args')}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded bg-white dark:bg-base-200 text-xs text-gray-900 dark:text-base-content font-mono outline-none focus:ring-1 focus:ring-zinc-950 focus:border-transparent"
                                            value={formData.antigravity_args ? formData.antigravity_args.join(' ') : ''}
                                            placeholder={t('settings.advanced.antigravity_args_placeholder')}
                                            onChange={(e) => {
                                                const args = e.target.value.trim() === '' ? [] : e.target.value.split(' ').map(arg => arg.trim()).filter(arg => arg !== '');
                                                setFormData({ ...formData, antigravity_args: args });
                                            }}
                                        />
                                        <button
                                            className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 text-xs text-gray-755 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-base-200 transition-colors font-semibold"
                                            onClick={async () => {
                                                try {
                                                    const args = await invoke<string[]>('get_antigravity_args');
                                                    setFormData({ ...formData, antigravity_args: args });
                                                    showToast(t('settings.advanced.antigravity_args_detected'), 'success');
                                                } catch (error) {
                                                    showToast(`${t('settings.advanced.antigravity_args_detect_error')}: ${error}`, 'error');
                                                }
                                            }}
                                        >
                                            {t('settings.advanced.detect_args_btn')}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                                        {t('settings.advanced.antigravity_args_desc')}
                                    </p>
                                </div>

                                {/* 日志缓存清理 */}
                                <div className="border-t border-gray-200 dark:border-base-200 pt-4">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">{t('settings.advanced.logs_title')}</h3>
                                    <div className="bg-gray-50 dark:bg-base-200 border border-gray-200 dark:border-base-300 rounded p-3 mb-3">
                                        <p className="text-xs text-gray-600 dark:text-gray-400">{t('settings.advanced.logs_desc')}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button
                                            className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 text-xs text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-base-200 transition-colors font-semibold"
                                            onClick={() => setIsClearLogsOpen(true)}
                                        >
                                            {t('settings.advanced.clear_logs')}
                                        </button>
                                    </div>
                                </div>

                                {/* Antigravity 缓存清理 */}
                                <div className="border-t border-gray-200 dark:border-base-200 pt-4">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">{t('settings.advanced.antigravity_cache_title')}</h3>
                                    <div className="bg-gray-50 dark:bg-base-200 border border-gray-200 dark:border-base-350 rounded p-3 mb-3">
                                        <p className="text-xs text-red-600 dark:text-red-400">{t('settings.advanced.antigravity_cache_warning')}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-base-200 border border-gray-200 dark:border-base-300 rounded p-3 mb-3">
                                        <p className="text-xs text-gray-600 dark:text-gray-400">{t('settings.advanced.antigravity_cache_desc')}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button
                                            className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 text-xs text-zinc-950 dark:text-zinc-200 rounded-md hover:bg-gray-50 dark:hover:bg-base-200 transition-colors font-semibold"
                                            onClick={handleOpenClearCacheDialog}
                                        >
                                            {t('settings.advanced.clear_antigravity_cache')}
                                        </button>
                                    </div>
                                </div>



                                <div className="border-t border-gray-200 dark:border-base-200 pt-4">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-base-200 rounded border border-gray-200 dark:border-base-350">
                                            <div>
                                                <div className="text-xs font-semibold text-gray-900 dark:text-base-content">
                                                    {t('settings.advanced.debug_logs_title')}
                                                </div>
                                                <p className="text-[10px] text-gray-550 dark:text-gray-400 mt-0.5">
                                                    {t('settings.advanced.debug_logs_enable_desc')}
                                                </p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                                    checked={formData.proxy?.debug_logging?.enabled ?? false}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({
                                                        ...formData,
                                                        proxy: {
                                                            ...formData.proxy,
                                                            debug_logging: {
                                                                enabled: e.target.checked,
                                                                output_dir: formData.proxy?.debug_logging?.output_dir,
                                                            },
                                                        },
                                                    })}
                                                />
                                            </label>
                                        </div>
                                        {(formData.proxy?.debug_logging?.enabled ?? false) && (
                                            <>
                                                <div className="bg-gray-50 dark:bg-base-200 border border-gray-200 dark:border-base-300 rounded p-3">
                                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                                        {t('settings.advanced.debug_logs_desc')}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                                                        {t('settings.advanced.debug_log_dir')}
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            className="flex-1 px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded bg-white dark:bg-base-200 text-xs text-gray-905 dark:text-base-content font-mono outline-none focus:ring-1 focus:ring-zinc-950 focus:border-transparent"
                                                            value={formData.proxy?.debug_logging?.output_dir || ''}
                                                            placeholder={`${dataDirPath.replace(/\/$/, '')}/debug_logs`}
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({
                                                                ...formData,
                                                                proxy: {
                                                                    ...formData.proxy,
                                                                    debug_logging: {
                                                                        enabled: formData.proxy?.debug_logging?.enabled ?? false,
                                                                        output_dir: e.target.value || undefined,
                                                                    },
                                                                },
                                                            })}
                                                        />
                                                        {isTauri() && (
                                                            <button
                                                                className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 text-xs text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-base-200 transition-colors font-semibold"
                                                                onClick={handleSelectDebugLogDir}
                                                            >
                                                                {t('settings.advanced.select_btn')}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                                                        {t('settings.advanced.debug_log_dir_hint', { path: dataDirPath.replace(/\/$/, '') })}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </>
                    )}


                    {/* 调试设置 */}
                    {activeTab === 'debug' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* 标题和开关 */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                        {t('settings.debug.title')}
                                    </h2>
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        {t('settings.debug.desc')}
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer gap-2">
                                    <input
                                        type="checkbox"
                                        className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                        checked={isEnabled}
                                        onChange={(e) => e.target.checked ? enable() : disable()}
                                    />
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                        {isEnabled ? t('settings.debug.enabled') : t('settings.debug.disabled')}
                                    </span>
                                </label>
                            </div>

                            {/* 控制台或提示 */}
                            {isEnabled ? (
                                <div className="h-[calc(100vh-320px)] min-h-[400px]">
                                    <DebugConsole embedded />
                                </div>
                            ) : (
                                <div className="h-[calc(100vh-320px)] min-h-[400px] flex items-center justify-center bg-gray-50 dark:bg-base-200 rounded border border-gray-200 dark:border-base-300">
                                    <div className="text-center">
                                        <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold">
                                            {t('settings.debug.disabled_hint')}
                                        </p>
                                        <p className="text-gray-450 dark:text-gray-500 text-[10px] mt-1">
                                            {t('settings.debug.disabled_desc')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 代理设置 */}
                    {activeTab === 'proxy' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <ProxyPoolSettings
                                config={formData.proxy?.proxy_pool || {
                                    enabled: false,
                                    proxies: [],
                                    health_check_interval: 300,
                                    auto_failover: true,
                                    strategy: 'priority'
                                }}
                                onChange={(newConfig, silent = false) => {
                                    const updatedFormData = {
                                        ...formData,
                                        proxy: {
                                            ...formData.proxy,
                                            proxy_pool: newConfig
                                        }
                                    };
                                    setFormData(updatedFormData);

                                    if (silent) {
                                        return;
                                    }

                                    saveConfig({ ...updatedFormData, auto_refresh: true })
                                        .then(() => undefined)
                                        .catch(err => console.error('Save failed:', err));
                                }}
                            />

                             <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-base-200 dark:bg-base-100">
                                  <div className="flex items-center justify-between mb-4">
                                      <div>
                                          <div className="text-xs font-black uppercase tracking-[0.12em] text-gray-900 dark:text-gray-100">{t('proxy.config.upstream_proxy.title')}</div>
                                          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                              {t('proxy.config.upstream_proxy.desc_short')}
                                          </p>
                                      </div>
                                     <label className="relative inline-flex items-center cursor-pointer">
                                         <input
                                             type="checkbox"
                                             className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                             checked={formData.proxy?.upstream_proxy?.enabled ?? false}
                                             onChange={(e) => setFormData({
                                                 ...formData,
                                                 proxy: {
                                                     ...formData.proxy,
                                                     upstream_proxy: {
                                                         ...formData.proxy?.upstream_proxy,
                                                         enabled: e.target.checked
                                                     }
                                                 }
                                             })}
                                         />
                                     </label>
                                 </div>

                                 {formData.proxy?.upstream_proxy?.enabled && (
                                     <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                          <div className="pt-3 border-t border-gray-100 dark:border-base-200">
                                              <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
                                                  {t('proxy.config.upstream_proxy.url')}
                                              </label>
                                              <input
                                                  type="text"
                                                  className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-mono outline-none transition-colors focus:border-gray-500 dark:border-base-300 dark:bg-base-200"
                                                 placeholder={t('proxy.config.upstream_proxy.url_placeholder')}
                                                 value={formData.proxy?.upstream_proxy?.url || ''}
                                                 onChange={(e) => setFormData({
                                                     ...formData,
                                                     proxy: {
                                                         ...formData.proxy,
                                                         upstream_proxy: {
                                                             ...formData.proxy?.upstream_proxy,
                                                             url: e.target.value
                                                         }
                                                     }
                                                 })}
                                             />
                                              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-[10px] text-gray-650 dark:border-base-300 dark:bg-base-200 dark:text-gray-400">
                                                  <div className="leading-relaxed">
                                                      <span className="font-semibold mr-1">Tip:</span>
                                                      {t('proxy.config.upstream_proxy.socks5h_hint')}
                                                  </div>
                                             </div>
                                         </div>
                                     </div>
                                 )}
                             </div>
                        </div>
                    )}

                    {activeTab === 'about' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="relative overflow-hidden rounded-2xl border border-gray-150 dark:border-base-200/60 bg-[#F9FBFC] dark:bg-base-200/30 p-6 flex flex-col items-center text-center">
                                <div className="relative flex items-center justify-center p-2 rounded-2xl bg-white dark:bg-base-100 shadow-[0_12px_24px_-10px_rgba(0,0,0,0.04)] dark:shadow-none border border-gray-100 dark:border-base-200 mb-4">
                                    <div className="relative w-16 h-16 flex items-center justify-center">
                                        <img
                                            src="/src/assets/logo-light.webp"
                                            alt="GravityLite Logo"
                                            className="h-12 w-auto object-contain block dark:hidden"
                                            onError={(e) => {
                                                e.currentTarget.src = '/src/assets/logo-light.webp';
                                            }}
                                        />
                                        <img
                                            src="/src/assets/logo-dark.webp"
                                            alt="GravityLite Logo"
                                            className="h-12 w-auto object-contain hidden dark:block"
                                        />
                                    </div>
                                </div>

                                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-1">
                                    GravityLite
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-[45ch] leading-relaxed">
                                    A cleaned-up, focused fork of Antigravity-Manager for account management and local AI protocol proxying.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="group relative rounded-2xl border border-gray-200/80 dark:border-base-200/50 bg-white dark:bg-base-100 p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_8px_16px_-6px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                                    <div>
                                        <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-400 font-semibold block mb-1">
                                            {t('settings.about.version')}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-base font-mono font-semibold text-gray-900 dark:text-gray-100">
                                                v{packageJson.version}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-base-200/60 flex items-center justify-between">
                                        <span className="text-[10px] text-gray-400">Release Channel</span>
                                        <span className="text-[10px] font-medium text-gray-700 dark:text-zinc-300">Stable</span>
                                    </div>
                                </div>

                                <div className="group relative rounded-2xl border border-gray-200/80 dark:border-base-200/50 bg-white dark:bg-base-100 p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_8px_16px_-6px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                                    <div>
                                        <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-400 font-semibold block mb-1">
                                            Creator and Maintainer
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                Bernard Thimotius Turnip
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-base-200/60 grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleOpenExternal('https://github.com/bernardthimotius')}
                                            className="rounded-lg border border-gray-200 dark:border-base-200 px-2.5 py-1.5 text-[10px] font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-base-200 flex items-center justify-center gap-1"
                                        >
                                            GitHub <ExternalLink className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                            onClick={() => handleOpenExternal('https://www.linkedin.com/in/bernardtrnp/')}
                                            className="rounded-lg border border-gray-200 dark:border-base-200 px-2.5 py-1.5 text-[10px] font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-base-200 flex items-center justify-center gap-1"
                                        >
                                            LinkedIn <ExternalLink className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="group relative rounded-2xl border border-gray-200/80 dark:border-base-200/50 bg-white dark:bg-base-100 p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_8px_16px_-6px_rgba(0,0,0,0.03)]">
                                    <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-400 font-semibold block mb-1">
                                        Upstream Attribution
                                    </span>
                                    <p className="text-xs leading-relaxed text-gray-600 dark:text-zinc-400">
                                        GravityLite is based on Antigravity-Manager by lbjlaq. This fork changes the product name, UI, proxy surface, model list, and removes several unused features.
                                    </p>
                                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-base-200/60 grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleOpenExternal('https://github.com/lbjlaq/Antigravity-Manager')}
                                            className="rounded-lg border border-gray-200 dark:border-base-200 px-2.5 py-1.5 text-[10px] font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-base-200 flex items-center justify-center gap-1"
                                        >
                                            Original Repo <ExternalLink className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                            onClick={() => handleOpenExternal('https://github.com/lbjlaq')}
                                            className="rounded-lg border border-gray-200 dark:border-base-200 px-2.5 py-1.5 text-[10px] font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-base-200 flex items-center justify-center gap-1"
                                        >
                                            lbjlaq <ExternalLink className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="group relative rounded-2xl border border-gray-200/80 dark:border-base-200/50 bg-white dark:bg-base-100 p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_8px_16px_-6px_rgba(0,0,0,0.03)]">
                                    <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-400 font-semibold block mb-1">
                                        License
                                    </span>
                                    <p className="text-xs leading-relaxed text-gray-600 dark:text-zinc-400">
                                        Licensed as adapted material under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International.
                                    </p>
                                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-base-200/60 flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => handleOpenExternal('https://creativecommons.org/licenses/by-nc-sa/4.0/')}
                                            className="text-[10px] font-medium text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                                        >
                                            CC BY-NC-SA 4.0 <ExternalLink className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="md:col-span-2 group relative rounded-2xl border border-gray-200/80 dark:border-base-200/50 bg-white dark:bg-base-100 p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_8px_16px_-6px_rgba(0,0,0,0.03)]">
                                    <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-400 font-semibold block mb-2">
                                        {t('settings.about.tech_stack')}
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                        {['React 19', 'TypeScript', 'Tauri v2', 'Rust', 'TailwindCSS'].map((tech) => (
                                            <span
                                                key={tech}
                                                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-gray-50 dark:bg-base-200/60 text-gray-700 dark:text-zinc-300 border border-gray-150 dark:border-base-200/40"
                                            >
                                                {tech}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200/80 dark:border-base-200/50 bg-white dark:bg-base-100 p-5 space-y-4">
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        className="relative overflow-hidden px-4 py-2 rounded-xl border border-gray-200 dark:border-base-200/60 text-xs font-semibold text-gray-750 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-base-200 flex items-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-sm active:shadow-none"
                                        onClick={() => handleOpenExternal('https://github.com/bernardthimotius/GravityLite')}
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        {t('settings.about.view_code')}
                                    </button>
                                    <button
                                        className="relative overflow-hidden px-4 py-2 rounded-xl border border-gray-200 dark:border-base-200/60 text-xs font-semibold text-gray-750 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-base-200 flex items-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-sm active:shadow-none"
                                        onClick={() => handleOpenExternal('https://github.com/lbjlaq/Antigravity-Manager')}
                                    >
                                        <Globe className="w-3.5 h-3.5" />
                                        Original Project
                                    </button>
                                </div>

                                <div className="text-[10px] text-gray-400 dark:text-zinc-500 pt-1">
                                    <span>
                                        Copyright © 2026 Bernard Thimotius Turnip. Portions adapted from Antigravity-Manager © lbjlaq.
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div >

                <ModalDialog
                    isOpen={isClearLogsOpen}
                    title={t('settings.advanced.clear_logs_title')}
                    message={t('settings.advanced.clear_logs_msg')}
                    type="confirm"
                    confirmText={t('common.clear')}
                    cancelText={t('common.cancel')}
                    isDestructive={true}
                    onConfirm={confirmClearLogs}
                    onCancel={() => setIsClearLogsOpen(false)}
                />

                {/* Antigravity Cache Clear Modal */}
                <ModalDialog
                    isOpen={isClearCacheOpen}
                    title={t('settings.advanced.clear_cache_confirm_title')}
                    type="confirm"
                    confirmText={isClearingCache ? t('common.clearing') : t('common.clear')}
                    cancelText={t('common.cancel')}
                    isDestructive={true}
                    onConfirm={confirmClearAntigravityCache}
                    onCancel={() => setIsClearCacheOpen(false)}
                >
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t('settings.advanced.clear_cache_confirm_msg')}
                        </p>
                        {cachePaths.length > 0 ? (
                            <div className="bg-gray-50 dark:bg-base-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                                <ul className="text-xs font-mono text-gray-600 dark:text-gray-400 space-y-1">
                                    {cachePaths.map((path, index) => (
                                        <li key={index} className="truncate">• {path}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className="bg-gray-50 dark:bg-base-200 rounded-lg p-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('settings.advanced.cache_not_found')}
                                </p>
                            </div>
                        )}
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg p-2">
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                {t('settings.advanced.antigravity_cache_warning')}
                            </p>
                        </div>
                    </div>
                </ModalDialog>

            </div >
        </div >
    );
}

export default Settings;
