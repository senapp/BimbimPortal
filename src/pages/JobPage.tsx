import * as React from 'react';
import { addMonths, endOfMonth, format, isSameDay, isSameMonth, parseISO, startOfDay, startOfMonth, subMonths } from 'date-fns';
import {
    getDayShiftInfoForDate,
    getClampedSevenDayWindowStartIndex,
    getHolidayInfoForDate,
    getMonthGridDays,
    getMonthShiftCompliance,
    getSevenDayWindowSummary,
    getWorkingHoursForDate,
    isWorkingDay,
} from '../utils/jobCalendar';
import { CurrencyCode, JobCalendarState, JobDayShiftOverride, JobHolidayCountry, JobShiftPreset } from '../utils/portalTypes';
import { usePersistedState } from '../utils/storage';
import css from './JobPage.module.css';

const STORAGE_DEFAULT: JobCalendarState = {
    visibleMonthIso: format(startOfMonth(new Date()), 'yyyy-MM-01'),
    selectedDayIso: null,
    holidayCountry: 'SE',
    wagePerHourSek: 0,
    workingHoursPerDay: 0,
    monthlySalarySek: 0,
    monthlyBonusSek: 0,
    bonusMonthOverrides: {},
    dayShiftOverrides: {},
    workingDayOverrides: {},
    shiftPreset: null,
};

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const countryLabels: Record<JobHolidayCountry, string> = {
    SE: 'Sweden',
    JP: 'Japan',
};
const countryFlags: Record<JobHolidayCountry, string> = {
    SE: '🇸🇪',
    JP: '🇯🇵',
};
const WORK_DATA_START_DATE = parseISO('2026-04-01');
const FULL_TIME_EMPLOYMENT_START_DATE = parseISO('2027-04-01');

const toIsoDate = (date: Date): string => format(date, 'yyyy-MM-dd');
const formatCurrency = (value: number, currency: CurrencyCode): string => new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
}).format(value);

const toSekAmount = (value: number, currency: CurrencyCode, jpyPerSek: number): number => {
    if (currency === 'SEK') {
        return value;
    }

    return value / Math.max(jpyPerSek, 0.0001);
};

const fromSekAmount = (valueSek: number, currency: CurrencyCode, jpyPerSek: number): number => {
    if (currency === 'SEK') {
        return valueSek;
    }

    return valueSek * Math.max(jpyPerSek, 0.0001);
};

const normalizeCalendarState = (state: Partial<JobCalendarState>): JobCalendarState => ({
    ...STORAGE_DEFAULT,
    ...state,
    bonusMonthOverrides: Object.entries(state.bonusMonthOverrides ?? {}).reduce<Record<string, boolean>>((acc, [monthIso, value]) => {
        const monthDate = parseISO(monthIso);
        if (monthDate >= FULL_TIME_EMPLOYMENT_START_DATE) {
            acc[monthIso] = value;
        }
        return acc;
    }, {}),
    dayShiftOverrides: {
        ...Object.entries(state.workingDayOverrides ?? {}).reduce<Record<string, JobDayShiftOverride>>((acc, [dateIso, value]) => {
            const date = parseISO(dateIso);
            if (date >= WORK_DATA_START_DATE) {
                acc[dateIso] = {
                    working: value,
                    hours: value ? (state.workingHoursPerDay ?? STORAGE_DEFAULT.workingHoursPerDay) : 0,
                };
            }
            return acc;
        }, {}),
        ...Object.entries(state.dayShiftOverrides ?? {}).reduce<Record<string, JobDayShiftOverride>>((acc, [dateIso, value]) => {
            const date = parseISO(dateIso);
            if (date >= WORK_DATA_START_DATE) {
                acc[dateIso] = {
                    title: value.title ?? '',
                    hours: Number.isFinite(value.hours ?? NaN) ? Math.max(value.hours ?? 0, 0) : STORAGE_DEFAULT.workingHoursPerDay,
                    working: value.working ?? true,
                };
            }
            return acc;
        }, {}),
    },
    workingDayOverrides: Object.entries(state.workingDayOverrides ?? {}).reduce<Record<string, boolean>>((acc, [dateIso, value]) => {
        const date = parseISO(dateIso);
        if (date >= WORK_DATA_START_DATE) {
            acc[dateIso] = value;
        }
        return acc;
    }, {}),
    shiftPreset: state.shiftPreset && typeof state.shiftPreset.title === 'string' && Number.isFinite(state.shiftPreset.hours)
        ? { title: state.shiftPreset.title, hours: Math.max(state.shiftPreset.hours, 0) }
        : null,
});

export const JobPage: React.FC = () => {
    const [storedCalendarState, setStoredCalendarState] = usePersistedState<JobCalendarState>('job-calendar-state', STORAGE_DEFAULT);
    const [displayCurrency, setDisplayCurrency] = usePersistedState<CurrencyCode>('job-display-currency', 'SEK');
    const [jpyPerSekRate, setJpyPerSekRate] = usePersistedState<number>('global-jpy-per-sek-rate', 14.8);
    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const [selectedWindowIndex, setSelectedWindowIndex] = React.useState(0);
    const [isWindowDragging, setIsWindowDragging] = React.useState(false);
    const calendarState = React.useMemo(() => normalizeCalendarState(storedCalendarState), [storedCalendarState]);
    const selectedWindowIndexRef = React.useRef(0);
    const windowDragStateRef = React.useRef<{ pointerId: number; offsetFromStart: number; hasMoved: boolean } | null>(null);
    const suppressWindowClickRef = React.useRef(false);

    const visibleMonth = React.useMemo(() => parseISO(calendarState.visibleMonthIso), [calendarState.visibleMonthIso]);
    const visibleMonthKey = React.useMemo(() => format(startOfMonth(visibleMonth), 'yyyy-MM-01'), [visibleMonth]);
    const days = React.useMemo(() => getMonthGridDays(visibleMonth), [visibleMonth]);

    const selectedDay = calendarState.selectedDayIso ? parseISO(calendarState.selectedDayIso) : null;
    const today = React.useMemo(() => startOfDay(new Date()), []);
    const visibleMonthStart = React.useMemo(() => startOfMonth(visibleMonth), [visibleMonth]);
    const todayMonthStart = React.useMemo(() => startOfMonth(today), [today]);
    const visibleMonthHasData = React.useMemo(() => endOfMonth(visibleMonth) >= WORK_DATA_START_DATE, [visibleMonth]);
    const isFullTimeEmploymentMonth = React.useMemo(() => visibleMonthStart >= FULL_TIME_EMPLOYMENT_START_DATE, [visibleMonthStart]);
    const isBonusMonth = isFullTimeEmploymentMonth ? (calendarState.bonusMonthOverrides[visibleMonthKey] ?? false) : false;
    const visibleMonthCompliance = React.useMemo(() => getMonthShiftCompliance(visibleMonth, calendarState), [calendarState, visibleMonth]);

    const monthDays = React.useMemo(() => days.filter((day) => isSameMonth(day, visibleMonth)), [days, visibleMonth]);
    const monthDaysWithData = React.useMemo(() => monthDays.filter((day) => day >= WORK_DATA_START_DATE), [monthDays]);

    const selectedDayHasData = selectedDay ? selectedDay >= WORK_DATA_START_DATE : false;
    const selectedDayShift = selectedDay && selectedDayHasData ? getDayShiftInfoForDate(selectedDay, calendarState) : null;
    const selectedHoliday = selectedDayShift?.holidayInfo ?? null;
    const selectedDayStatus = selectedDay && selectedDayHasData ? isWorkingDay(selectedDay, calendarState) : null;
    const selectedDayWorkingHours = selectedDayShift?.hours ?? 0;

    React.useEffect(() => {
        setSelectedWindowIndex((current) => getClampedSevenDayWindowStartIndex(current, days.length));
    }, [days.length]);

    React.useEffect(() => {
        selectedWindowIndexRef.current = selectedWindowIndex;
    }, [selectedWindowIndex]);

    const currentMonthSummary = React.useMemo(() => {
        const totalWorkingDays = monthDaysWithData.filter((day) => isWorkingDay(day, calendarState)).length;
        const earnedWorkingDays = monthDaysWithData.filter((day) => day <= today && isWorkingDay(day, calendarState)).length;
        const remainingWorkingDays = monthDaysWithData.filter((day) => day > today && isWorkingDay(day, calendarState)).length;

        const totalWorkingHours = monthDaysWithData.reduce((sum, day) => sum + getWorkingHoursForDate(day, calendarState), 0);
        const earnedWorkingHours = monthDaysWithData.filter((day) => day <= today).reduce((sum, day) => sum + getWorkingHoursForDate(day, calendarState), 0);
        const remainingWorkingHours = monthDaysWithData.filter((day) => day > today).reduce((sum, day) => sum + getWorkingHoursForDate(day, calendarState), 0);

        const totalSalarySek = totalWorkingHours * calendarState.wagePerHourSek;
        const earnedSalarySek = earnedWorkingHours * calendarState.wagePerHourSek;
        const remainingSalarySek = remainingWorkingHours * calendarState.wagePerHourSek;

        return {
            totalWorkingDays,
            earnedWorkingDays,
            remainingWorkingDays,
            totalWorkingHours,
            earnedWorkingHours,
            remainingWorkingHours,
            totalSalarySek,
            earnedSalarySek,
            remainingSalarySek,
        };
    }, [calendarState, monthDaysWithData, today]);

    const isFutureVisibleMonth = visibleMonthStart.getTime() > todayMonthStart.getTime();
    const isCurrentVisibleMonth = visibleMonthStart.getTime() === todayMonthStart.getTime();

    const earnedSalaryDisplay = fromSekAmount(currentMonthSummary.earnedSalarySek, displayCurrency, jpyPerSekRate);
    const remainingSalaryDisplay = fromSekAmount(currentMonthSummary.remainingSalarySek, displayCurrency, jpyPerSekRate);
    const totalSalaryDisplay = fromSekAmount(currentMonthSummary.totalSalarySek, displayCurrency, jpyPerSekRate);
    const wageDisplay = fromSekAmount(calendarState.wagePerHourSek, displayCurrency, jpyPerSekRate);

    const updateCalendarState = (mutator: (previous: JobCalendarState) => JobCalendarState): void => {
        setStoredCalendarState((previous) => mutator(normalizeCalendarState(previous)));
    };

    const updateVisibleMonth = (direction: -1 | 1): void => {
        const nextVisibleMonth = direction === -1 ? subMonths(visibleMonth, 1) : addMonths(visibleMonth, 1);

        updateCalendarState((previous) => ({
            ...previous,
            visibleMonthIso: format(startOfMonth(nextVisibleMonth), 'yyyy-MM-01'),
        }));
    };

    const setSelectedDay = (dayIso: string): void => {
        updateCalendarState((previous) => ({
            ...previous,
            selectedDayIso: dayIso,
        }));
    };

    const hourlyMonthSummary = React.useMemo(() => {
        const totalWorkingDays = monthDaysWithData.filter((day) => isWorkingDay(day, calendarState)).length;
        const earnedWorkingDays = monthDaysWithData.filter((day) => day <= today && isWorkingDay(day, calendarState)).length;
        const remainingWorkingDays = monthDaysWithData.filter((day) => day > today && isWorkingDay(day, calendarState)).length;

        const totalWorkingHours = monthDaysWithData.reduce((sum, day) => sum + getWorkingHoursForDate(day, calendarState), 0);
        const earnedWorkingHours = monthDaysWithData.filter((day) => day <= today).reduce((sum, day) => sum + getWorkingHoursForDate(day, calendarState), 0);
        const remainingWorkingHours = monthDaysWithData.filter((day) => day > today).reduce((sum, day) => sum + getWorkingHoursForDate(day, calendarState), 0);

        const expectedSalarySek = totalWorkingHours * calendarState.wagePerHourSek;
        const earnedSalarySek = earnedWorkingHours * calendarState.wagePerHourSek;
        const remainingSalarySek = remainingWorkingHours * calendarState.wagePerHourSek;

        return {
            totalWorkingDays,
            earnedWorkingDays,
            remainingWorkingDays,
            totalWorkingHours,
            earnedWorkingHours,
            remainingWorkingHours,
            expectedSalarySek,
            earnedSalarySek,
            remainingSalarySek,
        };
    }, [calendarState, monthDaysWithData, today]);

    const selectedWindowStartIndex = React.useMemo(
        () => getClampedSevenDayWindowStartIndex(selectedWindowIndex, days.length),
        [days.length, selectedWindowIndex],
    );
    const selectedWindowStart = React.useMemo(
        () => days[selectedWindowStartIndex] ?? days[0],
        [days, selectedWindowStartIndex],
    );
    const selectedWindowSummary = React.useMemo(
        () => (selectedWindowStart ? getSevenDayWindowSummary(selectedWindowStart, calendarState) : null),
        [calendarState, selectedWindowStart],
    );
    const selectedWindowDaySet = React.useMemo(() => new Set(selectedWindowSummary?.days.map((dayInfo) => dayInfo.dateIso) ?? []), [selectedWindowSummary]);

    const getDayIndexFromPointer = React.useCallback((clientX: number, clientY: number): number | null => {
        if (typeof document === 'undefined') {
            return null;
        }

        const hoveredElement = document.elementFromPoint(clientX, clientY);
        const dayCell = hoveredElement instanceof HTMLElement ? hoveredElement.closest('[data-day-index]') : null;

        if (!(dayCell instanceof HTMLElement)) {
            return null;
        }

        const dayIndex = Number(dayCell.dataset.dayIndex);
        return Number.isFinite(dayIndex) ? dayIndex : null;
    }, []);

    const beginWindowDrag = (pointerId: number, dayIndex: number): void => {
        windowDragStateRef.current = {
            pointerId,
            offsetFromStart: 0,
            hasMoved: false,
        };
        setSelectedWindowIndex(dayIndex);
        suppressWindowClickRef.current = false;
        setIsWindowDragging(true);
    };

    const updateWindowDrag = (pointerId: number, clientX: number, clientY: number): void => {
        const dragState = windowDragStateRef.current;

        if (!dragState || dragState.pointerId !== pointerId) {
            return;
        }

        const hoveredIndex = getDayIndexFromPointer(clientX, clientY);

        if (hoveredIndex === null) {
            return;
        }

        const nextIndex = getClampedSevenDayWindowStartIndex(hoveredIndex - dragState.offsetFromStart, days.length);

        if (nextIndex !== selectedWindowIndexRef.current) {
            suppressWindowClickRef.current = true;
            dragState.hasMoved = true;
            selectedWindowIndexRef.current = nextIndex;
            setSelectedWindowIndex(nextIndex);
        }
    };

    const endWindowDrag = (pointerId: number, currentTarget: EventTarget & HTMLButtonElement): void => {
        const dragState = windowDragStateRef.current;
        const shouldSuppressClick = dragState?.hasMoved ?? false;

        if (dragState && dragState.pointerId === pointerId) {
            windowDragStateRef.current = null;
        }

        suppressWindowClickRef.current = shouldSuppressClick;
        setIsWindowDragging(false);

        if (currentTarget.hasPointerCapture(pointerId)) {
            currentTarget.releasePointerCapture(pointerId);
        }
    };

    const handleCalendarDayClick = (dayIso: string): void => {
        if (suppressWindowClickRef.current) {
            suppressWindowClickRef.current = false;
            return;
        }

        setSelectedDay(dayIso);
    };

    const fullTimeMonthSummary = React.useMemo(() => {
        if (!isFullTimeEmploymentMonth) {
            return null;
        }

        const bonusSek = isBonusMonth ? calendarState.monthlyBonusSek : 0;
        const totalCompensationSek = calendarState.monthlySalarySek + bonusSek;
        const daysInMonth = new Date(visibleMonthStart.getFullYear(), visibleMonthStart.getMonth() + 1, 0).getDate();
        const daysElapsed = visibleMonthStart.getTime() === todayMonthStart.getTime() ? Math.min(today.getDate(), daysInMonth) : (visibleMonthStart < todayMonthStart ? daysInMonth : 0);
        const earnedSalarySek = totalCompensationSek * (daysElapsed / daysInMonth);
        const remainingSalarySek = Math.max(totalCompensationSek - earnedSalarySek, 0);

        return {
            bonusSek,
            totalCompensationSek,
            daysInMonth,
            daysElapsed,
            earnedSalarySek,
            remainingSalarySek,
        };
    }, [calendarState.monthlyBonusSek, calendarState.monthlySalarySek, isBonusMonth, isFullTimeEmploymentMonth, today, todayMonthStart, visibleMonthStart]);

    const setBonusMonthForVisibleMonth = (bonusMonth: boolean): void => {
        updateCalendarState((previous) => ({
            ...previous,
            bonusMonthOverrides: {
                ...previous.bonusMonthOverrides,
                [visibleMonthKey]: bonusMonth,
            },
        }));
    };

    const updateDayShift = (day: Date, patch: Partial<JobDayShiftOverride>): void => {
        if (day < WORK_DATA_START_DATE) {
            return;
        }

        const dayIso = toIsoDate(day);

        updateCalendarState((previous) => {
            const current = previous.dayShiftOverrides[dayIso] ?? {};
            const nextOverride: JobDayShiftOverride = {
                ...current,
                ...patch,
            };

            return {
                ...previous,
                dayShiftOverrides: {
                    ...previous.dayShiftOverrides,
                    [dayIso]: nextOverride,
                },
                workingDayOverrides: {
                    ...previous.workingDayOverrides,
                    [dayIso]: nextOverride.working ?? ((nextOverride.hours ?? 0) > 0),
                },
            };
        });
    };

    const setSelectedDayWorkingState = (working: boolean): void => {
        if (!selectedDay || !selectedDayHasData) {
            return;
        }

        updateDayShift(selectedDay, {
            working,
            hours: working ? Math.max(selectedDayWorkingHours || calendarState.workingHoursPerDay, 0) : 0,
        });
    };

    const setVisibleMonthWorkingState = (working: boolean): void => {
        const monthDaysForUpdate = days.filter((day) => isSameMonth(day, visibleMonth));

        updateCalendarState((previous) => {
            const nextDayShiftOverrides = { ...previous.dayShiftOverrides };
            const nextWorkingDayOverrides = { ...previous.workingDayOverrides };
            const template = previous.shiftPreset ?? { title: '', hours: previous.workingHoursPerDay };

            monthDaysForUpdate.forEach((day) => {
                const dayIso = toIsoDate(day);

                if (day < WORK_DATA_START_DATE) {
                    delete nextDayShiftOverrides[dayIso];
                    delete nextWorkingDayOverrides[dayIso];
                    return;
                }

                if (!working) {
                    nextDayShiftOverrides[dayIso] = {
                        ...(nextDayShiftOverrides[dayIso] ?? {}),
                        hours: 0,
                        working: false,
                    };
                    nextWorkingDayOverrides[dayIso] = false;
                    return;
                }

                const holidayInfo = getHolidayInfoForDate(day, previous.holidayCountry);
                const suitableForWork = day.getDay() !== 0 && day.getDay() !== 6 && !holidayInfo;

                nextDayShiftOverrides[dayIso] = {
                    title: template.title,
                    hours: template.hours,
                    working: suitableForWork,
                };
                nextWorkingDayOverrides[dayIso] = suitableForWork;
            });

            return {
                ...previous,
                dayShiftOverrides: nextDayShiftOverrides,
                workingDayOverrides: nextWorkingDayOverrides,
            };
        });
    };

    const updateShiftPreset = (patch: Partial<JobShiftPreset>): void => {
        updateCalendarState((previous) => ({
            ...previous,
            shiftPreset: {
                title: previous.shiftPreset?.title ?? '',
                hours: previous.shiftPreset?.hours ?? previous.workingHoursPerDay,
                ...patch,
            },
        }));
    };

    const applyPresetToSelectedDay = (): void => {
        if (!selectedDay || !selectedDayHasData || !calendarState.shiftPreset) {
            return;
        }

        updateDayShift(selectedDay, {
            title: calendarState.shiftPreset.title,
            hours: calendarState.shiftPreset.hours,
            working: true,
        });
    };

    const applyPresetToSelectedWindow = (): void => {
        if (!selectedWindowSummary || !calendarState.shiftPreset) {
            return;
        }

        updateCalendarState((previous) => {
            const nextDayShiftOverrides = { ...previous.dayShiftOverrides };
            const nextWorkingDayOverrides = { ...previous.workingDayOverrides };

            selectedWindowSummary.days.forEach((dayInfo) => {
                const day = parseISO(dayInfo.dateIso);
                if (day < WORK_DATA_START_DATE) {
                    return;
                }

                nextDayShiftOverrides[dayInfo.dateIso] = {
                    title: previous.shiftPreset?.title ?? '',
                    hours: previous.shiftPreset?.hours ?? previous.workingHoursPerDay,
                    working: true,
                };
                nextWorkingDayOverrides[dayInfo.dateIso] = true;
            });

            return {
                ...previous,
                dayShiftOverrides: nextDayShiftOverrides,
                workingDayOverrides: nextWorkingDayOverrides,
            };
        });
    };

    const hourlyWageDisplay = fromSekAmount(calendarState.wagePerHourSek, displayCurrency, jpyPerSekRate);
    const monthlySalaryDisplay = fromSekAmount(calendarState.monthlySalarySek, displayCurrency, jpyPerSekRate);
    const monthlyBonusDisplay = fromSekAmount(calendarState.monthlyBonusSek, displayCurrency, jpyPerSekRate);
    const fullTimeBonusDisplay = fullTimeMonthSummary ? fromSekAmount(fullTimeMonthSummary.bonusSek, displayCurrency, jpyPerSekRate) : 0;
    const fullTimeEarnedDisplay = fullTimeMonthSummary ? fromSekAmount(fullTimeMonthSummary.earnedSalarySek, displayCurrency, jpyPerSekRate) : 0;
    const fullTimeRemainingDisplay = fullTimeMonthSummary ? fromSekAmount(fullTimeMonthSummary.remainingSalarySek, displayCurrency, jpyPerSekRate) : 0;
    const fullTimeTotalDisplay = fullTimeMonthSummary ? fromSekAmount(fullTimeMonthSummary.totalCompensationSek, displayCurrency, jpyPerSekRate) : 0;
    const hourlyCurrentEarnedDisplay = fromSekAmount(hourlyMonthSummary.earnedSalarySek, displayCurrency, jpyPerSekRate);
    const hourlyRemainingDisplay = fromSekAmount(hourlyMonthSummary.remainingSalarySek, displayCurrency, jpyPerSekRate);
    const hourlyTotalDisplay = fromSekAmount(hourlyMonthSummary.expectedSalarySek, displayCurrency, jpyPerSekRate);

    return (
        <section className={css.page}>
            <div className={css.headerRow}>
                <div>
                    <h2 className={css.title}>Job</h2>
                    <p className={css.subtitle}>Calendar, holidays, working days, and salary projections in one view.</p>
                </div>

                <div className={css.monthControls}>
                    <button type="button" className={css.controlButton} onClick={() => updateVisibleMonth(-1)}>Previous</button>
                    <div className={css.monthLabel}>{format(visibleMonth, 'MMMM yyyy')}</div>
                    <button type="button" className={css.controlButton} onClick={() => updateVisibleMonth(1)}>Next</button>
                </div>
            </div>

            <div className={css.controlPanel}>
                <label className={css.field}>
                    <span>Salary currency</span>
                    <select value={displayCurrency} onChange={(event) => setDisplayCurrency(event.target.value as CurrencyCode)}>
                        <option value="SEK">SEK</option>
                        <option value="JPY">JPY</option>
                    </select>
                </label>

                <label className={css.field}>
                    <span>Holiday calendar</span>
                    <select
                        value={calendarState.holidayCountry}
                        onChange={(event) => updateCalendarState((previous) => ({
                            ...previous,
                            holidayCountry: event.target.value as JobHolidayCountry,
                        }))}
                    >
                        <option value="SE">Sweden</option>
                        <option value="JP">Japan</option>
                    </select>
                </label>

                {!isFullTimeEmploymentMonth ? (
                    <>
                        <label className={css.field}>
                            <span>Wage per hour ({displayCurrency})</span>
                            <input
                                type="number"
                                min="0"
                                step={displayCurrency === 'SEK' ? '1' : '10'}
                                value={Math.round(hourlyWageDisplay)}
                                onChange={(event) => updateCalendarState((previous) => ({
                                    ...previous,
                                    wagePerHourSek: toSekAmount(Number(event.target.value), displayCurrency, jpyPerSekRate),
                                }))}
                            />
                        </label>

                        <label className={css.field}>
                            <span>Working hours per day</span>
                            <input
                                type="number"
                                min="0"
                                step="0.25"
                                value={calendarState.workingHoursPerDay}
                                onChange={(event) => updateCalendarState((previous) => ({
                                    ...previous,
                                    workingHoursPerDay: Number(event.target.value),
                                }))}
                            />
                        </label>
                    </>
                ) : (
                    <>
                        <label className={css.field}>
                            <span>Monthly salary ({displayCurrency})</span>
                            <input
                                type="number"
                                min="0"
                                step={displayCurrency === 'SEK' ? '100' : '1000'}
                                value={Math.round(monthlySalaryDisplay)}
                                onChange={(event) => updateCalendarState((previous) => ({
                                    ...previous,
                                    monthlySalarySek: toSekAmount(Number(event.target.value), displayCurrency, jpyPerSekRate),
                                }))}
                            />
                        </label>

                        <label className={css.field}>
                            <span>Bonus amount ({displayCurrency})</span>
                            <input
                                type="number"
                                min="0"
                                step={displayCurrency === 'SEK' ? '100' : '1000'}
                                value={Math.round(monthlyBonusDisplay)}
                                onChange={(event) => updateCalendarState((previous) => ({
                                    ...previous,
                                    monthlyBonusSek: toSekAmount(Number(event.target.value), displayCurrency, jpyPerSekRate),
                                }))}
                            />
                        </label>

                        <label className={`${css.field} ${css.checkboxField}`.trim()}>
                            <input
                                type="checkbox"
                                checked={isBonusMonth}
                                onChange={(event) => setBonusMonthForVisibleMonth(event.target.checked)}
                            />
                            <span>Mark {format(visibleMonth, 'MMMM yyyy')} as bonus month</span>
                        </label>
                    </>
                )}

                <button type="button" className={css.advancedToggleButton} onClick={() => setShowAdvanced(!showAdvanced)}>
                    {showAdvanced ? '▼' : '▶'} Advanced settings
                </button>
            </div>

            {showAdvanced && (
                <div className={css.controlPanel}>
                    <div className={css.advancedSection}>
                        <label className={css.field}>
                            <span>JPY per SEK rate</span>
                            <input type="number" min="0.0001" step="0.01" value={jpyPerSekRate} onChange={(event) => setJpyPerSekRate(Number(event.target.value))} />
                        </label>

                        <div className={css.selectionCard}>
                            <div className={css.selectionHeading}>Selected day</div>
                            <div className={css.selectionValue}>
                                {selectedDay ? format(selectedDay, 'EEEE, d MMMM yyyy') : 'No day selected'}
                            </div>
                            <div className={css.selectionMeta}>
                                {selectedDay ? (
                                    selectedDayHasData ? (
                                        <>
                                            {selectedHoliday ? `${selectedHoliday.name} • ` : ''}
                                            {selectedDayStatus ? 'Working day' : 'Non-working day'} • {selectedDayWorkingHours.toFixed(2)} h
                                        </>
                                    ) : (
                                        'No work data before April 2026'
                                    )
                                ) : (
                                    'Click a day to inspect or update it'
                                )}
                            </div>

                            <label className={css.shiftField}>
                                <span>Day title</span>
                                <input
                                    type="text"
                                    value={selectedDayShift?.title ?? ''}
                                    disabled={!selectedDay || !selectedDayHasData}
                                    onChange={(event) => {
                                        if (!selectedDay || !selectedDayHasData) {
                                            return;
                                        }

                                        updateDayShift(selectedDay, { title: event.target.value });
                                    }}
                                />
                            </label>

                            <label className={css.shiftField}>
                                <span>Day hours</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.25"
                                    value={selectedDayWorkingHours}
                                    disabled={!selectedDay || !selectedDayHasData}
                                    onChange={(event) => {
                                        if (!selectedDay || !selectedDayHasData) {
                                            return;
                                        }

                                        const nextHours = Number(event.target.value);
                                        updateDayShift(selectedDay, {
                                            hours: nextHours,
                                            working: nextHours > 0,
                                        });
                                    }}
                                />
                            </label>

                            <div
                                className={`${css.dayStateToggle} ${selectedDayStatus === true ? css.dayStateToggleWorking : ''} ${selectedDayStatus === false ? css.dayStateToggleOff : ''}`.trim()}
                                role="group"
                                aria-label="Selected day status"
                            >
                                <button
                                    type="button"
                                    className={`${css.dayStateOption} ${selectedDayStatus === true ? css.dayStateOptionActive : ''}`.trim()}
                                    onClick={() => setSelectedDayWorkingState(true)}
                                    disabled={!selectedDay || !selectedDayHasData}
                                    aria-pressed={selectedDayStatus === true}
                                >
                                    Working
                                </button>
                                <button
                                    type="button"
                                    className={`${css.dayStateOption} ${selectedDayStatus === false ? css.dayStateOptionActive : ''}`.trim()}
                                    onClick={() => setSelectedDayWorkingState(false)}
                                    disabled={!selectedDay || !selectedDayHasData}
                                    aria-pressed={selectedDayStatus === false}
                                >
                                    Off
                                </button>
                            </div>

                            <div className={css.selectionButtons}>
                                <button type="button" className={css.primaryButton} onClick={applyPresetToSelectedDay} disabled={!selectedDay || !selectedDayHasData || !calendarState.shiftPreset}>
                                    Apply preset to day
                                </button>
                            </div>
                        </div>

                        <div className={css.selectionCard}>
                            <div className={css.selectionHeading}>Reusable preset</div>
                            <div className={css.selectionMeta}>Create one standard title and shift length, then apply it to a selected day or 7-day window.</div>

                            <label className={css.shiftField}>
                                <span>Preset title</span>
                                <input
                                    type="text"
                                    value={calendarState.shiftPreset?.title ?? ''}
                                    onChange={(event) => updateShiftPreset({ title: event.target.value })}
                                />
                            </label>

                            <label className={css.shiftField}>
                                <span>Preset hours</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.25"
                                    value={calendarState.shiftPreset?.hours ?? calendarState.workingHoursPerDay}
                                    onChange={(event) => updateShiftPreset({ hours: Number(event.target.value) })}
                                />
                            </label>

                            <div className={css.selectionButtons}>
                                <button type="button" className={css.primaryButton} onClick={() => updateShiftPreset({ title: calendarState.shiftPreset?.title ?? '', hours: calendarState.shiftPreset?.hours ?? calendarState.workingHoursPerDay })}>
                                    Save preset
                                </button>
                                <button type="button" className={css.secondaryButton} onClick={applyPresetToSelectedWindow} disabled={!selectedWindowSummary || !calendarState.shiftPreset}>
                                    Apply to 7-day window
                                </button>
                            </div>
                        </div>

                        <div className={css.monthActionCard}>
                            <div className={css.selectionHeading}>Whole month</div>
                            <div className={css.selectionMeta}>Apply one action to all days in {format(visibleMonth, 'MMMM yyyy')}.</div>
                            <div className={css.selectionButtons}>
                                <button type="button" className={css.primaryButton} onClick={() => setVisibleMonthWorkingState(true)} disabled={!visibleMonthHasData}>Set suitable days working</button>
                                <button type="button" className={css.secondaryButton} onClick={() => setVisibleMonthWorkingState(false)} disabled={!visibleMonthHasData}>Set all days off</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className={css.summaryGrid}>
                <article className={css.summaryCard}>
                    <span>{!visibleMonthHasData ? 'No data period' : isFullTimeEmploymentMonth ? 'Monthly salary' : isCurrentVisibleMonth ? 'Current earned salary' : 'Expected salary'}</span>
                    <strong>{formatCurrency(!visibleMonthHasData ? 0 : isFullTimeEmploymentMonth ? monthlySalaryDisplay : isCurrentVisibleMonth ? hourlyCurrentEarnedDisplay : hourlyTotalDisplay, displayCurrency)}</strong>
                    <small>
                        {!visibleMonthHasData
                            ? 'No work data is available before April 2026'
                            : isFullTimeEmploymentMonth
                                ? `Base salary for ${format(visibleMonth, 'MMMM yyyy')}`
                                : isCurrentVisibleMonth
                                    ? `Earned from ${hourlyMonthSummary.earnedWorkingDays} worked days up to today`
                                    : `Planned from ${hourlyMonthSummary.totalWorkingDays} working days`}
                    </small>
                </article>

                <article className={css.summaryCard}>
                    <span>{isFullTimeEmploymentMonth ? 'Bonus' : isCurrentVisibleMonth ? 'Remaining salary' : 'Working days planned'}</span>
                    <strong>{isFullTimeEmploymentMonth ? formatCurrency(fullTimeBonusDisplay, displayCurrency) : isCurrentVisibleMonth ? formatCurrency(hourlyRemainingDisplay, displayCurrency) : `${hourlyMonthSummary.totalWorkingDays} days`}</strong>
                    <small>
                        {isFullTimeEmploymentMonth
                            ? `${isBonusMonth ? 'Bonus month active' : 'No bonus for this month'}${monthlyBonusDisplay > 0 ? ` • Bonus amount ${formatCurrency(monthlyBonusDisplay, displayCurrency)}` : ''}`
                            : isCurrentVisibleMonth
                                ? `${hourlyMonthSummary.remainingWorkingDays} working days remaining in ${format(visibleMonth, 'MMMM yyyy')}`
                                : visibleMonthHasData
                                    ? `${hourlyMonthSummary.totalWorkingHours.toFixed(2)} planned hours at ${calendarState.workingHoursPerDay} h/day`
                                    : 'No work data is available before April 2026'}
                    </small>
                </article>

                {!isFullTimeEmploymentMonth && (
                    <article className={css.summaryCard}>
                        <span>{isCurrentVisibleMonth ? 'Total month salary' : 'Visible month working hours'}</span>
                        <strong>{isCurrentVisibleMonth ? formatCurrency(hourlyTotalDisplay, displayCurrency) : `${hourlyMonthSummary.totalWorkingHours.toFixed(2)} h`}</strong>
                        <small>
                            {isCurrentVisibleMonth
                                ? `Earned + remaining in ${format(visibleMonth, 'MMMM yyyy')}`
                                : `${hourlyMonthSummary.totalWorkingDays} working days at ${calendarState.workingHoursPerDay} h/day`}
                        </small>
                    </article>
                )}

                <article className={css.summaryCard}>
                    <span>Holiday set</span>
                    <strong>{countryFlags[calendarState.holidayCountry]} {countryLabels[calendarState.holidayCountry]}</strong>
                    <small>Holiday cells are highlighted and labeled</small>
                </article>

                <article className={css.summaryCard}>
                    <span>Holiday set</span>
                    <strong>{countryFlags[calendarState.holidayCountry]} {countryLabels[calendarState.holidayCountry]}</strong>
                    <small>Holiday cells are highlighted and labeled</small>
                </article>
            </div>

            <div className={css.calendarTools}>
                <div className={css.rangeCard}>
                    <div className={css.selectionHeading}>7-day window</div>
                    <div className={css.selectionMeta}>Drag the highlighted block on the calendar to move the selected 7-day period.</div>
                    <div className={css.rangeSummary}>
                        <strong>
                            {selectedWindowSummary
                                ? `${format(selectedWindowSummary.startDate, 'd MMM yyyy')} to ${format(selectedWindowSummary.endDate, 'd MMM yyyy')}`
                                : 'No window selected'}
                        </strong>
                        <small>
                            {selectedWindowSummary
                                ? `${selectedWindowSummary.totalHours.toFixed(2)} total hours in this 7-day period`
                                : 'The slider is unavailable until a month is loaded'}
                        </small>
                    </div>
                </div>

                <div className={`${css.complianceBanner} ${visibleMonthCompliance.isLegal ? css.complianceBannerLegal : css.complianceBannerIllegal}`.trim()}>
                    <strong>{visibleMonthCompliance.isLegal ? '✓ Legal Shifts' : 'Illegal Shifts'}</strong>
                    <span>
                        {visibleMonthCompliance.isLegal
                            ? 'Every 7-day window that overlaps this month stays at or below 28 hours.'
                            : `${visibleMonthCompliance.violatingWindows.length} overlapping 7-day window(s) exceed 28 hours.`}
                    </span>
                </div>
            </div>

            <div className={css.calendarCard}>
                <div className={css.weekRow}>
                    {weekDays.map((day) => (
                        <div key={day} className={`${css.weekDay} ${day === 'Sat' ? css.saturday : ''} ${day === 'Sun' ? css.sunday : ''}`.trim()}>{day}</div>
                    ))}
                </div>

                <div className={css.dayGrid}>
                    {days.map((day, index) => {
                        const outsideMonth = !isSameMonth(day, visibleMonth);
                        const dayIso = toIsoDate(day);
                        const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                        const hasWorkData = day >= WORK_DATA_START_DATE;
                        const dayShift = hasWorkData ? getDayShiftInfoForDate(day, calendarState) : null;
                        const holidayInfo = dayShift?.holidayInfo ?? null;
                        const working = dayShift?.working ?? false;
                        const dayIsSaturday = day.getDay() === 6;
                        const dayIsSunday = day.getDay() === 0;
                        const isInSelectedWindow = selectedWindowDaySet.has(dayIso);

                        return (
                            <button
                                key={dayIso}
                                type="button"
                                data-day-index={index}
                                className={`${css.dayCell} ${outsideMonth ? css.outsideMonth : ''} ${isSelected ? css.selectedDay : ''} ${isInSelectedWindow ? `${css.windowDay} ${isWindowDragging ? css.windowDayDragging : ''}`.trim() : ''} ${holidayInfo ? css.holidayCell : ''} ${hasWorkData ? (working ? css.dayCellWorking : css.dayCellOff) : css.dayCellNoData} ${dayIsSaturday ? css.saturdayCell : ''} ${dayIsSunday ? css.sundayCell : ''}`.trim()}
                                onClick={() => {
                                    setSelectedWindowIndex(index);
                                    handleCalendarDayClick(dayIso);
                                }}
                                onPointerDown={(event) => {
                                    beginWindowDrag(event.pointerId, index);
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                }}
                                onPointerMove={(event) => {
                                    if (!isWindowDragging) {
                                        return;
                                    }

                                    updateWindowDrag(event.pointerId, event.clientX, event.clientY);
                                }}
                                onPointerUp={(event) => {
                                    endWindowDrag(event.pointerId, event.currentTarget);
                                }}
                                onPointerCancel={(event) => {
                                    endWindowDrag(event.pointerId, event.currentTarget);
                                }}
                            >
                                <span className={css.dayTopRow}>
                                    <span className={css.dayNumber}>{format(day, 'd')}</span>
                                    <span className={`${css.dayBadge} ${hasWorkData ? (working ? css.dayBadgeWorking : css.dayBadgeOff) : css.dayBadgeNoData}`.trim()}>{hasWorkData ? (working ? 'Working' : 'Off') : 'No data'}</span>
                                </span>

                                {holidayInfo ? (
                                    <span className={css.holidayName}>{holidayInfo.name}</span>
                                ) : (
                                    <>
                                        <span className={css.dayTitle}>{!hasWorkData ? 'No work data' : dayShift?.title}</span>
                                        <span className={css.dayNote}>{!hasWorkData ? 'No work data' : `${dayShift?.hours} h`}</span>
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};