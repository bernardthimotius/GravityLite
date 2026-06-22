import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { request as invoke } from '../utils/request';
import { isTauri } from '../utils/env';
import { copyToClipboard } from '../utils/clipboard';
import {
    Power,
    Copy,
    RefreshCw,
    CheckCircle,
    Settings,
    Terminal,
    Trash2,
    BrainCircuit,
    X,
    Edit2
} from 'lucide-react';
import { AppConfig, ProxyConfig, StickySessionConfig } from '../types/config';
import HelpTooltip from '../components/common/HelpTooltip';
import ModalDialog from '../components/common/ModalDialog';
import { showToast } from '../components/common/ToastContainer';
import { cn } from '../utils/cn';
import { useProxyModels } from '../hooks/useProxyModels';
import { CliSyncCard } from '../components/proxy/CliSyncCard';
import { listAccounts } from '../services/accountService';
import CircuitBreaker from '../components/settings/CircuitBreaker';
import AdvancedThinking from '../components/settings/AdvancedThinking';
import { CircuitBreakerConfig } from '../types/config';

interface ProxyStatus {
    running: boolean;
    port: number;
    base_url: string;
    active_accounts: number;
}

interface CollapsibleCardProps {
    title: string;
    icon: React.ReactNode;
    enabled?: boolean;
    onToggle?: (enabled: boolean) => void;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    rightElement?: React.ReactNode;
    allowInteractionWhenDisabled?: boolean;
}

function CollapsibleCard({
    title,
    icon,
    enabled,
    onToggle,
    children,
    defaultExpanded = false,
    rightElement,
    allowInteractionWhenDisabled = false,
}: CollapsibleCardProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const { t } = useTranslation();

    return (
        <div className="border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-lg overflow-hidden">
            <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50/70 dark:hover:bg-base-200/60 transition-colors select-none"
                onClick={(e) => {
                    if ((e.target as HTMLElement).closest('.no-expand')) return;
                    setIsExpanded(!isExpanded);
                }}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="text-gray-400 dark:text-gray-500 shrink-0">
                        {icon}
                    </div>
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                        {title}
                    </span>
                    {enabled !== undefined && (
                        <span className={cn(
                            'shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold tracking-wide',
                            enabled
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/10 dark:text-emerald-400'
                                : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-base-300 dark:bg-base-200 dark:text-gray-500'
                        )}>
                            {enabled ? t('common.enabled') : t('common.disabled')}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 no-expand shrink-0 ml-3">
                    {rightElement}

                    {enabled !== undefined && onToggle && (
                        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                            <input
                                type="checkbox"
                                className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                checked={enabled}
                                onChange={(e) => onToggle(e.target.checked)}
                            />
                        </div>
                    )}

                    <div className={cn('text-gray-300 dark:text-gray-600 transition-transform duration-200', isExpanded ? 'rotate-180' : '')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </div>
                </div>
            </div>

            <div className={cn(
                'transition-all duration-200 ease-in-out border-t border-gray-100 dark:border-base-200',
                isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
            )}>
                <div className="relative">
                    {enabled === false && !allowInteractionWhenDisabled && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-base-100/60 z-10 cursor-not-allowed" />
                    )}
                    <div className={enabled === false && !allowInteractionWhenDisabled ? 'opacity-50 pointer-events-none select-none' : ''}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ApiProxy() {
    const { t } = useTranslation();

    const { models } = useProxyModels();

    const [status, setStatus] = useState<ProxyStatus>({
        running: false,
        port: 0,
        base_url: '',
        active_accounts: 0,
    });

    const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
    const [configLoading, setConfigLoading] = useState(true);
    const [configError, setConfigError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [selectedProtocol, setSelectedProtocol] = useState<'openai' | 'anthropic' | 'gemini'>('openai');
    const [selectedModelId, setSelectedModelId] = useState('gemini-3-flash');

    // API Key editing states
    const [isEditingApiKey, setIsEditingApiKey] = useState(false);
    const [tempApiKey, setTempApiKey] = useState('');

    const [isEditingAdminPassword, setIsEditingAdminPassword] = useState(false);
    const [tempAdminPassword, setTempAdminPassword] = useState('');

    // Modal states
    const [isRegenerateKeyConfirmOpen, setIsRegenerateKeyConfirmOpen] = useState(false);
    const [isClearBindingsConfirmOpen, setIsClearBindingsConfirmOpen] = useState(false);

    // [FIX #820] Fixed account mode states
    const [preferredAccountId, setPreferredAccountId] = useState<string | null>(null);
    const [availableAccounts, setAvailableAccounts] = useState<Array<{ id: string; email: string }>>([]);

    // Cloudflared (CF隧道) states
    const [cfStatus, setCfStatus] = useState<{ installed: boolean; version?: string; running: boolean; url?: string; error?: string }>({
        installed: false,
        running: false,
    });
    const [cfLoading, setCfLoading] = useState(false);
    const [cfMode, setCfMode] = useState<'quick' | 'auth'>('quick');
    const [cfToken, setCfToken] = useState('');
    const [cfUseHttp2, setCfUseHttp2] = useState(true); // 默认启用HTTP/2，更稳定

    // 初始化加载
    useEffect(() => {
        loadConfig();
        loadStatus();
        loadAccounts();
        loadPreferredAccount();
        loadCfStatus();
        const interval = setInterval(loadStatus, 3000);
        const cfInterval = setInterval(loadCfStatus, 5000);
        return () => {
            clearInterval(interval);
            clearInterval(cfInterval);
        };
    }, []);



    const loadAccounts = async () => {
        try {
            const accounts = await listAccounts();
            setAvailableAccounts(accounts.map(a => ({ id: a.id, email: a.email })));
        } catch (error) {
            console.error('Failed to load accounts:', error);
        }
    };

    const loadCfStatus = async () => {
        try {
            const status = await invoke<typeof cfStatus>('cloudflared_get_status');
            setCfStatus(status);
        } catch (error) {
        }
    };

    const handleCfInstall = async () => {
        setCfLoading(true);
        try {
            const status = await invoke<typeof cfStatus>('cloudflared_install');
            setCfStatus(status);
            showToast(t('proxy.cloudflared.install_success', { defaultValue: 'Cloudflared installed successfully' }), 'success');
        } catch (error) {
            console.error('[Cloudflared] Install error:', error);
            showToast(String(error), 'error');
        } finally {
            setCfLoading(false);
        }
    };

    const handleCfToggle = async (enable: boolean) => {
        if (enable && !status.running) {
            showToast(
                t('proxy.cloudflared.require_proxy_running', { defaultValue: 'Please start the local proxy service first' }),
                'warning'
            );
            return;
        }
        setCfLoading(true);
        try {
            if (enable) {
                if (!cfStatus.installed) {
                    const installStatus = await invoke<typeof cfStatus>('cloudflared_install');
                    setCfStatus(installStatus);
                    if (!installStatus.installed) {
                        throw new Error('Cloudflared install failed');
                    }
                    showToast(t('proxy.cloudflared.install_success', { defaultValue: 'Cloudflared installed successfully' }), 'success');
                }

                const config = {
                    enabled: true,
                    mode: cfMode,
                    port: appConfig?.proxy.port || 8045,
                    token: cfMode === 'auth' ? cfToken : null,
                    use_http2: cfUseHttp2,
                };
                const status = await invoke<typeof cfStatus>('cloudflared_start', { config });
                setCfStatus(status);
                showToast(t('proxy.cloudflared.started', { defaultValue: 'Tunnel started' }), 'success');

                // 持久化“启用”状态
                if (appConfig) {
                    const newConfig = {
                        ...appConfig,
                        cloudflared: {
                            ...appConfig.cloudflared,
                            enabled: true,
                            mode: cfMode,
                            token: cfToken,
                            use_http2: cfUseHttp2,
                            port: appConfig.proxy.port || 8045
                        }
                    };
                    saveConfig(newConfig);
                }
            } else {
                const status = await invoke<typeof cfStatus>('cloudflared_stop');
                setCfStatus(status);
                showToast(t('proxy.cloudflared.stopped', { defaultValue: 'Tunnel stopped' }), 'success');

                // 持久化“禁用”状态
                if (appConfig) {
                    const newConfig = {
                        ...appConfig,
                        cloudflared: {
                            ...appConfig.cloudflared,
                            enabled: false
                        }
                    };
                    saveConfig(newConfig);
                }
            }
        } catch (error) {
            showToast(String(error), 'error');
        } finally {
            setCfLoading(false);
        }
    };

    // Cloudflared: 复制URL
    const handleCfCopyUrl = async () => {
        if (cfStatus.url) {
            const success = await copyToClipboard(cfStatus.url);
            if (success) {
                setCopied('cf-url');
                setTimeout(() => setCopied(null), 2000);
            }
        }
    };

    // [FIX #820] Load current preferred account
    const loadPreferredAccount = async () => {
        try {
            const prefId = await invoke<string | null>('get_preferred_account');
            setPreferredAccountId(prefId);
        } catch (error) {
            // Service not running, ignore
        }
    };

    // [FIX #820] Set preferred account
    const handleSetPreferredAccount = async (accountId: string | null) => {
        try {
            const wasEnabled = preferredAccountId !== null;
            await invoke('set_preferred_account', { accountId });
            setPreferredAccountId(accountId);

            // Determine appropriate message
            let message: string;
            if (accountId === null) {
                message = t('proxy.config.scheduling.round_robin_set', { defaultValue: 'Round-robin mode enabled' });
            } else if (wasEnabled) {
                // Changed account while already in fixed mode
                const account = availableAccounts.find(a => a.id === accountId);
                message = t('proxy.config.scheduling.account_changed', {
                    defaultValue: `Switched to ${account?.email || accountId}`,
                    email: account?.email || accountId
                });
            } else {
                // Just enabled fixed mode
                message = t('proxy.config.scheduling.fixed_account_set', { defaultValue: 'Fixed account mode enabled' });
            }

            showToast(message, 'success');
        } catch (error) {
            showToast(String(error), 'error');
        }
    };

    const loadConfig = async () => {
        setConfigLoading(true);
        setConfigError(null);
        try {
            const config = await invoke<AppConfig>('load_config');
            setAppConfig(config);

            // 恢复 Cloudflared 持久化状态
            if (config.cloudflared) {
                setCfMode(config.cloudflared.mode || 'quick');
                setCfToken(config.cloudflared.token || '');
                setCfUseHttp2(config.cloudflared.use_http2 !== false); // 默认开启 HTTP/2
            }

            // 恢复 Cloudflared 状态并实现持久化同步
            if (config.cloudflared) {
                setCfMode(config.cloudflared.mode || 'quick');
                setCfToken(config.cloudflared.token || '');
                setCfUseHttp2(config.cloudflared.use_http2 !== false); // 默认 true
            }
        } catch (error) {
            console.error('加载配置失败:', error);
            setConfigError(String(error));
        } finally {
            setConfigLoading(false);
        }
    };

    const loadStatus = async () => {
        try {
            const s = await invoke<ProxyStatus>('get_proxy_status');
            // 如果后端返回 starting 或 busy，则在 UI 上表现为加载中
            if (s.base_url === 'starting' || s.base_url === 'busy') {
                // 如果当前已经是运行状态，不要被覆盖为 false
                setStatus(prev => ({ ...s, running: prev.running }));
            } else {
                setStatus(s);
            }
        } catch (error) {
            console.error('获取状态失败:', error);
        }
    };


    const saveConfig = async (newConfig: AppConfig) => {
        // 1. 立即更新 UI 状态，确保流畅
        setAppConfig(newConfig);
        try {
            await invoke('save_config', { config: newConfig });
        } catch (error) {
            console.error('保存配置失败:', error);
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const updateProxyConfig = (updates: Partial<ProxyConfig>) => {
        if (!appConfig) return;
        const newConfig = {
            ...appConfig,
            proxy: {
                ...appConfig.proxy,
                ...updates
            }
        };
        saveConfig(newConfig);
    };

    const updateSchedulingConfig = (updates: Partial<StickySessionConfig>) => {
        if (!appConfig) return;
        const currentScheduling = appConfig.proxy.scheduling || { mode: 'Balance', max_wait_seconds: 60 };
        const newScheduling = { ...currentScheduling, ...updates };

        const newAppConfig = {
            ...appConfig,
            proxy: {
                ...appConfig.proxy,
                scheduling: newScheduling
            }
        };
        saveConfig(newAppConfig);
    };

    const updateCircuitBreakerConfig = (newBreakerConfig: CircuitBreakerConfig) => {
        if (!appConfig) return;
        const newConfig = {
            ...appConfig,
            circuit_breaker: newBreakerConfig
        };
        saveConfig(newConfig);
    };

    const handleClearSessionBindings = () => {
        setIsClearBindingsConfirmOpen(true);
    };

    const executeClearSessionBindings = async () => {
        setIsClearBindingsConfirmOpen(false);
        try {
            await invoke('clear_proxy_session_bindings');
            showToast(t('common.success'), 'success');
        } catch (error) {
            console.error('Failed to clear session bindings:', error);
            showToast(`${t('common.error')}: ${error}`, 'error');
        }
    };

    const handleToggle = async () => {
        if (!appConfig) return;
        setLoading(true);
        try {
            if (status.running) {
                await invoke('stop_proxy_service');
            } else {
                // 使用当前的 appConfig.proxy 启动
                await invoke('start_proxy_service', { config: appConfig.proxy });
            }
            await loadStatus();
        } catch (error: any) {
            showToast(t('proxy.dialog.operate_failed', { error: error.toString() }), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateApiKey = () => {
        setIsRegenerateKeyConfirmOpen(true);
    };

    const executeGenerateApiKey = async () => {
        setIsRegenerateKeyConfirmOpen(false);
        try {
            const newKey = await invoke<string>('generate_api_key');
            updateProxyConfig({ api_key: newKey });
            showToast(t('common.success'), 'success');
        } catch (error: any) {
            console.error('生成 API Key 失败:', error);
            showToast(t('proxy.dialog.operate_failed', { error: error.toString() }), 'error');
        }
    };

    const copyToClipboardHandler = (text: string, label: string) => {
        copyToClipboard(text).then((success) => {
            if (success) {
                setCopied(label);
                setTimeout(() => setCopied(null), 2000);
            }
        });
    };

    // API Key editing functions
    const validateApiKey = (key: string): boolean => {
        // Must start with 'sk-' and be at least 10 characters long
        return key.startsWith('sk-') && key.length >= 10;
    };

    const handleEditApiKey = () => {
        setTempApiKey(appConfig?.proxy.api_key || '');
        setIsEditingApiKey(true);
    };

    const handleSaveApiKey = () => {
        if (!validateApiKey(tempApiKey)) {
            showToast(t('proxy.config.api_key_invalid'), 'error');
            return;
        }
        updateProxyConfig({ api_key: tempApiKey });
        setIsEditingApiKey(false);
        showToast(t('proxy.config.api_key_updated'), 'success');
    };

    const handleCancelEditApiKey = () => {
        setTempApiKey('');
        setIsEditingApiKey(false);
    };

    // Admin Password editing functions
    const handleEditAdminPassword = () => {
        setTempAdminPassword(appConfig?.proxy.admin_password || '');
        setIsEditingAdminPassword(true);
    };

    const handleSaveAdminPassword = () => {
        // Validation: can be empty (meaning fallback to api_key) or at least 4 chars
        if (tempAdminPassword && tempAdminPassword.length < 4) {
            showToast(t('proxy.config.admin_password_short', { defaultValue: 'Password is too short (min 4 chars)' }), 'error');
            return;
        }
        updateProxyConfig({ admin_password: tempAdminPassword || undefined });
        setIsEditingAdminPassword(false);
        showToast(t('proxy.config.admin_password_updated', { defaultValue: 'Web UI password updated' }), 'success');
    };

    const handleCancelEditAdminPassword = () => {
        setTempAdminPassword('');
        setIsEditingAdminPassword(false);
    };


    const getPythonExample = (modelId: string) => {
        const port = status.running ? status.port : (appConfig?.proxy.port || 8045);
        // Prefer 127.0.0.1 to avoid IPv6 resolution delays in some environments.
        const baseUrl = `http://127.0.0.1:${port}/v1`;
        const apiKey = appConfig?.proxy.api_key || 'YOUR_API_KEY';

        // 1. Anthropic Protocol
        if (selectedProtocol === 'anthropic') {
            return `from anthropic import Anthropic

client = Anthropic(
    # Prefer 127.0.0.1 for local proxy connections.
    base_url="${`http://127.0.0.1:${port}`}",
    api_key="${apiKey}"
)

# GravityLite supports calling any proxy model through the Anthropic SDK.
response = client.messages.create(
    model="${modelId}",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}]
)

print(response.content[0].text)`;
        }

        // 2. Gemini Protocol (Native)
        if (selectedProtocol === 'gemini') {
            const rawBaseUrl = `http://127.0.0.1:${port}`;
            return `# Install first: pip install google-generativeai
import google.generativeai as genai

# Use the GravityLite proxy endpoint. Prefer 127.0.0.1 for local connections.
genai.configure(
    api_key="${apiKey}",
    transport='rest',
    client_options={'api_endpoint': '${rawBaseUrl}'}
)

model = genai.GenerativeModel('${modelId}')
response = model.generate_content("Hello")
print(response.text)`;
        }

        // 3. OpenAI Protocol
        if (modelId.startsWith('gemini-3.1-flash-image')) {
            return `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${apiKey}"
)

response = client.chat.completions.create(
    model="${modelId}",
    # Option 1: use the size parameter. Recommended.
    # Supported: "1024x1024" (1:1), "1280x720" (16:9), "720x1280" (9:16), "1216x896" (4:3)
    extra_body={ "size": "1024x1024" },
    
    # Option 2: use a model suffix.
    # Example: gemini-3.1-flash-image-16-9, gemini-3.1-flash-image-4-3
    # model="gemini-3.1-flash-image-16-9",
    messages=[{
        "role": "user",
        "content": "Draw a futuristic city"
    }]
)

print(response.choices[0].message.content)`;
        }

        return `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${apiKey}"
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=[{"role": "user", "content": "Hello"}]
)

print(response.choices[0].message.content)`;
    };

    // 在 filter 逻辑中，当选择 openai 协议时，允许显示所有模型
    const filteredModels = models.filter(model => {
        if (selectedProtocol === 'openai') {
            return true;
        }
        // Anthropic 协议下隐藏不支持的图片模型
        if (selectedProtocol === 'anthropic') {
            return !model.id.includes('image');
        }
        return true;
    });

    const proxyBaseUrl = appConfig
        ? (status.running ? status.base_url : `http://127.0.0.1:${appConfig.proxy.port || 8045}`)
        : '';
    const openAiBaseUrl = proxyBaseUrl ? `${proxyBaseUrl}/v1` : '';
    const authMode = appConfig?.proxy.auth_mode || 'off';
    const schedulingMode = appConfig?.proxy.scheduling?.mode || 'Balance';

    return (
        <div className="h-full w-full overflow-y-auto overflow-x-hidden">
            <div className="p-4 space-y-3 max-w-7xl mx-auto">

                {/* Loading State */}
                {configLoading && (
                    <div className="flex items-center justify-center py-24">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-base-300 border-t-gray-500 animate-spin" />
                            <span className="text-xs text-gray-400 tracking-wide">
                                {t('common.loading')}
                            </span>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {!configLoading && configError && (
                    <div className="flex items-center justify-center py-24">
                        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                            <div className="w-10 h-10 rounded-lg border border-gray-200 dark:border-base-200 flex items-center justify-center bg-gray-50 dark:bg-base-200">
                                <Settings size={18} className="text-gray-400" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {t('proxy.error.load_failed')}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    {configError}
                                </p>
                            </div>
                            <button
                                onClick={loadConfig}
                                className="px-3 py-1.5 bg-gray-950 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors active:scale-[0.98]"
                            >
                                <RefreshCw size={12} />
                                {t('common.retry')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Command surface */}
                {!configLoading && !configError && appConfig && (
                    <div className="border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between border-b border-gray-100 dark:border-base-200">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <h1 className="text-sm font-semibold tracking-tight text-gray-950 dark:text-base-content">API Proxy</h1>
                                <span className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide shrink-0',
                                    status.running
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300'
                                        : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-base-300 dark:bg-base-200 dark:text-gray-500'
                                )}>
                                    <span className={cn('h-1.5 w-1.5 rounded-full', status.running ? 'bg-emerald-500' : 'bg-gray-400')} />
                                    {status.running ? t('proxy.status.running') : t('proxy.status.stopped')}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => copyToClipboardHandler(openAiBaseUrl, 'status-openai-url')}
                                    className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-base-200 text-xs font-medium hover:bg-gray-50 dark:hover:bg-base-200 flex items-center gap-1.5 transition-colors active:scale-[0.98]"
                                >
                                    {copied === 'status-openai-url' ? <CheckCircle size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                    Copy Endpoint
                                </button>
                                <button
                                    onClick={handleToggle}
                                    disabled={loading || !appConfig}
                                    className={cn(
                                        'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 active:scale-[0.98]',
                                        status.running
                                            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 dark:bg-red-900/15 dark:border-red-900/40 dark:text-red-300'
                                            : 'bg-gray-950 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white',
                                        (loading || !appConfig) && 'opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    <Power size={13} />
                                    {loading ? t('proxy.status.processing') : (status.running ? t('proxy.action.stop') : t('proxy.action.start'))}
                                </button>
                            </div>
                        </div>

                        <dl className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-base-200">
                            <div className="px-4 py-2.5 min-w-0">
                                <dt className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Endpoint</dt>
                                <dd className="font-mono text-[11px] text-gray-700 dark:text-gray-300 truncate">{openAiBaseUrl}</dd>
                            </div>
                            <div className="px-4 py-2.5">
                                <dt className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Runtime</dt>
                                <dd className="font-mono text-[11px] text-gray-700 dark:text-gray-300">:{status.running ? status.port : appConfig.proxy.port} &middot; {status.active_accounts} acct</dd>
                            </div>
                            <div className="px-4 py-2.5">
                                <dt className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Policy</dt>
                                <dd className="text-[11px] text-gray-700 dark:text-gray-300 truncate">{schedulingMode} / {authMode}</dd>
                            </div>
                        </dl>
                    </div>
                )}

                {/* Advanced configuration */}
                {!configLoading && !configError && appConfig && (
                    <CollapsibleCard
                        title="Advanced Proxy Configuration"
                        icon={<Settings size={16} className="text-gray-400" />}
                        defaultExpanded={false}
                    >
                        <div className="divide-y divide-gray-100 dark:divide-base-200">

                            {/* Row 1 — Network */}
                            <div className="px-5 py-4 grid grid-cols-3 gap-6">
                                {/* Port */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                        {t('proxy.config.port')}
                                        <HelpTooltip text={t('proxy.config.port_tooltip')} placement="right" />
                                    </div>
                                    <input
                                        type="number"
                                        value={appConfig.proxy.port}
                                        onChange={(e) => updateProxyConfig({ port: parseInt(e.target.value) })}
                                        min={8000} max={65535}
                                        disabled={status.running}
                                        className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded-md bg-white dark:bg-base-200 text-xs font-mono text-gray-900 dark:text-base-content focus:ring-1 focus:ring-gray-400 focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    />
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">{t('proxy.config.port_hint')}</p>
                                </div>

                                {/* Timeout */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                        {t('proxy.config.request_timeout')}
                                        <HelpTooltip text={t('proxy.config.request_timeout_tooltip')} placement="top" />
                                    </div>
                                    <input
                                        type="number"
                                        value={appConfig.proxy.request_timeout || 120}
                                        onChange={(e) => {
                                            const value = parseInt(e.target.value);
                                            const timeout = Math.max(30, Math.min(7200, value));
                                            updateProxyConfig({ request_timeout: timeout });
                                        }}
                                        min={30} max={7200}
                                        disabled={status.running}
                                        className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded-md bg-white dark:bg-base-200 text-xs font-mono text-gray-900 dark:text-base-content focus:ring-1 focus:ring-gray-400 focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    />
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">{t('proxy.config.request_timeout_hint')}</p>
                                </div>

                                {/* Auto Start + LAN */}
                                <div className="space-y-3 pt-0.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-gray-600 dark:text-gray-400 inline-flex items-center gap-1">
                                            {t('proxy.config.auto_start')}
                                            <HelpTooltip text={t('proxy.config.auto_start_tooltip')} placement="right" />
                                        </span>
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                            checked={appConfig.proxy.auto_start}
                                            onChange={(e) => updateProxyConfig({ auto_start: e.target.checked })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-gray-600 dark:text-gray-400 inline-flex items-center gap-1">
                                            {t('proxy.config.allow_lan_access')}
                                            <HelpTooltip text={t('proxy.config.allow_lan_access_tooltip')} placement="right" />
                                        </span>
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                            checked={appConfig.proxy.allow_lan_access || false}
                                            onChange={(e) => updateProxyConfig({ allow_lan_access: e.target.checked })}
                                        />
                                    </div>
                                    {(appConfig.proxy.allow_lan_access || false) && (
                                        <p className="text-[10px] text-amber-600 dark:text-amber-500 leading-relaxed">
                                            {t('proxy.config.allow_lan_access_warning')}
                                        </p>
                                    )}
                                    {status.running && (appConfig.proxy.allow_lan_access || false) && (
                                        <p className="text-[10px] text-blue-500 dark:text-blue-400 leading-relaxed">
                                            {t('proxy.config.allow_lan_access_restart_hint')}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Row 2 — Authorization */}
                            <div className="px-5 py-4 grid grid-cols-3 gap-6 items-start">
                                <div className="col-span-1">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
                                        {t('proxy.config.auth.title')}
                                    </div>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
                                        {t('proxy.config.auth.hint')}
                                    </p>
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-gray-600 dark:text-gray-400 inline-flex items-center gap-1">
                                            {(appConfig.proxy.auth_mode || 'off') !== 'off' ? t('proxy.config.auth.enabled') : t('common.disabled')}
                                            <HelpTooltip text={t('proxy.config.auth.enabled_tooltip')} placement="left" />
                                        </span>
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                            checked={(appConfig.proxy.auth_mode || 'off') !== 'off'}
                                            onChange={(e) => updateProxyConfig({ auth_mode: e.target.checked ? 'all_except_health' : 'off' })}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 inline-flex items-center gap-1">
                                            {t('proxy.config.auth.mode')}
                                            <HelpTooltip text={t('proxy.config.auth.mode_tooltip')} placement="top" />
                                        </span>
                                        <select
                                            value={appConfig.proxy.auth_mode || 'off'}
                                            onChange={(e) => updateProxyConfig({ auth_mode: e.target.value as ProxyConfig['auth_mode'] })}
                                            className="flex-1 px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded-md bg-white dark:bg-base-200 text-xs text-gray-900 dark:text-base-content focus:ring-1 focus:ring-gray-400 focus:border-transparent transition-colors"
                                        >
                                            <option value="off">{t('proxy.config.auth.modes.off')}</option>
                                            <option value="strict">{t('proxy.config.auth.modes.strict')}</option>
                                            <option value="all_except_health">{t('proxy.config.auth.modes.all_except_health')}</option>
                                            <option value="auto">{t('proxy.config.auth.modes.auto')}</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Row 3 — API Key */}
                            <div className="px-5 py-4 grid grid-cols-3 gap-6 items-start">
                                <div className="col-span-1">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1 inline-flex items-center gap-1">
                                        {t('proxy.config.api_key')}
                                        <HelpTooltip text={t('proxy.config.api_key_tooltip')} placement="right" />
                                    </div>
                                    <p className="text-[10px] text-amber-600 dark:text-amber-500 leading-relaxed">
                                        {t('proxy.config.warning_key')}
                                    </p>
                                </div>
                                <div className="col-span-2 flex gap-1.5">
                                    <input
                                        type="text"
                                        value={isEditingApiKey ? tempApiKey : appConfig.proxy.api_key}
                                        onChange={(e) => isEditingApiKey && setTempApiKey(e.target.value)}
                                        readOnly={!isEditingApiKey}
                                        className={cn(
                                            'flex-1 px-2.5 py-1.5 border rounded-md text-xs font-mono transition-colors',
                                            isEditingApiKey
                                                ? 'border-gray-300 dark:border-base-200 bg-white dark:bg-base-200 text-gray-900 dark:text-base-content focus:ring-1 focus:ring-gray-400 focus:border-transparent'
                                                : 'border-gray-200 dark:border-base-200 bg-gray-50 dark:bg-base-300 text-gray-500 dark:text-gray-400'
                                        )}
                                    />
                                    {isEditingApiKey ? (
                                        <>
                                            <button onClick={handleSaveApiKey} title={t('proxy.config.btn_save')} className="px-2.5 py-1.5 border border-emerald-200 dark:border-emerald-800/50 rounded-md bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors">
                                                <CheckCircle size={13} />
                                            </button>
                                            <button onClick={handleCancelEditApiKey} title={t('common.cancel')} className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded-md bg-white dark:bg-base-200 hover:bg-gray-50 dark:hover:bg-base-300 transition-colors text-gray-500">
                                                <X size={13} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={handleEditApiKey} title={t('proxy.config.btn_edit')} className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded-md bg-white dark:bg-base-200 hover:bg-gray-50 dark:hover:bg-base-300 transition-colors text-gray-500">
                                                <Edit2 size={13} />
                                            </button>
                                            <button onClick={handleGenerateApiKey} title={t('proxy.config.btn_regenerate')} className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded-md bg-white dark:bg-base-200 hover:bg-gray-50 dark:hover:bg-base-300 transition-colors text-gray-500">
                                                <RefreshCw size={13} />
                                            </button>
                                            <button onClick={() => copyToClipboardHandler(appConfig.proxy.api_key, 'api_key')} title={t('proxy.config.btn_copy')} className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded-md bg-white dark:bg-base-200 hover:bg-gray-50 dark:hover:bg-base-300 transition-colors text-gray-500">
                                                {copied === 'api_key' ? <CheckCircle size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Row 4 — Web UI Password */}
                            <div className="px-5 py-4 grid grid-cols-3 gap-6 items-start">
                                <div className="col-span-1">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1 inline-flex items-center gap-1">
                                        {t('proxy.config.admin_password', { defaultValue: 'Web UI Password' })}
                                        <HelpTooltip text={t('proxy.config.admin_password_tooltip', { defaultValue: 'Used for the Web Management Console. Defaults to API Key if empty.' })} placement="right" />
                                    </div>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
                                        {t('proxy.config.admin_password_hint', { defaultValue: 'Set a separate password for Docker/Browser deployments.' })}
                                    </p>
                                </div>
                                <div className="col-span-2 flex gap-1.5">
                                    <input
                                        type="text"
                                        value={isEditingAdminPassword ? tempAdminPassword : (appConfig.proxy.admin_password || t('proxy.config.admin_password_default', { defaultValue: '(Same as API Key)' }))}
                                        onChange={(e) => isEditingAdminPassword && setTempAdminPassword(e.target.value)}
                                        readOnly={!isEditingAdminPassword}
                                        placeholder={t('proxy.config.admin_password_placeholder', { defaultValue: 'Leave empty to use API Key' })}
                                        className={cn(
                                            'flex-1 px-2.5 py-1.5 border rounded-md text-xs font-mono transition-colors',
                                            isEditingAdminPassword
                                                ? 'border-gray-300 dark:border-base-200 bg-white dark:bg-base-200 text-gray-900 dark:text-base-content focus:ring-1 focus:ring-gray-400 focus:border-transparent'
                                                : 'border-gray-200 dark:border-base-200 bg-gray-50 dark:bg-base-300 text-gray-500 dark:text-gray-400'
                                        )}
                                    />
                                    {isEditingAdminPassword ? (
                                        <>
                                            <button onClick={handleSaveAdminPassword} title={t('proxy.config.btn_save')} className="px-2.5 py-1.5 border border-emerald-200 dark:border-emerald-800/50 rounded-md bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors">
                                                <CheckCircle size={13} />
                                            </button>
                                            <button onClick={handleCancelEditAdminPassword} title={t('common.cancel')} className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded-md bg-white dark:bg-base-200 hover:bg-gray-50 dark:hover:bg-base-300 transition-colors text-gray-500">
                                                <X size={13} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={handleEditAdminPassword} title={t('proxy.config.btn_edit')} className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded-md bg-white dark:bg-base-200 hover:bg-gray-50 dark:hover:bg-base-300 transition-colors text-gray-500">
                                                <Edit2 size={13} />
                                            </button>
                                            <button onClick={() => copyToClipboardHandler(appConfig.proxy.admin_password || appConfig.proxy.api_key, 'admin_password')} title={t('proxy.config.btn_copy')} className="px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded-md bg-white dark:bg-base-200 hover:bg-gray-50 dark:hover:bg-base-300 transition-colors text-gray-500">
                                                {copied === 'admin_password' ? <CheckCircle size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Row 5 — User-Agent */}
                            <div className="px-5 py-4 grid grid-cols-3 gap-6 items-start">
                                <div className="col-span-1">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1 inline-flex items-center gap-1">
                                        {t('proxy.config.request.user_agent', { defaultValue: 'User-Agent Override' })}
                                        <HelpTooltip text={t('proxy.config.request.user_agent_tooltip', { defaultValue: 'Override the User-Agent header sent to upstream APIs.' })} />
                                    </div>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
                                        {t('common.example', { defaultValue: 'Example' })}: <span className="font-mono">antigravity/1.15.8 darwin/arm64</span>
                                    </p>
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-gray-600 dark:text-gray-400">
                                            {!!appConfig.proxy.user_agent_override ? 'Enabled' : 'Disabled'}
                                        </span>
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                            checked={!!appConfig.proxy.user_agent_override}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    const restoredValue = appConfig.proxy.saved_user_agent || 'antigravity/1.15.8 darwin/arm64';
                                                    updateProxyConfig({ user_agent_override: restoredValue, saved_user_agent: restoredValue });
                                                } else {
                                                    updateProxyConfig({ user_agent_override: undefined });
                                                }
                                            }}
                                        />
                                    </div>
                                    {!!appConfig.proxy.user_agent_override && (
                                        <input
                                            type="text"
                                            value={appConfig.proxy.user_agent_override}
                                            onChange={(e) => {
                                                const newValue = e.target.value;
                                                updateProxyConfig({ user_agent_override: newValue, saved_user_agent: newValue });
                                            }}
                                            className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-base-200 rounded-md bg-white dark:bg-base-200 text-xs font-mono text-gray-900 dark:text-base-content focus:ring-1 focus:ring-gray-400 focus:border-transparent transition-colors animate-in fade-in slide-in-from-top-1 duration-200"
                                            placeholder={t('proxy.config.request.user_agent_placeholder', { defaultValue: 'Enter custom User-Agent string...' })}
                                        />
                                    )}
                                </div>
                            </div>

                        </div>
                    </CollapsibleCard>
                )}

                {/* External Providers Integration */}
                {
                    !configLoading && !configError && appConfig && (
                        <div className="space-y-3">
                            <CollapsibleCard
                                title={t('proxy.cli_sync.title', { defaultValue: 'CLI Sync' })}
                                icon={<Terminal size={16} className="text-gray-400" />}
                                defaultExpanded={false}
                            >
                                <CliSyncCard
                                    proxyUrl={status.running ? status.base_url : `http://127.0.0.1:${appConfig.proxy.port || 8045}`}
                                    apiKey={appConfig.proxy.api_key}
                                />
                            </CollapsibleCard>

                            {/* Account Scheduling & Rotation */}
                            <CollapsibleCard
                                title={t('proxy.config.scheduling.title')}
                                icon={<RefreshCw size={16} className="text-gray-400" />}
                            >
                                <div className="p-5 space-y-6">

                                    {/* Scheduling Mode */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 inline-flex items-center gap-1">
                                                {t('proxy.config.scheduling.mode')}
                                                <HelpTooltip text={t('proxy.config.scheduling.mode_tooltip')} placement="right" />
                                            </span>
                                            <button
                                                onClick={handleClearSessionBindings}
                                                className="text-[10px] text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                                                title={t('proxy.config.scheduling.clear_bindings_tooltip')}
                                            >
                                                <Trash2 size={11} />
                                                {t('proxy.config.scheduling.clear_bindings')}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            {(['CacheFirst', 'Balance', 'PerformanceFirst'] as const).map(mode => {
                                                const isActive = (appConfig.proxy.scheduling?.mode || 'Balance') === mode;
                                                return (
                                                    <label
                                                        key={mode}
                                                        className={cn(
                                                            'flex flex-col gap-1.5 p-3 rounded-lg border cursor-pointer transition-all',
                                                            isActive
                                                                ? 'border-gray-800 dark:border-gray-400 bg-gray-50 dark:bg-white/5 shadow-sm'
                                                                : 'border-gray-200 dark:border-base-200 hover:border-gray-300 dark:hover:border-gray-600'
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="radio"
                                                                className="radio radio-xs shrink-0"
                                                                checked={isActive}
                                                                onChange={() => updateSchedulingConfig({ mode })}
                                                            />
                                                            <span className="text-[11px] font-semibold text-gray-900 dark:text-base-content">
                                                                {t(`proxy.config.scheduling.modes.${mode}`)}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed pl-5">
                                                            {t(`proxy.config.scheduling.modes_desc.${mode}`, {
                                                                defaultValue: mode === 'CacheFirst' ? 'Binds session to account, waits precisely if limited.' :
                                                                    mode === 'Balance' ? 'Auto-switches to available account if limited.' :
                                                                        'Pure round-robin rotation (Best for high concurrency).'
                                                            })}
                                                        </p>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 dark:border-base-200" />

                                    {/* Max Wait + Fixed Account side by side */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                                        {/* Max Wait */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 inline-flex items-center gap-1">
                                                    {t('proxy.config.scheduling.max_wait')}
                                                    <HelpTooltip text={t('proxy.config.scheduling.max_wait_tooltip')} />
                                                </span>
                                                <span className="text-[11px] font-mono font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                                                    {appConfig.proxy.scheduling?.max_wait_seconds || 60}s
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0" max="300" step="10"
                                                disabled={(appConfig.proxy.scheduling?.mode || 'Balance') !== 'CacheFirst'}
                                                className="range range-xs w-full"
                                                value={appConfig.proxy.scheduling?.max_wait_seconds || 60}
                                                onChange={(e) => updateSchedulingConfig({ max_wait_seconds: parseInt(e.target.value) })}
                                            />
                                            <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                                                <span>0s</span>
                                                <span>300s</span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed pt-1">
                                                {t('proxy.config.scheduling.subtitle')}
                                            </p>
                                        </div>

                                        {/* Fixed Account Mode */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 inline-flex items-center gap-1">
                                                    {t('proxy.config.scheduling.fixed_account', { defaultValue: 'Fixed Account Mode' })}
                                                    <HelpTooltip text={t('proxy.config.scheduling.fixed_account_tooltip', { defaultValue: 'When enabled, all API requests will use only the selected account instead of rotating.' })} />
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                                    checked={preferredAccountId !== null}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            if (availableAccounts.length > 0) {
                                                                handleSetPreferredAccount(availableAccounts[0].id);
                                                            }
                                                        } else {
                                                            handleSetPreferredAccount(null);
                                                        }
                                                    }}
                                                    disabled={!status.running}
                                                />
                                            </div>
                                            {preferredAccountId !== null && (
                                                <select
                                                    className="select select-bordered select-sm w-full text-xs"
                                                    value={preferredAccountId || ''}
                                                    onChange={(e) => handleSetPreferredAccount(e.target.value || null)}
                                                    disabled={!status.running}
                                                >
                                                    {availableAccounts.map(account => (
                                                        <option key={account.id} value={account.id}>
                                                            {account.email}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                            {!status.running && (
                                                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                                    {t('proxy.config.scheduling.start_proxy_first', { defaultValue: 'Start the proxy service to configure fixed account mode.' })}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Circuit Breaker */}
                                    {appConfig.circuit_breaker && (
                                        <>
                                            <div className="border-t border-gray-100 dark:border-base-200" />
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 inline-flex items-center gap-1">
                                                        {t('proxy.config.circuit_breaker.title', { defaultValue: 'Adaptive Circuit Breaker' })}
                                                        <HelpTooltip text={t('proxy.config.circuit_breaker.tooltip', { defaultValue: 'Prevent continuous failures by exponentially backing off when quota is exhausted.' })} />
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                                        checked={appConfig.circuit_breaker.enabled}
                                                        onChange={(e) => updateCircuitBreakerConfig({ ...appConfig.circuit_breaker, enabled: e.target.checked })}
                                                    />
                                                </div>
                                                {appConfig.circuit_breaker.enabled && (
                                                    <CircuitBreaker
                                                        config={appConfig.circuit_breaker}
                                                        onChange={updateCircuitBreakerConfig}
                                                    />
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </CollapsibleCard>

                            {/* Advanced Thinking & Global Config */}
                            <CollapsibleCard
                                title={t('settings.advanced_thinking.title', { defaultValue: 'Advanced Thinking & Global Config' })}
                                icon={<BrainCircuit size={16} className="text-gray-400" />}
                            >
                                <AdvancedThinking
                                    config={appConfig.proxy}
                                    onChange={(newProxyConfig) => updateProxyConfig(newProxyConfig)}
                                />
                            </CollapsibleCard>

                            {/* 公网访问 (Cloudflared) - 仅在桌面端显示 */}
                            {isTauri() && (
                                <CollapsibleCard
                                    title={t('proxy.cloudflared.title', { defaultValue: 'Public Access (Cloudflared)' })}
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>}
                                    enabled={cfStatus.running}
                                    onToggle={handleCfToggle}
                                    allowInteractionWhenDisabled={true}
                                    rightElement={
                                        cfLoading ? (
                                            <span className="loading loading-spinner loading-xs"></span>
                                        ) :                                         cfStatus.running && cfStatus.url ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleCfCopyUrl(); }}
                                                className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-base-300 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-base-200 transition-colors flex items-center gap-1"
                                            >
                                                {copied === 'cf-url' ? <CheckCircle size={12} /> : <Copy size={12} />}
                                                {cfStatus.url.replace('https://', '').slice(0, 20)}...
                                            </button>
                                        ) : null
                                    }
                                >
                                    <div className="space-y-4">
                                        {/* 安装状态 */}
                                        {!cfStatus.installed ? (
                                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-base-200 rounded-lg border border-gray-200 dark:border-base-300">
                                                <div className="space-y-1">
                                                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                                        {t('proxy.cloudflared.not_installed', { defaultValue: 'Cloudflared not installed' })}
                                                    </span>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {t('proxy.cloudflared.install_hint', { defaultValue: 'Click to download and install cloudflared binary' })}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={handleCfInstall}
                                                    disabled={cfLoading}
                                                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-950 text-white hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2 transition-colors"
                                                >
                                                    {cfLoading ? <span className="loading loading-spinner loading-xs"></span> : null}
                                                    {t('proxy.cloudflared.install', { defaultValue: 'Install' })}
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* 版本信息 */}
                                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                    <CheckCircle size={14} className="text-green-500" />
                                                    {t('proxy.cloudflared.installed', { defaultValue: 'Installed' })}: {cfStatus.version || 'Unknown'}
                                                </div>

                                                {/* 隧道模式选择 */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => {
                                                            setCfMode('quick');
                                                            if (appConfig) {
                                                                saveConfig({
                                                                    ...appConfig,
                                                                    cloudflared: { ...appConfig.cloudflared, mode: 'quick' }
                                                                });
                                                            }
                                                        }}
                                                        disabled={cfStatus.running}
                                                        className={cn(
                                                            "p-3 rounded-md border text-left transition-all",
                                                            cfMode === 'quick'
                                                                ? "border-zinc-950 dark:border-zinc-200 bg-zinc-50 dark:bg-zinc-900/40"
                                                                : "border-gray-200 dark:border-base-200 hover:border-gray-300 dark:hover:border-base-300",
                                                            cfStatus.running && "opacity-50 cursor-not-allowed"
                                                        )}
                                                    >
                                                        <div className="text-xs font-semibold text-gray-900 dark:text-base-content">
                                                            {t('proxy.cloudflared.mode_quick', { defaultValue: 'Quick Tunnel' })}
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                                            {t('proxy.cloudflared.mode_quick_desc', { defaultValue: 'Auto-generated temporary URL (*.trycloudflare.com)' })}
                                                        </p>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setCfMode('auth');
                                                            if (appConfig) {
                                                                saveConfig({
                                                                    ...appConfig,
                                                                    cloudflared: { ...appConfig.cloudflared, mode: 'auth' }
                                                                });
                                                            }
                                                        }}
                                                        disabled={cfStatus.running}
                                                        className={cn(
                                                            "p-3 rounded-md border text-left transition-all",
                                                            cfMode === 'auth'
                                                                ? "border-zinc-950 dark:border-zinc-200 bg-zinc-50 dark:bg-zinc-900/40"
                                                                : "border-gray-200 dark:border-base-200 hover:border-gray-300 dark:hover:border-base-300",
                                                            cfStatus.running && "opacity-50 cursor-not-allowed"
                                                        )}
                                                    >
                                                        <div className="text-xs font-semibold text-gray-900 dark:text-base-content">
                                                            {t('proxy.cloudflared.mode_auth', { defaultValue: 'Named Tunnel' })}
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                                            {t('proxy.cloudflared.mode_auth_desc', { defaultValue: 'Use your Cloudflare account with custom domain' })}
                                                        </p>
                                                    </button>
                                                </div>

                                                {/* Token输入 (仅auth模式) */}
                                                {cfMode === 'auth' && (
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                            {t('proxy.cloudflared.token', { defaultValue: 'Tunnel Token' })}
                                                        </label>
                                                        <input
                                                            type="password"
                                                            value={cfToken}
                                                            onChange={(e) => setCfToken(e.target.value)}
                                                            onBlur={() => {
                                                                if (appConfig) {
                                                                    saveConfig({
                                                                        ...appConfig,
                                                                        cloudflared: { ...appConfig.cloudflared, token: cfToken }
                                                                    });
                                                                }
                                                            }}
                                                            disabled={cfStatus.running}
                                                            placeholder="eyJhIjoiNj..."
                                                            className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-base-200 bg-white dark:bg-base-200 text-xs font-mono disabled:opacity-60 focus:ring-1 focus:ring-zinc-950 focus:border-transparent"
                                                        />
                                                    </div>
                                                )}

                                                {/* HTTP2选项 */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-base-200 border border-gray-200 dark:border-base-300 rounded-lg">
                                                    <div className="space-y-0.5">
                                                        <span className="text-xs font-semibold text-gray-900 dark:text-base-content">
                                                            {t('proxy.cloudflared.use_http2', { defaultValue: 'Use HTTP/2' })}
                                                        </span>
                                                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                                            {t('proxy.cloudflared.use_http2_desc', { defaultValue: 'More compatible, recommended for China mainland' })}
                                                        </p>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="toggle toggle-sm border-gray-300 dark:border-gray-600 checked:bg-sky-300 checked:border-sky-300 dark:checked:bg-sky-400 dark:checked:border-sky-400"
                                                        checked={cfUseHttp2}
                                                        onChange={(e) => {
                                                            const val = e.target.checked;
                                                            setCfUseHttp2(val);
                                                            if (appConfig) {
                                                                const newConfig = {
                                                                    ...appConfig,
                                                                    cloudflared: {
                                                                        ...appConfig.cloudflared,
                                                                        use_http2: val
                                                                    }
                                                                };
                                                                saveConfig(newConfig);
                                                            }
                                                        }}
                                                        disabled={cfStatus.running}
                                                    />
                                                </div>

                                                {/* 运行状态和URL */}
                                                {cfStatus.running && (
                                                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 border border-gray-200 dark:border-base-300 rounded-lg">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                                                {t('proxy.cloudflared.running', { defaultValue: 'Tunnel Running' })}
                                                            </span>
                                                        </div>
                                                        {cfStatus.url && (
                                                            <div className="flex items-center gap-2">
                                                                <code className="flex-1 px-2.5 py-1.5 bg-white dark:bg-base-100 rounded text-[10px] font-mono text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-base-300 break-all">
                                                                    {cfStatus.url}
                                                                </code>
                                                                <button
                                                                    onClick={handleCfCopyUrl}
                                                                    className="p-1.5 border border-gray-200 dark:border-base-200 rounded-md bg-white dark:bg-base-100 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-base-200 transition-colors shrink-0"
                                                                >
                                                                    {copied === 'cf-url' ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* 错误信息 */}
                                                {cfStatus.error && (
                                                    <div className="p-3 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-950/30 text-xs text-red-700 dark:text-red-300">
                                                        {cfStatus.error}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </CollapsibleCard>
                            )}
                        </div>
                    )
                }

                {/* Supported models */}
                {
                    !configLoading && !configError && appConfig && (
                        <div className="bg-white dark:bg-base-100 rounded-lg border border-gray-200 dark:border-base-200 overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-base-200 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h2 className="text-sm font-semibold text-gray-950 dark:text-base-content flex items-center gap-2">
                                        <Terminal size={15} className="text-gray-400 shrink-0" />
                                        Models and Client Setup
                                    </h2>
                                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                        Select a protocol and model. The setup example updates on the right.
                                    </p>
                                </div>
                                <div className="inline-flex rounded-md border border-gray-200 dark:border-base-200 bg-gray-50 dark:bg-base-200 p-0.5 w-fit shrink-0">
                                    {(['openai', 'anthropic', 'gemini'] as const).map(protocol => (
                                        <button
                                            key={protocol}
                                            onClick={() => setSelectedProtocol(protocol)}
                                            className={cn(
                                                'px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors',
                                                selectedProtocol === protocol
                                                    ? 'bg-white dark:bg-base-100 text-gray-950 dark:text-gray-100 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                                            )}
                                        >
                                            {protocol}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x divide-gray-100 dark:divide-gray-700 lg:h-[520px]">
                                {/* Model list */}
                                <div className="col-span-2 p-0 min-h-0">
                                    <div className="h-[420px] lg:h-full overflow-auto">
                                        <table className="table table-fixed w-full">
                                            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-base-200 text-gray-500 dark:text-gray-400">
                                                <tr>
                                                    <th className="w-9 pl-3"></th>
                                                    <th className="w-[30%] text-[10px] font-semibold tracking-wide">{t('proxy.supported_models.model_name')}</th>
                                                    <th className="w-[34%] text-[10px] font-semibold tracking-wide">{t('proxy.supported_models.model_id')}</th>
                                                    <th className="w-[24%] text-[10px] hidden sm:table-cell font-semibold tracking-wide">{t('proxy.supported_models.description')}</th>
                                                    <th className="w-20 text-[10px] text-center font-semibold tracking-wide">{t('proxy.supported_models.action')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredModels.map((m) => (
                                                    <tr
                                                        key={m.id}
                                                        className={cn(
                                                            'hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors',
                                                            selectedModelId === m.id && 'bg-gray-50 dark:bg-white/10'
                                                        )}
                                                        onClick={() => setSelectedModelId(m.id)}
                                                    >
                                                        <td className="pl-4 text-gray-400 align-middle">{m.icon}</td>
                                                        <td className="font-semibold text-xs text-gray-900 dark:text-base-content align-middle truncate" title={m.name}>{m.name}</td>
                                                        <td className="font-mono text-[10px] text-gray-500 align-middle truncate" title={m.id}>{m.id}</td>
                                                        <td className="text-[10px] text-gray-400 hidden sm:table-cell align-middle truncate" title={m.desc}>{m.desc}</td>
                                                        <td className="text-center">
                                                            <button
                                                                className="btn btn-ghost btn-xs text-gray-500 hover:text-gray-950 dark:hover:text-gray-100"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    copyToClipboardHandler(m.id, `model-${m.id}`);
                                                                }}
                                                            >
                                                                {copied === `model-${m.id}`
                                                                    ? <CheckCircle size={13} />
                                                                    : <div className="flex items-center gap-1 text-[10px] font-semibold"><Copy size={11} /> {t('common.copy')}</div>
                                                                }
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Code preview */}
                                <div className="col-span-1 bg-zinc-950 text-zinc-100 flex flex-col h-[420px] lg:h-full min-h-0">
                                    <div className="px-3 py-2.5 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('proxy.multi_protocol.quick_integration')}</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded border border-zinc-800 text-zinc-400">
                                            {selectedProtocol === 'anthropic' ? 'Python (Anthropic SDK)' : (selectedProtocol === 'gemini' ? 'Python (Google GenAI)' : 'Python (OpenAI SDK)')}
                                        </span>
                                    </div>
                                    <div className="flex-1 relative overflow-hidden group">
                                        <div className="absolute inset-0 overflow-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                                            <pre className="p-4 text-[10px] font-mono leading-relaxed">
                                                {getPythonExample(selectedModelId)}
                                            </pre>
                                        </div>
                                        <button
                                            onClick={() => copyToClipboardHandler(getPythonExample(selectedModelId), 'example-code')}
                                            className="absolute top-3 right-3 p-1.5 bg-white/10 hover:bg-white/20 rounded-md transition-colors text-white opacity-0 group-hover:opacity-100"
                                        >
                                            {copied === 'example-code' ? <CheckCircle size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <div className="px-3 py-2 bg-zinc-900/60 border-t border-zinc-800/80 text-[10px] text-zinc-500 shrink-0">
                                        {t('proxy.multi_protocol.click_tip')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
                {/* 各种对话框 */}
                <ModalDialog
                    isOpen={isRegenerateKeyConfirmOpen}
                    title={t('proxy.dialog.regenerate_key_title') || t('proxy.dialog.confirm_regenerate')}
                    message={t('proxy.dialog.regenerate_key_msg') || t('proxy.dialog.confirm_regenerate')}
                    type="confirm"
                    isDestructive={true}
                    onConfirm={executeGenerateApiKey}
                    onCancel={() => setIsRegenerateKeyConfirmOpen(false)}
                />

                <ModalDialog
                    isOpen={isClearBindingsConfirmOpen}
                    title={t('proxy.dialog.clear_bindings_title') || '清除会话绑定'}
                    message={t('proxy.dialog.clear_bindings_msg') || '确定要清除所有会话与账号的绑定映射吗？'}
                    type="confirm"
                    isDestructive={true}
                    onConfirm={executeClearSessionBindings}
                    onCancel={() => setIsClearBindingsConfirmOpen(false)}
                />

            </div >
        </div >
    );
}
