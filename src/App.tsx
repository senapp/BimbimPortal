import * as React from 'react';
import { ContactsPage } from './pages/ContactsPage';
import { JobPage } from './pages/JobPage';
import { MoneyPage } from './pages/MoneyPage';
import { TodoPage } from './pages/TodoPage';
import { TimelinePage } from './pages/TimelinePage';
import { Header } from './components/Header';
import { PORTAL_TABS } from './utils/portalTabs';
import { PortalTabKey } from './utils/portalTypes';
import { usePersistedState } from './utils/storage';

import css from './App.module.css';

const PERSISTED_STORAGE_KEYS = [
    'portal-active-tab',
    'money-state',
    'money-display-currency',
    'job-calendar-state',
    'job-display-currency',
    'contacts-state',
    'todo-state',
    'timeline-state',
    'global-jpy-per-sek-rate',
] as const;

export const App: React.FC = () => {
    const tabs = PORTAL_TABS;
    const [activeTab, setActiveTab] = usePersistedState<PortalTabKey>('portal-active-tab', 'Money');

    const onExportData = (): void => {
        const payload = {
            exportedAtIso: new Date().toISOString(),
            version: 1,
            data: PERSISTED_STORAGE_KEYS.reduce<Record<string, unknown>>((acc, key) => {
                const rawValue = window.localStorage.getItem(key);
                if (rawValue === null) {
                    return acc;
                }

                try {
                    acc[key] = JSON.parse(rawValue);
                } catch {
                    acc[key] = rawValue;
                }

                return acc;
            }, {}),
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = payload.exportedAtIso.replace(/[:.]/g, '-');

        link.href = url;
        link.download = `bimbim-portal-backup-${stamp}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const onImportData = (file: File): void => {
        const reader = new FileReader();

        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result ?? '{}')) as { data?: Record<string, unknown> };
                const importedData = parsed.data;

                if (!importedData || typeof importedData !== 'object') {
                    throw new Error('Invalid backup format');
                }

                PERSISTED_STORAGE_KEYS.forEach((key) => {
                    if (!(key in importedData)) {
                        return;
                    }

                    window.localStorage.setItem(key, JSON.stringify(importedData[key]));
                });

                window.location.reload();
            } catch {
                window.alert('Import failed: invalid JSON backup file.');
            }
        };

        reader.onerror = () => {
            window.alert('Import failed: could not read file.');
        };

        reader.readAsText(file);
    };

    const renderScreen = (): React.ReactElement => {
        switch (activeTab) {
            case 'Job':
                return <JobPage />;
            case 'Contacts':
                return <ContactsPage />;
            case 'Todo':
                return <TodoPage />;
            case 'Timeline':
                return <TimelinePage />;
            case 'Money':
            default:
                return <MoneyPage />;
        }
    };

    return (
        <div className={css.container}>
            <Header tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} onExportData={onExportData} onImportData={onImportData} />
            <main className={css.content}>{renderScreen()}</main>
        </div>
    );
};