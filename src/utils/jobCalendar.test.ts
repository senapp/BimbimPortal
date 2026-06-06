import { describe, expect, test } from '@jest/globals';
import { format, parseISO } from 'date-fns';
import {
    getDayShiftInfoForDate,
    getEasterSunday,
    getHolidayInfoForDate,
    getClampedSevenDayWindowStartIndex,
    getJapanEquinoxDay,
    getJapanHolidayInfos,
    getMonthGridDays,
    getMonthShiftCompliance,
    getMonthWorkSummary,
    getSevenDayWindowSummary,
    getSwedenHolidayInfos,
    isWorkingDay,
} from './jobCalendar';
import { JobCalendarState } from './portalTypes';

const createJobState = (overrides: Partial<JobCalendarState> = {}): JobCalendarState => ({
    visibleMonthIso: '2026-04-01',
    selectedDayIso: null,
    holidayCountry: 'SE',
    wagePerHourSek: 100,
    workingHoursPerDay: 8,
    monthlySalarySek: 0,
    monthlyBonusSek: 0,
    bonusMonthOverrides: {},
    dayShiftOverrides: {},
    workingDayOverrides: {},
    shiftPreset: null,
    ...overrides,
});

describe('jobCalendar calculations', () => {
    test('computes known Easter Sunday dates', () => {
        expect(format(getEasterSunday(2026), 'yyyy-MM-dd')).toBe('2026-04-05');
        expect(format(getEasterSunday(2027), 'yyyy-MM-dd')).toBe('2027-03-28');
    });

    test('computes Japanese equinox day approximations for 2026', () => {
        expect(getJapanEquinoxDay(2026, 'spring')).toBe(20);
        expect(getJapanEquinoxDay(2026, 'autumn')).toBe(23);
    });

    test('returns all Swedish fixed and movable holidays', () => {
        const holidays = getSwedenHolidayInfos(2026);
        expect(holidays).toHaveLength(11);
        expect(holidays.some((holiday) => holiday.dateIso === '2026-12-25')).toBe(true);
    });

    test('includes substitute holiday in Japan when holiday lands on Sunday', () => {
        const holidays = getJapanHolidayInfos(2023);
        const substitute = holidays.find((holiday) => holiday.dateIso === '2023-01-02');

        expect(substitute).toBeDefined();
    });

    test('working day can be overridden', () => {
        const normalState = createJobState();
        const overrideState = createJobState({
            dayShiftOverrides: {
                '2026-04-04': { working: true },
            },
        });

        expect(isWorkingDay(parseISO('2026-04-04'), normalState)).toBe(false);
        expect(isWorkingDay(parseISO('2026-04-04'), overrideState)).toBe(true);
    });

    test('holiday lookup returns null for non-holiday and info for holiday', () => {
        expect(getHolidayInfoForDate(parseISO('2026-12-25'), 'SE')?.name).toBe('Christmas Day');
        expect(getHolidayInfoForDate(parseISO('2026-12-24'), 'SE')).toBeNull();
    });

    test('month work summary is internally consistent', () => {
        const monthDate = parseISO('2026-02-01');
        const wage = Math.floor(Math.random() * 500) + 100;
        const hours = Math.floor(Math.random() * 8) + 1;
        const state = createJobState({
            wagePerHourSek: wage,
            workingHoursPerDay: hours,
            holidayCountry: 'SE',
        });
        const summary = getMonthWorkSummary(monthDate, state);

        expect(summary.workingHours).toBe(summary.workingDays * state.workingHoursPerDay);
        expect(summary.expectedSalarySek).toBe(summary.workingHours * state.wagePerHourSek);
    });

    test('day shift info falls back to the default hours and title', () => {
        const hours = Math.floor(Math.random() * 12) + 1;
        const info = getDayShiftInfoForDate(parseISO('2026-04-07'), createJobState({ workingHoursPerDay: hours }));

        expect(info.working).toBe(true);
        expect(info.hours).toBe(hours);
        expect(info.title).toBe('');
    });

    test('seven day window sums per-day hours', () => {
        const hoursA = Math.floor(Math.random() * 5) + 1;
        const hoursB = Math.floor(Math.random() * 5) + 1;
        const state = createJobState({
            dayShiftOverrides: {
                '2026-04-01': { hours: hoursA, title: 'Short shift', working: true },
                '2026-04-02': { hours: hoursB, title: 'Short shift', working: true },
            },
        });

        const window = getSevenDayWindowSummary(parseISO('2026-04-01'), state);

        expect(window.totalHours).toBeGreaterThan(0);
        expect(window.days[0].hours).toBe(hoursA);
        expect(window.days[1].hours).toBe(hoursB);
    });

    test('seven day windows before the work-data start do not count phantom hours', () => {
        const hours = Math.floor(Math.random() * 8) + 1;
        const state = createJobState({
            workingHoursPerDay: hours,
        });

        const window = getSevenDayWindowSummary(parseISO('2026-03-29'), state);

        expect(window.days[0].hours).toBe(0);
        expect(window.days[1].hours).toBe(0);
        expect(window.days[2].hours).toBe(0);
        expect(window.days[3].hours).toBe(hours);
    });

    test('seven day windows can span from April into May', () => {
        const hours = Math.floor(Math.random() * 8) + 1;
        const state = createJobState({
            workingHoursPerDay: hours,
            dayShiftOverrides: {
                '2026-04-27': { hours: hours, working: true },
                '2026-04-28': { hours: hours, working: true },
                '2026-04-29': { hours: hours, working: true },
                '2026-04-30': { hours: hours, working: true },
                '2026-05-01': { hours: hours, working: true },
                '2026-05-02': { hours: hours, working: true },
                '2026-05-03': { hours: hours, working: true },
            },
        });

        const window = getSevenDayWindowSummary(parseISO('2026-04-27'), state);

        expect(window.days.map((day) => day.dateIso)).toEqual([
            '2026-04-27',
            '2026-04-28',
            '2026-04-29',
            '2026-04-30',
            '2026-05-01',
            '2026-05-02',
            '2026-05-03',
        ]);
        expect(window.totalHours).toBe(hours * 7);
    });

    test('seven day windows can start on the last visible day of May', () => {
        const hours = Math.floor(Math.random() * 8) + 1;
        const state = createJobState({
            workingHoursPerDay: hours,
            dayShiftOverrides: {
                '2026-05-31': { hours: hours, working: true },
                '2026-06-01': { hours: hours, working: true },
                '2026-06-02': { hours: hours, working: true },
                '2026-06-03': { hours: hours, working: true },
                '2026-06-04': { hours: hours, working: true },
                '2026-06-05': { hours: hours, working: true },
                '2026-06-06': { hours: hours, working: true },
            },
        });

        const window = getSevenDayWindowSummary(parseISO('2026-05-31'), state);

        expect(window.days[0].dateIso).toBe('2026-05-31');
        expect(window.days[6].dateIso).toBe('2026-06-06');
        expect(window.totalHours).toBe(hours * 7);
    });

    test('seven day window start index clamps to the visible range', () => {
        const range = Math.floor(Math.random() * 50) + 10;
        expect(getClampedSevenDayWindowStartIndex(-3, range)).toBe(0);
        expect(getClampedSevenDayWindowStartIndex(5, range)).toBe(5);
        expect(getClampedSevenDayWindowStartIndex(range + 5, range)).toBe(range - 1);
        expect(getClampedSevenDayWindowStartIndex(2, 6)).toBe(2);
    });

    test('month compliance detects windows over 28 hours at the edge of the month', () => {
        const state = createJobState({
            workingHoursPerDay: 6,
            dayShiftOverrides: {
                '2026-04-30': { hours: 8, working: true },
                '2026-05-01': { hours: 8, working: true },
                '2026-05-02': { hours: 8, working: true },
                '2026-05-03': { hours: 8, working: true },
            },
        });

        const compliance = getMonthShiftCompliance(parseISO('2026-04-01'), state);

        expect(compliance.isLegal).toBe(false);
        expect(compliance.violatingWindows.length).toBeGreaterThan(0);
        expect(compliance.violatingWindows[0].totalHours).toBeGreaterThan(28);
    });

    test('month compliance ignores months before work data starts', () => {
        const compliance = getMonthShiftCompliance(parseISO('2026-03-01'), createJobState());

        expect(compliance.isLegal).toBe(true);
        expect(compliance.allWindows).toHaveLength(0);
        expect(compliance.violatingWindows).toHaveLength(0);
    });

    test('month compliance stays legal when every seven day window is at or below 28 hours', () => {
        const state = createJobState({
            workingHoursPerDay: 4,
            dayShiftOverrides: {
                '2026-04-30': { hours: 4, working: true },
                '2026-05-01': { hours: 4, working: true },
            },
        });

        const compliance = getMonthShiftCompliance(parseISO('2026-04-01'), state);

        expect(compliance.isLegal).toBe(true);
    });

    test('month grid starts Monday and ends Sunday', () => {
        const days = getMonthGridDays(parseISO('2026-04-01'));
        expect(days[0].getDay()).toBe(1);
        expect(days[days.length - 1].getDay()).toBe(0);
    });
});
