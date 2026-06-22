import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, RefreshCw, Copy, Settings, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { request as invoke } from '../utils/request';
import { showToast } from '../components/common/ToastContainer';
import { copyToClipboard } from '../utils/clipboard';

interface UserToken {
    id: string;
    token: string;
    username: string;
    description?: string;
    enabled: boolean;
    expires_type: string;
    expires_at?: number;
    max_ips: number;
    curfew_start?: string;
    curfew_end?: string;
    curfew_timezone?: string;
    created_at: number;
    updated_at: number;
    last_used_at?: number;
    total_requests: number;
    total_tokens_used: number;
}

interface UserTokenStats {
    total_tokens: number;
    active_tokens: number;
    total_users: number;
    today_requests: number;
}

// interface CreateTokenRequest omitted as it's not explicitly used for typing variables

const UserToken: React.FC = () => {
    const { t } = useTranslation();
    const [tokens, setTokens] = useState<UserToken[]>([]);
    const [stats, setStats] = useState<UserTokenStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);

    // Edit State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingToken, setEditingToken] = useState<UserToken | null>(null);
    const [editUsername, setEditUsername] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editMaxIps, setEditMaxIps] = useState(0);
    const [editCurfewStart, setEditCurfewStart] = useState('');
    const [editCurfewEnd, setEditCurfewEnd] = useState('');
    const [editCurfewTimezone, setEditCurfewTimezone] = useState('UTC+08:00');
    const [updating, setUpdating] = useState(false);

    // Create Form State
    const [newUsername, setNewUsername] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newExpiresType, setNewExpiresType] = useState('month'); // day, week, month, never, custom
    const [newMaxIps, setNewMaxIps] = useState(0);
    const [newCurfewStart, setNewCurfewStart] = useState('');
    const [newCurfewEnd, setNewCurfewEnd] = useState('');
    const [newCurfewTimezone, setNewCurfewTimezone] = useState('UTC+08:00');
    const [newCustomExpires, setNewCustomExpires] = useState(''); // datetime-local value

    const timezoneOptions = ['UTC-08:00', 'UTC-05:00', 'UTC+00:00', 'UTC+01:00', 'UTC+07:00', 'UTC+08:00', 'UTC+09:00'];

    const loadData = async () => {
        setLoading(true);
        try {
            const [tokensData, statsData] = await Promise.all([
                invoke<UserToken[]>('list_user_tokens'),
                invoke<UserTokenStats>('get_user_token_summary')
            ]);
            setTokens(tokensData);
            setStats(statsData);
        } catch (e) {
            console.error('Failed to load user tokens', e);
            showToast(t('common.load_failed') || 'Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreate = async () => {
        if (!newUsername) {
            showToast(t('user_token.username_required') || 'Username is required', 'error');
            return;
        }

        // 验证自定义时间
        if (newExpiresType === 'custom' && !newCustomExpires) {
            showToast(t('user_token.custom_expires_required') || 'Please select a custom expiration time', 'error');
            return;
        }

        setCreating(true);
        try {
            // 计算自定义过期时间戳
            const customExpiresAt = newExpiresType === 'custom' && newCustomExpires
                ? Math.floor(new Date(newCustomExpires).getTime() / 1000)
                : undefined;

            await invoke('create_user_token', {
                request: {
                    username: newUsername,
                    expires_type: newExpiresType,
                    description: newDesc || null,
                    max_ips: newMaxIps,
                    curfew_start: newCurfewStart || null,
                    curfew_end: newCurfewEnd || null,
                    curfew_timezone: newCurfewTimezone,
                    custom_expires_at: customExpiresAt || null
                }
            });
            showToast(t('common.create_success') || 'Created successfully', 'success');
            setShowCreateModal(false);
            setNewUsername('');
            setNewDesc('');
            setNewExpiresType('month');
            setNewMaxIps(0);
            setNewCurfewStart('');
            setNewCurfewEnd('');
            setNewCurfewTimezone('UTC+08:00');
            setNewCustomExpires('');
            loadData();
        } catch (e) {
            console.error('Failed to create token', e);
            showToast(String(e), 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await invoke('delete_user_token', { id });
            showToast(t('common.delete_success') || 'Deleted successfully', 'success');
            loadData();
        } catch (e) {
            showToast(String(e), 'error');
        }
    };

    const handleEdit = (token: UserToken) => {
        setEditingToken(token);
        setEditUsername(token.username);
        setEditDesc(token.description || '');
        setEditMaxIps(token.max_ips ?? 0);
        setEditCurfewStart(token.curfew_start ?? '');
        setEditCurfewEnd(token.curfew_end ?? '');
        setEditCurfewTimezone(token.curfew_timezone ?? 'UTC+08:00');
        setShowEditModal(true);
    };

    const handleUpdate = async () => {
        if (!editingToken) return;
        if (!editUsername) {
            showToast(t('user_token.username_required') || 'Username is required', 'error');
            return;
        }

        setUpdating(true);
        try {
            await invoke('update_user_token', {
                id: editingToken.id,
                request: {
                    username: editUsername,
                    description: editDesc || undefined,
                    max_ips: editMaxIps,
                    // 使用双层包装: undefined = 不更新, null = 清空, string = 设置值
                    curfew_start: editCurfewStart === '' ? null : editCurfewStart,
                    curfew_end: editCurfewEnd === '' ? null : editCurfewEnd,
                    curfew_timezone: editCurfewTimezone
                }
            });
            showToast(t('common.update_success') || 'Updated successfully', 'success');
            setShowEditModal(false);
            setEditingToken(null);
            loadData();
        } catch (e) {
            console.error('Failed to update token', e);
            showToast(String(e), 'error');
        } finally {
            setUpdating(false);
        }
    };

    const handleRenew = async (id: string, type: string) => {
        try {
            await invoke('renew_user_token', { id, expiresType: type });
            showToast(t('user_token.renew_success') || 'Renewed successfully', 'success');
            loadData();
        } catch (e) {
            showToast(String(e), 'error');
        }
    };

    const handleCopyToken = async (text: string) => {
        const success = await copyToClipboard(text);
        if (success) {
            showToast(t('common.copied') || 'Copied to clipboard', 'success');
        } else {
            showToast(t('common.copy_failed') || 'Failed to copy to clipboard', 'error');
        }
    };

    const formatTime = (ts?: number) => {
        if (!ts) return '-';
        return new Date(ts * 1000).toLocaleString();
    };

    const getExpiresLabel = (type: string) => {
        switch (type) {
            case 'day': return t('user_token.expires_day', { defaultValue: '1 Day' });
            case 'week': return t('user_token.expires_week', { defaultValue: '1 Week' });
            case 'month': return t('user_token.expires_month', { defaultValue: '1 Month' });
            case 'never': return t('user_token.expires_never', { defaultValue: 'Never' });
            case 'custom': return t('user_token.expires_custom', { defaultValue: 'Custom' });
            default: return type;
        }
    };

    // Calculate expiration status style
    const getExpiresStatus = (expiresAt?: number) => {
        if (!expiresAt) return 'text-green-500';
        const now = Date.now() / 1000;
        if (expiresAt < now) return 'text-red-500 font-bold';
        if (expiresAt - now < 86400 * 3) return 'text-orange-500'; // Less than 3 days
        return 'text-green-500';
    };

    const modalInputClass = "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 dark:border-base-300 dark:bg-base-100 dark:text-base-content";
    const modalLabelClass = "text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400";
    const modalHintClass = "mt-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400";

    return (
        <div className="h-full flex flex-col p-5 gap-4 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-lg font-semibold tracking-tight text-gray-950 dark:text-base-content flex items-center gap-2">
                    {t('user_token.title', { defaultValue: 'User Tokens' })}
                </h1>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadData()}
                        className={`p-1.5 hover:bg-gray-50 dark:hover:bg-base-200 rounded border border-gray-200 dark:border-base-200 transition-colors ${loading ? 'text-zinc-950' : 'text-gray-400'}`}
                        title={t('common.refresh') || 'Refresh'}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold rounded-md transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Plus size={14} />
                        <span>{t('user_token.create', { defaultValue: 'Create Token' })}</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards Row */}
            <div className="border border-gray-200 dark:border-base-200 bg-white dark:bg-base-100 rounded-lg overflow-hidden">
                <dl className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-base-200">
                    <div className="px-4 py-3 min-w-0">
                        <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('user_token.total_users', { defaultValue: 'Total Users' })}</dt>
                        <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate">{stats?.total_users || 0}</dd>
                    </div>
                    <div className="px-4 py-3 min-w-0">
                        <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('user_token.active_tokens', { defaultValue: 'Active Tokens' })}</dt>
                        <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate">{stats?.active_tokens || 0}</dd>
                    </div>
                    <div className="px-4 py-3 min-w-0">
                        <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('user_token.total_created', { defaultValue: 'Total Tokens' })}</dt>
                        <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate">{stats?.total_tokens || 0}</dd>
                    </div>
                    <div className="px-4 py-3 min-w-0">
                        <dt className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('user_token.today_requests', { defaultValue: 'Today Requests' })}</dt>
                        <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 truncate">{stats?.today_requests || 0}</dd>
                    </div>
                </dl>
            </div>

            {/* Token List */}
            <div className="flex-1 overflow-auto bg-white dark:bg-base-100 rounded-lg border border-gray-200 dark:border-base-200">
                <table className="table table-pin-rows">
                    <thead>
                        <tr className="bg-gray-50/50 dark:bg-base-200/50">
                            <th className="bg-transparent text-zinc-400 text-[10px] uppercase tracking-wider font-semibold py-3">{t('user_token.username', { defaultValue: 'Username' })}</th>
                            <th className="bg-transparent text-zinc-400 text-[10px] uppercase tracking-wider font-semibold py-3">{t('user_token.token', { defaultValue: 'Token' })}</th>
                            <th className="bg-transparent text-zinc-400 text-[10px] uppercase tracking-wider font-semibold py-3">{t('user_token.expires', { defaultValue: 'Expires' })}</th>
                            <th className="bg-transparent text-zinc-400 text-[10px] uppercase tracking-wider font-semibold py-3">{t('user_token.usage', { defaultValue: 'Usage' })}</th>
                            <th className="bg-transparent text-zinc-400 text-[10px] uppercase tracking-wider font-semibold py-3">{t('user_token.ip_limit', { defaultValue: 'IP Limit' })}</th>
                            <th className="bg-transparent text-zinc-400 text-[10px] uppercase tracking-wider font-semibold py-3">{t('user_token.created', { defaultValue: 'Created' })}</th>
                            <th className="bg-transparent text-zinc-400 text-[10px] uppercase tracking-wider font-semibold py-3 text-right">{t('common.actions', { defaultValue: 'Actions' })}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-base-200">
                        <AnimatePresence mode="popLayout">
                            {tokens.map((token, index) => (
                                <motion.tr
                                    key={token.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.03 }}
                                    className="hover:bg-gray-50/80 dark:hover:bg-base-200/50 transition-colors group"
                                >
                                    <td className="py-3">
                                        <div>
                                            <div className="font-semibold text-gray-900 dark:text-white uppercase tracking-wider text-xs">{token.username}</div>
                                            <div className="text-[10px] text-gray-400">{token.description || '-'}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-1.5 group/token">
                                            <code className="bg-gray-50 dark:bg-base-200 px-2 py-0.5 rounded border border-gray-200 dark:border-base-300 text-[10px] font-mono text-gray-600 dark:text-gray-400">
                                                {token.token.substring(0, 8)}••••••••
                                            </code>
                                            <button
                                                onClick={() => handleCopyToken(token.token)}
                                                className="p-1 hover:bg-gray-100 dark:hover:bg-base-300 rounded text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                            >
                                                <Copy size={12} />
                                            </button>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={`text-xs font-mono font-semibold mb-0.5 ${getExpiresStatus(token.expires_at)}`}>
                                            {token.expires_at ? formatTime(token.expires_at) : t('user_token.never', { defaultValue: 'Never' })}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] px-1 py-0.5 bg-gray-50 dark:bg-base-200 text-gray-450 border border-gray-200 dark:border-base-300 rounded font-semibold uppercase tracking-wider">
                                                {getExpiresLabel(token.expires_type)}
                                            </span>
                                            {token.expires_at && token.expires_at < Date.now() / 1000 && (
                                                <button
                                                    onClick={() => handleRenew(token.id, token.expires_type)}
                                                    className="text-[9px] text-zinc-950 hover:underline font-semibold uppercase tracking-wider"
                                                >
                                                    {t('user_token.renew_button', { defaultValue: 'Renew' })}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">{token.total_requests} <span className="text-[9px] font-normal text-gray-400 font-sans">reqs</span></div>
                                        <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                                            {(token.total_tokens_used / 1000).toFixed(1)}k tokens
                                        </div>
                                    </td>
                                    <td>
                                        {token.max_ips === 0
                                            ? <span className="px-1.5 py-0.5 border border-gray-200 dark:border-base-200 text-gray-500 text-[10px] rounded bg-gray-50 dark:bg-base-200 font-mono font-semibold">{t('user_token.unlimited', { defaultValue: 'Unlimited' })}</span>
                                            : <span className="px-1.5 py-0.5 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-mono font-semibold rounded bg-amber-50 dark:bg-amber-900/10">{token.max_ips} IPs</span>
                                        }
                                        {token.curfew_start && token.curfew_end && (
                                            <div className="text-[9px] text-gray-400 mt-1 flex items-center gap-1 bg-gray-50 dark:bg-base-200 border border-gray-200 dark:border-base-300 w-fit px-1 rounded font-mono font-semibold">
                                                <Clock size={9} className="text-gray-400" />
                                                <span>{token.curfew_start} - {token.curfew_end}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="text-[10px] font-mono text-gray-400">
                                        {formatTime(token.created_at)}
                                    </td>
                                    <td className="text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEdit(token)}
                                                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-450 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-base-200 dark:hover:bg-base-200 dark:hover:text-white"
                                                title={t('common.edit', { defaultValue: 'Edit' })}
                                            >
                                                <Settings size={12} />
                                            </button>
                                            <div className="dropdown dropdown-end flex h-7 w-7 items-center justify-center">
                                                <label tabIndex={0} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-gray-200 text-gray-450 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-base-200 dark:hover:bg-base-200 dark:hover:text-white">
                                                    <RefreshCw size={12} />
                                                </label>
                                                <ul tabIndex={0} className="dropdown-content z-[10] menu p-1 shadow-md bg-white dark:bg-base-100 rounded border border-gray-200 dark:border-base-200 w-32 mt-1">
                                                    <div className="px-2 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t('user_token.renew')}</div>
                                                    <li><a className="text-xs py-1.5 font-semibold" onClick={() => handleRenew(token.id, 'day')}>{t('user_token.expires_day', { defaultValue: '1 Day' })}</a></li>
                                                    <li><a className="text-xs py-1.5 font-semibold" onClick={() => handleRenew(token.id, 'week')}>{t('user_token.expires_week', { defaultValue: '1 Week' })}</a></li>
                                                    <li><a className="text-xs py-1.5 font-semibold" onClick={() => handleRenew(token.id, 'month')}>{t('user_token.expires_month', { defaultValue: '1 Month' })}</a></li>
                                                </ul>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(token.id)}
                                                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-450 transition-colors hover:bg-gray-50 hover:text-red-600 dark:border-base-200 dark:hover:bg-base-200"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                        {tokens.length === 0 && !loading && (
                            <tr>
                                <td colSpan={7} className="py-20">
                                    <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                                        <p className="text-xs font-semibold">{t('user_token.no_data', { defaultValue: 'No tokens found' })}</p>
                                        <button
                                            onClick={() => setShowCreateModal(true)}
                                            className="text-[10px] text-zinc-950 dark:text-zinc-200 font-semibold uppercase tracking-wider hover:underline"
                                        >
                                            {t('user_token.create', { defaultValue: 'Create your first token' })}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-xl rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl dark:border-base-200 dark:bg-base-100">
                        <div className="border-b border-gray-100 px-6 py-5 dark:border-base-200">
                            <h3 className="text-lg font-black tracking-tight text-gray-950 dark:text-base-content">{t('user_token.create_title', { defaultValue: 'Create New Token' })}</h3>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Configure identity, expiry, and access limits for this token.</p>
                        </div>

                        <div className="space-y-4 px-6 py-5">
                        <div className="space-y-1.5">
                            <label className={modalLabelClass}>{t('user_token.username', { defaultValue: 'Username' })} *</label>
                            <input
                                type="text"
                                className={modalInputClass}
                                value={newUsername}
                                onChange={e => setNewUsername(e.target.value)}
                                placeholder={t('user_token.placeholder_username', { defaultValue: 'e.g. user1' })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className={modalLabelClass}>{t('user_token.description', { defaultValue: 'Description' })}</label>
                            <input
                                type="text"
                                className={modalInputClass}
                                value={newDesc}
                                onChange={e => setNewDesc(e.target.value)}
                                placeholder={t('user_token.placeholder_desc', { defaultValue: 'Optional notes' })}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className={modalLabelClass}>{t('user_token.expires', { defaultValue: 'Expires In' })}</label>
                                <select
                                    className={modalInputClass}
                                    value={newExpiresType}
                                    onChange={e => setNewExpiresType(e.target.value)}
                                >
                                    <option value="day">{t('user_token.expires_day', { defaultValue: '1 Day' })}</option>
                                    <option value="week">{t('user_token.expires_week', { defaultValue: '1 Week' })}</option>
                                    <option value="month">{t('user_token.expires_month', { defaultValue: '1 Month' })}</option>
                                    <option value="custom">{t('user_token.expires_custom', { defaultValue: 'Custom' })}</option>
                                    <option value="never">{t('user_token.expires_never', { defaultValue: 'Never' })}</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className={modalLabelClass}>{t('user_token.ip_limit', { defaultValue: 'Max IPs' })}</label>
                                <input
                                    type="number"
                                    className={modalInputClass}
                                    value={newMaxIps}
                                    onChange={e => setNewMaxIps(parseInt(e.target.value) || 0)}
                                    min="0"
                                    placeholder={t('user_token.placeholder_max_ips', { defaultValue: '0 = Unlimited' })}
                                />
                                <p className={modalHintClass}>{t('user_token.hint_max_ips', { defaultValue: '0 = Unlimited. Limits how many different IP addresses can use this token.' })}</p>
                            </div>
                        </div>

                        {/* Custom Expiration Time Picker */}
                        {newExpiresType === 'custom' && (
                            <div className="space-y-1.5">
                                <label className={modalLabelClass}>{t('user_token.custom_expires_at', { defaultValue: 'Expiration Date & Time' })} *</label>
                                <input
                                    type="datetime-local"
                                    className={modalInputClass}
                                    value={newCustomExpires}
                                    onChange={e => setNewCustomExpires(e.target.value)}
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                                <p className={modalHintClass}>{t('user_token.hint_custom_expires', { defaultValue: 'Select the exact date and hour when this token expires' })}</p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3">
                                <label className={modalLabelClass}>{t('user_token.curfew', { defaultValue: 'Curfew (Service Unavailable Time)' })}</label>
                                <select
                                    className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-[11px] font-bold text-gray-600 outline-none transition-colors focus:border-gray-400 dark:border-base-300 dark:bg-base-100 dark:text-gray-300"
                                    value={newCurfewTimezone}
                                    onChange={e => setNewCurfewTimezone(e.target.value)}
                                    aria-label="Curfew timezone"
                                >
                                    {timezoneOptions.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <input
                                    type="time"
                                    className={modalInputClass}
                                    value={newCurfewStart}
                                    onChange={e => setNewCurfewStart(e.target.value)}
                                />
                                <span className="text-xs font-bold text-gray-400">to</span>
                                <input
                                    type="time"
                                    className={modalInputClass}
                                    value={newCurfewEnd}
                                    onChange={e => setNewCurfewEnd(e.target.value)}
                                />
                            </div>
                            <p className={modalHintClass}>{t('user_token.hint_curfew', { defaultValue: 'Leave empty to disable. Time is evaluated using the selected timezone.' })}</p>
                        </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-base-200">
                            <button className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-base-200" onClick={() => setShowCreateModal(false)}>
                                {t('common.cancel', { defaultValue: 'Cancel' })}
                            </button>
                            <button
                                className={`flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white ${creating ? 'cursor-not-allowed opacity-50' : ''}`}
                                onClick={handleCreate}
                                disabled={creating}
                            >
                                {creating && <RefreshCw size={14} className="animate-spin" />}
                                {t('common.create', { defaultValue: 'Create' })}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingToken && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-xl rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl dark:border-base-200 dark:bg-base-100">
                        <div className="border-b border-gray-100 px-6 py-5 dark:border-base-200">
                            <h3 className="text-lg font-black tracking-tight text-gray-950 dark:text-base-content">{t('user_token.edit_title', { defaultValue: 'Edit Token' })}</h3>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Update token identity and access controls.</p>
                        </div>

                        <div className="space-y-4 px-6 py-5">
                        <div className="space-y-1.5">
                            <label className={modalLabelClass}>{t('user_token.username', { defaultValue: 'Username' })} *</label>
                            <input
                                type="text"
                                className={modalInputClass}
                                value={editUsername}
                                onChange={e => setEditUsername(e.target.value)}
                                placeholder={t('user_token.placeholder_username', { defaultValue: 'e.g. user1' })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className={modalLabelClass}>{t('user_token.description', { defaultValue: 'Description' })}</label>
                            <input
                                type="text"
                                className={modalInputClass}
                                value={editDesc}
                                onChange={e => setEditDesc(e.target.value)}
                                placeholder={t('user_token.placeholder_desc', { defaultValue: 'Optional notes' })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className={modalLabelClass}>{t('user_token.ip_limit', { defaultValue: 'Max IPs' })}</label>
                            <input
                                type="number"
                                className={modalInputClass}
                                value={editMaxIps}
                                onChange={e => setEditMaxIps(parseInt(e.target.value) || 0)}
                                min="0"
                                placeholder={t('user_token.placeholder_max_ips', { defaultValue: '0 = Unlimited' })}
                            />
                            <p className={modalHintClass}>{t('user_token.hint_max_ips', { defaultValue: '0 = Unlimited. Limits how many different IP addresses can use this token.' })}</p>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3">
                                <label className={modalLabelClass}>{t('user_token.curfew', { defaultValue: 'Curfew (Service Unavailable Time)' })}</label>
                                <select
                                    className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-[11px] font-bold text-gray-600 outline-none transition-colors focus:border-gray-400 dark:border-base-300 dark:bg-base-100 dark:text-gray-300"
                                    value={editCurfewTimezone}
                                    onChange={e => setEditCurfewTimezone(e.target.value)}
                                    aria-label="Curfew timezone"
                                >
                                    {timezoneOptions.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <input
                                    type="time"
                                    className={modalInputClass}
                                    value={editCurfewStart}
                                    onChange={e => setEditCurfewStart(e.target.value)}
                                />
                                <span className="text-xs font-bold text-gray-400">to</span>
                                <input
                                    type="time"
                                    className={modalInputClass}
                                    value={editCurfewEnd}
                                    onChange={e => setEditCurfewEnd(e.target.value)}
                                />
                            </div>
                            <p className={modalHintClass}>{t('user_token.hint_curfew', { defaultValue: 'Leave empty to disable. Time is evaluated using the selected timezone.' })}</p>
                        </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-base-200">
                            <button className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-base-200" onClick={() => setShowEditModal(false)}>
                                {t('common.cancel', { defaultValue: 'Cancel' })}
                            </button>
                            <button
                                className={`flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white ${updating ? 'cursor-not-allowed opacity-50' : ''}`}
                                onClick={handleUpdate}
                                disabled={updating}
                            >
                                {updating && <RefreshCw size={14} className="animate-spin" />}
                                {t('common.update', { defaultValue: 'Update' })}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default UserToken;
