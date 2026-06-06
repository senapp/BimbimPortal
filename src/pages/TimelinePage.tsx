import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { Timeline, TimelineEvent, TimelineEventPeriod, TimelineEventPoint, TimelinePageState, EventCategory } from '../utils/portalTypes';
import { usePersistedState } from '../utils/storage';
import { DEFAULT_TIMELINE_PAGE_STATE, createDefaultTimeline, EVENT_COLORS, EVENT_CATEGORY_OPTIONS } from '../utils/timelineConstants';
import { calculateTimelineRange, getPositionedEvents, TimelineRange } from '../utils/timelineUtils';
import { TimelineSelector } from '../components/timeline/TimelineSelector';
import { TimelineViewer } from '../components/timeline/TimelineViewer';
import { EventForm } from '../components/timeline/EventForm';
import css from './TimelinePage.module.css';

type EventFormState = {
    title: string;
    description: string;
    category: EventCategory;
    color: string;
    eventType: 'point' | 'period';
    date?: string;
    startDate?: string;
    endDate?: string;
};

const createEmptyForm = (): EventFormState => ({
    title: '',
    description: '',
    category: 'milestone',
    color: '',
    eventType: 'point',
    date: '',
    startDate: '',
    endDate: '',
});

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const TimelinePage: React.FC = () => {
    const [pageState, setPageState] = usePersistedState<TimelinePageState>('timeline-state', DEFAULT_TIMELINE_PAGE_STATE);
    const [showEventForm, setShowEventForm] = React.useState(false);
    const [showTimelineForm, setShowTimelineForm] = React.useState(false);
    const [editingEventId, setEditingEventId] = React.useState<string | null>(null);
    const [eventFormState, setEventFormState] = React.useState<EventFormState>(createEmptyForm());
    const [newTimelineName, setNewTimelineName] = React.useState('');

    const selectedTimeline = pageState.selectedTimelineId
        ? pageState.timelines.find((t) => t.id === pageState.selectedTimelineId)
        : null;

    const timelineRange = React.useMemo(
        () => (selectedTimeline ? calculateTimelineRange(selectedTimeline.events) : null),
        [selectedTimeline]
    );

    const positionedEvents = React.useMemo(
        () => (selectedTimeline ? getPositionedEvents(selectedTimeline.events, timelineRange) : []),
        [selectedTimeline, timelineRange]
    );

    const handleCreateTimeline = (): void => {
        if (!newTimelineName.trim()) {
            window.alert('Timeline name cannot be empty');
            return;
        }

        const newTimeline = createDefaultTimeline(newTimelineName);
        setPageState({
            ...pageState,
            timelines: [...pageState.timelines, newTimeline],
            selectedTimelineId: newTimeline.id,
        });

        setNewTimelineName('');
        setShowTimelineForm(false);
    };

    const handleDeleteTimeline = (timelineId: string): void => {
        if (!window.confirm('Delete this timeline? This action cannot be undone.')) {
            return;
        }

        const updatedTimelines = pageState.timelines.filter((t) => t.id !== timelineId);
        const newSelectedId = pageState.selectedTimelineId === timelineId ? updatedTimelines[0]?.id ?? null : pageState.selectedTimelineId;

        setPageState({
            ...pageState,
            timelines: updatedTimelines,
            selectedTimelineId: newSelectedId,
        });
    };

    const handleSelectTimeline = (timelineId: string): void => {
        setPageState({
            ...pageState,
            selectedTimelineId: timelineId,
        });
    };

    const handleOpenEventForm = (eventId?: string): void => {
        if (eventId) {
            const event = selectedTimeline?.events.find((e) => e.id === eventId);
            if (event) {
                setEditingEventId(eventId);
                if (event.type === 'point') {
                    setEventFormState({
                        title: event.title,
                        description: event.description,
                        category: event.category,
                        color: event.color,
                        eventType: 'point',
                        date: event.date,
                    });
                } else {
                    setEventFormState({
                        title: event.title,
                        description: event.description,
                        category: event.category,
                        color: event.color,
                        eventType: 'period',
                        startDate: event.startDate,
                        endDate: event.endDate,
                    });
                }
            }
        } else {
            setEventFormState(createEmptyForm());
            setEditingEventId(null);
        }

        setShowEventForm(true);
    };

    const handleCloseEventForm = (): void => {
        setShowEventForm(false);
        setEditingEventId(null);
    };

    const handleSaveEvent = (): void => {
        if (!selectedTimeline || !eventFormState.title.trim()) {
            window.alert('Please enter a title for the event');
            return;
        }

        if (eventFormState.eventType === 'point' && !eventFormState.date) {
            window.alert('Please select a date');
            return;
        }

        if (eventFormState.eventType === 'period' && (!eventFormState.startDate || !eventFormState.endDate)) {
            window.alert('Please select start and end dates');
            return;
        }

        if (eventFormState.eventType === 'period' && eventFormState.startDate && eventFormState.endDate) {
            if (parseISO(eventFormState.startDate) > parseISO(eventFormState.endDate)) {
                window.alert('Start date must be before end date');
                return;
            }
        }

        let newEvent: TimelineEvent;

        if (editingEventId) {
            // Update existing event
            const updatedTimelines = pageState.timelines.map((t) => {
                if (t.id !== selectedTimeline.id) {
                    return t;
                }

                return {
                    ...t,
                    events: t.events.map((e) => {
                        if (e.id !== editingEventId) {
                            return e;
                        }

                        if (eventFormState.eventType === 'point') {
                            return {
                                type: 'point' as const,
                                id: editingEventId,
                                title: eventFormState.title,
                                description: eventFormState.description,
                                date: eventFormState.date!,
                                category: eventFormState.category,
                                color: eventFormState.color,
                                createdAt: (e as TimelineEventPoint).createdAt,
                            };
                        } else {
                            return {
                                type: 'period' as const,
                                id: editingEventId,
                                title: eventFormState.title,
                                description: eventFormState.description,
                                startDate: eventFormState.startDate!,
                                endDate: eventFormState.endDate!,
                                category: eventFormState.category,
                                color: eventFormState.color,
                                createdAt: (e as TimelineEventPeriod).createdAt,
                            };
                        }
                    }),
                    updatedAt: new Date().toISOString(),
                };
            });

            setPageState({
                ...pageState,
                timelines: updatedTimelines,
            });
        } else {
            // Create new event
            if (eventFormState.eventType === 'point') {
                newEvent = {
                    type: 'point',
                    id: createId(),
                    title: eventFormState.title,
                    description: eventFormState.description,
                    date: eventFormState.date!,
                    category: eventFormState.category,
                    color: eventFormState.color,
                    createdAt: new Date().toISOString(),
                };
            } else {
                newEvent = {
                    type: 'period',
                    id: createId(),
                    title: eventFormState.title,
                    description: eventFormState.description,
                    startDate: eventFormState.startDate!,
                    endDate: eventFormState.endDate!,
                    category: eventFormState.category,
                    color: eventFormState.color,
                    createdAt: new Date().toISOString(),
                };
            }

            const updatedTimelines = pageState.timelines.map((t) => {
                if (t.id !== selectedTimeline.id) {
                    return t;
                }

                return {
                    ...t,
                    events: [...t.events, newEvent],
                    updatedAt: new Date().toISOString(),
                };
            });

            setPageState({
                ...pageState,
                timelines: updatedTimelines,
            });
        }

        handleCloseEventForm();
    };

    const handleDeleteEvent = (eventId: string): void => {
        if (!selectedTimeline) {
            return;
        }

        const updatedTimelines = pageState.timelines.map((t) => {
            if (t.id !== selectedTimeline.id) {
                return t;
            }

            return {
                ...t,
                events: t.events.filter((e) => e.id !== eventId),
                updatedAt: new Date().toISOString(),
            };
        });

        setPageState({
            ...pageState,
            timelines: updatedTimelines,
        });

        handleCloseEventForm();
    };

    return (
        <div className={css.container}>
            <TimelineSelector
                timelines={pageState.timelines}
                selectedTimelineId={pageState.selectedTimelineId}
                onSelectTimeline={handleSelectTimeline}
                onDeleteTimeline={handleDeleteTimeline}
                onCreateTimeline={() => setShowTimelineForm(true)}
            />

            {showTimelineForm && (
                <div className={css.modalOverlay} onClick={() => setShowTimelineForm(false)}>
                    <div className={css.modal} onClick={(e) => e.stopPropagation()}>
                        <h2>Create New Timeline</h2>
                        <input
                            type="text"
                            placeholder="Timeline name..."
                            value={newTimelineName}
                            onChange={(e) => setNewTimelineName(e.target.value)}
                            className={css.input}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleCreateTimeline();
                                }
                            }}
                        />
                        <div className={css.modalButtons}>
                            <button onClick={handleCreateTimeline} className={css.primaryButton}>
                                Create
                            </button>
                            <button onClick={() => setShowTimelineForm(false)} className={css.secondaryButton}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedTimeline && (
                <TimelineViewer
                    timeline={selectedTimeline}
                    timelineRange={timelineRange}
                    positionedEvents={positionedEvents}
                    onAddEvent={() => handleOpenEventForm()}
                    onEditEvent={handleOpenEventForm}
                    onDeleteEvent={handleDeleteEvent}
                />
            )}

            {showEventForm && selectedTimeline && (
                <EventForm
                    formState={eventFormState}
                    setFormState={setEventFormState}
                    onSave={handleSaveEvent}
                    onCancel={handleCloseEventForm}
                    onDelete={editingEventId ? () => handleDeleteEvent(editingEventId) : undefined}
                    isEditing={editingEventId !== null}
                />
            )}

            {!selectedTimeline && pageState.timelines.length === 0 && (
                <div className={css.emptyState}>
                    <p>No timelines yet. Create one to get started!</p>
                    <button onClick={() => setShowTimelineForm(true)} className={css.primaryButton}>
                        Create Timeline
                    </button>
                </div>
            )}
        </div>
    );
};
