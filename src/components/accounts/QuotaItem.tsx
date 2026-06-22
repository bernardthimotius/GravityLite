
import { Clock, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { getQuotaColor, formatTimeRemaining, getTimeRemainingColor } from '../../utils/format';

interface QuotaItemProps {
    label: string;
    percentage: number;
    resetTime?: string;
    isProtected?: boolean;
    className?: string;
    Icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export function QuotaItem({ label, percentage, resetTime, isProtected, className, Icon }: QuotaItemProps) {
    const { t } = useTranslation();
    const getBgColorClass = (p: number) => {
        const color = getQuotaColor(p);
        switch (color) {
            case 'success': return 'bg-emerald-500/80 dark:bg-emerald-500/60';
            case 'warning': return 'bg-amber-500/80 dark:bg-amber-500/60';
            case 'error': return 'bg-rose-500/80 dark:bg-rose-500/60';
            default: return 'bg-gray-400';
        }
    };

    const getTextColorClass = (p: number) => {
        const color = getQuotaColor(p);
        switch (color) {
            case 'success': return 'text-emerald-600 dark:text-emerald-400 font-bold';
            case 'warning': return 'text-amber-600 dark:text-amber-400 font-bold';
            case 'error': return 'text-rose-600 dark:text-rose-400 font-bold';
            default: return 'text-gray-500';
        }
    };

    const getTimeColorClass = (time?: string) => {
        if (!time) return 'text-gray-300 dark:text-gray-600';
        const color = getTimeRemainingColor(time);
        switch (color) {
            case 'success': return 'text-emerald-550 dark:text-emerald-400';
            case 'warning': return 'text-amber-550 dark:text-amber-400';
            default: return 'text-blue-500 dark:text-blue-400';
        }
    };

    return (
        <div className={cn(
            "relative h-[22px] flex items-center px-2 rounded-md overflow-hidden bg-gray-50/70 dark:bg-white/[0.03] group/quota transition-colors hover:bg-gray-100/70 dark:hover:bg-white/[0.05]",
            className
        )}>
            {/* Background Progress Bar */}
            <div
                className={cn(
                    "absolute inset-y-0 left-0 transition-all duration-700 ease-out opacity-[0.08] dark:opacity-[0.12]",
                    getBgColorClass(percentage)
                )}
                style={{ width: `${percentage}%` }}
            />

            {/* Content */}
            <div className="relative z-10 w-full flex items-center text-[10px] leading-none gap-2">
                {/* Model Name */}
                <span className="flex-1 min-w-0 text-gray-700 dark:text-zinc-300 font-semibold truncate text-left flex items-center gap-1.5" title={label}>
                    {Icon && <Icon size={11} className="shrink-0 text-gray-400 dark:text-zinc-550" />}
                    {label}
                </span>

                {/* Reset Time */}
                <div className="w-[48px] flex justify-start shrink-0">
                    {resetTime ? (
                        <span className={cn("flex items-center gap-0.5 font-mono text-[9px] transition-colors truncate", getTimeColorClass(resetTime))}>
                            <Clock className="w-2.5 h-2.5 shrink-0 opacity-70" />
                            {formatTimeRemaining(resetTime)}
                        </span>
                    ) : (
                        <span className="text-gray-300 dark:text-zinc-700 font-mono text-[9px] italic">N/A</span>
                    )}
                </div>

                {/* Percentage */}
                <span className={cn("w-[30px] text-right font-mono text-[9px] font-bold transition-colors flex items-center justify-end gap-0.5 shrink-0", getTextColorClass(percentage))}>
                    {isProtected && (
                        <span title={t('accounts.quota_protected')}>
                            <Lock className="w-2.5 h-2.5 text-amber-500 opacity-80" strokeWidth={2} />
                        </span>
                    )}
                    {percentage}%
                </span>
            </div>
        </div>
    );
}
