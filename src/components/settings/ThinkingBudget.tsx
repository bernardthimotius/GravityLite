import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ThinkingBudgetConfig, ThinkingBudgetMode, ThinkingEffort } from "../../types/config";

interface ThinkingBudgetProps {
    config: ThinkingBudgetConfig;
    onChange: (config: ThinkingBudgetConfig) => void;
}

const DEFAULT_CONFIG: ThinkingBudgetConfig = {
    mode: 'auto',
    custom_value: 24576,
};

export default function ThinkingBudget({
    config = DEFAULT_CONFIG,
    onChange,
}: ThinkingBudgetProps) {
    const { t } = useTranslation();

    const [inputValue, setInputValue] = useState(String(config.custom_value));

    useEffect(() => {
        setInputValue(String(config.custom_value));
    }, [config.custom_value]);

    const handleModeChange = (mode: ThinkingBudgetMode) => {
        if (mode === 'adaptive' && !config.effort) {
            onChange({ ...config, mode, effort: 'high' });
        } else {
            onChange({ ...config, mode });
        }
    };

    const handleEffortChange = (effort: ThinkingEffort) => {
        onChange({ ...config, effort });
    };

    const handleInputChange = (val: string) => {
        setInputValue(val);
    };

    const handleInputBlur = () => {
        let num = parseInt(inputValue, 10);
        if (isNaN(num) || num < 1024) num = 1024;
        if (num > 65536) num = 65536;
        setInputValue(String(num));
        onChange({ ...config, custom_value: num });
    };

    const modes: ThinkingBudgetMode[] = ['auto', 'adaptive', 'passthrough', 'custom'];
    const efforts: ThinkingEffort[] = ['low', 'medium', 'high'];

    return (
        <div className="rounded-lg border border-gray-200 dark:border-base-200 bg-gray-50/50 dark:bg-base-200/30 px-4 py-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0 space-y-1.5">
                    <h4 className="font-semibold text-sm text-gray-950 dark:text-gray-100">
                        {t("settings.thinking_budget.title", { defaultValue: "Thinking Budget" })}
                    </h4>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {t("settings.thinking_budget.mode_label", { defaultValue: "Processing Mode" })}
                    </p>
                </div>

                <div className="grid grid-cols-4 gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-base-300 dark:bg-base-100 lg:w-[360px] shrink-0">
                    {modes.map((key) => (
                        <button
                            key={key}
                            onClick={() => handleModeChange(key)}
                            className={`flex h-10 items-center justify-center rounded-lg px-2 text-center text-[11px] font-semibold leading-tight transition-colors ${config.mode === key
                                ? 'bg-gray-950 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-base-200 dark:hover:text-gray-200'
                                }`}
                        >
                            {t(`settings.thinking_budget.mode.${key}`)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-3 rounded-md border border-gray-200/70 bg-white/60 px-3 py-2 dark:border-base-300/70 dark:bg-base-100/50">
                {config.mode === 'auto' && (
                    <p className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                        {t("settings.thinking_budget.auto_hint", {
                            defaultValue: "Auto: limits Gemini/Thinking and web-search requests to 24576 to avoid errors.",
                        })}
                    </p>
                )}

                {config.mode === 'passthrough' && (
                    <p className="text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
                        {t("settings.thinking_budget.passthrough_warning", {
                            defaultValue: "Passthrough: uses the caller's raw value. Unsupported high values may fail.",
                        })}
                    </p>
                )}

                {config.mode === 'adaptive' && (
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <p className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                            {t("settings.thinking_budget.adaptive_hint", {
                                defaultValue: "Adaptive: lets the model adjust thinking effort by task complexity. Recommended for Claude 4.6+.",
                            })}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                {t("settings.thinking_budget.effort_label", { defaultValue: "Thinking Effort" })}:
                            </span>
                            <div className="flex rounded-md border border-gray-200 dark:border-base-300 bg-white/80 dark:bg-base-100 p-0.5">
                                {efforts.map((effort) => (
                                    <button
                                        key={effort}
                                        onClick={() => handleEffortChange(effort)}
                                        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${config.effort === effort
                                            ? 'bg-gray-950 text-white dark:bg-gray-100 dark:text-gray-950 shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        {t(`settings.thinking_budget.effort.${effort}`)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}


                {config.mode === 'custom' && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={inputValue}
                                onChange={(e) => handleInputChange(e.target.value)}
                                onBlur={handleInputBlur}
                                className="w-24 bg-white dark:bg-base-100 border border-gray-200 dark:border-base-300 rounded-md px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-gray-950 outline-none transition-all [appearance:textfield]"
                                min={1024}
                                max={65536}
                                step={1024}
                            />
                            <span className="text-[10px] text-gray-400 font-mono">TOKENS</span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {t("settings.thinking_budget.custom_value_hint", {
                                defaultValue: "Recommended: 24576 for Flash or 51200 for extended runs",
                            })}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
