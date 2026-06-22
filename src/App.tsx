import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Settings from './pages/Settings';
import ApiProxy from './pages/ApiProxy';
import Monitor from './pages/Monitor';
import TokenStats from './pages/TokenStats';
import ThemeManager from './components/common/ThemeManager';
import UserToken from './pages/UserToken';
import DebugConsole from './components/debug/DebugConsole';
import { useEffect } from 'react';
import { useConfigStore } from './stores/useConfigStore';
import { useAccountStore } from './stores/useAccountStore';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from './utils/env';
import { AdminAuthGuard } from './components/common/AdminAuthGuard';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'accounts',
        element: <Accounts />,
      },
      {
        path: 'api-proxy',
        element: <ApiProxy />,
      },
      {
        path: 'monitor',
        element: <Monitor />,
      },
      {
        path: 'token-stats',
        element: <TokenStats />,
      },
      {
        path: 'user-token',
        element: <UserToken />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
    ],
  },
]);

function App() {
  const { config, loadConfig } = useConfigStore();
  const { fetchCurrentAccount, fetchAccounts } = useAccountStore();
  const { i18n } = useTranslation();

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Sync language from config
  useEffect(() => {
    if (config?.language) {
      i18n.changeLanguage(config.language);
      // Support RTL
      if (config.language === 'ar') {
        document.documentElement.dir = 'rtl';
      } else {
        document.documentElement.dir = 'ltr';
      }
    }
  }, [config?.language, i18n]);

  // Listen for tray events
  useEffect(() => {
    if (!isTauri()) return;
    const unlistenPromises: Promise<() => void>[] = [];

    unlistenPromises.push(
      listen('tray://account-switched', () => {
        fetchCurrentAccount();
        fetchAccounts();
      })
    );

    unlistenPromises.push(
      listen('tray://refresh-current', () => {
        fetchCurrentAccount();
        fetchAccounts();
      })
    );

    unlistenPromises.push(
      listen('accounts://refreshed', () => {
        fetchCurrentAccount();
        fetchAccounts();
      })
    );

    // Cleanup
    return () => {
      Promise.all(unlistenPromises).then(unlisteners => {
        unlisteners.forEach(unlisten => unlisten());
      });
    };
  }, [fetchCurrentAccount, fetchAccounts]);

  return (
    <AdminAuthGuard>
      <ThemeManager />
      <DebugConsole />
      <RouterProvider router={router} />
    </AdminAuthGuard>
  );
}

export default App;
