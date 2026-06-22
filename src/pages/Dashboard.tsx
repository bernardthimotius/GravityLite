import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AddAccountDialog from '../components/accounts/AddAccountDialog';
import { showToast } from '../components/common/ToastContainer';
import BestAccounts from '../components/dashboard/BestAccounts';
import CurrentAccount from '../components/dashboard/CurrentAccount';
import { useAccountStore } from '../stores/useAccountStore';
import { Account } from '../types/account';

function Dashboard() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const {
        accounts,
        currentAccount,
        fetchAccounts,
        fetchCurrentAccount,
        switchAccount,
        addAccount,
        refreshQuota,
        loading
    } = useAccountStore();

    useEffect(() => {
        fetchAccounts();
        fetchCurrentAccount();
    }, []);

    // 计算统计数据
    const stats = useMemo(() => {
        const getGeminiProQuota = (a: Account) =>
            (a.quota?.models || [])
                .filter(m =>
                    m.name.toLowerCase() === 'gemini-3-pro-high'
                    || m.name.toLowerCase() === 'gemini-3-pro-low'
                    || m.name.toLowerCase() === 'gemini-3.1-pro-high'
                    || m.name.toLowerCase() === 'gemini-3.1-pro-low'
                )
                .reduce((best, model) => Math.max(best, model.percentage || 0), 0);

        const geminiQuotas = accounts
            .map(a => getGeminiProQuota(a))
            .filter(q => q > 0);

        const geminiImageQuotas = accounts
            .map(a => a.quota?.models.find(m =>
                m.name.toLowerCase() === 'gemini-3.1-flash-image'
            )?.percentage || 0)
            .filter(q => q > 0);

        const claudeQuotas = accounts
            .map(a => a.quota?.models.find(m => m.name.toLowerCase() === 'claude-sonnet-4-6' || m.name.toLowerCase() === 'claude-sonnet-4-5')?.percentage || 0)
            .filter(q => q > 0);

        const lowQuotaCount = accounts.filter(a => {
            if (a.quota?.is_forbidden) return false;
            const gemini = getGeminiProQuota(a);
            const claude = a.quota?.models.find(m => m.name.toLowerCase() === 'claude-sonnet-4-6' || m.name.toLowerCase() === 'claude-sonnet-4-5')?.percentage || 0;
            return gemini < 20 || claude < 20;
        }).length;

        return {
            total: accounts.length,
            avgGemini: geminiQuotas.length > 0
                ? Math.round(geminiQuotas.reduce((a, b) => a + b, 0) / geminiQuotas.length)
                : 0,
            avgGeminiImage: geminiImageQuotas.length > 0
                ? Math.round(geminiImageQuotas.reduce((a, b) => a + b, 0) / geminiImageQuotas.length)
                : 0,
            avgClaude: claudeQuotas.length > 0
                ? Math.round(claudeQuotas.reduce((a, b) => a + b, 0) / claudeQuotas.length)
                : 0,
            lowQuota: lowQuotaCount,
        };
    }, [accounts]);

    const isSwitchingRef = useRef(false);

    const handleSwitch = async (accountId: string) => {
        if (loading || isSwitchingRef.current) return;

        isSwitchingRef.current = true;
        try {
            await switchAccount(accountId);
            showToast(t('dashboard.toast.switch_success'), 'success');
        } catch (error) {
            console.error('[Dashboard] Switch account failed:', error);
            showToast(`${t('dashboard.toast.switch_error')}: ${error}`, 'error');
        } finally {
            setTimeout(() => {
                isSwitchingRef.current = false;
            }, 1000);
        }
    };

    const handleAddAccount = async (email: string, refreshToken: string) => {
        await addAccount(email, refreshToken);
        await fetchAccounts();
    };

    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefreshCurrent = async () => {
        if (!currentAccount) return;

        setIsRefreshing(true);
        try {
            await refreshQuota(currentAccount.id);
            await fetchCurrentAccount();
            showToast(t('dashboard.toast.refresh_success'), 'success');
        } catch (error) {
            console.error('[Dashboard] Refresh failed:', error);
            showToast(`${t('dashboard.toast.refresh_error')}: ${error}`, 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="h-full w-full overflow-y-auto overflow-x-hidden">
            <div className="p-5 space-y-4 max-w-7xl mx-auto">
                {/* Title and Action Buttons */}
                <div className="flex justify-between items-center">
                    <h1 className="text-lg font-semibold tracking-tight text-gray-950 dark:text-base-content">
                        Dashboard
                    </h1>
                    <div className="flex items-center gap-2">
                        <AddAccountDialog onAdd={handleAddAccount} />
                        <button
                            className={`px-3 py-1.5 border border-gray-200 dark:border-base-200 text-xs font-medium hover:bg-gray-50 dark:hover:bg-base-200 flex items-center gap-2 active:scale-[0.98] transition-colors rounded-md ${isRefreshing || !currentAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={handleRefreshCurrent}
                            disabled={isRefreshing || !currentAccount}
                            title={isRefreshing ? t('dashboard.refreshing') : t('dashboard.refresh_quota')}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? t('dashboard.refreshing') : t('dashboard.refresh_quota')}
                        </button>
                    </div>
                </div>

                {/* Connection facts strip */}
                <div className="border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-lg overflow-hidden">
                    <dl className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-base-200">
                        <div className="px-4 py-3 min-w-0">
                            <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('dashboard.total_accounts')}</dt>
                            <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate">{stats.total}</dd>
                        </div>
                        <div className="px-4 py-3 min-w-0">
                            <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('dashboard.avg_gemini')}</dt>
                            <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate">{stats.avgGemini}%</dd>
                        </div>
                        <div className="px-4 py-3 min-w-0">
                            <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('dashboard.avg_gemini_image')}</dt>
                            <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate">{stats.avgGeminiImage}%</dd>
                        </div>
                        <div className="px-4 py-3 min-w-0">
                            <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('dashboard.avg_claude')}</dt>
                            <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate">{stats.avgClaude}%</dd>
                        </div>
                        <div className="px-4 py-3 min-w-0">
                            <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('dashboard.low_quota_accounts')}</dt>
                            <dd className={`mt-1 font-mono text-xs truncate font-semibold ${stats.lowQuota > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-gray-900 dark:text-gray-100'}`}>{stats.lowQuota}</dd>
                        </div>
                    </dl>
                </div>

                {/* Double column layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CurrentAccount
                        account={currentAccount}
                        onSwitch={() => navigate('/accounts')}
                    />
                    <BestAccounts
                        accounts={accounts}
                        currentAccountId={currentAccount?.id}
                        onSwitch={handleSwitch}
                    />
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
