import { format, parseISO } from 'date-fns';
import {
    getEasterSunday,
    getHolidayInfoForDate,
    getJapanEquinoxDay,
    getJapanHolidayInfos,
    getMonthGridDays,
    getMonthWorkSummary,
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
    workingDayOverrides: {},
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
            workingDayOverrides: {
                '2026-04-04': true,
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
        const state = createJobState({
            wagePerHourSek: 200,
            workingHoursPerDay: 6,
            holidayCountry: 'SE',
        });
        const summary = getMonthWorkSummary(monthDate, state);

        expect(summary.workingHours).toBe(summary.workingDays * state.workingHoursPerDay);
        expect(summary.expectedSalarySek).toBe(summary.workingHours * state.wagePerHourSek);
    });

    test('month grid starts Monday and ends Sunday', () => {
        const days = getMonthGridDays(parseISO('2026-04-01'));
        expect(days[0].getDay()).toBe(1);
        expect(days[days.length - 1].getDay()).toBe(0);
    });
});
