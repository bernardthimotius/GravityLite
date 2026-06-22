import { useTranslation } from "react-i18next";
import { GlobalSystemPromptConfig } from "../../types/config";

interface GlobalSystemPromptProps {
    config: GlobalSystemPromptConfig;
    onChange: (config: GlobalSystemPromptConfig) => void;
}

const DEFAULT_CONFIG: GlobalSystemPromptConfig = {
    enabled: false,
    content: '',
};

export default function GlobalSystemPrompt({
    config = DEFAULT_CONFIG,
    onChange,
}: GlobalSystemPromptProps) {
    const { t } = useTranslation();

    return (
        <div className="rounded-lg border border-gray-200 dark:border-base-200 bg-gray-50/50 dark:bg-base-200/30 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <h4 className="font-semibold text-sm text-gray-950 dark:text-gray-100">
                        {t("settings.global_system_prompt.title", { defaultValue: "Global System Prompt" })}
                    </h4>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {t("settings.global_system_prompt.hint", { defaultValue: "Automatically inject systemInstruction into every request" })}
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] font-medium ${config.enabled ? 'text-sky-600 dark:text-sky-400' : 'text-gray-400'}`}>
                        {config.enabled ? t("common.enabled", { defaultValue: "Enabled" }) : t("common.disabled", { defaultValue: "Disabled" })}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-600 peer-checked:bg-sky-300 dark:peer-checked:bg-sky-400"></div>
                    </label>
                </div>
            </div>

            {config.enabled && (
                <div className="mt-3 space-y-3">
                    <textarea
                        value={config.content}
                        onChange={(e) => onChange({ ...config, content: e.target.value })}
                        placeholder={t("settings.global_system_prompt.placeholder", {
                            defaultValue: "Enter a global system prompt...\nExample: You are a senior full-stack engineer with deep React and Rust experience.",
                        })}
                        rows={6}
                        className="w-full bg-white dark:bg-base-100 border border-gray-200 dark:border-base-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-gray-950/10 outline-none transition-all resize-y min-h-[120px]"
                    />
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            {t("settings.global_system_prompt.char_count", {
                                defaultValue: "{{count}} characters",
                                count: config.content.length,
                            })}
                        </p>
                    </div>
                    {config.content.length > 2000 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg p-3">
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                {t("settings.global_system_prompt.long_prompt_warning", {
                                    defaultValue: "This prompt is long (over 2000 characters) and may use a significant amount of context window space.",
                                })}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
