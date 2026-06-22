import React, { useState, useEffect } from 'react';
import { Globe, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isTauri } from '../../utils/env';
import logoLight from '../../assets/logo-light.webp';

/**
 * AdminAuthGuard
 * 针对 Docker/Web 模式的强制鉴权保护层。
 * 如果检测到没有存储的 API Key 或后端返回 401，将拦截 UI 并要求输入 Key。
 */
export const AdminAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t, i18n } = useTranslation();
    const [isAuthenticated, setIsAuthenticated] = useState(isTauri());
    const [apiKey, setApiKey] = useState('');
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isTauri()) return;

        // 检查 Session 存储 (优先)
        const sessionKey = sessionStorage.getItem('abv_admin_api_key');
        if (sessionKey) {
            setIsAuthenticated(true);
            setApiKey(sessionKey);
            return;
        }

        // 检查本地存储 (迁移逻辑)
        const savedKey = localStorage.getItem('abv_admin_api_key');
        if (savedKey) {
            // 迁移到 sessionStorage 并清理 localStorage
            sessionStorage.setItem('abv_admin_api_key', savedKey);
            localStorage.removeItem('abv_admin_api_key');
            setIsAuthenticated(true);
            setApiKey(savedKey);
        }

        // 监听全局 401 事件
        const handleUnauthorized = () => {
            sessionStorage.removeItem('abv_admin_api_key');
            localStorage.removeItem('abv_admin_api_key'); // 双重清理确保万一
            setIsAuthenticated(false);
        };

        window.addEventListener('abv-unauthorized', handleUnauthorized);
        return () => window.removeEventListener('abv-unauthorized', handleUnauthorized);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedKey = apiKey.trim();
        if (!trimmedKey) return;

        setIsLoading(true);
        setError('');

        try {
            // 先临时存储 key，用于验证请求
            sessionStorage.setItem('abv_admin_api_key', trimmedKey);

            // 调用一个需要认证的 API 来验证密码是否正确
            const response = await fetch('/api/accounts', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${trimmedKey}`,
                    'x-api-key': trimmedKey
                }
            });

            if (response.ok || response.status === 204) {
                // 验证成功
                localStorage.removeItem('abv_admin_api_key');
                setIsAuthenticated(true);
                window.location.reload();
            } else if (response.status === 401) {
                // 密码错误
                sessionStorage.removeItem('abv_admin_api_key');
                setError(t('login.error_invalid_key'));
            } else {
                // 其他错误，但可能密码是对的
                setIsAuthenticated(true);
                window.location.reload();
            }
        } catch (err) {
            // 网络错误等
            sessionStorage.removeItem('abv_admin_api_key');
            setError(t('login.error_network'));
        } finally {
            setIsLoading(false);
        }
    };

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
        setShowLangMenu(false);
    };

    const languages = [
        { code: 'zh', name: '简体中文' },
        { code: 'zh-TW', name: '繁體中文' },
        { code: 'en', name: 'English' },
        { code: 'ja', name: '日本語' },
        { code: 'ko', name: '한국어' },
        { code: 'ru', name: 'Русский' },
        { code: 'tr', name: 'Türkçe' },
        { code: 'vi', name: 'Tiếng Việt' },
        { code: 'pt', name: 'Português' },
        { code: 'ar', name: 'العربية' },
        { code: 'es', name: 'Español' },
        { code: 'my', name: 'Bahasa Melayu' },
    ];

    if (isAuthenticated) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-[#f7f8fa] dark:bg-base-300 flex items-center justify-center p-4 relative">
            {/* 语言切换按钮 */}
            <div className="absolute top-6 right-6 sm:top-8 sm:right-8">
                <div className="relative">
                    <button
                        onClick={() => setShowLangMenu(!showLangMenu)}
                        className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-gray-600 shadow-sm transition-colors hover:bg-gray-50 dark:border-base-200 dark:bg-base-100 dark:text-gray-300 dark:hover:bg-base-200"
                    >
                        <Globe className="w-4 h-4" />
                        <span className="text-sm font-semibold uppercase">{i18n.language.split('-')[0]}</span>
                    </button>

                    {showLangMenu && (
                        <div className="absolute right-0 mt-2 w-40 rounded-2xl border border-gray-200 bg-white py-2 shadow-xl z-50 animate-in fade-in zoom-in duration-200 dark:border-base-200 dark:bg-base-100">
                            {languages.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => changeLanguage(lang.code)}
                                    className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-base-200 ${i18n.language === lang.code ? 'text-gray-950 dark:text-white font-bold' : 'text-gray-600 dark:text-gray-300'
                                        }`}
                                >
                                    {lang.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_24px_70px_-45px_rgba(15,23,42,0.65)] dark:border-base-200 dark:bg-base-100">
                <div className="p-7 sm:p-8">
                    <img src={logoLight} alt="GravityLite" className="mx-auto -mb-6 h-52 w-52 object-contain" />
                    <div className="mb-6 text-center">
                        <p className="mx-auto max-w-sm text-sm leading-5 text-gray-500 dark:text-gray-400">{t('login.desc')}</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                placeholder={t('login.placeholder')}
                                className={`h-12 w-full rounded-xl border bg-white px-4 text-sm font-medium text-gray-950 outline-none transition-colors placeholder:text-gray-400 dark:bg-base-200 dark:text-white ${error ? 'border-rose-300 focus:border-rose-400' : 'border-gray-200 focus:border-gray-500 dark:border-base-300'}`}
                                value={apiKey}
                                onChange={(e) => { setApiKey(e.target.value); setError(''); }}
                                autoFocus
                                disabled={isLoading}
                            />
                        </div>
                        {error && (
                            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                                <AlertCircle className="w-4 h-4" />
                                <span>{error}</span>
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={isLoading || !apiKey.trim()}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gray-950 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white dark:disabled:bg-base-200 dark:disabled:text-gray-500"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {t('login.btn_verifying')}
                                </>
                            ) : (
                                t('login.btn_login')
                            )}
                        </button>
                    </form>

                    <div className="mt-6 border-t border-gray-100 pt-4 text-center dark:border-base-200">
                        <div className="mx-auto max-w-full text-center text-[8px] leading-4 text-gray-400/80">
                            <p className="whitespace-nowrap">{t('login.note')}</p>
                            <p className="whitespace-nowrap">{t('login.lookup_hint')}</p>
                            <p>{t('login.config_hint')}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
