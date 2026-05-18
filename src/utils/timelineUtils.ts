import { differenceInDays, parseISO, format } from 'date-fns';
import { TimelineEvent, TimelineEventPeriod, TimelineEventPoint } from './portalTypes';

export interface TimelineRange {
    minDate: string;
    maxDate: string;
    totalDays: number;
}

export interface PositionedEvent {
    event: TimelineEvent;
    startPercent: number;
    widthPercent?: number;
    rowIndex?: number;
}

/**
 * Calculate the date range for a timeline with 10% padding
 */
export const calculateTimelineRange = (events: TimelineEvent[]): TimelineRange | null => {
    if (events.length === 0) {
        return null;
    }

    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    events.forEach((event) => {
        const eventDate = event.type === 'point' ? parseISO(event.date) : parseISO(event.startDate);
        const eventMaxDate = event.type === 'period' ? parseISO(event.endDate) : eventDate;

        if (minDate === null || eventDate < minDate) {
            minDate = eventDate;
        }
        if (maxDate === null || eventMaxDate > maxDate) {
            maxDate = eventMaxDate;
        }
    });

    if (minDate === null || maxDate === null) {
        return null;
    }

    const totalDays = differenceInDays(maxDate, minDate) || 1;
    const paddingDays = Math.max(Math.ceil(totalDays * 0.1), 1);

    const paddedMinDate = new Date(minDate);
    paddedMinDate.setDate(paddedMinDate.getDate() - paddingDays);

    const paddedMaxDate = new Date(maxDate);
    paddedMaxDate.setDate(paddedMaxDate.getDate() + paddingDays);

    return {
        minDate: format(paddedMinDate, 'yyyy-MM-dd'),
        maxDate: format(paddedMaxDate, 'yyyy-MM-dd'),
        totalDays: differenceInDays(paddedMaxDate, paddedMinDate),
    };
};

/**
 * Convert a date to a percentage position on the timeline
 */
export const calculateEventPosition = (eventDate: string, range: TimelineRange): number => {
    const eventDays = differenceInDays(parseISO(eventDate), parseISO(range.minDate));
    return (eventDays / range.totalDays) * 100;
};

/**
 * Check if two periods overlap
 */
const doPeriodOverlap = (period1: TimelineEventPeriod, period2: TimelineEventPeriod): boolean => {
    const p1Start = parseISO(period1.startDate);
    const p1End = parseISO(period1.endDate);
    const p2Start = parseISO(period2.startDate);
    const p2End = parseISO(period2.endDate);

    return p1Start <= p2End && p2Start <= p1End;
};

/**
 * Assign row indices to period events to avoid overlaps
 * Uses a greedy algorithm: assign each period to the first available row
 */
export const assignPeriodRows = (periodEvents: TimelineEventPeriod[]): Map<string, number> => {
    const rowAssignments = new Map<string, number>();
    const rowOccupancy: TimelineEventPeriod[][] = [];

    periodEvents.forEach((period) => {
        // Find first row where this period doesn't overlap
        let assignedRow = -1;

        for (let rowIndex = 0; rowIndex < rowOccupancy.length; rowIndex++) {
            const hasConflict = rowOccupancy[rowIndex].some((existingPeriod) =>
                doPeriodOverlap(period, existingPeriod)
            );

            if (!hasConflict) {
                assignedRow = rowIndex;
                break;
            }
        }

        // If no available row, create new one
        if (assignedRow === -1) {
            assignedRow = rowOccupancy.length;
            rowOccupancy.push([]);
        }

        rowOccupancy[assignedRow].push(period);
        rowAssignments.set(period.id, assignedRow);
    });

    return rowAssignments;
};

/**
 * Get positioned events for rendering with minimum spacing
 */
export const getPositionedEvents = (
    events: TimelineEvent[],
    range: TimelineRange | null
): PositionedEvent[] => {
    if (range === null) {
        return [];
    }

    const periodEvents = events.filter((e): e is TimelineEventPeriod => e.type === 'period');
    const rowAssignments = assignPeriodRows(periodEvents);
    const MIN_EVENT_SPACING_PERCENT = 10;

    let positioned = events.map((event) => {
        const startPercent =
            event.type === 'point'
                ? calculateEventPosition(event.date, range)
                : calculateEventPosition(event.startDate, range);

        const widthPercent =
            event.type === 'period'
                ? Math.max(calculateEventPosition(event.endDate, range) - startPercent, 20)
                : undefined;

        const rowIndex = event.type === 'period' ? rowAssignments.get(event.id) : undefined;

        return {
            event,
            startPercent,
            widthPercent,
            rowIndex,
        };
    });

    // Sort by start position to apply minimum spacing
    const sorted = [...positioned].sort((a, b) => a.startPercent - b.startPercent);

    // Apply minimum spacing: ensure each event has at least MIN_EVENT_SPACING_PERCENT gap from the next
    let adjustedStartPercents = new Map<string, number>();

    sorted.forEach((current, index) => {
        if (index === 0) {
            adjustedStartPercents.set(current.event.id, current.startPercent);
            return;
        }

        const previous = sorted[index - 1];
        const prevAdjustedStart = adjustedStartPercents.get(previous.event.id) ?? previous.startPercent;
        const prevWidth = previous.widthPercent ?? 2; // Approximate point event width
        const prevEnd = prevAdjustedStart + prevWidth;
        const minAllowedStart = prevEnd + MIN_EVENT_SPACING_PERCENT;

        // Use adjusted position if needed to maintain spacing, but prefer original position
        const newStart = Math.max(current.startPercent, minAllowedStart);
        adjustedStartPercents.set(current.event.id, newStart);
    });

    // Apply adjusted positions back
    positioned = positioned.map((pe) => ({
        ...pe,
        startPercent: adjustedStartPercents.get(pe.event.id) ?? pe.startPercent,
    }));

    return positioned;
};

/**
 * Sort events by date (periods first, then points)
 */
export const sortEvents = (events: TimelineEvent[]): TimelineEvent[] => {
    return [...events].sort((a, b) => {
        // Periods come first
        if (a.type === 'period' && b.type !== 'period') return -1;
        if (a.type !== 'period' && b.type === 'period') return 1;

        const aDate = a.type === 'point' ? a.date : a.startDate;
        const bDate = b.type === 'point' ? b.date : b.startDate;

        return parseISO(aDate).getTime() - parseISO(bDate).getTime();
    });
};
