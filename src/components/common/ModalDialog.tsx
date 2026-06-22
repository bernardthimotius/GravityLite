import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export type ModalType = 'confirm' | 'success' | 'error' | 'info';

interface ModalDialogProps {
    isOpen: boolean;
    title: string;
    message?: string;
    children?: React.ReactNode;
    type?: ModalType;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

export default function ModalDialog({
    isOpen,
    title,
    message,
    children,
    type = 'confirm',
    onConfirm,
    onCancel,
    confirmText,
    cancelText,
    isDestructive = false
}: ModalDialogProps) {
    const { t } = useTranslation();
    const finalConfirmText = confirmText || t('common.confirm');
    const finalCancelText = cancelText || t('common.cancel');

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
            case 'error':
                return <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />;
            case 'info':
                return <Info className="w-6 h-6 text-gray-600 dark:text-gray-300" />;
            case 'confirm':
            default:
                return isDestructive ? <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" /> : <AlertTriangle className="w-6 h-6 text-gray-700 dark:text-gray-200" />;
        }
    };

    const getIconBg = () => {
        switch (type) {
            case 'success': return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/40';
            case 'error': return 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/40';
            case 'info': return 'bg-gray-50 dark:bg-base-200 border-gray-200 dark:border-base-300';
            case 'confirm': default: return isDestructive ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/40' : 'bg-gray-50 dark:bg-base-200 border-gray-200 dark:border-base-300';
        }
    };

    const showCancel = type === 'confirm' && onCancel;

    return createPortal(
        <div className="modal modal-open z-[100]">
            {/* Draggable Top Region */}
            <div data-tauri-drag-region className="fixed top-0 left-0 right-0 h-8 z-[110]" />

            <div className="modal-box relative max-w-sm bg-white dark:bg-base-100 shadow-2xl rounded-2xl p-0 overflow-hidden border border-gray-200 dark:border-base-200 transform transition-all animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center p-6 pt-7">
                    <div className={`w-12 h-12 rounded-full border flex items-center justify-center mb-4 ${getIconBg()}`}>
                        {getIcon()}
                    </div>

                    <h3 className="text-lg font-semibold text-gray-950 dark:text-base-content mb-2">{title}</h3>

                    {children ? (
                        <div className="w-full text-left mb-8 px-1">
                            {children}
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-7 leading-relaxed px-4">{message}</p>
                    )}

                    <div className="flex gap-3 w-full">
                        {showCancel && (
                            <button
                                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-base-200 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-base-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-base-300"
                                onClick={onCancel}
                            >
                                {finalCancelText}
                            </button>
                        )}
                        <button
                            className={`flex-1 px-4 py-2.5 font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isDestructive && type === 'confirm'
                                ? 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500'
                                : 'bg-gray-950 hover:bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white focus:ring-gray-400'
                                }`}
                            onClick={onConfirm}
                        >
                            {finalConfirmText}
                        </button>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop bg-black/40 backdrop-blur-sm fixed inset-0 z-[-1]" onClick={showCancel ? onCancel : undefined}></div>
        </div>,
        document.body
    );
}
