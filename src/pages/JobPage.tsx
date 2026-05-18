import * as React from 'react';
import { addMonths, endOfMonth, format, isSameDay, isSameMonth, parseISO, startOfDay, startOfMonth, subMonths } from 'date-fns';
import { getHolidayInfoForDate, getMonthGridDays, isWorkingDay } from '../utils/jobCalendar';
import { CurrencyCode, JobCalendarState, JobHolidayCountry } from '../utils/portalTypes';
import { usePersistedState } from '../utils/storage';
import css from './JobPage.module.css';

const STORAGE_DEFAULT: JobCalendarState = {
    visibleMonthIso: format(startOfMonth(new Date()), 'yyyy-MM-01'),
    selectedDayIso: null,
    holidayCountry: 'SE',
    wagePerHourSek: 175,
    workingHoursPerDay: 8,
    monthlySalarySek: 0,
    monthlyBonusSek: 0,
    bonusMonthOverrides: {},
    workingDayOverrides: {},
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
    workingDayOverrides: Object.entries(state.workingDayOverrides ?? {}).reduce<Record<string, boolean>>((acc, [dateIso, value]) => {
        const date = parseISO(dateIso);
        if (date >= WORK_DATA_START_DATE) {
            acc[dateIso] = value;
        }
        return acc;
    }, {}),
});

export const JobPage: React.FC = () => {
    const [storedCalendarState, setStoredCalendarState] = usePersistedState<JobCalendarState>('job-calendar-state', STORAGE_DEFAULT);
    const [displayCurrency, setDisplayCurrency] = usePersistedState<CurrencyCode>('job-display-currency', 'SEK');
    const [jpyPerSekRate, setJpyPerSekRate] = usePersistedState<number>('global-jpy-per-sek-rate', 14.8);
    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const calendarState = React.useMemo(() => normalizeCalendarState(storedCalendarState), [storedCalendarState]);

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

    const monthDays = React.useMemo(() => days.filter((day) => isSameMonth(day, visibleMonth)), [days, visibleMonth]);
    const monthDaysWithData = React.useMemo(() => monthDays.filter((day) => day >= WORK_DATA_START_DATE), [monthDays]);

    const selectedDayHasData = selectedDay ? selectedDay >= WORK_DATA_START_DATE : false;
    const selectedHoliday = selectedDay && selectedDayHasData ? getHolidayInfoForDate(selectedDay, calendarState.holidayCountry) : null;

    const currentMonthSummary = React.useMemo(() => {
        const totalWorkingDays = monthDaysWithData.filter((day) => isWorkingDay(day, calendarState)).length;
        const earnedWorkingDays = monthDaysWithData.filter((day) => day <= today && isWorkingDay(day, calendarState)).length;
        const remainingWorkingDays = monthDaysWithData.filter((day) => day > today && isWorkingDay(day, calendarState)).length;

        const totalWorkingHours = totalWorkingDays * calendarState.workingHoursPerDay;
        const earnedWorkingHours = earnedWorkingDays * calendarState.workingHoursPerDay;
        const remainingWorkingHours = remainingWorkingDays * calendarState.workingHoursPerDay;

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

    const setSelectedDayWorkingState = (working: boolean): void => {
        if (!selectedDay || selectedDay < WORK_DATA_START_DATE) {
            return;
        }

        const selectedDayIso = toIsoDate(selectedDay);

        updateCalendarState((previous) => ({
            ...previous,
            workingDayOverrides: {
                ...previous.workingDayOverrides,
                [selectedDayIso]: working,
            },
        }));
    };

    const setVisibleMonthWorkingState = (working: boolean): void => {
        const monthDays = days.filter((day) => isSameMonth(day, visibleMonth));

        updateCalendarState((previous) => {
            const nextOverrides = { ...previous.workingDayOverrides };

            monthDays.forEach((day) => {
                const dayIso = toIsoDate(day);

                if (day < WORK_DATA_START_DATE) {
                    delete nextOverrides[dayIso];
                    return;
                }

                if (!working) {
                    nextOverrides[dayIso] = false;
                    return;
                }

                const holidayInfo = getHolidayInfoForDate(day, previous.holidayCountry);
                const suitableForWork = day.getDay() !== 0 && day.getDay() !== 6 && !holidayInfo;
                nextOverrides[dayIso] = suitableForWork;
            });

            return {
                ...previous,
                workingDayOverrides: nextOverrides,
            };
        });
    };

    const selectedDayStatus = selectedDay && selectedDayHasData ? isWorkingDay(selectedDay, calendarState) : null;

    const hourlyMonthSummary = React.useMemo(() => {
        const totalWorkingDays = monthDaysWithData.filter((day) => isWorkingDay(day, calendarState)).length;
        const earnedWorkingDays = monthDaysWithData.filter((day) => day <= today && isWorkingDay(day, calendarState)).length;
        const remainingWorkingDays = monthDaysWithData.filter((day) => day > today && isWorkingDay(day, calendarState)).length;

        const totalWorkingHours = totalWorkingDays * calendarState.workingHoursPerDay;
        const earnedWorkingHours = earnedWorkingDays * calendarState.workingHoursPerDay;
        const remainingWorkingHours = remainingWorkingDays * calendarState.workingHoursPerDay;

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
                                            {selectedDayStatus ? 'Working day' : 'Non-working day'}
                                        </>
                                    ) : (
                                        'No work data before April 2026'
                                    )
                                ) : (
                                    'Click a day to inspect or update it'
                                )}
                            </div>

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

            <div className={css.calendarCard}>
                <div className={css.weekRow}>
                    {weekDays.map((day) => (
                        <div key={day} className={`${css.weekDay} ${day === 'Sat' ? css.saturday : ''} ${day === 'Sun' ? css.sunday : ''}`.trim()}>{day}</div>
                    ))}
                </div>

                <div className={css.dayGrid}>
                    {days.map((day) => {
                        const outsideMonth = !isSameMonth(day, visibleMonth);
                        const dayIso = toIsoDate(day);
                        const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                        const hasWorkData = day >= WORK_DATA_START_DATE;
                        const holidayInfo = hasWorkData ? getHolidayInfoForDate(day, calendarState.holidayCountry) : null;
                        const working = hasWorkData ? isWorkingDay(day, calendarState) : false;
                        const dayIsSaturday = day.getDay() === 6;
                        const dayIsSunday = day.getDay() === 0;

                        return (
                            <button
                                key={dayIso}
                                type="button"
                                className={`${css.dayCell} ${outsideMonth ? css.outsideMonth : ''} ${isSelected ? css.selectedDay : ''} ${holidayInfo ? css.holidayCell : ''} ${hasWorkData ? (working ? css.dayCellWorking : css.dayCellOff) : css.dayCellNoData} ${dayIsSaturday ? css.saturdayCell : ''} ${dayIsSunday ? css.sundayCell : ''}`.trim()}
                                onClick={() => setSelectedDay(dayIso)}
                            >
                                <span className={css.dayTopRow}>
                                    <span className={css.dayNumber}>{format(day, 'd')}</span>
                                    <span className={`${css.dayBadge} ${hasWorkData ? (working ? css.dayBadgeWorking : css.dayBadgeOff) : css.dayBadgeNoData}`.trim()}>{hasWorkData ? (working ? 'Working' : 'Off') : 'No data'}</span>
                                </span>

                                {holidayInfo ? (
                                    <span className={css.holidayName}>{holidayInfo.name}</span>
                                ) : (
                                    <span className={css.dayNote}>{!hasWorkData ? 'No work data' : dayIsSunday || dayIsSaturday ? 'Weekend' : ' '}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};