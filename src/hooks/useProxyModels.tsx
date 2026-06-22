import { useMemo, useEffect } from 'react';
import { ACTIVE_PROXY_MODEL_IDS, ACTIVE_PROXY_MODEL_ID_SET, MODEL_CONFIG } from '../config/modelConfig';
import { useAccountStore } from '../stores/useAccountStore';
import { Bot } from 'lucide-react';

export const useProxyModels = () => {
    const { accounts, fetchAccounts } = useAccountStore();

    // 确保账号数据已加载（针对未触发 fetchAccounts 的页面，如 ApiProxy）
    useEffect(() => {
        if (accounts.length === 0) {
            fetchAccounts();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const models = useMemo(() => {
        // Step 1: 从所有账号中收集动态模型
        // 以 name（小写）为 key 去重，优先保留含 display_name 的条目
        const dynamicMap = new Map<string, { name: string; display_name?: string }>();
        for (const account of accounts) {
            for (const m of account.quota?.models ?? []) {
                const key = m.name.toLowerCase();
                if (!ACTIVE_PROXY_MODEL_ID_SET.has(key)) continue;
                if (!dynamicMap.has(key) || m.display_name) {
                    dynamicMap.set(key, { name: m.name, display_name: m.display_name });
                }
            }
        }

        const result = [];

        // Step 2: Render models in a fixed product order, independent of account quota order.
        for (const id of ACTIVE_PROXY_MODEL_IDS) {
            const key = id.toLowerCase();
            const m = dynamicMap.get(key);
            const config = MODEL_CONFIG[key];
            const primaryName = config ? config.label : (m?.display_name || m?.name || id);
            const CfgIcon = config?.Icon;
            const icon = CfgIcon
                ? <CfgIcon size={16} />
                : <Bot size={16} className="text-gray-400 dark:text-gray-500" />;
            const group = config ? (config.group || 'Other') : 'Dynamic';

            result.push({
                id,
                name: primaryName,
                desc: primaryName,
                group,
                icon,
            });
        }

        return result;
    }, [accounts]);

    return { models };
};
