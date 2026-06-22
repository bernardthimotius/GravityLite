import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor,
    useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { cn } from '../../utils/cn';
import { request as invoke } from '../../utils/request';
import { showToast } from '../common/ToastContainer';
import { useProxyModels } from '../../hooks/useProxyModels';
import { SortableModelItem, type PreviewModelEntry } from './SortableModelItem';

interface OpenCodeSyncModalProps {
    proxyUrl: string;
    apiKey: string;
    onClose: () => void;
    onSyncDone: () => void;
}

export function OpenCodeSyncModal({ proxyUrl, apiKey, onClose, onSyncDone }: OpenCodeSyncModalProps) {
    const { t } = useTranslation();
    const { models: antigravityModels } = useProxyModels();
    const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
    const [previewModels, setPreviewModels] = useState<PreviewModelEntry[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [hasAuthPlugin, setHasAuthPlugin] = useState(false);
    const [customBaseUrl, setCustomBaseUrl] = useState(proxyUrl);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const rebuildPreview = useCallback((selectedIds: Set<string>) => {
        const selected = antigravityModels.filter(m => selectedIds.has(m.id));
        const newEntries: PreviewModelEntry[] = selected.map((m, i) => ({
            _uid: `new-${i}`,
            model: m.id,
            id: m.id,
            index: i,
            baseUrl: '', // OpenCode uses provider-level base URL
            apiKey: apiKey,
            displayName: m.name,
            noImageSupport: false,
            provider: m.id.includes('claude') ? 'anthropic' : 'google',
            isAg: true,
        }));
        setPreviewModels(newEntries);
    }, [antigravityModels, apiKey]);

    if (!configLoaded) {
        setConfigLoaded(true);
        invoke<string>('get_opencode_config_content', { request: { fileName: 'opencode.json' } })
            .then(content => {
                const parsed = JSON.parse(content);
                const existingModelIds = new Set<string>();

                if (parsed.provider?.['antigravity-manager']?.models) {
                    Object.keys(parsed.provider['antigravity-manager'].models).forEach(k => existingModelIds.add(k));
                }

                if (existingModelIds.size === 0) {
                    if (parsed.provider?.anthropic?.models) {
                        Object.keys(parsed.provider.anthropic.models).forEach(k => existingModelIds.add(k));
                    }
                    if (parsed.provider?.google?.models) {
                        Object.keys(parsed.provider.google.models).forEach(k => existingModelIds.add(k));
                    }
                }

                const plugins = parsed.plugin || [];
                const hasAuth = plugins.some((p: string) => p.includes('opencode-antigravity-auth'));
                setHasAuthPlugin(hasAuth);

                if (parsed.provider?.['antigravity-manager']?.options?.baseURL) {
                    setCustomBaseUrl(parsed.provider['antigravity-manager'].options.baseURL);
                }

                setSelectedModels(existingModelIds);
                rebuildPreview(existingModelIds);
            })
            .catch(() => rebuildPreview(new Set()));
    }

    const allSelected = antigravityModels.length > 0 && antigravityModels.every(m => selectedModels.has(m.id));
    const toggleAll = () => {
        const next = allSelected ? new Set<string>() : new Set(antigravityModels.map(m => m.id));
        setSelectedModels(next);
        rebuildPreview(next);
    };

    const toggleModel = (modelId: string) => {
        const next = new Set(selectedModels);
        if (next.has(modelId)) next.delete(modelId); else next.add(modelId);
        setSelectedModels(next);
        rebuildPreview(next);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIdx = previewModels.findIndex(m => m._uid === active.id);
        const newIdx = previewModels.findIndex(m => m._uid === over.id);
        if (oldIdx < 0 || newIdx < 0) return;
        setPreviewModels(arrayMove([...previewModels], oldIdx, newIdx).map((m, i) => ({
            ...m, index: i,
        })));
    };

    const handleRemoveModel = (uid: string) => {
        const nextPreviews = previewModels.filter(m => m._uid !== uid);
        setPreviewModels(nextPreviews);
        const nextSelected = new Set(nextPreviews.map(p => p.model));
        setSelectedModels(nextSelected);
    };

    const executeOpenCodeSync = async () => {
        setSyncing(true);
        try {
            const models = previewModels.map(m => m.model);
            await invoke('execute_opencode_sync', {
                proxyUrl: customBaseUrl || proxyUrl,
                apiKey,
                syncAccounts: true,
                models
            });
            showToast(t('proxy.opencode_sync.toast.sync_success', { defaultValue: 'OpenCode synced successfully' }), 'success');
            onSyncDone();
            onClose();
        } catch (error: any) {
            showToast(error.toString(), 'error');
        } finally {
            setSyncing(false);
        }
    };

    const providerGroups = [
        { id: 'anthropic', label: 'Anthropic', models: antigravityModels.filter(m => m.id.includes('claude')) },
        { id: 'google', label: 'Google', models: antigravityModels.filter(m => m.id.includes('gemini')) },
        { id: 'openai', label: 'OpenAI', models: antigravityModels.filter(m => m.id.includes('gpt')) },
    ].filter(group => group.models.length > 0);

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-base-100 rounded-2xl shadow-2xl border border-gray-200 dark:border-base-300 w-full max-w-2xl max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                <div className="px-5 pt-4 pb-3 shrink-0 border-b border-gray-100 dark:border-base-200">
                    <div className="flex items-center justify-between">
                        <div className="min-w-0">
                            <h3 className="text-sm font-black text-gray-950 dark:text-base-content">
                                {t('proxy.config.opencode_sync.modal_title', { defaultValue: 'Select OpenCode Models' })}
                            </h3>
                            <p className="text-[10px] text-gray-400 mt-0.5">~/.config/opencode/opencode.json</p>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-base-300 transition-colors">
                            <X size={16} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                <div className="px-5 py-3 shrink-0 border-b border-gray-100 dark:border-base-200 bg-gray-50/50 dark:bg-base-200/30">
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                {t('proxy.config.opencode_sync.custom_base_url_label', { defaultValue: 'Custom Manager BaseURL' })}
                            </label>
                            <span className="text-[9px] text-gray-400 italic font-medium">
                                {t('proxy.config.opencode_sync.custom_base_url_desc', { defaultValue: 'For Docker Compose networking' })}
                            </span>
                        </div>
                        <div className="relative group">
                            <input
                                type="text"
                                value={customBaseUrl}
                                onChange={(e) => setCustomBaseUrl(e.target.value)}
                                placeholder="e.g. http://antigravity-manager:8045/v1"
                                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-base-100 border border-gray-200 dark:border-base-300 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                            />
                            {customBaseUrl !== proxyUrl && (
                                <button
                                    onClick={() => setCustomBaseUrl(proxyUrl)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 font-medium"
                                >
                                    {t('proxy.config.opencode_sync.custom_base_url_reset', { defaultValue: 'Reset' })}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-5 py-3 shrink-0 border-b border-gray-100 dark:border-base-200">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {t('proxy.config.opencode_sync.select_models', { defaultValue: 'Select Models to Sync' })}
                            <span className="ml-2 text-gray-300">{selectedModels.size}/{antigravityModels.length}</span>
                        </span>
                        <button onClick={toggleAll} className="text-[10px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 font-medium transition-colors">
                            {allSelected ? t('common.deselect_all', { defaultValue: 'Deselect all' }) : t('common.select_all', { defaultValue: 'Select all' })}
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[25vh] overflow-auto">
                        {providerGroups.map(group => {
                            return (
                                <div key={group.id}>
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">{group.label}</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.models.map(m => {
                                            const selected = selectedModels.has(m.id);
                                            return (
                                                <button
                                                    key={m.id}
                                                    onClick={() => toggleModel(m.id)}
                                                    className={cn(
                                                        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 border",
                                                        selected
                                                            ? "bg-gray-950 text-white border-gray-950 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100"
                                                            : "bg-gray-50 dark:bg-base-200 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-base-300 hover:border-gray-300 hover:text-gray-900 dark:hover:text-gray-200"
                                                    )}
                                                >
                                                    {m.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {hasAuthPlugin && (
                    <div className="px-5 py-2 shrink-0 bg-amber-50 dark:bg-amber-900/20 border-y border-amber-100 dark:border-amber-900/30">
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                            {t('proxy.config.opencode_sync.auth_plugin_warning', {
                                defaultValue: 'Sync chỉ tạo provider antigravity-manager và không ghi đè google provider/plugin.'
                            })}
                        </p>
                    </div>
                )}

                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="px-5 py-2 flex items-center justify-between shrink-0">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Sync Queue Preview
                        </span>
                        <span className="text-[9px] font-mono text-gray-300">{previewModels.length} models</span>
                    </div>
                    <div className="px-4 pb-3 overflow-auto flex-1">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={previewModels.map(m => m._uid)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-1.5">
                                    {previewModels.map(entry => (
                                        <SortableModelItem
                                            key={entry._uid}
                                            entry={entry}
                                            collapsed={true}
                                            onToggle={() => { }}
                                            onRemove={() => handleRemoveModel(entry._uid)}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-gray-100 dark:border-base-200 flex items-center justify-end gap-2 shrink-0">
                    <button className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-base-300 transition-colors" onClick={onClose}>
                        {t('common.cancel', { defaultValue: 'Cancel' })}
                    </button>
                    <button
                        className={cn(
                            "px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                            previewModels.length > 0
                                ? "bg-gray-950 hover:bg-gray-800 active:bg-gray-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                                : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                        )}
                        disabled={previewModels.length === 0 || syncing}
                        onClick={executeOpenCodeSync}
                    >
                        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                        {t('proxy.config.opencode_sync.btn_confirm_sync', { defaultValue: 'Confirm Sync' })}
                    </button>
                </div>
            </div>
        </div>
    );
}
