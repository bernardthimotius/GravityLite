import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    Loader2,
    Eye,
    RotateCcw,
    Copy,
    X,
    Trash2
} from 'lucide-react';

import { copyToClipboard } from '../../utils/clipboard';
import { request as invoke } from '../../utils/request';
import { showToast } from '../common/ToastContainer';
import ModalDialog from '../common/ModalDialog';
import { cn } from '../../utils/cn';

import { OpenCodeSyncModal } from './OpenCodeSyncModal';
import { useProxyModels } from '../../hooks/useProxyModels';
import GroupedSelect from '../common/GroupedSelect';

interface CliSyncCardProps {
    proxyUrl: string;
    apiKey: string;
    className?: string;
}

type CliAppType = 'Claude' | 'Codex' | 'Gemini' | 'OpenCode';

interface CliStatus {
    installed: boolean;
    version: string | null;
    is_synced: boolean;
    has_backup: boolean;
    current_base_url: string | null;
    files: string[];
    synced_count?: number;
}

export const CliSyncCard = ({ proxyUrl, apiKey, className }: CliSyncCardProps) => {
    const { t } = useTranslation();
    const [statuses, setStatuses] = useState<Record<CliAppType, CliStatus | null>>({
        Claude: null,
        Codex: null,
        Gemini: null,
        OpenCode: null,
    });
    const [loading, setLoading] = useState<Record<CliAppType, boolean>>({
        Claude: false,
        Codex: false,
        Gemini: false,
        OpenCode: false,
    });
    const [syncing, setSyncing] = useState<Record<CliAppType, boolean>>({
        Claude: false,
        Codex: false,
        Gemini: false,
        OpenCode: false,
    });
    const [syncAccounts, setSyncAccounts] = useState(false);
    const [selectedModels, setSelectedModels] = useState<Record<CliAppType, string>>({
        Claude: 'claude-3-5-sonnet-latest',
        Codex: 'gpt-4o',
        Gemini: 'gemini-1.5-pro',
        OpenCode: '',
    });
    const [viewingConfig, setViewingConfig] = useState<{
        app: CliAppType,
        content: string,
        fileName: string,
        allFiles: string[]
    } | null>(null);
    const [restoreConfirmApp, setRestoreConfirmApp] = useState<CliAppType | null>(null);
    const [syncConfirmApp, setSyncConfirmApp] = useState<CliAppType | null>(null);
    const [openCodeSyncModal, setOpenCodeSyncModal] = useState(false);
    const [clearConfirmApp, setClearConfirmApp] = useState<CliAppType | null>(null);

    const { models: proxyModels } = useProxyModels();

    const modelOptions = proxyModels.map(m => ({
        value: m.id,
        label: m.name,
        group: m.group || 'General'
    }));

    // 根据不同的 CLI 应用格式化 Proxy URL
    const getFormattedProxyUrl = useCallback((app: CliAppType) => {
        if (!proxyUrl) return '';
        const base = proxyUrl.trimEnd().replace(/\/+$/, '');
        // Codex & OpenCode (OpenAI 协议) 通常需要带 /v1
        if (app === 'Codex' || app === 'OpenCode') {
            return base.endsWith('/v1') ? base : `${base}/v1`;
        }
        // Claude 和 Gemini 的 SDK 通常会自动处理版本路径或不需要 /v1
        return base.replace(/\/v1$/, '');
    }, [proxyUrl]);

    const checkStatus = useCallback(async (app: CliAppType) => {
        setLoading(prev => ({ ...prev, [app]: true }));
        try {
            const formattedUrl = getFormattedProxyUrl(app);
            let command: string;
            let params: Record<string, unknown>;
            if (app === 'OpenCode') {
                command = 'get_opencode_sync_status';
                params = { proxyUrl: formattedUrl };
            } else {
                command = 'get_cli_sync_status';
                params = { appType: app, proxyUrl: formattedUrl };
            }

            const status = await invoke<CliStatus>(command, params);
            setStatuses(prev => ({ ...prev, [app]: status }));
        } catch (error) {
            console.error(`Failed to check ${app} status:`, error);
        } finally {
            setLoading(prev => ({ ...prev, [app]: false }));
        }
    }, [getFormattedProxyUrl]);

    const handleSync = async (app: CliAppType) => {
        if (app === 'OpenCode') {
            setOpenCodeSyncModal(true);
            return;
        }
        setSyncConfirmApp(app);
    };

    const executeSync = async () => {
        const app = syncConfirmApp;
        if (!app) return;
        setSyncConfirmApp(null);

        if (!proxyUrl || !apiKey) {
            showToast(t('proxy.cli_sync.toast.config_missing', { defaultValue: 'Generate an API key and start the service first' }), 'error');
            return;
        }

        try {
            const formattedUrl = getFormattedProxyUrl(app);
            const command = app === 'OpenCode' ? 'execute_opencode_sync' : 'execute_cli_sync';
            const params = app === 'OpenCode'
                ? { proxyUrl: formattedUrl, apiKey: apiKey, syncAccounts: syncAccounts }
                : { appType: app, proxyUrl: formattedUrl, apiKey: apiKey, model: selectedModels[app] };
            await invoke(command, params);
            showToast(t(app === 'OpenCode' ? 'proxy.opencode_sync.toast.sync_success' : 'proxy.cli_sync.toast.sync_success', { name: app, defaultValue: `${app} synced successfully` }), 'success');
            await checkStatus(app);
        } catch (error: any) {
            showToast(t(app === 'OpenCode' ? 'proxy.opencode_sync.toast.sync_error' : 'proxy.cli_sync.toast.sync_error', { name: app, error: error.toString(), defaultValue: `Sync failed: ${error.toString()}` }), 'error');
        } finally {
            setSyncing(prev => ({ ...prev, [app]: false }));
        }
    };

    const handleRestore = (app: CliAppType) => {
        setRestoreConfirmApp(app);
    };

    const executeRestore = async () => {
        if (!restoreConfirmApp) return;
        const app = restoreConfirmApp;
        setRestoreConfirmApp(null);

        setSyncing(prev => ({ ...prev, [app]: true }));
        try {
            const command = app === 'OpenCode' ? 'execute_opencode_restore' : 'execute_cli_restore';
            const params = app === 'OpenCode' ? {} : { appType: app };
            await invoke(command, params);
            showToast(t('common.success'), 'success');
            await checkStatus(app);
        } catch (error: any) {
            showToast(error.toString(), 'error');
        } finally {
            setSyncing(prev => ({ ...prev, [app]: false }));
        }
    };

    const handleClear = (app: CliAppType) => {
        setClearConfirmApp(app);
    };

    const executeClear = async () => {
        if (!clearConfirmApp) return;
        const app = clearConfirmApp;
        setClearConfirmApp(null);

        setSyncing(prev => ({ ...prev, [app]: true }));
        try {
            const formattedUrl = getFormattedProxyUrl(app);
            await invoke('execute_opencode_clear', { proxyUrl: formattedUrl, clearLegacy: true });
            showToast(t('proxy.opencode_sync.toast.clear_success', { defaultValue: 'OpenCode cleared successfully' }), 'success');
            await checkStatus(app);
        } catch (error: any) {
            showToast(t('proxy.opencode_sync.toast.clear_error', { defaultValue: `Clear failed: ${error.toString()}` }), 'error');
        } finally {
            setSyncing(prev => ({ ...prev, [app]: false }));
        }
    };

    const handleViewConfig = async (app: CliAppType, fileName?: string) => {
        try {
            const status = statuses[app];
            if (!status) return;

            const targetFile = fileName || status.files[0];
            let command: string;
            let params: Record<string, unknown>;
            if (app === 'OpenCode') {
                command = 'get_opencode_config_content';
                params = { request: { fileName: targetFile } };
            } else {
                command = 'get_cli_config_content';
                params = { appType: app, fileName: targetFile };
            }

            const content = await invoke<string>(command, params);
            setViewingConfig({
                app,
                content,
                fileName: targetFile,
                allFiles: status.files
            });
        } catch (error: any) {
            showToast(error.toString(), 'error');
        }
    };

    useEffect(() => {
        checkStatus('Claude');
        checkStatus('Codex');
        checkStatus('Gemini');
        checkStatus('OpenCode');
    }, [checkStatus]);

    const renderCliItem = (app: CliAppType, name: string) => {
        const status = statuses[app];
        const isAppLoading = loading[app];
        const isAppSyncing = syncing[app];
        const hasModelSelect = (app === 'Claude' || app === 'Codex' || app === 'Gemini') && !!status?.installed;
        const syncDisabled = (app !== 'OpenCode' && !status?.installed) || isAppSyncing || isAppLoading;

        return (
            <div className="flex min-h-[265px] flex-col bg-white dark:bg-base-100 rounded-xl border border-gray-100 dark:border-base-200 overflow-hidden">
                {/* Card header row */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-base-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="min-w-0">
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-none truncate block">
                                {name}
                            </span>
                            <div className="mt-0.5 flex items-center gap-1.5">
                                {isAppLoading ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                                        <Loader2 size={9} className="animate-spin" />
                                        {t('proxy.cli_sync.status.detecting')}
                                    </span>
                                ) : status?.installed ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                                        {t('proxy.cli_sync.status.installed', { version: status.version })}
                                    </span>
                                ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-400 font-medium whitespace-nowrap">
                                        {t('proxy.cli_sync.status.not_installed')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sync status pill */}
                    {!isAppLoading && (status?.installed || (app === 'OpenCode' && status?.current_base_url)) && (
                        <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0",
                            status.is_synced
                                ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/40"
                                : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40"
                        )}>
                            {status.is_synced ? (
                                <><CheckCircle2 size={10} className="shrink-0" /> {t('proxy.cli_sync.status.synced', { defaultValue: 'Synced' })}</>
                            ) : (
                                <><AlertCircle size={10} className="shrink-0" /> {t('proxy.cli_sync.status.not_synced', { defaultValue: 'Not synced' })}</>
                            )}
                        </span>
                    )}
                </div>

                {/* Base URL row */}
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-base-200">
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium mb-0.5">
                        {t('proxy.cli_sync.status.current_base_url')}
                    </div>
                    <div className="text-[11px] font-mono truncate text-gray-500 dark:text-gray-400">
                        {status?.current_base_url || '—'}
                    </div>
                </div>

                {/* Model select row — Claude / Codex / Gemini only */}
                {hasModelSelect && (
                    <div className="px-4 py-2.5 border-b border-gray-100 dark:border-base-200">
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium mb-1">
                            {t('proxy.cli_sync.model_select', { defaultValue: 'Model' })}
                        </div>
                        <GroupedSelect
                            value={selectedModels[app]}
                            onChange={(val) => setSelectedModels(prev => ({ ...prev, [app]: val }))}
                            options={modelOptions}
                            className="w-full !h-8 !text-[11px] !rounded-md"
                            allowCustomInput={true}
                        />
                    </div>
                )}

                {/* OpenCode: sync-accounts checkbox row */}
                {app === 'OpenCode' && (
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-base-200">
                        <input
                            type="checkbox"
                            id="opencode-sync-accounts"
                            checked={syncAccounts}
                            onChange={(e) => setSyncAccounts(e.target.checked)}
                            className="checkbox checkbox-xs checked:bg-zinc-900"
                        />
                        <label htmlFor="opencode-sync-accounts" className="text-[11px] text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                            {t('proxy.opencode_sync.sync_accounts', { defaultValue: 'Sync accounts to antigravity-accounts.json' })}
                        </label>
                    </div>
                )}

                <div className="flex-1" />

                {/* Action row */}
                <div className="flex items-center gap-1.5 px-4 py-2.5">
                    {(status?.installed || app === 'OpenCode') && (
                        <>
                            {/* View button — hidden for OpenCode until synced */}
                            {(app !== 'OpenCode' || status?.is_synced) && (
                                <button
                                    onClick={() => handleViewConfig(app)}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-base-300 rounded-md transition-colors"
                                    title={t(app === 'OpenCode' ? 'proxy.opencode_sync.btn_view' : 'proxy.cli_sync.btn_view', { defaultValue: 'View Config' })}
                                >
                                    <Eye size={13} />
                                </button>
                            )}
                            <button
                                onClick={() => handleRestore(app)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-base-300 rounded-md transition-colors"
                                title={t(app === 'OpenCode' ? 'proxy.opencode_sync.btn_restore' : 'proxy.cli_sync.btn_restore', { defaultValue: 'Restore' })}
                            >
                                <RotateCcw size={13} />
                            </button>
                            {app === 'OpenCode' && (
                                <button
                                    onClick={() => handleClear(app)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                    title={t('proxy.opencode_sync.btn_clear', { defaultValue: 'Clear' })}
                                >
                                    <Trash2 size={13} />
                                </button>
                            )}
                            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
                        </>
                    )}
                    <button
                        onClick={() => handleSync(app)}
                        disabled={syncDisabled}
                        className={cn(
                            "btn btn-sm flex-1 gap-1.5 rounded-md h-8 min-h-0 text-[12px] font-medium shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-300",
                            syncDisabled
                                ? "border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed dark:border-base-300 dark:bg-base-200 dark:text-gray-500"
                                : "border border-gray-950 bg-gray-950 text-white hover:bg-gray-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                        )}
                    >
                        {isAppSyncing ? (
                            <Loader2 size={13} className="animate-spin" />
                        ) : (
                            <RefreshCw size={13} />
                        )}
                        {t('proxy.cli_sync.btn_sync')}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className={cn("p-4 space-y-3", className)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {renderCliItem('Claude', 'Claude Code')}
                {renderCliItem('Codex', 'Codex AI')}
                {renderCliItem('Gemini', 'Gemini CLI')}
                {renderCliItem('OpenCode', 'OpenCode')}
            </div>

            {/* Config Viewer Modal */}
            {viewingConfig && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-base-100 rounded-2xl shadow-2xl border border-gray-200 dark:border-base-300 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-base-200 flex items-start justify-between bg-white dark:bg-base-100">
                            <div>
                                <h3 className="text-base font-black tracking-tight text-gray-950 dark:text-base-content">
                                    {t('proxy.cli_sync.modal.view_title', { name: viewingConfig.app })}
                                </h3>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {viewingConfig.allFiles.map(file => (
                                        <button
                                            key={file}
                                            onClick={() => handleViewConfig(viewingConfig.app, file)}
                                            className={cn(
                                                "px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors border",
                                                viewingConfig.fileName === file
                                                    ? "bg-gray-950 text-white border-gray-950 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100"
                                                    : "bg-white dark:bg-base-200 text-gray-500 border-gray-200 dark:border-base-300 hover:border-gray-300 hover:text-gray-900 dark:hover:text-gray-200"
                                            )}
                                        >
                                            {file}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={async () => {
                                        const success = await copyToClipboard(viewingConfig.content);
                                        if (success) {
                                            showToast(t('proxy.cli_sync.modal.copy_success'), 'success');
                                        }
                                    }}
                                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:border-base-300 dark:text-gray-400 dark:hover:bg-base-200 dark:hover:text-gray-200 transition-colors"
                                >
                                    <Copy size={14} />
                                </button>
                                <button
                                    onClick={() => setViewingConfig(null)}
                                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:border-base-300 dark:text-gray-400 dark:hover:bg-base-200 dark:hover:text-gray-200 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50/50 dark:bg-base-200/20">
                            <div className="bg-zinc-950 rounded-xl p-4 overflow-auto max-h-[50vh] border border-zinc-900 shadow-none">
                                <pre className="text-xs font-mono text-zinc-300 leading-relaxed">
                                    {viewingConfig.content}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* 恢复默认/备份确认弹窗 */}
            <ModalDialog
                isOpen={!!restoreConfirmApp}
                title={statuses[restoreConfirmApp!]?.has_backup
                    ? t('proxy.cli_sync.btn_restore_backup')
                    : t('proxy.cli_sync.btn_restore') || t('proxy.cli_sync.title')}
                message={restoreConfirmApp
                    ? (statuses[restoreConfirmApp!]?.has_backup
                        ? t('proxy.cli_sync.restore_backup_confirm')
                        : t('proxy.cli_sync.restore_confirm', { name: restoreConfirmApp }))
                    : ''}
                onConfirm={executeRestore}
                onCancel={() => setRestoreConfirmApp(null)}
                isDestructive={true}
            />

            {/* 同步配置确认弹窗 (Issue #756) */}
            <ModalDialog
                isOpen={!!syncConfirmApp}
                title={t('proxy.cli_sync.sync_confirm_title')}
                message={syncConfirmApp ? t('proxy.cli_sync.sync_confirm_message', { name: syncConfirmApp }) : ''}
                onConfirm={executeSync}
                onCancel={() => setSyncConfirmApp(null)}
                confirmText={t('proxy.cli_sync.btn_confirm_sync', { defaultValue: 'Confirm Sync' })}
            />

            {/* Clear 确认弹窗 - 仅 OpenCode */}
            <ModalDialog
                isOpen={!!clearConfirmApp}
                title={t('proxy.opencode_sync.clear_confirm_title', { defaultValue: 'Clear OpenCode Configuration' })}
                message={t('proxy.opencode_sync.clear_confirm_message', { defaultValue: 'This will clear all OpenCode configurations including legacy settings. Are you sure?' })}
                onConfirm={executeClear}
                onCancel={() => setClearConfirmApp(null)}
                isDestructive={true}
            />

            {/* OpenCode 模型选择弹窗 */}
            {openCodeSyncModal && (
                <OpenCodeSyncModal
                    proxyUrl={proxyUrl}
                    apiKey={apiKey}
                    onClose={() => setOpenCodeSyncModal(false)}
                    onSyncDone={() => checkStatus('OpenCode')}
                />
            )}
        </div>
    );
};


export default CliSyncCard;
