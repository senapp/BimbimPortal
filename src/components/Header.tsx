import * as React from 'react';
import { PortalTabKey } from '../utils/portalTypes';
import { PortalTabConfig } from '../utils/portalTabs';
import css from './Header.module.css';

type Props = {
    tabs: PortalTabConfig[];
    activeTab: PortalTabKey;
    onTabChange: (tabKey: PortalTabKey) => void;
    onExportData: () => void;
    onImportData: (file: File) => void;
};

export const Header: React.FC<Props> = ({ tabs, activeTab, onTabChange, onExportData, onImportData }) => {
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const triggerImport = (): void => {
        fileInputRef.current?.click();
    };

    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        onImportData(file);
        event.target.value = '';
    };

    return (
        <header className={css.header}>
            <div className={css.topRow}>
                <div className={css.brandBlock}>
                    <h1 className={css.title}>Mingo Portal</h1>
                    <p className={css.subtitle}>Navigate between the workspaces and keep state persisted</p>
                </div>

                <div className={css.dataButtons}>
                    <button type="button" className={css.dataButton} onClick={onExportData}>Export</button>
                    <button type="button" className={css.dataButtonSecondary} onClick={triggerImport}>Import</button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json,.json"
                        className={css.hiddenFileInput}
                        onChange={onFileChange}
                    />
                </div>
            </div>

            <nav className={css.tabs} aria-label="Portal sections">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={`${css.tabButton} ${activeTab === tab.key ? css.activeTab : ''}`.trim()}
                        onClick={() => onTabChange(tab.key)}
                        aria-current={activeTab === tab.key ? 'page' : undefined}
                    >
                        <span className={css.tabLabel}>{tab.label}</span>
                        <span className={css.tabDescription}>{tab.description}</span>
                    </button>
                ))}
            </nav>
        </header>
    );
};