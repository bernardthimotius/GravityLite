import React, { useEffect, useState, useRef, useCallback } from 'react';
import { request as invoke } from '../utils/request';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Clock, Calendar, CalendarDays, RefreshCw } from 'lucide-react';

interface TokenStatsAggregated {
    period: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    request_count: number;
}

interface AccountTokenStats {
    account_email: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    request_count: number;
}

interface ApiKeyTokenStats {
    username: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    request_count: number;
}

interface ModelTokenStats {
    model: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    request_count: number;
}

interface ModelTrendPoint {
    period: string;
    model_data: Record<string, number>;
}

interface AccountTrendPoint {
    period: string;
    account_data: Record<string, number>;
}

interface ApiKeyTrendPoint {
    period: string;
    api_key_data: Record<string, number>;
}

interface TokenStatsSummary {
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    total_requests: number;
    unique_accounts: number;
}

type TimeRange = 'hourly' | 'daily' | 'weekly';
type ViewMode = 'model' | 'account' | 'apiKey';

const MODEL_COLORS = [
    '#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
    '#ec4899', '#06b6d4', '#f43f5e', '#a855f7', '#14b8a6',
    '#f97316', '#64748b', '#0ea5e9', '#d946ef'
];

const COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#f43f5e'];

const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
};

const shortenModelName = (model: string): string => {
    return model
        .replace('gemini-', 'g-')
        .replace('claude-', 'c-')
        .replace('-preview', '')
        .replace('-latest', '');
};

const TokenStats: React.FC = () => {
    const { t } = useTranslation();
    const [timeRange, setTimeRange] = useState<TimeRange>('daily');
    const [viewMode, setViewMode] = useState<ViewMode>('model');
    const [chartData, setChartData] = useState<TokenStatsAggregated[]>([]);
    const [accountData, setAccountData] = useState<AccountTokenStats[]>([]);
    const [apiKeyData, setApiKeyData] = useState<ApiKeyTokenStats[]>([]);
    const [modelData, setModelData] = useState<ModelTokenStats[]>([]);
    const [modelTrendData, setModelTrendData] = useState<any[]>([]);
    const [accountTrendData, setAccountTrendData] = useState<any[]>([]);
    const [apiKeyTrendData, setApiKeyTrendData] = useState<any[]>([]);
    const [allModels, setAllModels] = useState<string[]>([]);
    const [allAccounts, setAllAccounts] = useState<string[]>([]);
    const [allApiKeys, setAllApiKeys] = useState<string[]>([]);
    const [summary, setSummary] = useState<TokenStatsSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            let hours = 24;
            let data: TokenStatsAggregated[] = [];
            let modelTrend: ModelTrendPoint[] = [];
            let accountTrend: AccountTrendPoint[] = [];
            let apiKeyTrend: ApiKeyTrendPoint[] = [];

            switch (timeRange) {
                case 'hourly':
                    hours = 24;
                    data = await invoke<TokenStatsAggregated[]>('get_token_stats_hourly', { hours: 24 });
                    modelTrend = await invoke<ModelTrendPoint[]>('get_token_stats_model_trend_hourly', { hours: 24 });
                    accountTrend = await invoke<AccountTrendPoint[]>('get_token_stats_account_trend_hourly', { hours: 24 });
                    apiKeyTrend = await invoke<ApiKeyTrendPoint[]>('get_token_stats_api_key_trend_hourly', { hours: 24 });
                    break;
                case 'daily':
                    hours = 168;
                    data = await invoke<TokenStatsAggregated[]>('get_token_stats_daily', { days: 7 });
                    modelTrend = await invoke<ModelTrendPoint[]>('get_token_stats_model_trend_daily', { days: 7 });
                    accountTrend = await invoke<AccountTrendPoint[]>('get_token_stats_account_trend_daily', { days: 7 });
                    apiKeyTrend = await invoke<ApiKeyTrendPoint[]>('get_token_stats_api_key_trend_daily', { days: 7 });
                    break;
                case 'weekly':
                    hours = 720;
                    data = await invoke<TokenStatsAggregated[]>('get_token_stats_weekly', { weeks: 4 });
                    modelTrend = await invoke<ModelTrendPoint[]>('get_token_stats_model_trend_daily', { days: 30 });
                    accountTrend = await invoke<AccountTrendPoint[]>('get_token_stats_account_trend_daily', { days: 30 });
                    apiKeyTrend = await invoke<ApiKeyTrendPoint[]>('get_token_stats_api_key_trend_daily', { days: 30 });
                    break;
            }

            setChartData(data);

            const models = new Set<string>();
            modelTrend.forEach(point => {
                Object.keys(point.model_data).forEach(m => models.add(m));
            });
            const modelList = Array.from(models);
            setAllModels(modelList);

            const transformedTrend = modelTrend.map(point => {
                const row: Record<string, any> = { period: point.period };
                modelList.forEach(model => {
                    row[model] = point.model_data[model] || 0;
                });
                return row;
            });
            setModelTrendData(transformedTrend);

            // Process Account Trend Data
            const accountsSet = new Set<string>();
            accountTrend.forEach(point => {
                Object.keys(point.account_data).forEach(acc => accountsSet.add(acc));
            });
            const accountList = Array.from(accountsSet);
            setAllAccounts(accountList);

            const transformedAccountTrend = accountTrend.map(point => {
                const row: Record<string, any> = { period: point.period };
                accountList.forEach(acc => {
                    row[acc] = point.account_data[acc] || 0;
                });
                return row;
            });
            setAccountTrendData(transformedAccountTrend);

            const apiKeysSet = new Set<string>();
            apiKeyTrend.forEach(point => {
                Object.keys(point.api_key_data).forEach(key => apiKeysSet.add(key));
            });
            const apiKeyList = Array.from(apiKeysSet);
            setAllApiKeys(apiKeyList);

            const transformedApiKeyTrend = apiKeyTrend.map(point => {
                const row: Record<string, any> = { period: point.period };
                apiKeyList.forEach(key => {
                    row[key] = point.api_key_data[key] || 0;
                });
                return row;
            });
            setApiKeyTrendData(transformedApiKeyTrend);

            const [accounts, apiKeys, models_stats, summaryData] = await Promise.all([
                invoke<AccountTokenStats[]>('get_token_stats_by_account', { hours }),
                invoke<ApiKeyTokenStats[]>('get_token_stats_by_api_key', { hours }),
                invoke<ModelTokenStats[]>('get_token_stats_by_model', { hours }),
                invoke<TokenStatsSummary>('get_token_stats_summary', { hours })
            ]);

            setAccountData(accounts);
            setApiKeyData(apiKeys);
            setModelData(models_stats);
            setSummary(summaryData);
        } catch (error) {
            console.error('Failed to fetch token stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [timeRange]);

    const pieData = accountData.slice(0, 8).map((account, index) => ({
        name: account.account_email.split('@')[0] + '...',
        value: account.total_tokens,
        fullEmail: account.account_email,
        color: COLORS[index % COLORS.length]
    }));

    const apiKeyPieData = apiKeyData.slice(0, 8).map((apiKey, index) => ({
        name: apiKey.username,
        value: apiKey.total_tokens,
        fullLabel: apiKey.username,
        color: COLORS[index % COLORS.length]
    }));

    const activeTrendData = viewMode === 'model'
        ? modelTrendData
        : viewMode === 'account'
            ? accountTrendData
            : apiKeyTrendData;

    const activeTrendKeys = viewMode === 'model'
        ? allModels
        : viewMode === 'account'
            ? allAccounts
            : allApiKeys;

    const distributionData = viewMode === 'apiKey' ? apiKeyPieData : pieData;

    const trendChartContainerRef = useRef<HTMLDivElement>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | undefined>(undefined);

    // Ref and state for pie chart tooltip position
    const pieChartContainerRef = useRef<HTMLDivElement>(null);
    const [pieTooltipPosition, setPieTooltipPosition] = useState<{ x: number; y: number } | undefined>(undefined);

    // Handle mouse move to calculate tooltip position
    const handleTrendChartMouseMove = useCallback((e: any) => {
        if (!trendChartContainerRef.current || !e?.activeCoordinate) return;

        const containerRect = trendChartContainerRef.current.getBoundingClientRect();
        const tooltipWidth = 200; // Approximate tooltip width
        const rightEdgeThreshold = containerRect.width - tooltipWidth - 20; // 20px buffer

        const mouseXInContainer = e.activeCoordinate.x;

        if (mouseXInContainer > rightEdgeThreshold) {
            setTooltipPosition({
                x: e.activeCoordinate.x - tooltipWidth - 15,
                y: e.activeCoordinate.y
            });
        } else {
            setTooltipPosition(undefined); // Use default positioning
        }
    }, []);

    // Handle mouse move for pie chart to calculate tooltip position
    const handlePieChartMouseMove = useCallback((e: any) => {
        if (!pieChartContainerRef.current) return;

        const containerRect = pieChartContainerRef.current.getBoundingClientRect();
        const tooltipWidth = 180; // Approximate tooltip width for pie chart

        // Get mouse position relative to container
        if (e?.activeCoordinate) {
            const mouseXInContainer = e.activeCoordinate.x;
            const rightEdgeThreshold = containerRect.width - tooltipWidth - 20;

            if (mouseXInContainer > rightEdgeThreshold) {
                setPieTooltipPosition({
                    x: e.activeCoordinate.x - tooltipWidth - 15,
                    y: e.activeCoordinate.y
                });
            } else {
                setPieTooltipPosition(undefined);
            }
        }
    }, []);

    // Custom Tooltip for Trend Chart
    const CustomTrendTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;

        // Sort payload by value descending
        const sortedPayload = [...payload].sort((a: any, b: any) => b.value - a.value);

        return (
            <div className="bg-white/95 dark:bg-base-100/95 backdrop-blur-sm p-2 rounded border border-gray-200 dark:border-base-200 text-[10px] z-[100] min-w-[180px] pointer-events-none shadow-sm">
                <p className="font-semibold text-gray-900 dark:text-gray-200 mb-1 border-b border-gray-100 dark:border-base-200 pb-1">
                    {label}
                </p>
                <div className="max-h-[180px] overflow-y-auto space-y-1 pr-1.5 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                    {sortedPayload.map((entry: any, index: number) => {
                        const name = entry.name;
                        const displayName = viewMode === 'model'
                            ? shortenModelName(name)
                            : viewMode === 'account'
                                ? name.split('@')[0]
                                : name;
                        return (
                            <div key={index} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                    <span className="text-gray-500 dark:text-gray-400 truncate max-w-[120px]" title={name}>
                                        {displayName}
                                    </span>
                                </div>
                                <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                                    {formatNumber(entry.value)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Custom Tooltip for Bar/Pie Charts
    const SimpleCustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        return (
            <div className="bg-white/95 dark:bg-base-100/95 backdrop-blur-sm p-2 rounded border border-gray-200 dark:border-base-200 text-[10px] z-[100] pointer-events-none shadow-sm">
                {label && <p className="font-semibold text-gray-900 dark:text-gray-200 mb-1">{label}</p>}
                <div className="space-y-1">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                            <span className="text-gray-500 dark:text-gray-400">
                                {entry.name}:
                            </span>
                            <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                                {formatNumber(entry.value)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Custom Tooltip for Pie Chart
    const CustomPieTooltip = ({ active, payload }: any) => {
        if (!active || !payload || !payload.length) return null;
        const entry = payload[0];
        return (
            <div className="bg-white/95 dark:bg-base-100/95 backdrop-blur-sm p-2 rounded border border-gray-200 dark:border-base-200 text-[10px] z-[100] pointer-events-none shadow-sm">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.payload.color || entry.color }} />
                    <span className="text-gray-500 dark:text-gray-400">
                        {entry.payload.fullEmail || entry.payload.fullLabel || entry.name}:
                    </span>
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                        {formatNumber(entry.value)}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-5 space-y-4 max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h1 className="text-lg font-semibold tracking-tight text-gray-950 dark:text-base-content flex items-center gap-2">
                        {t('token_stats.title', 'Token Usage Stats')}
                    </h1>
                    <div className="flex items-center gap-2">
                        <div className="flex border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-md p-0.5">
                            <button
                                onClick={() => setTimeRange('hourly')}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${timeRange === 'hourly'
                                    ? 'bg-gray-100 dark:bg-base-200 text-gray-950 dark:text-white font-semibold'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                {t('token_stats.hourly', 'Hourly')}
                            </button>
                            <button
                                onClick={() => setTimeRange('daily')}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${timeRange === 'daily'
                                    ? 'bg-gray-100 dark:bg-base-200 text-gray-950 dark:text-white font-semibold'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                {t('token_stats.daily', 'Daily')}
                            </button>
                            <button
                                onClick={() => setTimeRange('weekly')}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${timeRange === 'weekly'
                                    ? 'bg-gray-100 dark:bg-base-200 text-gray-950 dark:text-white font-semibold'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                <CalendarDays className="w-3.5 h-3.5" />
                                {t('token_stats.weekly', 'Weekly')}
                            </button>
                        </div>
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="p-1.5 border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 hover:bg-gray-50 dark:hover:bg-base-200 text-gray-500 hover:text-gray-700 dark:text-gray-400 rounded-md transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {summary && (
                    <div className="border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-lg overflow-hidden">
                        <dl className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-base-200">
                            <div className="px-4 py-3 min-w-0">
                                <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('token_stats.total_tokens', 'Total Tokens')}</dt>
                                <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate font-semibold">
                                    {formatNumber(summary.total_tokens)}
                                </dd>
                            </div>
                            <div className="px-4 py-3 min-w-0">
                                <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('token_stats.input_tokens', 'Input Tokens')}</dt>
                                <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate font-semibold">
                                    {formatNumber(summary.total_input_tokens)}
                                </dd>
                            </div>
                            <div className="px-4 py-3 min-w-0">
                                <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('token_stats.output_tokens', 'Output Tokens')}</dt>
                                <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate font-semibold">
                                    {formatNumber(summary.total_output_tokens)}
                                </dd>
                            </div>
                            <div className="px-4 py-3 min-w-0">
                                <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('token_stats.accounts_used', 'Active Accounts')}</dt>
                                <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate font-semibold">
                                    {summary.unique_accounts}
                                </dd>
                            </div>
                            <div className="px-4 py-3 min-w-0">
                                <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('token_stats.models_used', 'Models Used')}</dt>
                                <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate font-semibold">
                                    {modelData.length}
                                </dd>
                            </div>
                        </dl>
                    </div>
                )}

                <div className="border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {viewMode === 'model'
                                ? t('token_stats.model_trend', 'Usage Trend by Model')
                                : viewMode === 'account'
                                    ? t('token_stats.account_trend', 'Usage Trend by Account')
                                    : t('token_stats.api_key_trend', 'Usage Trend by API Key')
                            }
                        </h2>
                        <div className="flex border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-md p-0.5">
                            <button
                                onClick={() => setViewMode('model')}
                                className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${viewMode === 'model'
                                    ? 'bg-gray-100 dark:bg-base-200 text-gray-900 dark:text-white font-semibold'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                {t('token_stats.by_model', 'By Model')}
                            </button>
                            <button
                                onClick={() => setViewMode('account')}
                                className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${viewMode === 'account'
                                    ? 'bg-gray-100 dark:bg-base-200 text-gray-900 dark:text-white font-semibold'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                {t('token_stats.by_account_view', 'By Account')}
                            </button>
                            <button
                                onClick={() => setViewMode('apiKey')}
                                className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${viewMode === 'apiKey'
                                    ? 'bg-gray-100 dark:bg-base-200 text-gray-900 dark:text-white font-semibold'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                {t('token_stats.by_api_key', 'By API Key')}
                            </button>
                        </div>
                    </div>
                    <div className="h-72" ref={trendChartContainerRef}>
                        {activeTrendData.length > 0 && activeTrendKeys.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={activeTrendData}
                                    onMouseMove={handleTrendChartMouseMove}
                                    onMouseLeave={() => setTooltipPosition(undefined)}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.06} />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fontSize: 10, fill: '#a1a1aa' }}
                                        tickFormatter={(val) => {
                                            if (timeRange === 'hourly') return val.split(' ')[1] || val;
                                            if (timeRange === 'daily') return val.split('-').slice(1).join('/');
                                            return val;
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 10, fill: '#a1a1aa' }}
                                        tickFormatter={(val) => formatNumber(val)}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        content={<CustomTrendTooltip />}
                                        cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.2, fill: 'transparent' }}
                                        allowEscapeViewBox={{ x: true, y: true }}
                                        position={tooltipPosition}
                                        wrapperStyle={{ zIndex: 100 }}
                                    />
                                    <Legend
                                        formatter={(value) => viewMode === 'model'
                                            ? shortenModelName(value)
                                            : viewMode === 'account'
                                                ? value.split('@')[0]
                                                : value}
                                        wrapperStyle={{
                                            fontSize: '10px',
                                            paddingTop: '10px',
                                            maxHeight: '60px',
                                            overflowY: 'auto',
                                            zIndex: 0
                                        }}
                                    />
                                    {activeTrendKeys.map((item, index) => (
                                        <Area
                                            key={item}
                                            type="monotone"
                                            dataKey={item}
                                            stackId="1"
                                            stroke={(viewMode === 'model' ? MODEL_COLORS : COLORS)[index % (viewMode === 'model' ? MODEL_COLORS.length : COLORS.length)]}
                                            fill={(viewMode === 'model' ? MODEL_COLORS : COLORS)[index % (viewMode === 'model' ? MODEL_COLORS.length : COLORS.length)]}
                                            fillOpacity={0.12}
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                                {loading ? t('common.loading', 'Loading...') : t('token_stats.no_data', 'No data')}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-lg p-4 flex flex-col">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                            {t('token_stats.usage_trend', 'Token Usage Trend')}
                        </h2>
                        <div className="flex-1 min-h-[16rem]">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.06} />
                                        <XAxis
                                            dataKey="period"
                                            tick={{ fontSize: 10, fill: '#a1a1aa' }}
                                            tickFormatter={(val) => {
                                                if (timeRange === 'hourly') return val.split(' ')[1] || val;
                                                if (timeRange === 'daily') return val.split('-').slice(1).join('/');
                                                return val;
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                            dy={10}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10, fill: '#a1a1aa' }}
                                            tickFormatter={(val) => formatNumber(val)}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            content={<SimpleCustomTooltip />}
                                            cursor={{ fill: 'transparent' }}
                                            allowEscapeViewBox={{ x: true, y: true }}
                                            wrapperStyle={{ zIndex: 100 }}
                                        />
                                        <Bar dataKey="total_input_tokens" name="Input" fill="#a1a1aa" radius={[2, 2, 0, 0]} maxBarSize={30} opacity={0.6} />
                                        <Bar dataKey="total_output_tokens" name="Output" fill="#3f3f46" radius={[2, 2, 0, 0]} maxBarSize={30} opacity={0.9} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                                    {loading ? t('common.loading', 'Loading...') : t('token_stats.no_data', 'No data')}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-lg p-4 flex flex-col justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {viewMode === 'apiKey'
                                    ? t('token_stats.by_api_key', 'By API Key')
                                    : t('token_stats.by_account', 'By Account')}
                            </h2>
                            <div className="h-44" ref={pieChartContainerRef}>
                                {distributionData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart
                                            onMouseMove={handlePieChartMouseMove}
                                            onMouseLeave={() => setPieTooltipPosition(undefined)}
                                        >
                                            <Pie
                                                data={distributionData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={48}
                                                outerRadius={68}
                                                paddingAngle={2}
                                                dataKey="value"
                                            >
                                                {distributionData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                content={<CustomPieTooltip />}
                                                allowEscapeViewBox={{ x: true, y: true }}
                                                position={pieTooltipPosition}
                                                wrapperStyle={{ zIndex: 100 }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                                        {loading ? t('common.loading', 'Loading...') : t('token_stats.no_data', 'No data')}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-4 space-y-2 max-h-32 overflow-y-auto">
                            {(viewMode === 'apiKey'
                                ? apiKeyData.slice(0, 5).map((item) => ({
                                    key: item.username,
                                    label: item.username,
                                    total_tokens: item.total_tokens,
                                }))
                                : accountData.slice(0, 5).map((item) => ({
                                    key: item.account_email,
                                    label: item.account_email.split('@')[0],
                                    total_tokens: item.total_tokens,
                                }))
                            ).map((item, index) => (
                                <div key={item.key} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        <span className="text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                                            {item.label}
                                        </span>
                                    </div>
                                    <span className="font-medium text-gray-900 dark:text-white font-mono">
                                        {formatNumber(item.total_tokens)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {modelData.length > 0 && viewMode === 'model' && (
                    <div className="border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-gray-200 dark:border-base-200 bg-gray-50/20 dark:bg-base-200/10">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {t('token_stats.model_details', 'Model Breakdown')}
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50/50 dark:bg-base-200/50 border-b border-gray-200 dark:border-base-200">
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-left">
                                            {t('token_stats.model', 'Model')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.requests', 'Requests')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.input', 'Input')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.output', 'Output')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.total', 'Total')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.percentage', 'Share')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modelData.map((model, index) => {
                                        const percentage = summary ? ((model.total_tokens / summary.total_tokens) * 100).toFixed(1) : '0';
                                        return (
                                            <tr
                                                key={model.model}
                                                className="border-b border-gray-100 dark:border-base-200/30 hover:bg-gray-50 dark:hover:bg-base-200/20"
                                            >
                                                <td className="py-2.5 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-2 h-2 rounded-full"
                                                            style={{ backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length] }}
                                                        />
                                                        <span className="text-gray-900 dark:text-gray-100 font-medium">
                                                            {model.model}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-4 text-right text-gray-500 dark:text-gray-400 font-mono">
                                                    {model.request_count.toLocaleString()}
                                                </td>
                                                <td className="py-2.5 px-4 text-right text-gray-500 dark:text-gray-400 font-mono">
                                                    {formatNumber(model.total_input_tokens)}
                                                </td>
                                                <td className="py-2.5 px-4 text-right text-gray-500 dark:text-gray-400 font-mono">
                                                    {formatNumber(model.total_output_tokens)}
                                                </td>
                                                <td className="py-2.5 px-4 text-right font-medium text-gray-900 dark:text-gray-100 font-mono">
                                                    {formatNumber(model.total_tokens)}
                                                </td>
                                                <td className="py-2.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 bg-gray-100 dark:bg-zinc-800/80 rounded-full h-1.5">
                                                            <div
                                                                className="h-1.5 rounded-full bg-zinc-700 dark:bg-zinc-400"
                                                                style={{
                                                                    width: `${percentage}%`
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-gray-500 dark:text-gray-400 w-10 text-right font-mono">
                                                            {percentage}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {accountData.length > 0 && viewMode === 'account' && (
                    <div className="border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-gray-200 dark:border-base-200 bg-gray-50/20 dark:bg-base-200/10">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {t('token_stats.account_details', 'Account Breakdown')}
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50/50 dark:bg-base-200/50 border-b border-gray-200 dark:border-base-200">
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-left">
                                            {t('token_stats.account', 'Account')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.requests', 'Requests')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.input', 'Input')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.output', 'Output')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.total', 'Total')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {accountData.map((account) => (
                                        <tr
                                            key={account.account_email}
                                            className="border-b border-gray-100 dark:border-base-200/30 hover:bg-gray-50 dark:hover:bg-base-200/20"
                                        >
                                            <td className="py-2.5 px-4 text-gray-900 dark:text-gray-100 font-medium">
                                                {account.account_email}
                                            </td>
                                            <td className="py-2.5 px-4 text-right text-gray-500 dark:text-gray-400 font-mono">
                                                {account.request_count.toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-4 text-right text-gray-500 dark:text-gray-400 font-mono">
                                                {formatNumber(account.total_input_tokens)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right text-gray-500 dark:text-gray-400 font-mono">
                                                {formatNumber(account.total_output_tokens)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-medium text-gray-900 dark:text-gray-100 font-mono">
                                                {formatNumber(account.total_tokens)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {apiKeyData.length > 0 && viewMode === 'apiKey' && (
                    <div className="border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-gray-200 dark:border-base-200 bg-gray-50/20 dark:bg-base-200/10">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {t('token_stats.api_key_details', 'API Key Breakdown')}
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50/50 dark:bg-base-200/50 border-b border-gray-200 dark:border-base-200">
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-left">
                                            {t('token_stats.api_key', 'API Key')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.requests', 'Requests')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.input', 'Input')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.output', 'Output')}
                                        </th>
                                        <th className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold py-2 px-4 text-right">
                                            {t('token_stats.total', 'Total')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {apiKeyData.map((apiKey) => (
                                        <tr
                                            key={apiKey.username}
                                            className="border-b border-gray-100 dark:border-base-200/30 hover:bg-gray-50 dark:hover:bg-base-200/20"
                                        >
                                            <td className="py-2.5 px-4 text-gray-900 dark:text-gray-100 font-medium">
                                                {apiKey.username}
                                            </td>
                                            <td className="py-2.5 px-4 text-right text-gray-500 dark:text-gray-400 font-mono">
                                                {apiKey.request_count.toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-4 text-right text-gray-500 dark:text-gray-400 font-mono">
                                                {formatNumber(apiKey.total_input_tokens)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right text-gray-500 dark:text-gray-400 font-mono">
                                                {formatNumber(apiKey.total_output_tokens)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-medium text-gray-900 dark:text-gray-100 font-mono">
                                                {formatNumber(apiKey.total_tokens)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TokenStats;
