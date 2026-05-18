import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { Timeline, TimelineEventPeriod, TimelineEventPoint } from '../../utils/portalTypes';
import { TimelineRange, PositionedEvent } from '../../utils/timelineUtils';
import css from '../../pages/TimelinePage.module.css';

interface TimelineViewerProps {
    timeline: Timeline;
    timelineRange: TimelineRange | null;
    positionedEvents: PositionedEvent[];
    onAddEvent: () => void;
    onEditEvent: (eventId: string) => void;
    onDeleteEvent: (eventId: string) => void;
}

const CONNECTOR_GAP_PX = 8;
const PERIOD_MIN_WIDTH_PX = 100;

const toRgba = (hexColor: string, alpha: number): string => {
    const hex = hexColor.replace('#', '').trim();

    if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return `rgba(78, 205, 196, ${alpha})`;
};

export const TimelineViewer: React.FC<TimelineViewerProps> = ({
    timeline,
    timelineRange,
    positionedEvents,
    onAddEvent,
    onEditEvent,
    onDeleteEvent,
}) => {
    interface FlowNode {
        id: string;
        percent: number;
        color: string;
        order: number;
        markerDiameterPx: number;
    }

    const getEventOrderDate = React.useCallback((event: TimelineEventPoint | TimelineEventPeriod): Date => {
        if (event.type === 'period') {
            // Sequence periods by end date so following events respect when the period finishes.
            return parseISO(event.endDate);
        }

        return parseISO(event.date);
    }, []);

    const getPeriodWidthPx = React.useCallback((title: string): number => {
        const titleBasedWidth = title.length * 8 + 44;
        return Math.max(PERIOD_MIN_WIDTH_PX, titleBasedWidth);
    }, []);

    const eventDateById = React.useMemo(() => {
        const dateById = new Map<string, Date>();
        timeline.events.forEach((event) => {
            dateById.set(event.id, getEventOrderDate(event));
        });
        return dateById;
    }, [timeline.events, getEventOrderDate]);

    // Separate positioned events into period and point events
    const { periodEvents, pointEvents } = React.useMemo(() => {
        const periods: PositionedEvent[] = [];
        const points: PositionedEvent[] = [];

        positionedEvents.forEach((pe) => {
            if (pe.event.type === 'period') {
                periods.push(pe);
            } else {
                points.push(pe);
            }
        });

        return { periodEvents: periods, pointEvents: points };
    }, [positionedEvents]);



    const flowNodes = React.useMemo<FlowNode[]>(() => {
        const nodes: FlowNode[] = [];

        positionedEvents.forEach((pe) => {
            const event = pe.event;

            if (event.type === 'point') {
                nodes.push({
                    id: `point-${event.id}`,
                    percent: pe.startPercent,
                    color: event.color,
                    order: 0,
                    markerDiameterPx: 30,
                });
                return;
            }

            nodes.push({
                id: `period-start-${event.id}`,
                percent: pe.startPercent,
                color: event.color,
                order: 1,
                markerDiameterPx: 40,
            });
        });

        nodes.sort((a, b) => {
            const aId = a.id.replace('point-', '').replace('period-start-', '');
            const bId = b.id.replace('point-', '').replace('period-start-', '');
            const aDate = eventDateById.get(aId) ?? new Date(0);
            const bDate = eventDateById.get(bId) ?? new Date(0);

            if (aDate.getTime() !== bDate.getTime()) {
                return aDate.getTime() - bDate.getTime();
            }

            return a.order - b.order;
        });

        return nodes;
    }, [positionedEvents, eventDateById]);

    const calculateDuration = (startDate: string, endDate: string): string => {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        
        if (days < 30) return `${days}d`;
        if (days < 365) return `${Math.round(days / 30)}mo`;
        return `${Math.round(days / 365)}y`;
    };

    if (!timelineRange) {
        return (
            <div className={css.viewer}>
                <div className={css.emptyState}>
                    <p>No events yet. Add your first event!</p>
                    <button onClick={onAddEvent} className={css.addEventButton}>
                        + Add Event
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={css.viewer}>
            <div className={css.viewerHeader}>
                <h2 className={css.viewerTitle}>{timeline.name}</h2>
                <button onClick={onAddEvent} className={css.addEventButton}>
                    + Add Event
                </button>
            </div>

            <div className={css.timelineContent}>
                <div className={css.timelineCanvas}>
                    <div className={css.timelineBaseLine} />

                    {flowNodes.map((node, index) => {
                        const nextNode = index < flowNodes.length - 1 ? flowNodes[index + 1] : null;

                        if (!nextNode) {
                            return null;
                        }

                        const spanPercent = Math.max(nextNode.percent - node.percent, 0);
                        const isPointToPeriod = node.id.startsWith('point-') && nextNode.id.startsWith('period-start-');
                        const pairGapPx = CONNECTOR_GAP_PX + (isPointToPeriod ? 6 : 0);
                        const startOffsetPx = Math.round(node.markerDiameterPx / 2) + pairGapPx;
                        const endOffsetPx = Math.round(nextNode.markerDiameterPx / 2) + pairGapPx;
                        const offsetTotalPx = startOffsetPx + endOffsetPx;

                        if (spanPercent < 0.9) {
                            return null;
                        }

                        return (
                            <div
                                key={`${node.id}-to-${nextNode.id}`}
                                className={css.pointFlow}
                                style={{
                                    left: `calc(${node.percent}% + ${startOffsetPx}px)`,
                                    width: `calc(${spanPercent}% - ${offsetTotalPx}px)`,
                                    '--event-color': node.color,
                                    '--event-color-fade': toRgba(node.color, 0.2),
                                } as React.CSSProperties}
                            >
                                <div className={css.pointArrow} />
                            </div>
                        );
                    })}

                    {periodEvents.map((pe) => {
                        const event = pe.event as TimelineEventPeriod;
                        const duration = calculateDuration(event.startDate, event.endDate);
                        const periodWidthPx = getPeriodWidthPx(event.title);

                        return (
                            <div
                                key={event.id}
                                className={css.periodEvent}
                                style={{
                                    left: `${pe.startPercent}%`,
                                    width: `${pe.widthPercent}%`,
                                }}
                            >
                                <div
                                    className={css.periodEventLabel}
                                    style={{
                                        '--event-color': event.color,
                                    } as React.CSSProperties}
                                    title={`${event.title} (${duration})`}
                                >
                                    {duration}
                                </div>
                                <div className={css.periodEventTitle} title={event.title}>
                                    {event.title}
                                </div>
                                <div
                                    className={css.periodConnector}
                                    style={{
                                        '--event-color': event.color,
                                    } as React.CSSProperties}
                                />
                                <div
                                    className={css.periodMarker}
                                    style={{
                                        left: 0,
                                        '--event-color': event.color,
                                    } as React.CSSProperties}
                                    onClick={() => onEditEvent(event.id)}
                                    title={`${event.title} - Start: ${format(parseISO(event.startDate), 'MMM d')}`}
                                />
                                <div className={`${css.periodEdgeDate} ${css.periodEdgeDateStart}`}>
                                    {format(parseISO(event.startDate), 'MMM d')}
                                </div>
                                <div
                                    className={css.periodMarker}
                                    style={{
                                        right: 0,
                                        '--event-color': event.color,
                                    } as React.CSSProperties}
                                    onClick={() => onEditEvent(event.id)}
                                    title={`${event.title} - End: ${format(parseISO(event.endDate), 'MMM d')}`}
                                />
                                <div className={`${css.periodEdgeDate} ${css.periodEdgeDateEnd}`}>
                                    {format(parseISO(event.endDate), 'MMM d')}
                                </div>
                            </div>
                        );
                    })}

                    {pointEvents.map((pe) => {
                        const event = pe.event as TimelineEventPoint;

                        return (
                            <div
                                key={event.id}
                                className={css.pointEvent}
                                style={{
                                    left: `${pe.startPercent}%`,
                                }}
                            >
                                <div className={css.pointDate}>{format(parseISO(event.date), 'MMM d')}</div>
                                <div
                                    className={css.pointMarker}
                                    style={{
                                        '--event-color': event.color,
                                    } as React.CSSProperties}
                                    onClick={() => onEditEvent(event.id)}
                                    title={event.description ? `${event.title}\n${event.description}` : event.title}
                                />
                                <div className={css.pointLabel}>{event.title}</div>
                            </div>
                        );
                    })}
                </div>

                {!timeline.events || timeline.events.length === 0 ? (
                    <div className={css.emptyState}>
                        <p>No events yet. Add your first event!</p>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
