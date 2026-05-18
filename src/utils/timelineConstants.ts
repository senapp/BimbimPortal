import { EventCategory, Timeline, TimelinePageState } from './portalTypes';

export const EVENT_CATEGORY_OPTIONS: { value: EventCategory; label: string }[] = [
    { value: 'period', label: 'Period' },
    { value: 'start', label: 'Start' },
    { value: 'finish', label: 'Finish' },
    { value: 'milestone', label: 'Milestone' },
];

export const EVENT_COLORS = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E2',
    '#F8B88B',
    '#AED6F1',
] as const;

export const DEFAULT_TIMELINE_PAGE_STATE: TimelinePageState = {
    timelines: [],
    selectedTimelineId: null,
};

export const createDefaultTimeline = (name: string): Timeline => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
});
