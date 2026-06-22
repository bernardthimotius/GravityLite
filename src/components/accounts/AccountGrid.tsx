import {
    Ban,
    Check,
    Download,
    Fingerprint,
    Info,
    RefreshCw,
    Sparkles,
    Tag,
    ToggleLeft,
    ToggleRight,
    Trash2,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Account } from '../../types/account';
import { cn } from '../../utils/cn';
import { formatTimeRemaining, getQuotaColor } from '../../utils/format';
import { getValidationBlockedStatusLabel } from './accountValidationStatus';
import { useConfigStore } from '../../stores/useConfigStore';
import { ACTIVE_PROXY_MODEL_IDS, ACTIVE_PROXY_MODEL_ID_SET, MODEL_CONFIG } from '../../config/modelConfig';

const MODEL_ID_ALIASES: Record<string, string[]> = {
    'gemini-3-pro-high': ['gemini-3-pro-high', 'gemini-3.1-pro-high'],
    'gemini-3-pro-low': ['gemini-3-pro-low', 'gemini-3.1-pro-low'],
    'gemini-3-pro-preview': ['gemini-3-pro-preview', 'gemini-3.1-pro-preview'],
    'gemini-3.1-pro-high': ['gemini-3.1-pro-high', 'gemini-3-pro-high'],
    'gemini-3.1-pro-low': ['gemini-3.1-pro-low', 'gemini-3-pro-low'],
    'gemini-3.1-pro-preview': ['gemini-3.1-pro-preview', 'gemini-3-pro-preview'],
};

function getModelAliases(modelId: string): string[] {
    return MODEL_ID_ALIASES[modelId] || [modelId];
}

interface AccountGridProps {
    accounts: Account[];
    selectedIds: Set<string>;
    refreshingIds: Set<string>;
    onToggleSelect: (id: string) => void;
    currentAccountId: string | null;
    switchingAccountId: string | null;
    onRefresh: (accountId: string) => void;
    onViewDevice: (accountId: string) => void;
    onViewDetails: (accountId: string) => void;
    onExport: (accountId: string) => void;
    onDelete: (accountId: string) => void;
    onToggleProxy: (accountId: string) => void;
    onWarmup?: (accountId: string) => void;
    onUpdateLabel?: (accountId: string, label: string) => void;
    onViewError: (accountId: string) => void;
}

function AccountGrid({
    accounts,
    selectedIds,
    refreshingIds,
    onToggleSelect,
    currentAccountId,
    switchingAccountId,
    onRefresh,
    onViewDevice,
    onViewDetails,
    onExport,
    onDelete,
    onToggleProxy,
    onWarmup,
    onUpdateLabel,
    onViewError,
}: AccountGridProps) {
    const { t } = useTranslation();
    const { config, showAllQuotas } = useConfigStore();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [labelValue, setLabelValue] = useState('');
    const pinnedModels = (config?.pinned_quota_models?.models || ACTIVE_PROXY_MODEL_IDS)
        .filter(modelId => ACTIVE_PROXY_MODEL_ID_SET.has(modelId));

    const startEditing = (account: Account) => {
        setEditingId(account.id);
        setLabelValue(account.custom_label || '');
    };

    const saveLabel = (accountId: string) => {
        onUpdateLabel?.(accountId, labelValue.trim());
        setEditingId(null);
    };

    if (accounts.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                {t('accounts.no_accounts', 'No accounts')}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-2">
            {accounts.map((account) => {
                const selected = selectedIds.has(account.id);
                const isCurrent = currentAccountId === account.id;
                const isRefreshing = refreshingIds.has(account.id);
                const isSwitching = switchingAccountId === account.id;
                const isDisabled = Boolean(account.disabled);
                // Calculate display models using whitelist and sort
                const displayModelIds = showAllQuotas ? ACTIVE_PROXY_MODEL_IDS : pinnedModels;
                const displayModels = displayModelIds
                    .filter(modelId => modelId.toLowerCase() in MODEL_CONFIG)
                    .map(modelId => {
                        const id = modelId.toLowerCase();
                        const m = account.quota?.models.find(m => m.name === modelId || getModelAliases(id).includes(m.name.toLowerCase()));
                        const config = MODEL_CONFIG[id];
                        return {
                            id,
                            label: config?.label || modelId,
                            protectedKey: config?.protectedKey || id,
                            data: m
                        };
                    });

                return (
                    <div
                        key={account.id}
                        className={cn(
                            'rounded-2xl border bg-white dark:bg-base-100 shadow-sm transition-colors overflow-hidden',
                            selected ? 'border-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/40' : 'border-gray-100 dark:border-base-200',
                            isCurrent && 'bg-blue-50/60 dark:bg-blue-900/10',
                            (isRefreshing || isDisabled) && 'opacity-75'
                        )}
                    >
                        <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-xs rounded border-2 border-gray-400 dark:border-gray-500 checked:border-blue-600 checked:bg-blue-600 [--chkbg:theme(colors.blue.600)] [--chkfg:white]"
                                            checked={selected}
                                            onChange={() => onToggleSelect(account.id)}
                                        />
                                        <div className="font-semibold text-sm truncate" title={account.email}>
                                            {account.email}
                                        </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        {isCurrent && (
                                            <span className="px-2 py-0.5 rounded-md bg-blue-150 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                                {t('accounts.current').toUpperCase()}
                                            </span>
                                        )}
                                        {account.quota?.subscription_tier && (
                                            <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-[10px] font-bold">
                                                {account.quota.subscription_tier.toUpperCase()}
                                            </span>
                                        )}
                                        {isDisabled && (
                                            <button
                                                className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-[10px] font-bold flex items-center gap-1"
                                                onClick={() => onViewError(account.id)}
                                                title={account.disabled_reason}
                                            >
                                                <Ban className="w-3 h-3" />
                                                {t('accounts.disabled')}
                                            </button>
                                        )}
                                        {account.validation_blocked && (
                                            <button
                                                className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[10px] font-bold"
                                                onClick={() => onViewError(account.id)}
                                            >
                                                {getValidationBlockedStatusLabel(account.validation_blocked_reason, t)}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="min-h-[72px] space-y-2">
                                {displayModels.length > 0 ? displayModels.map((model) => {
                                    const modelData = model.data;
                                    return (
                                        <div key={model.id} className="space-y-1">
                                            <div className="flex items-center justify-between gap-2 text-[11px]">
                                                <span className="font-medium truncate text-gray-600 dark:text-gray-300" title={model.label}>
                                                    {model.label}
                                                </span>
                                                <span className="font-mono text-gray-500 dark:text-gray-400">
                                                    {modelData?.percentage || 0}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-base-200 overflow-hidden">
                                                <div
                                                    className={cn(
                                                        'h-full rounded-full',
                                                        getQuotaColor(modelData?.percentage || 0) === 'success' && 'bg-emerald-500',
                                                        getQuotaColor(modelData?.percentage || 0) === 'warning' && 'bg-amber-500',
                                                        getQuotaColor(modelData?.percentage || 0) === 'error' && 'bg-rose-500'
                                                    )}
                                                    style={{ width: `${modelData?.percentage || 0}%` }}
                                                />
                                            </div>
                                            {modelData?.reset_time && (
                                                <div className="text-[10px] text-gray-400 dark:text-gray-500">
                                                    {formatTimeRemaining(modelData.reset_time)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }) : (
                                    <div className="h-full flex items-center text-xs text-gray-400 dark:text-gray-500">
                                        {account.quota?.is_forbidden ? t('accounts.forbidden_msg') : t('accounts.no_quota', 'No quota data')}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 min-h-8">
                                {editingId === account.id ? (
                                    <>
                                        <input
                                            className="input input-xs input-bordered flex-1"
                                            value={labelValue}
                                            onChange={(event) => setLabelValue(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') saveLabel(account.id);
                                                if (event.key === 'Escape') setEditingId(null);
                                            }}
                                            autoFocus
                                        />
                                        <button className="btn btn-ghost btn-xs btn-circle" onClick={() => saveLabel(account.id)}>
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setEditingId(null)}>
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className="btn btn-ghost btn-xs min-h-0 h-7 max-w-full justify-start px-2"
                                        onClick={() => startEditing(account)}
                                        disabled={!onUpdateLabel}
                                    >
                                        <Tag className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate">{account.custom_label || t('accounts.add_label', 'Add label')}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-3 py-2 border-t border-gray-100 dark:border-base-200 bg-gray-50/80 dark:bg-base-200/50 flex items-center justify-between gap-1">
                            <button className="btn btn-ghost btn-xs btn-circle" onClick={() => onRefresh(account.id)} disabled={isRefreshing} title={t('common.refresh')}>
                                <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
                            </button>
                            <button className="btn btn-ghost btn-xs btn-circle" onClick={() => onViewDevice(account.id)} title={t('accounts.device_fingerprint')}>
                                <Fingerprint className="w-3.5 h-3.5" />
                            </button>
                            <button className="btn btn-ghost btn-xs btn-circle" onClick={() => onViewDetails(account.id)} title={t('common.details')}>
                                <Info className="w-3.5 h-3.5" />
                            </button>
                            <button className="btn btn-ghost btn-xs btn-circle" onClick={() => onExport(account.id)} title={t('common.export')}>
                                <Download className="w-3.5 h-3.5" />
                            </button>
                            {onWarmup && (
                                <button className="btn btn-ghost btn-xs btn-circle" onClick={() => onWarmup(account.id)} title={t('accounts.warmup')}>
                                    <Sparkles className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button className="btn btn-ghost btn-xs btn-circle" onClick={() => onToggleProxy(account.id)} disabled={isSwitching} title={t('accounts.toggle_proxy')}>
                                {account.proxy_disabled ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5 text-emerald-600" />}
                            </button>
                            <button className="btn btn-ghost btn-xs btn-circle text-rose-600" onClick={() => onDelete(account.id)} title={t('common.delete')}>
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default AccountGrid;
