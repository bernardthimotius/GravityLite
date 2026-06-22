import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PinnedQuotaModelsConfig } from '../../types/config';
import { ACTIVE_PROXY_MODEL_IDS, ACTIVE_PROXY_MODEL_ID_SET, MODEL_CONFIG } from '../../config/modelConfig';

interface PinnedQuotaModelsProps {
    config: PinnedQuotaModelsConfig;
    onChange: (config: PinnedQuotaModelsConfig) => void;
}

const PinnedQuotaModels = ({ config, onChange }: PinnedQuotaModelsProps) => {
    const { t } = useTranslation();

    const selectedModels = (config.models || []).filter(model => ACTIVE_PROXY_MODEL_ID_SET.has(model));

    useEffect(() => {
        const currentModels = config.models || [];
        const sanitized = currentModels.filter(model => ACTIVE_PROXY_MODEL_ID_SET.has(model));
        if (currentModels.length !== sanitized.length) {
            onChange({ ...config, models: sanitized.length > 0 ? sanitized : [...ACTIVE_PROXY_MODEL_IDS] });
        }
    }, [config, onChange]);

    const toggleModel = (model: string) => {
        const currentModels = selectedModels;
        let newModels: string[];

        if (currentModels.includes(model)) {
            // 至少保留一个模型
            if (currentModels.length <= 1) return;
            newModels = currentModels.filter(m => m !== model);
        } else {
            newModels = [...currentModels, model];
        }

        onChange({ ...config, models: newModels });
    };

    const modelOptions = ACTIVE_PROXY_MODEL_IDS.map(id => {
        const cfg = MODEL_CONFIG[id];
        return {
            id,
            label: id,
            desc: cfg?.label || id
        };
    });

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <div>
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-gray-900 dark:text-gray-100">
                        {t('settings.pinned_quota_models.title')}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {t('settings.pinned_quota_models.desc')}
                    </p>
                </div>
            </div>

            {/* 模型选择区域 */}
            <div className="mt-5 pt-5 border-t border-gray-100 dark:border-base-200 space-y-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {modelOptions.map((model) => {
                        const isSelected = selectedModels.includes(model.id);
                        return (
                            <div
                                key={model.id}
                                onClick={() => toggleModel(model.id)}
                                className={`
                                    flex items-center justify-between p-2 rounded border cursor-pointer transition-all duration-200
                                    ${isSelected
                                        ? 'bg-zinc-950 border-zinc-950 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-950 font-semibold'
                                        : 'bg-transparent border-gray-200 dark:border-base-300 text-gray-500 dark:text-gray-400 hover:border-zinc-950 dark:hover:border-zinc-100'}
                                `}
                            >
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[11px] font-bold truncate">
                                        {model.label}
                                    </span>
                                    <span className="text-[9px] text-gray-450 dark:text-gray-500 mt-0.5 truncate">
                                        {model.desc}
                                    </span>
                                </div>
                                <div className={`
                                    w-4 h-4 rounded flex items-center justify-center transition-all duration-200 flex-shrink-0 ml-1 border
                                    ${isSelected ? 'bg-zinc-950 border-zinc-950 dark:bg-zinc-100 dark:border-zinc-100 text-white dark:text-zinc-950 scale-100' : 'border-gray-200 dark:border-base-300 text-transparent scale-75 opacity-0'}
                                `}>
                                    <Check size={10} strokeWidth={3} />
                                </div>
                            </div>
                        );
                    })}
                </div>


            </div>
        </div>
    );
};

export default PinnedQuotaModels;
