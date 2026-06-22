import { Account } from '../../types/account';

interface BestAccountsProps {
    accounts: Account[];
    currentAccountId?: string;
    onSwitch?: (accountId: string) => void;
}

import { useTranslation } from 'react-i18next';

function BestAccounts({ accounts, currentAccountId, onSwitch }: BestAccountsProps) {
    const { t } = useTranslation();
    const geminiSorted = accounts
        .filter(a => a.id !== currentAccountId)
        .map(a => {
            const proQuota = (a.quota?.models || [])
                .filter(m =>
                    m.name.toLowerCase() === 'gemini-3-pro-high'
                    || m.name.toLowerCase() === 'gemini-3-pro-low'
                    || m.name.toLowerCase() === 'gemini-3.1-pro-high'
                    || m.name.toLowerCase() === 'gemini-3.1-pro-low'
                )
                .reduce((best, model) => Math.max(best, model.percentage || 0), 0);
            const flashQuota = a.quota?.models.find(m => m.name.toLowerCase() === 'gemini-3-flash')?.percentage || 0;
            return {
                ...a,
                quotaVal: Math.round(proQuota * 0.7 + flashQuota * 0.3),
            };
        })
        .filter(a => a.quotaVal > 0)
        .sort((a, b) => b.quotaVal - a.quotaVal);

    const claudeSorted = accounts
        .filter(a => a.id !== currentAccountId)
        .map(a => ({
            ...a,
            quotaVal: a.quota?.models.find(m => m.name.toLowerCase().includes('claude'))?.percentage || 0,
        }))
        .filter(a => a.quotaVal > 0)
        .sort((a, b) => b.quotaVal - a.quotaVal);

    let bestGemini = geminiSorted[0];
    let bestClaude = claudeSorted[0];

    if (bestGemini && bestClaude && bestGemini.id === bestClaude.id) {
        const nextGemini = geminiSorted[1];
        const nextClaude = claudeSorted[1];

        const scoreA = bestGemini.quotaVal + (nextClaude?.quotaVal || 0);
        const scoreB = (nextGemini?.quotaVal || 0) + bestClaude.quotaVal;

        if (nextClaude && (!nextGemini || scoreA >= scoreB)) {
            bestClaude = nextClaude;
        } else if (nextGemini) {
            bestGemini = nextGemini;
        }
    }

    const bestGeminiRender = bestGemini ? { ...bestGemini, geminiQuota: bestGemini.quotaVal } : undefined;
    const bestClaudeRender = bestClaude ? { ...bestClaude, claudeQuota: bestClaude.quotaVal } : undefined;

    return (
        <div className="bg-white dark:bg-base-100 rounded-lg p-4 border border-gray-200 dark:border-base-200 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {t('dashboard.best_accounts')}
                </h2>
            </div>

            <div className="space-y-2 flex-1">
                {bestGeminiRender && (
                    <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-base-200 rounded border border-gray-200 dark:border-base-300">
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5">{t('dashboard.for_gemini')}</div>
                            <div className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate">
                                {bestGeminiRender.email}
                            </div>
                        </div>
                        <div className="ml-2 px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/10 dark:text-emerald-400 text-[10px] font-mono font-semibold">
                            {bestGeminiRender.geminiQuota}%
                        </div>
                    </div>
                )}

                {bestClaudeRender && (
                    <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-base-200 rounded border border-gray-200 dark:border-base-300">
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5">{t('dashboard.for_claude')}</div>
                            <div className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate">
                                {bestClaudeRender.email}
                            </div>
                        </div>
                        <div className="ml-2 px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/10 dark:text-emerald-400 text-[10px] font-mono font-semibold">
                            {bestClaudeRender.claudeQuota}%
                        </div>
                    </div>
                )}

                {(!bestGeminiRender && !bestClaudeRender) && (
                    <div className="text-center py-4 text-gray-400 text-xs italic">
                        {t('accounts.no_data')}
                    </div>
                )}
            </div>

            {(bestGeminiRender || bestClaudeRender) && onSwitch && (
                <div className="mt-auto pt-3">
                    <button
                        className="w-full px-3 py-1.5 text-xs text-gray-750 dark:text-gray-300 border border-gray-200 dark:border-base-200 rounded-md hover:bg-gray-50 dark:hover:bg-base-200 transition-colors font-medium"
                        onClick={() => {
                            let targetId = bestGeminiRender?.id;
                            if (bestClaudeRender && (!bestGeminiRender || bestClaudeRender.claudeQuota > bestGeminiRender.geminiQuota)) {
                                targetId = bestClaudeRender.id;
                            }

                            if (onSwitch && targetId) {
                                onSwitch(targetId);
                            }
                        }}
                    >
                        {t('dashboard.switch_best')}
                    </button>
                </div>
            )}
        </div>
    );
}

export default BestAccounts;
