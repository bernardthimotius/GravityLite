import React, { useEffect, useState, useRef, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import ModalDialog from '../common/ModalDialog';
import { useTranslation } from 'react-i18next';
import { request as invoke } from '../../utils/request';
import { Trash2, Search, X, Copy, CheckCircle, ChevronLeft, ChevronRight, RefreshCw, User } from 'lucide-react';

import { AppConfig } from '../../types/config';
import { formatCompactNumber } from '../../utils/format';
import { useAccountStore } from '../../stores/useAccountStore';
import { isTauri } from '../../utils/env';
import { copyToClipboard } from '../../utils/clipboard';


interface ProxyRequestLog {
    id: string;
    timestamp: number;
    method: string;
    url: string;
    status: number;
    duration: number;
    model?: string;
    mapped_model?: string;
    error?: string;
    request_body?: string;
    response_body?: string;
    input_tokens?: number;
    output_tokens?: number;
    account_email?: string;
    protocol?: string;  // "openai" | "anthropic" | "gemini"
}

interface ProxyStats {
    total_requests: number;
    success_count: number;
    error_count: number;
}

interface ProxyMonitorProps {
    className?: string;
}

// Log Table Component
interface LogTableProps {
    logs: ProxyRequestLog[];
    loading: boolean;
    onLogClick: (log: ProxyRequestLog) => void;
    t: any;
}

const LogTable: React.FC<LogTableProps> = ({
    logs,
    loading,
    onLogClick,
    t
}) => {
    const getProtocolLabel = (protocol?: string) => {
        if (protocol === 'openai') return 'OpenAI';
        if (protocol === 'anthropic') return 'Claude';
        if (protocol === 'gemini') return 'Gemini';
        return protocol || '-';
    };

    const maskEmail = (email?: string) => email ? email.replace(/(.{3}).*(@.*)/, '$1***$2') : '-';

    const getStatusMeta = (status: number) => {
        if (status >= 200 && status < 400) {
            return {
                label: 'OK',
                className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
            };
        }

        if (status === 429) {
            return {
                label: 'Limit',
                className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'
            };
        }

        return {
            label: 'Error',
            className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300'
        };
    };

    const getDetailSummary = (log: ProxyRequestLog) => {
        if (!log.error) return log.url || '-';

        let detail = log.error;
        try {
            const parsed = JSON.parse(detail);
            detail = parsed?.error?.message || parsed?.message || detail;
        } catch {
            // Error details may be plain text from retry/network failures.
        }

        detail = detail
            .replace(/\\n/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\{\s*"error"\s*:\s*\{.*?"message"\s*:\s*"/i, '')
            .replace(/"\s*,\s*"status".*$/i, '')
            .trim();

        if (detail.includes('GenerateContentRequest.safety_settings')) {
            return 'Invalid safety settings sent upstream';
        }

        if (detail.includes('Request contains an invalid argument')) {
            return 'Invalid argument rejected by upstream';
        }

        if (detail.includes('All accounts exhausted')) {
            return 'All accounts exhausted';
        }

        if (detail.includes('Max retries exhausted')) {
            return 'Network retries exhausted';
        }

        return detail || 'Upstream error';
    };

    return (
        <div className="flex-1 overflow-y-auto overflow-x-auto bg-white dark:bg-base-100">
            <table className="table table-sm table-fixed w-full">
                <thead className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 text-[10px] uppercase tracking-[0.18em] text-gray-400 backdrop-blur dark:border-base-200 dark:bg-base-100/95">
                    <tr>
                        <th style={{ width: '120px' }}>{t('monitor.table.status')}</th>
                        <th>{t('monitor.table.request')}</th>
                        <th className="text-right" style={{ width: '130px' }}>{t('monitor.table.usage')}</th>
                        <th className="text-right" style={{ width: '160px' }}>{t('monitor.table.time')}</th>
                    </tr>
                </thead>
                <tbody className="font-mono text-gray-700 dark:text-gray-300">
                    {logs.map((log) => {
                        const statusMeta = getStatusMeta(log.status);
                        const modelLabel = log.mapped_model && log.model !== log.mapped_model
                            ? `${log.model || '-'} -> ${log.mapped_model}`
                            : (log.model || '-');

                        return (
                            <tr
                                key={log.id}
                                className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50/80 dark:border-base-200/60 dark:hover:bg-base-200/40"
                                onClick={() => onLogClick(log)}
                            >
                                <td style={{ width: '120px' }}>
                                <div className="flex flex-col gap-1">
                                    <span className={`w-fit rounded-md border px-2 py-0.5 text-[10px] font-black ${statusMeta.className}`}>
                                        {log.status} {statusMeta.label}
                                    </span>
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{log.method}</span>
                                </div>
                            </td>
                            <td className="min-w-[300px]">
                                <div className="truncate font-bold text-gray-900 dark:text-zinc-100" title={modelLabel}>
                                    {modelLabel}
                                </div>
                                <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                                    <span className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 font-semibold text-gray-500 dark:border-base-300 dark:text-gray-400">
                                        {getProtocolLabel(log.protocol)}
                                    </span>
                                    <span className="truncate" title={log.error || log.url || '-'}>{getDetailSummary(log)}</span>
                                </div>
                            </td>
                            <td className="text-right text-[10px]" style={{ width: '130px' }}>
                                <div className="font-semibold text-gray-700 dark:text-gray-300">{formatCompactNumber(log.input_tokens ?? 0)} / {formatCompactNumber(log.output_tokens ?? 0)}</div>
                                <div className="text-gray-400">{log.duration}ms</div>
                            </td>
                            <td className="text-right text-[10px]" style={{ width: '160px' }} title={log.account_email || ''}>
                                <div className="font-semibold text-gray-700 dark:text-gray-300">{new Date(log.timestamp).toLocaleTimeString()}</div>
                                <div className="text-gray-400 truncate">{maskEmail(log.account_email)}</div>
                            </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Loading indicator */}
            {loading && (
                <div className="flex items-center justify-center p-4 bg-white dark:bg-base-100">
                    <div className="loading loading-spinner loading-md"></div>
                    <span className="ml-3 text-sm text-gray-500">{t('common.loading')}</span>
                </div>
            )}

            {/* Empty state */}
            {!loading && logs.length === 0 && (
                <div className="flex items-center justify-center p-10 text-xs font-semibold text-gray-400">
                    {t('monitor.table.empty') || '暂无请求记录'}
                </div>
            )}
        </div>
    );
};


export const ProxyMonitor: React.FC<ProxyMonitorProps> = ({ className }) => {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<ProxyRequestLog[]>([]);
    const [stats, setStats] = useState<ProxyStats>({ total_requests: 0, success_count: 0, error_count: 0 });
    const [filter, setFilter] = useState('');
    const [quickFilter, setQuickFilter] = useState('');
    const [accountFilter, setAccountFilter] = useState('');
    // [FIX] 使用 ref 存储最新的筛选条件，避免 setInterval 闭包问题
    const filterRef = useRef(filter);
    const accountFilterRef = useRef(accountFilter);
    const quickFilterRef = useRef(quickFilter);
    const currentPageRef = useRef(1);
    const [selectedLog, setSelectedLog] = useState<ProxyRequestLog | null>(null);
    const [payloadView, setPayloadView] = useState<'request' | 'response'>('request');
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
    const [copiedRequestId, setCopiedRequestId] = useState<string | null>(null);

    const { accounts, fetchAccounts } = useAccountStore();

    // Pagination state
    const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];
    const [pageSize, setPageSize] = useState(100);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const uniqueAccounts = useMemo(() => {
        const emailSet = new Set<string>();
        logs.forEach(log => {
            if (log.account_email) {
                emailSet.add(log.account_email);
            }
        });
        accounts.forEach(acc => {
            emailSet.add(acc.email);
        });
        return Array.from(emailSet).sort();
    }, [logs, accounts]);

    const loadData = async (page = 1, searchFilter = filter, accountEmailFilter = accountFilter, activeQuickFilter = quickFilter) => {
        if (loading) return;
        setLoading(true);

        try {
            // Add timeout control (10 seconds)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), 10000)
            );

            const config = await Promise.race([
                invoke<AppConfig>('load_config'),
                timeoutPromise
            ]) as AppConfig;

            if (config && config.proxy) {
                if (!config.proxy.enable_logging) {
                    config.proxy.enable_logging = true;
                    await invoke('save_config', { config });
                }
                await invoke('set_proxy_monitor_enabled', { enabled: true });
            }

            const errorsOnly = activeQuickFilter === '__ERROR__';
            const baseFilter = [searchFilter, errorsOnly ? '' : activeQuickFilter].filter(Boolean).join(' ');
            const actualFilter = accountEmailFilter
                ? (baseFilter ? `${baseFilter} ${accountEmailFilter}` : accountEmailFilter)
                : baseFilter;

            // Get count with filter
            const count = await Promise.race([
                invoke<number>('get_proxy_logs_count_filtered', {
                    filter: actualFilter,
                    errorsOnly: errorsOnly
                }),
                timeoutPromise
            ]) as number;
            setTotalCount(count);

            // Use filtered paginated query
            const offset = (page - 1) * pageSize;
            const history = await Promise.race([
                invoke<ProxyRequestLog[]>('get_proxy_logs_filtered', {
                    filter: actualFilter,
                    errorsOnly: errorsOnly,
                    limit: pageSize,
                    offset: offset
                }),
                timeoutPromise
            ]) as ProxyRequestLog[];

            if (Array.isArray(history)) {
                setLogs(history);
                // Clear pending logs to avoid duplicates (database data is authoritative)
                pendingLogsRef.current = [];
            }

            const currentStats = await Promise.race([
                invoke<ProxyStats>('get_proxy_stats'),
                timeoutPromise
            ]) as ProxyStats;

            if (currentStats) setStats(currentStats);
        } catch (e: any) {
            console.error("Failed to load proxy data", e);
            if (e.message === 'Request timeout') {
                // Show timeout error to user
                console.error('Loading monitor data timeout, please try again later');
            }
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(totalCount / pageSize);
    const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const pageEnd = totalCount === 0 ? 0 : Math.min(currentPage * pageSize, totalCount);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
            currentPageRef.current = page; // [FIX] 同步 ref
            loadData(page, filter, accountFilter);
        }
    };

    const pendingLogsRef = useRef<ProxyRequestLog[]>([]);
    const listenerSetupRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        loadData();
        fetchAccounts();

        let unlistenFn: (() => void) | null = null;
        let updateTimeout: number | null = null;

        const setupListener = async () => {
            if (!isTauri()) return;
            // Prevent duplicate listener registration (React 18 StrictMode)
            if (listenerSetupRef.current) {
                console.debug('[ProxyMonitor] Listener already set up, skipping...');
                return;
            }
            listenerSetupRef.current = true;

            console.debug('[ProxyMonitor] Setting up event listener for proxy://request');
            unlistenFn = await listen<ProxyRequestLog>('proxy://request', (event) => {
                if (!isMountedRef.current) return;

                const newLog = event.payload;

                // 移除 body 以减少内存占用
                const logSummary = {
                    ...newLog,
                    request_body: undefined,
                    response_body: undefined
                };

                // Check if this log already exists (deduplicate at event level)
                const alreadyExists = pendingLogsRef.current.some(log => log.id === newLog.id);
                if (alreadyExists) {
                    console.debug('[ProxyMonitor] Duplicate event ignored:', newLog.id);
                    return;
                }

                pendingLogsRef.current.push(logSummary);

                // 防抖:每 500ms 批量更新一次
                if (updateTimeout) clearTimeout(updateTimeout);
                updateTimeout = setTimeout(async () => {
                    if (!isMountedRef.current) return;

                    const currentPending = pendingLogsRef.current;
                    if (currentPending.length > 0) {
                        setLogs(prev => {
                            // Deduplicate by id
                            const existingIds = new Set(prev.map(log => log.id));
                            const uniqueNewLogs = currentPending.filter(log => !existingIds.has(log.id));
                            // Merge and sort by timestamp descending (newest first)
                            const merged = [...uniqueNewLogs, ...prev];
                            merged.sort((a, b) => b.timestamp - a.timestamp);
                            return merged.slice(0, 100);
                        });

                        // Fetch stats and total count from backend instead of local calculation
                        try {
                            const [currentStats, count] = await Promise.all([
                                invoke<ProxyStats>('get_proxy_stats'),
                                invoke<number>('get_proxy_logs_count_filtered', { filter: '', errorsOnly: false })
                            ]);
                            if (isMountedRef.current) {
                                if (currentStats) setStats(currentStats);
                                setTotalCount(count);
                            }
                        } catch (e) {
                            console.error('Failed to fetch stats:', e);
                        }

                        pendingLogsRef.current = [];
                    }
                }, 500);
            });
        };
        setupListener();

        // Web 模式補強：如果不是 Tauri 環境，則啟用定時輪詢
        let pollInterval: number | null = null;
        if (!isTauri()) {
            console.debug('[ProxyMonitor] Web mode detected, starting auto-poll (10s)');
            pollInterval = window.setInterval(() => {
                if (isMountedRef.current && !loading) {
                    // [FIX] 使用 ref.current 获取最新的筛选条件
                    loadData(currentPageRef.current, filterRef.current, accountFilterRef.current, quickFilterRef.current);
                }
            }, 10000);
        }

        return () => {
            isMountedRef.current = false;
            listenerSetupRef.current = false;
            if (unlistenFn) unlistenFn();
            if (updateTimeout) clearTimeout(updateTimeout);
            if (pollInterval) clearInterval(pollInterval);
        };
    }, []);

    useEffect(() => {
        setCopiedRequestId(null);
        setPayloadView('request');
    }, [selectedLog?.id]);

    // Reload when pageSize changes
    useEffect(() => {
        setCurrentPage(1);
        loadData(1, filter, accountFilter, quickFilter);
    }, [pageSize]);

    // Reload when filter changes (search based on all logs)
    useEffect(() => {
        setCurrentPage(1);
        loadData(1, filter, accountFilter, quickFilter);
        // [FIX] 同步 ref 值，供 setInterval 使用
        filterRef.current = filter;
        accountFilterRef.current = accountFilter;
        quickFilterRef.current = quickFilter;
        currentPageRef.current = 1;
    }, [filter, accountFilter, quickFilter]);

    // Logs are already filtered and sorted by backend
    // Apply account filter on frontend
    const filteredLogs = useMemo(() => {
        if (!accountFilter) return logs;
        return logs.filter(log => log.account_email === accountFilter);
    }, [logs, accountFilter]);

    const quickFilters = [
        { label: t('monitor.filters.all'), value: '' },
        { label: t('monitor.filters.error'), value: '__ERROR__' },
        { label: t('monitor.filters.chat'), value: 'completions' },
        { label: t('monitor.filters.gemini'), value: 'gemini' },
        { label: t('monitor.filters.claude'), value: 'claude' },
        { label: t('monitor.filters.images'), value: 'images' }
    ];

    const clearLogs = () => {
        setIsClearConfirmOpen(true);
    };

    const executeClearLogs = async () => {
        setIsClearConfirmOpen(false);
        try {
            await invoke('clear_proxy_logs');
            setLogs([]);
            setStats({ total_requests: 0, success_count: 0, error_count: 0 });
            setTotalCount(0);
        } catch (e) {
            console.error("Failed to clear logs", e);
        }
    };

    const formatBody = (body?: string) => {
        if (!body) return <span className="text-gray-400 italic">{t('monitor.details.payload_empty')}</span>;
        try {
            const obj = JSON.parse(body);
            return <pre className="text-[10px] font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300">{JSON.stringify(obj, null, 2)}</pre>;
        } catch (e) {
            return <pre className="text-[10px] font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300">{body}</pre>;
        }
    };

    const getCopyPayload = (body: string) => {
        try {
            const obj = JSON.parse(body);
            return JSON.stringify(obj, null, 2);
        } catch (e) {
            return body;
        }
    };


    return (
        <div className={`flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-base-200 dark:bg-base-100 ${className || 'flex-1'}`}>
            <div className="space-y-4 border-b border-gray-100 bg-gray-50/40 p-4 dark:border-base-200 dark:bg-base-200/20">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black tracking-tight text-gray-950 dark:text-base-content">{t('monitor.page_title')}</h2>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('monitor.page_subtitle')}</p>
                    </div>

                    <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-base-300 dark:bg-base-100">
                        {[
                            { value: stats.total_requests, label: t('monitor.stats.total'), tone: 'text-gray-900 dark:text-zinc-100' },
                            { value: stats.success_count, label: t('monitor.stats.ok'), tone: 'text-emerald-600 dark:text-emerald-300' },
                            { value: stats.error_count, label: t('monitor.stats.err'), tone: 'text-rose-600 dark:text-rose-300' }
                        ].map((item, index) => (
                            <div key={item.label} className={`min-w-[92px] px-3 py-2 ${index > 0 ? 'border-l border-gray-100 dark:border-base-300' : ''}`}>
                                <div className={`text-sm font-black tabular-nums ${item.tone}`}>{formatCompactNumber(item.value)}</div>
                                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400">{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder={t('monitor.filters.placeholder')}
                            className="h-9 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-xs font-medium text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 dark:border-base-300 dark:bg-base-100 dark:text-base-content"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <User className="absolute left-2.5 top-2.5 text-gray-400 z-10" size={14} />
                        <select
                            className="h-9 w-full rounded-xl border border-gray-200 bg-white pl-8 pr-8 text-xs font-medium text-gray-700 outline-none transition-colors focus:border-gray-400 dark:border-base-300 dark:bg-base-100 dark:text-base-content lg:min-w-[180px] lg:max-w-[260px]"
                            value={accountFilter}
                            onChange={(e) => setAccountFilter(e.target.value)}
                            title={t('monitor.filters.by_account')}
                        >
                            <option value="">{t('monitor.filters.all_accounts')}</option>
                            {uniqueAccounts.map(email => (
                                <option key={email} value={email} title={email}>
                                    {email}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button onClick={() => loadData(currentPage, filter, accountFilter, quickFilter)} className="flex h-9 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 dark:border-base-300 dark:bg-base-100 dark:text-gray-300 dark:hover:bg-base-200" title={t('common.refresh')}>
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">{t('common.refresh')}</span>
                    </button>
                    <button onClick={clearLogs} className="flex h-9 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-base-300 dark:bg-base-100 dark:text-gray-300 dark:hover:border-rose-900/60 dark:hover:bg-rose-950/30 dark:hover:text-rose-300">
                        <Trash2 size={15} />
                        <span className="hidden sm:inline">{t('common.clear')}</span>
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {quickFilters.map(q => {
                        const isActive = quickFilter === q.value;
                        return (
                            <button
                                key={q.label}
                                onClick={() => setQuickFilter(q.value)}
                                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${isActive
                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:border-base-300 dark:bg-base-100 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                {q.label}
                            </button>
                        );
                    })}
                    {(filter || accountFilter || quickFilter) && (
                        <button onClick={() => { setFilter(''); setQuickFilter(''); setAccountFilter(''); }} className="rounded-full px-2 py-1.5 text-[11px] font-bold text-gray-400 transition-colors hover:text-gray-800 dark:hover:text-gray-200">
                            {t('monitor.filters.reset')}
                        </button>
                    )}
                </div>
            </div>

            <LogTable
                logs={filteredLogs}
                loading={loading}
                onLogClick={async (log: ProxyRequestLog) => {
                    setLoadingDetail(true);
                    try {
                        const detail = await invoke<ProxyRequestLog>('get_proxy_log_detail', { logId: log.id });
                        setSelectedLog(detail);
                    } catch (e) {
                        console.error('Failed to load log detail', e);
                        setSelectedLog(log);
                    } finally {
                        setLoadingDetail(false);
                    }
                }}
                t={t}
            />

            {/* Pagination Controls */}
            <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3 text-xs dark:border-base-200 dark:bg-base-200/20 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 whitespace-nowrap text-gray-500">
                    <span className="font-bold uppercase tracking-[0.16em] text-[10px]">{t('common.per_page')}</span>
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="h-7 rounded-lg border border-gray-200 bg-white px-2 text-[11px] font-bold text-gray-700 outline-none dark:border-base-300 dark:bg-base-100 dark:text-gray-300"
                    >
                        {PAGE_SIZE_OPTIONS.map(size => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-center">
                    <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage <= 1 || loading}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-base-300 dark:bg-base-100 dark:hover:bg-base-200"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <span className="min-w-[80px] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-center font-mono text-[11px] font-bold text-gray-600 dark:border-base-300 dark:bg-base-100 dark:text-gray-400">
                        {currentPage} / {totalPages || 1}
                    </span>
                    <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= totalPages || loading}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-base-300 dark:bg-base-100 dark:hover:bg-base-200"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>

                <div className="text-gray-500 sm:text-right">
                    {t('common.pagination_info', { start: pageStart, end: pageEnd, total: totalCount })}
                </div>
            </div>

            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedLog(null)}>
                    <div className="bg-white dark:bg-base-100 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-base-300" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-base-300 flex items-center justify-between bg-gray-50 dark:bg-base-200">
                            <div className="flex items-center gap-3">
                                {loadingDetail && <div className="loading loading-spinner loading-sm"></div>}
                                <span className={`badge badge-sm text-white border-none ${selectedLog.status >= 200 && selectedLog.status < 400 ? 'badge-success' : 'badge-error'}`}>{selectedLog.status}</span>
                                <span className="font-mono font-bold text-gray-900 dark:text-base-content text-sm">{selectedLog.method}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-md hidden sm:inline">{selectedLog.url}</span>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="btn btn-ghost btn-sm btn-circle text-gray-500 dark:text-gray-400 hover:dark:bg-base-300"><X size={18} /></button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white dark:bg-base-100">
                            {/* Metadata Section */}
                            <div className="bg-gray-50 dark:bg-base-200 p-5 rounded-xl border border-gray-200 dark:border-base-300 shadow-inner">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-5 gap-x-10">
                                    <div className="space-y-1.5">
                                        <span className="block text-gray-500 dark:text-gray-400 uppercase font-black text-[10px] tracking-widest">{t('monitor.details.time')}</span>
                                        <span className="font-mono font-semibold text-gray-900 dark:text-base-content text-xs">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="block text-gray-500 dark:text-gray-400 uppercase font-black text-[10px] tracking-widest">{t('monitor.details.duration')}</span>
                                        <span className="font-mono font-semibold text-gray-900 dark:text-base-content text-xs">{selectedLog.duration}ms</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="block text-gray-500 dark:text-gray-400 uppercase font-black text-[10px] tracking-widest">{t('monitor.details.tokens')}</span>
                                        <div className="font-mono text-[11px] flex gap-2">
                                            <span className="text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800/50 font-bold">In: {formatCompactNumber(selectedLog.input_tokens ?? 0)}</span>
                                            <span className="text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800/50 font-bold">Out: {formatCompactNumber(selectedLog.output_tokens ?? 0)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-5 pt-5 border-t border-gray-200 dark:border-base-300">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {selectedLog.protocol && (
                                            <div className="space-y-1.5">
                                                <span className="block text-gray-500 dark:text-gray-400 uppercase font-black text-[10px] tracking-widest">{t('monitor.details.protocol')}</span>
                                                <span className={`inline-block px-2.5 py-1 rounded-md font-mono font-black text-xs uppercase ${selectedLog.protocol === 'openai' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' :
                                                    selectedLog.protocol === 'anthropic' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50' :
                                                        selectedLog.protocol === 'gemini' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50' :
                                                            'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-400'
                                                    }`}>
                                                    {selectedLog.protocol}
                                                </span>
                                            </div>
                                        )}
                                        <div className="space-y-1.5">
                                            <span className="block text-gray-500 dark:text-gray-400 uppercase font-black text-[10px] tracking-widest">{t('monitor.details.model')}</span>
                                            <span className="font-mono font-black text-blue-600 dark:text-blue-400 break-all text-sm">{selectedLog.model || '-'}</span>
                                        </div>
                                        {selectedLog.mapped_model && selectedLog.model !== selectedLog.mapped_model && (
                                            <div className="space-y-1.5">
                                                <span className="block text-gray-500 dark:text-gray-400 uppercase font-black text-[10px] tracking-widest">{t('monitor.details.mapped_model')}</span>
                                                <span className="font-mono font-black text-green-600 dark:text-green-400 break-all text-sm">{selectedLog.mapped_model}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {selectedLog.account_email && (
                                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-base-300">
                                        <span className="block text-gray-500 dark:text-gray-400 uppercase font-black text-[10px] tracking-widest mb-2">{t('monitor.details.account_used')}</span>
                                        <span className="font-mono font-semibold text-gray-900 dark:text-base-content text-xs">{selectedLog.account_email}</span>
                                    </div>
                                )}
                            </div>

                            {/* Payloads */}
                            <div className="space-y-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="tabs tabs-boxed bg-gray-100 dark:bg-base-300 w-fit">
                                        <button
                                            type="button"
                                            className={`tab tab-sm ${payloadView === 'request' ? 'tab-active' : ''}`}
                                            onClick={() => setPayloadView('request')}
                                        >
                                            {t('monitor.details.request_payload')}
                                        </button>
                                        <button
                                            type="button"
                                            className={`tab tab-sm ${payloadView === 'response' ? 'tab-active' : ''}`}
                                            onClick={() => setPayloadView('response')}
                                        >
                                            {t('monitor.details.response_payload')}
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-xs gap-1"
                                            onClick={async () => {
                                                const body = payloadView === 'request' ? selectedLog.request_body : selectedLog.response_body;
                                                if (!body) return;
                                                const copyId = `${selectedLog.id}-${payloadView}`;
                                                const success = await copyToClipboard(getCopyPayload(body));
                                                if (success) {
                                                    setCopiedRequestId(copyId);
                                                    setTimeout(() => {
                                                        setCopiedRequestId((current) => (current === copyId ? null : current));
                                                    }, 2000);
                                                }
                                            }}
                                            disabled={payloadView === 'request' ? !selectedLog.request_body : !selectedLog.response_body}
                                            title={copiedRequestId === `${selectedLog.id}-${payloadView}` ? t('proxy.config.btn_copied') : t('proxy.config.btn_copy')}
                                            aria-label={t('proxy.config.btn_copy')}
                                        >
                                            {copiedRequestId === `${selectedLog.id}-${payloadView}` ? (
                                                <CheckCircle size={12} className="text-green-500" />
                                            ) : (
                                                <Copy size={12} />
                                            )}
                                            <span className="text-[10px]">
                                                {copiedRequestId === `${selectedLog.id}-${payloadView}` ? t('proxy.config.btn_copied') : t('proxy.config.btn_copy')}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-xs gap-1"
                                            onClick={async () => {
                                                const success = await copyToClipboard(getCopyPayload(JSON.stringify(selectedLog)));
                                                if (success) {
                                                    setCopiedRequestId(`${selectedLog.id}-full`);
                                                    setTimeout(() => {
                                                        setCopiedRequestId((current) =>
                                                            current === `${selectedLog.id}-full` ? null : current
                                                        );
                                                    }, 2000);
                                                }
                                            }}
                                            title={copiedRequestId === `${selectedLog.id}-full` ? t('proxy.config.btn_copied') : t('monitor.details.copy_full_log')}
                                            aria-label={t('proxy.config.btn_copy')}
                                        >
                                            {copiedRequestId === `${selectedLog.id}-full` ? (
                                                <CheckCircle size={12} className="text-green-500" />
                                            ) : (
                                                <Copy size={12} />
                                            )}
                                            <span className="text-[10px]">
                                                {copiedRequestId === `${selectedLog.id}-full` ? t('proxy.config.btn_copied') : t('monitor.details.copy_full_log')}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-base-300 rounded-lg p-3 border border-gray-100 dark:border-base-300 overflow-hidden">
                                    {formatBody(payloadView === 'request' ? selectedLog.request_body : selectedLog.response_body)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ModalDialog
                isOpen={isClearConfirmOpen}
                title={t('monitor.dialog.clear_title')}
                message={t('monitor.dialog.clear_msg')}
                type="confirm"
                confirmText={t('common.delete')}
                isDestructive={true}
                onConfirm={executeClearLogs}
                onCancel={() => setIsClearConfirmOpen(false)}
            />
        </div>
    );
};
