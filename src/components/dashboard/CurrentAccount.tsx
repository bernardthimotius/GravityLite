import { Mail, Lock } from 'lucide-react';
import { Account } from '../../types/account';
import { formatTimeRemaining } from '../../utils/format';

interface CurrentAccountProps {
    account: Account | null;
    onSwitch?: () => void;
}

import { useTranslation } from 'react-i18next';

function CurrentAccount({ account, onSwitch }: CurrentAccountProps) {
    const { t } = useTranslation();
    if (!account) {
        return (
            <div className="bg-white dark:bg-base-100 rounded-lg p-4 border border-gray-200 dark:border-base-200">
                <div className="flex items-center gap-2 mb-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-350" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        {t('dashboard.current_account')}
                    </h2>
                </div>
                <div className="text-center py-4 text-gray-400 dark:text-gray-500 text-xs">
                    {t('dashboard.no_active_account')}
                </div>
            </div>
        );
    }

    const geminiProModel = account.quota?.models
        .filter(m =>
            m.name.toLowerCase() === 'gemini-3-pro-high'
            || m.name.toLowerCase() === 'gemini-3-pro-low'
            || m.name.toLowerCase() === 'gemini-3.1-pro-high'
            || m.name.toLowerCase() === 'gemini-3.1-pro-low'
        )
        .sort((a, b) => (a.percentage || 0) - (b.percentage || 0))[0];

    const geminiFlashModel = account.quota?.models.find(m => m.name.toLowerCase() === 'gemini-3-flash');

    const geminiImageModel = account.quota?.models.find(m => m.name.toLowerCase() === 'gemini-3.1-flash-image');

    const claudeGroupNames = [
        'claude-opus-4-6-thinking',
        'claude'
    ];
    const claudeModel = account.quota?.models
        .filter(m => claudeGroupNames.includes(m.name.toLowerCase()))
        .sort((a, b) => (a.percentage || 0) - (b.percentage || 0))[0];

    return (
        <div className="bg-white dark:bg-base-100 rounded-lg p-4 border border-gray-200 dark:border-base-200 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {t('dashboard.current_account')}
                </h2>
            </div>

            <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300 truncate">{account.email}</span>
                    </div>
                    {account.quota?.subscription_tier && (() => {
                        const tier = account.quota.subscription_tier.toLowerCase();
                        if (tier.includes('ultra')) {
                            return (
                                <span className="px-1.5 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-900/10 dark:text-sky-400 text-[10px] font-mono font-semibold shrink-0">
                                    ULTRA
                                </span>
                            );
                        } else if (tier.includes('pro')) {
                            return (
                                <span className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-750 dark:border-base-300 dark:bg-base-200 dark:text-gray-450 text-[10px] font-mono font-semibold shrink-0">
                                    PRO
                                </span>
                            );
                        } else {
                            return (
                                <span className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-500 dark:border-base-300 dark:bg-base-200 dark:text-gray-500 text-[10px] font-mono font-semibold shrink-0">
                                    FREE
                                </span>
                            );
                        }
                    })()}
                    {account.custom_label && (
                        <span className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/10 dark:text-amber-400 text-[10px] font-mono font-semibold shrink-0">
                            {account.custom_label}
                        </span>
                    )}
                </div>

                {geminiProModel && (
                    <div className="space-y-1">
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs font-mono text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                {(account.protected_models?.includes('gemini-3-pro-high') || account.protected_models?.includes('gemini-3.1-pro-high')) && <Lock className="w-2.5 h-2.5 text-rose-500" />}
                                Gemini 3.1 Pro
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-450 dark:text-gray-500" title={`${t('accounts.reset_time')}: ${new Date(geminiProModel.reset_time).toLocaleString()}`}>
                                    {geminiProModel.reset_time ? `R: ${formatTimeRemaining(geminiProModel.reset_time)}` : t('common.unknown')}
                                </span>
                                <span className={`text-xs font-mono font-semibold ${geminiProModel.percentage >= 50 ? 'text-emerald-600 dark:text-emerald-400' :
                                    geminiProModel.percentage >= 20 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                                    }`}>
                                    {geminiProModel.percentage}%
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-base-200 rounded-full h-1 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${geminiProModel.percentage >= 50 ? 'bg-emerald-500' :
                                    geminiProModel.percentage >= 20 ? 'bg-amber-500' :
                                        'bg-rose-500'
                                    }`}
                                style={{ width: `${geminiProModel.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                )}
                {geminiImageModel && (
                    <div className="space-y-1">
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs font-mono text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                {account.protected_models?.includes('gemini-3.1-flash-image') && <Lock className="w-2.5 h-2.5 text-rose-500" />}
                                Gemini 3.1 Flash Image
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-450 dark:text-gray-500" title={`${t('accounts.reset_time')}: ${new Date(geminiImageModel.reset_time).toLocaleString()}`}>
                                    {geminiImageModel.reset_time ? `R: ${formatTimeRemaining(geminiImageModel.reset_time)}` : t('common.unknown')}
                                </span>
                                <span className={`text-xs font-mono font-semibold ${geminiImageModel.percentage >= 50 ? 'text-emerald-600 dark:text-emerald-400' :
                                    geminiImageModel.percentage >= 20 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                                    }`}>
                                    {geminiImageModel.percentage}%
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-base-200 rounded-full h-1 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${geminiImageModel.percentage >= 50 ? 'bg-emerald-500' :
                                    geminiImageModel.percentage >= 20 ? 'bg-amber-500' :
                                        'bg-rose-500'
                                    }`}
                                style={{ width: `${geminiImageModel.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {geminiFlashModel && (
                    <div className="space-y-1">
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs font-mono text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                {account.protected_models?.includes('gemini-3-flash') && <Lock className="w-2.5 h-2.5 text-rose-500" />}
                                Gemini 3 Flash
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-450 dark:text-gray-500" title={`${t('accounts.reset_time')}: ${new Date(geminiFlashModel.reset_time).toLocaleString()}`}>
                                    {geminiFlashModel.reset_time ? `R: ${formatTimeRemaining(geminiFlashModel.reset_time)}` : t('common.unknown')}
                                </span>
                                <span className={`text-xs font-mono font-semibold ${geminiFlashModel.percentage >= 50 ? 'text-emerald-600 dark:text-emerald-400' :
                                    geminiFlashModel.percentage >= 20 ? 'text-amber-600 dark:text-amber-500' : 'text-rose-600 dark:text-rose-450'
                                    }`}>
                                    {geminiFlashModel.percentage}%
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-base-200 rounded-full h-1 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${geminiFlashModel.percentage >= 50 ? 'bg-emerald-500' :
                                    geminiFlashModel.percentage >= 20 ? 'bg-amber-500' :
                                        'bg-rose-500'
                                    }`}
                                style={{ width: `${geminiFlashModel.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {claudeModel && (
                    <div className="space-y-1">
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs font-mono text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                {account.protected_models?.includes('claude') && <Lock className="w-2.5 h-2.5 text-rose-500" />}
                                Claude Series
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-450 dark:text-gray-500" title={`${t('accounts.reset_time')}: ${new Date(claudeModel.reset_time).toLocaleString()}`}>
                                    {claudeModel.reset_time ? `R: ${formatTimeRemaining(claudeModel.reset_time)}` : t('common.unknown')}
                                </span>
                                <span className={`text-xs font-mono font-semibold ${claudeModel.percentage >= 50 ? 'text-emerald-600 dark:text-emerald-400' :
                                    claudeModel.percentage >= 20 ? 'text-amber-600 dark:text-amber-500' : 'text-rose-600 dark:text-rose-450'
                                    }`}>
                                    {claudeModel.percentage}%
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-base-200 rounded-full h-1 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${claudeModel.percentage >= 50 ? 'bg-emerald-500' :
                                    claudeModel.percentage >= 20 ? 'bg-amber-500' :
                                        'bg-rose-500'
                                    }`}
                                style={{ width: `${claudeModel.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            {onSwitch && (
                <div className="mt-auto pt-3">
                    <button
                        className="w-full px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-base-200 rounded-md hover:bg-gray-50 dark:hover:bg-base-200 transition-colors"
                        onClick={onSwitch}
                    >
                        {t('dashboard.switch_account')}
                    </button>
                </div>
            )}
        </div>
    );
}

export default CurrentAccount;
