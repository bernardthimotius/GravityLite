import { Maximize2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAccountStore } from '../../stores/useAccountStore';
import { useViewStore } from '../../stores/useViewStore';
import { cn } from '../../utils/cn';
import { enterMiniMode, exitMiniMode } from '../../utils/windowManager';
import { useEffect } from 'react';

function MiniView() {
    const { t } = useTranslation();
    const { setMiniView } = useViewStore();
    const { accounts, currentAccount, fetchAccounts } = useAccountStore();

    useEffect(() => {
        enterMiniMode(148, true);
    }, []);

    const activeCount = accounts.filter((account) => !account.disabled && !account.proxy_disabled).length;

    const handleExit = async () => {
        await exitMiniMode();
        setMiniView(false);
    };

    return (
        <div className="h-screen w-screen bg-white dark:bg-base-300 text-gray-900 dark:text-base-content rounded-2xl border border-gray-200 dark:border-base-200 shadow-xl overflow-hidden select-none">
            <div className="h-full flex flex-col p-3 gap-3" data-tauri-drag-region>
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {t('nav.mini_view', 'Mini View')}
                        </div>
                        <div className="text-sm font-semibold truncate" title={currentAccount?.email}>
                            {currentAccount?.email || t('accounts.no_account', 'No account')}
                        </div>
                    </div>
                    <button
                        className="btn btn-ghost btn-xs btn-circle shrink-0"
                        onClick={handleExit}
                        title={t('common.expand', 'Expand')}
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-gray-50 dark:bg-base-200 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {t('accounts.total', 'Total')}
                        </div>
                        <div className="text-lg font-bold">{accounts.length}</div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            {t('accounts.active', 'Active')}
                        </div>
                        <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{activeCount}</div>
                    </div>
                </div>

                <button
                    className={cn(
                        'btn btn-sm w-full rounded-xl border-0',
                        'bg-blue-600 hover:bg-blue-700 text-white'
                    )}
                    onClick={() => fetchAccounts()}
                >
                    <RefreshCw className="w-4 h-4" />
                    {t('common.refresh')}
                </button>
            </div>
        </div>
    );
}

export default MiniView;
