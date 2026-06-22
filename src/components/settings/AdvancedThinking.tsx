import { ProxyConfig } from "../../types/config";
import ThinkingBudget from "./ThinkingBudget";
import GlobalSystemPrompt from "./GlobalSystemPrompt";
import ImageThinkingMode from "./ImageThinkingMode";

interface AdvancedThinkingProps {
    config: ProxyConfig;
    onChange: (config: ProxyConfig) => void;
}

export default function AdvancedThinking({
    config,
    onChange,
}: AdvancedThinkingProps) {

    return (
        <div className="space-y-2 p-3">
            <div>
                <ThinkingBudget
                    config={config.thinking_budget || { mode: 'auto', custom_value: 24576 }}
                    onChange={(newConfig) => onChange({ ...config, thinking_budget: newConfig })}
                />
            </div>

            <div>
                <ImageThinkingMode
                    value={config.image_thinking_mode || 'enabled'}
                    onChange={(newValue) => onChange({ ...config, image_thinking_mode: newValue })}
                />
            </div>

            <div>
                <GlobalSystemPrompt
                    config={config.global_system_prompt || { enabled: false, content: '' }}
                    onChange={(newConfig) => onChange({ ...config, global_system_prompt: newConfig })}
                />
            </div>
        </div>
    );
}
