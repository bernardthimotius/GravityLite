import { useTranslation } from "react-i18next";

interface ImageThinkingModeProps {
    value?: 'enabled' | 'disabled';
    onChange: (value: 'enabled' | 'disabled') => void;
}

export default function ImageThinkingMode({
    value = 'enabled',
    onChange,
}: ImageThinkingModeProps) {
    const { t } = useTranslation();

    const options = [
        { value: 'enabled', label: 'enabled', desc: 'enabled_desc' },
        { value: 'disabled', label: 'disabled', desc: 'disabled_desc' },
    ] as const;

    return (
        <div className="rounded-lg border border-gray-200 dark:border-base-200 bg-gray-50/50 dark:bg-base-200/30 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start">
                    <div className="min-w-0 space-y-1">
                        <h4 className="font-semibold text-sm text-gray-950 dark:text-gray-100">
                            {t("settings.image_thinking_mode.title", { defaultValue: "Image Thinking Mode" })}
                        </h4>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                            {t("settings.image_thinking_mode.hint", { defaultValue: "Affects image quality and generation flow" })}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-0.5 rounded-md border border-gray-200 dark:border-base-300 bg-white/80 dark:bg-base-100 p-0.5 lg:w-[136px] shrink-0">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => onChange(option.value)}
                            className={`px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors ${value === option.value
                                ? 'bg-gray-950 text-white dark:bg-gray-100 dark:text-gray-950 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                        >
                            {t(`settings.image_thinking_mode.options.${option.label}`, {
                                defaultValue: option.value === 'enabled' ? "On" : "Off"
                            })}
                        </button>
                    ))}
                </div>
            </div>
            <div className="mt-2 min-h-[18px]">
                <p className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                    {value === 'enabled'
                        ? t("settings.image_thinking_mode.options.enabled_desc", { defaultValue: "On: preserves the thinking chain and returns draft plus final images." })
                        : t("settings.image_thinking_mode.options.disabled_desc", { defaultValue: "Off: disables the thinking chain and returns one high-quality image." })
                    }
                </p>
            </div>
        </div>
    );
}
