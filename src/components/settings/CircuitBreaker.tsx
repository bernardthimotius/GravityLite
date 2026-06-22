import { useTranslation } from "react-i18next";
import { CircuitBreakerConfig } from "../../types/config";
import { Plus, X } from "lucide-react";

interface CircuitBreakerProps {
    config: CircuitBreakerConfig;
    onChange: (config: CircuitBreakerConfig) => void;
}

export default function CircuitBreaker({
    config,
    onChange,
}: CircuitBreakerProps) {
    const { t } = useTranslation();

    const handleLevelChange = (index: number, val: string) => {
        let num = parseInt(val, 10);
        if (isNaN(num)) num = 0;

        const newSteps = [...config.backoff_steps];
        newSteps[index] = Math.max(0, num);
        onChange({ ...config, backoff_steps: newSteps });
    };

    const addLevel = () => {
        const lastVal = config.backoff_steps[config.backoff_steps.length - 1] || 60;
        onChange({
            ...config,
            backoff_steps: [...config.backoff_steps, lastVal * 2],
        });
    };

    const removeLevel = (index: number) => {
        if (config.backoff_steps.length <= 1) return;
        const newSteps = config.backoff_steps.filter((_, i) => i !== index);
        onChange({ ...config, backoff_steps: newSteps });
    };

    return (
        <div className="space-y-4">
            {/* Description row */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-base-300 dark:bg-base-200/40">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    {t("proxy.config.circuit_breaker.tooltip", {
                        defaultValue: "Automatically increases lockout duration for accounts that repeatedly fail with quota exhaustion. This prevents wasting API calls on dead accounts while allowing transient errors to recover quickly.",
                    })}
                </p>
            </div>

            {/* Backoff levels */}
            <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            {t("proxy.config.circuit_breaker.backoff_levels", { defaultValue: "Backoff Levels (Seconds)" })}
                        </label>
                        <p className="max-w-2xl text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
                            Each level is the cooldown applied after repeated quota/rate-limit failures. Requests skip that account until the current level expires, then move to the next level if failures continue.
                        </p>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); addLevel(); }}
                        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 text-[11px] font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-base-300 dark:bg-base-100 dark:text-gray-300 dark:hover:bg-base-200"
                    >
                        <Plus size={11} />
                        {t("common.add", { defaultValue: "Add" })}
                    </button>
                </div>

                {/* Compact single-row inputs */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {config.backoff_steps.map((seconds, idx) => (
                        <div key={idx} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-base-300 dark:bg-base-100">
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                {t("proxy.config.circuit_breaker.level", { level: idx + 1, defaultValue: `Lv ${idx + 1}` })}
                            </span>
                            <div className="relative min-w-0 flex-1">
                                <input
                                    type="number"
                                    value={seconds}
                                    onChange={(e) => handleLevelChange(idx, e.target.value)}
                                    className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-2 pr-6 text-[12px] font-mono text-gray-700 outline-none transition-colors focus:border-gray-400 dark:border-base-300 dark:bg-base-200 dark:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    min="0"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 dark:text-gray-600 select-none pointer-events-none">s</span>
                            </div>
                            {config.backoff_steps.length > 1 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeLevel(idx); }}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-base-300 dark:hover:border-rose-900/60 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                                    title={t("common.delete", { defaultValue: "Delete" })}
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
