import { PortalTabKey } from './portalTypes';

export type PortalTabConfig = {
    key: PortalTabKey;
    label: string;
    description: string;
};

export const PORTAL_TABS: PortalTabConfig[] = [
    { key: 'Money', label: 'Money', description: 'Cash flow and forecasts' },
    { key: 'Job', label: 'Job', description: 'Calendar and schedule' },
    { key: 'Contacts', label: 'Contacts', description: 'Friends and map view' },
    { key: 'Todo', label: 'Todo', description: 'Tasks and workflow' },
    { key: 'Timeline', label: 'Timeline', description: 'Events and milestones' },
    { key: 'Travel', label: 'Travel', description: 'Plans and map routes' },
];