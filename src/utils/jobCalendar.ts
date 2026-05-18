import {
    addDays,
    endOfMonth,
    endOfWeek,
    eachDayOfInterval,
    format,
    getDay,
    isBefore,
    isSameDay,
    isWeekend,
    parseISO,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { JobCalendarState, JobHolidayCountry } from './portalTypes';

export type HolidayInfo = {
    dateIso: string;
    name: string;
    country: JobHolidayCountry;
};

export type MonthWorkSummary = {
    workingDays: number;
    workingHours: number;
    expectedSalarySek: number;
};

const toIsoDate = (date: Date): string => format(date, 'yyyy-MM-dd');

export const getEasterSunday = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month, day);
};

const getNthWeekdayOfMonth = (year: number, monthIndex: number, weekday: number, occurrence: number): Date => {
    const monthStart = new Date(year, monthIndex, 1);
    const offset = (weekday - getDay(monthStart) + 7) % 7;
    return addDays(monthStart, offset + (occurrence - 1) * 7);
};

const getFirstSaturdayOnOrAfter = (year: number, monthIndex: number, dayOfMonth: number): Date => {
    const start = new Date(year, monthIndex, dayOfMonth);
    const offset = (6 - getDay(start) + 7) % 7;
    return addDays(start, offset);
};

export const getJapanEquinoxDay = (year: number, type: 'spring' | 'autumn'): number => {
    const baseYear = 1980;
    const drift = Math.floor((year - baseYear) / 4);
    const adjustment = 0.242194 * (year - baseYear) - drift;
    const rawValue = type === 'spring'
        ? Math.floor(20.8431 + adjustment)
        : Math.floor(23.2488 + adjustment);

    return rawValue;
};

export const getSwedenHolidayInfos = (year: number): HolidayInfo[] => {
    const easterSunday = getEasterSunday(year);
    const midsummerDay = getFirstSaturdayOnOrAfter(year, 5, 20);
    const allSaintsDay = getFirstSaturdayOnOrAfter(year, 9, 31);

    return [
        { dateIso: toIsoDate(new Date(year, 0, 1)), name: 'New Year\'s Day', country: 'SE' },
        { dateIso: toIsoDate(new Date(year, 0, 6)), name: 'Epiphany', country: 'SE' },
        { dateIso: toIsoDate(addDays(easterSunday, -2)), name: 'Good Friday', country: 'SE' },
        { dateIso: toIsoDate(addDays(easterSunday, 1)), name: 'Easter Monday', country: 'SE' },
        { dateIso: toIsoDate(new Date(year, 4, 1)), name: 'May Day', country: 'SE' },
        { dateIso: toIsoDate(addDays(easterSunday, 39)), name: 'Ascension Day', country: 'SE' },
        { dateIso: toIsoDate(new Date(year, 5, 6)), name: 'National Day', country: 'SE' },
        { dateIso: toIsoDate(midsummerDay), name: 'Midsummer Day', country: 'SE' },
        { dateIso: toIsoDate(allSaintsDay), name: 'All Saints Day', country: 'SE' },
        { dateIso: toIsoDate(new Date(year, 11, 25)), name: 'Christmas Day', country: 'SE' },
        { dateIso: toIsoDate(new Date(year, 11, 26)), name: 'Boxing Day', country: 'SE' },
    ];
};

export const getJapanHolidayInfos = (year: number): HolidayInfo[] => {
    const springEquinox = getJapanEquinoxDay(year, 'spring');
    const autumnEquinox = getJapanEquinoxDay(year, 'autumn');

    const baseHolidays: HolidayInfo[] = [
        { dateIso: toIsoDate(new Date(year, 0, 1)), name: 'New Year\'s Day', country: 'JP' },
        { dateIso: toIsoDate(getNthWeekdayOfMonth(year, 0, 1, 2)), name: 'Coming of Age Day', country: 'JP' },
        { dateIso: toIsoDate(new Date(year, 1, 11)), name: 'National Foundation Day', country: 'JP' },
        { dateIso: toIsoDate(new Date(year, 1, 23)), name: 'Emperor\'s Birthday', country: 'JP' },
        { dateIso: toIsoDate(new Date(year, 2, springEquinox)), name: 'Vernal Equinox Day', country: 'JP' },
        { dateIso: toIsoDate(new Date(year, 3, 29)), name: 'Showa Day', country: 'JP' },
        { dateIso: toIsoDate(new Date(year, 4, 3)), name: 'Constitution Memorial Day', country: 'JP' },
        { dateIso: toIsoDate(new Date(year, 4, 4)), name: 'Greenery Day', country: 'JP' },
        { dateIso: toIsoDate(new Date(year, 4, 5)), name: 'Children\'s Day', country: 'JP' },
        { dateIso: toIsoDate(getNthWeekdayOfMonth(year, 6, 1, 3)), name: 'Marine Day', country: 'JP' },
        { dateIso: toIsoDate(new Date(year, 7, 11)), name: 'Mountain Day', country: 'JP' },
        { dateIso: toIsoDate(getNthWeekdayOfMonth(year, 8, 1, 3)), name: 'Respect for the Aged Day', country: 'JP' },
        { dateIso: toIsoDate(new Date(year, 8, autumnEquinox)), name: 'Autumnal Equinox Day', country: 'JP' },
        { dateIso: toIsoDate(getNthWeekdayOfMonth(year, 9, 1, 2)), name: 'Sports Day', country: 'JP' },
        { dateIso: toIsoDate(new Date(year, 10, 3)), name: 'Culture Day', country: 'JP' },
        { dateIso: toIsoDate(new Date(year, 10, 23)), name: 'Labor Thanksgiving Day', country: 'JP' },
    ];

    const japaneseNameByEnglishName: Record<string, string> = {
        'New Year\'s Day': '元日',
        'Coming of Age Day': '成人の日',
        'National Foundation Day': '建国記念の日',
        'Emperor\'s Birthday': '天皇誕生日',
        'Vernal Equinox Day': '春分の日',
        'Showa Day': '昭和の日',
        'Constitution Memorial Day': '憲法記念日',
        'Greenery Day': 'みどりの日',
        'Children\'s Day': 'こどもの日',
        'Marine Day': '海の日',
        'Mountain Day': '山の日',
        'Respect for the Aged Day': '敬老の日',
        'Autumnal Equinox Day': '秋分の日',
        'Sports Day': 'スポーツの日',
        'Culture Day': '文化の日',
        'Labor Thanksgiving Day': '勤労感謝の日',
    };

    const holidayByIso = new Map<string, HolidayInfo>(baseHolidays.map((holiday) => [holiday.dateIso, holiday]));
    const substituteHolidays: HolidayInfo[] = [];

    baseHolidays.forEach((holiday) => {
        const holidayDate = parseISO(holiday.dateIso);

        // Japan substitute holiday rule: if holiday is on Sunday, next non-holiday weekday becomes substitute holiday.
        if (getDay(holidayDate) !== 0) {
            return;
        }

        let substituteDate = addDays(holidayDate, 1);
        let substituteIso = toIsoDate(substituteDate);

        while (holidayByIso.has(substituteIso)) {
            substituteDate = addDays(substituteDate, 1);
            substituteIso = toIsoDate(substituteDate);
        }

        const jpName = japaneseNameByEnglishName[holiday.name];
        const substituteName = jpName ? `${jpName} 振替休日` : `${holiday.name} Substitute Holiday`;
        const substituteHoliday: HolidayInfo = {
            dateIso: substituteIso,
            name: substituteName,
            country: 'JP',
        };

        holidayByIso.set(substituteIso, substituteHoliday);
        substituteHolidays.push(substituteHoliday);
    });

    return [...baseHolidays, ...substituteHolidays];
};

export const getHolidayInfoForDate = (date: Date, country: JobHolidayCountry): HolidayInfo | null => {
    const infos = country === 'SE' ? getSwedenHolidayInfos(date.getFullYear()) : getJapanHolidayInfos(date.getFullYear());
    const isoDate = toIsoDate(date);

    return infos.find((info) => info.dateIso === isoDate) ?? null;
};

export const getMonthGridDays = (monthDate: Date): Date[] => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: gridStart, end: gridEnd });
};

export const isWorkingDay = (date: Date, state: JobCalendarState): boolean => {
    const isoDate = toIsoDate(date);
    const override = state.workingDayOverrides[isoDate];

    if (override !== undefined) {
        return override;
    }

    const holidayInfo = getHolidayInfoForDate(date, state.holidayCountry);

    return !isWeekend(date) && !holidayInfo;
};

export const getMonthWorkSummary = (monthDate: Date, state: JobCalendarState): MonthWorkSummary => {
    const days = getMonthGridDays(monthDate).filter((day) => isSameDay(day, monthDate) || day.getMonth() === monthDate.getMonth());
    const workingDays = days.filter((day) => isWorkingDay(day, state)).length;
    const workingHours = workingDays * state.workingHoursPerDay;
    const expectedSalarySek = workingHours * state.wagePerHourSek;

    return {
        workingDays,
        workingHours,
        expectedSalarySek,
    };
};

export const isCalendarMonthBeforeToday = (monthDate: Date): boolean => isBefore(startOfMonth(monthDate), startOfMonth(new Date()));