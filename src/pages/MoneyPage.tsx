/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars, operator-linebreak, indent, react/jsx-indent, react/jsx-indent-props */
import * as React from 'react';
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { addMonths, eachDayOfInterval, endOfMonth, format, parseISO, startOfDay, startOfMonth, subMonths } from 'date-fns';
import { usePersistedState } from '../utils/storage';
import { CurrencyCode, JobCalendarState, MoneyProfileMode, MoneyState } from '../utils/portalTypes';
import { getWorkingHoursForDate, isWorkingDay } from '../utils/jobCalendar';
import css from './MoneyPage.module.css';

export const DEFAULT_MONEY_STATE: MoneyState = {
    sekTotal: 0,
    jpyTotal: 0,
    monthlyIncomeSek: 0,
    monthlyExpensesSek: 0,
    moneyProfileMode: 'Albin',
    jpyPerSek: 0,
    visibleMonthIso: format(startOfMonth(new Date()), 'yyyy-MM-01'),
    monthlyAdditionalIncomeByMonthSek: {},
    monthlyIncomeByMonthSek: {},
    monthlyExpensesByMonthSek: {},
    seMunicipalTaxRatePct: 0,
    seStateTaxThresholdSek: 0,
    seStateTaxRatePct: 0,
    sePensionRatePct: 0,
    seBasicDeductionSek: 0,
    seJobTaxCreditMaxSek: 0,
    sePublicServiceFeeRatePct: 0,
    sePublicServiceFeeMaxSek: 0,
    seBurialFeeRatePct: 0,
    seChurchFeeRatePct: 0,
    seIncludeChurchFee: false,
    jpHealthInsuranceRatePct: 0,
    jpPensionRatePct: 0,
    jpUnemploymentRatePct: 0,
    jpLongTermCareRatePct: 0,
    jpAge: 0,
    jpResidentTaxRatePct: 0,
    jpResidentPerCapitaAnnualJpy: 0,
    jpBasicDeductionNationalJpy: 0,
    jpBasicDeductionResidentJpy: 0,
    jpDependentDeductionAnnualJpy: 0,
    csnEnabled: false,
    csnRepaymentModel: 'annuity',
    csnOutstandingPrincipalSek: 0,
    csnAnnualInterestRatePct: 0,
    csnAdminFeeAnnualSek: 0,
    csnRepaymentYears: 0,
    csnRepaymentStartMonthIso: format(startOfMonth(new Date()), 'yyyy-MM-01'),
    showTaxProfile: false,
    showCsnProfile: false,
};

export const JOB_STATE_DEFAULT: JobCalendarState = {
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

const WORK_DATA_START_DATE = parseISO('2026-04-01');
const FULL_TIME_EMPLOYMENT_START_DATE = parseISO('2027-04-01');

type ProjectionPoint = {
    label: string;
    monthIso: string;
    total: number;
    income: number;
    expenses: number;
    tax: number;
    loan: number;
    net: number;
    isBaseline: boolean;
};

type TaxLine = {
    label: string;
    amount: number;
};

type TaxBreakdown = {
    effectiveRate: number;
    totalTax: number;
    lines: TaxLine[];
};

type MoneyStateNormalized = MoneyState & {
    visibleMonthIso: string;
    monthlyAdditionalIncomeByMonthSek: Record<string, number>;
    monthlyIncomeByMonthSek: Record<string, number>;
    monthlyExpensesByMonthSek: Record<string, number>;
    seMunicipalTaxRatePct: number;
    seStateTaxThresholdSek: number;
    seStateTaxRatePct: number;
    sePensionRatePct: number;
    seBasicDeductionSek: number;
    seJobTaxCreditMaxSek: number;
    sePublicServiceFeeRatePct: number;
    sePublicServiceFeeMaxSek: number;
    seBurialFeeRatePct: number;
    seChurchFeeRatePct: number;
    seIncludeChurchFee: boolean;
    jpHealthInsuranceRatePct: number;
    jpPensionRatePct: number;
    jpUnemploymentRatePct: number;
    jpLongTermCareRatePct: number;
    jpAge: number;
    jpResidentTaxRatePct: number;
    jpResidentPerCapitaAnnualJpy: number;
    jpBasicDeductionNationalJpy: number;
    jpBasicDeductionResidentJpy: number;
    jpDependentDeductionAnnualJpy: number;
    csnEnabled: boolean;
    csnRepaymentModel: 'annuity' | 'fixed';
    csnOutstandingPrincipalSek: number;
    csnAnnualInterestRatePct: number;
    csnAdminFeeAnnualSek: number;
    csnRepaymentYears: number;
    csnRepaymentStartMonthIso: string;
    showTaxProfile: boolean;
    showCsnProfile: boolean;
};

type TaxProfile = {
    seMunicipalTaxRate: number;
    seStateTaxThresholdSek: number;
    seStateTaxRate: number;
    sePensionRate: number;
    seBasicDeductionSek: number;
    seJobTaxCreditMaxSek: number;
    sePublicServiceFeeRate: number;
    sePublicServiceFeeMaxSek: number;
    seBurialFeeRate: number;
    seChurchFeeRate: number;
    seIncludeChurchFee: boolean;
    jpHealthInsuranceRate: number;
    jpPensionRate: number;
    jpUnemploymentRate: number;
    jpLongTermCareRate: number;
    jpAge: number;
    jpResidentTaxRate: number;
    jpResidentPerCapitaAnnualJpy: number;
    jpBasicDeductionNationalJpy: number;
    jpBasicDeductionResidentJpy: number;
    jpDependentDeductionAnnualJpy: number;
};

const moneyProfileModeLabels: Record<MoneyProfileMode, string> = {
    Albin: 'Albin',
    Misato: 'Misato',
    Both: 'Both',
};

const isMoneyProfileMode = (value: unknown): value is MoneyProfileMode => (
    value === 'Albin'
    || value === 'Misato'
    || value === 'Both'
);

const currencyFormatter = (value: number, currency: CurrencyCode): string => new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
}).format(value);

export const toMonthIso = (date: Date): string => format(startOfMonth(date), 'yyyy-MM-01');

export const normalizeMoneyState = (state?: Partial<MoneyState>): MoneyStateNormalized => {
    const visibleMonthIso = state?.visibleMonthIso ?? toMonthIso(new Date());

    return {
        ...DEFAULT_MONEY_STATE,
        ...state,
        moneyProfileMode: isMoneyProfileMode(state?.moneyProfileMode)
            ? state?.moneyProfileMode
            : (DEFAULT_MONEY_STATE.moneyProfileMode ?? 'Albin'),
        visibleMonthIso,
        monthlyAdditionalIncomeByMonthSek: state?.monthlyAdditionalIncomeByMonthSek ?? {},
        monthlyIncomeByMonthSek: state?.monthlyIncomeByMonthSek ?? {},
        monthlyExpensesByMonthSek: state?.monthlyExpensesByMonthSek ?? {},
        seMunicipalTaxRatePct: state?.seMunicipalTaxRatePct ?? DEFAULT_MONEY_STATE.seMunicipalTaxRatePct ?? 0,
        seStateTaxThresholdSek: state?.seStateTaxThresholdSek ?? DEFAULT_MONEY_STATE.seStateTaxThresholdSek ?? 0,
        seStateTaxRatePct: state?.seStateTaxRatePct ?? DEFAULT_MONEY_STATE.seStateTaxRatePct ?? 0,
        sePensionRatePct: state?.sePensionRatePct ?? DEFAULT_MONEY_STATE.sePensionRatePct ?? 0,
        seBasicDeductionSek: state?.seBasicDeductionSek ?? DEFAULT_MONEY_STATE.seBasicDeductionSek ?? 0,
        seJobTaxCreditMaxSek: state?.seJobTaxCreditMaxSek ?? DEFAULT_MONEY_STATE.seJobTaxCreditMaxSek ?? 0,
        sePublicServiceFeeRatePct: state?.sePublicServiceFeeRatePct ?? DEFAULT_MONEY_STATE.sePublicServiceFeeRatePct ?? 0,
        sePublicServiceFeeMaxSek: state?.sePublicServiceFeeMaxSek ?? DEFAULT_MONEY_STATE.sePublicServiceFeeMaxSek ?? 0,
        seBurialFeeRatePct: state?.seBurialFeeRatePct ?? DEFAULT_MONEY_STATE.seBurialFeeRatePct ?? 0,
        seChurchFeeRatePct: state?.seChurchFeeRatePct ?? DEFAULT_MONEY_STATE.seChurchFeeRatePct ?? 0,
        seIncludeChurchFee: state?.seIncludeChurchFee ?? DEFAULT_MONEY_STATE.seIncludeChurchFee ?? false,
        jpHealthInsuranceRatePct: state?.jpHealthInsuranceRatePct ?? DEFAULT_MONEY_STATE.jpHealthInsuranceRatePct ?? 0,
        jpPensionRatePct: state?.jpPensionRatePct ?? DEFAULT_MONEY_STATE.jpPensionRatePct ?? 0,
        jpUnemploymentRatePct: state?.jpUnemploymentRatePct ?? DEFAULT_MONEY_STATE.jpUnemploymentRatePct ?? 0,
        jpLongTermCareRatePct: state?.jpLongTermCareRatePct ?? DEFAULT_MONEY_STATE.jpLongTermCareRatePct ?? 0,
        jpAge: state?.jpAge ?? DEFAULT_MONEY_STATE.jpAge ?? 0,
        jpResidentTaxRatePct: state?.jpResidentTaxRatePct ?? DEFAULT_MONEY_STATE.jpResidentTaxRatePct ?? 0,
        jpResidentPerCapitaAnnualJpy: state?.jpResidentPerCapitaAnnualJpy ?? DEFAULT_MONEY_STATE.jpResidentPerCapitaAnnualJpy ?? 0,
        jpBasicDeductionNationalJpy: state?.jpBasicDeductionNationalJpy ?? DEFAULT_MONEY_STATE.jpBasicDeductionNationalJpy ?? 0,
        jpBasicDeductionResidentJpy: state?.jpBasicDeductionResidentJpy ?? DEFAULT_MONEY_STATE.jpBasicDeductionResidentJpy ?? 0,
        jpDependentDeductionAnnualJpy: state?.jpDependentDeductionAnnualJpy ?? DEFAULT_MONEY_STATE.jpDependentDeductionAnnualJpy ?? 0,
        csnEnabled: state?.csnEnabled ?? DEFAULT_MONEY_STATE.csnEnabled ?? false,
        csnRepaymentModel: state?.csnRepaymentModel ?? DEFAULT_MONEY_STATE.csnRepaymentModel ?? 'annuity',
        csnOutstandingPrincipalSek: state?.csnOutstandingPrincipalSek ?? DEFAULT_MONEY_STATE.csnOutstandingPrincipalSek ?? 0,
        csnAnnualInterestRatePct: state?.csnAnnualInterestRatePct ?? DEFAULT_MONEY_STATE.csnAnnualInterestRatePct ?? 0,
        csnAdminFeeAnnualSek: state?.csnAdminFeeAnnualSek ?? DEFAULT_MONEY_STATE.csnAdminFeeAnnualSek ?? 0,
        csnRepaymentYears: state?.csnRepaymentYears ?? DEFAULT_MONEY_STATE.csnRepaymentYears ?? 0,
        csnRepaymentStartMonthIso: state?.csnRepaymentStartMonthIso ?? DEFAULT_MONEY_STATE.csnRepaymentStartMonthIso ?? toMonthIso(new Date()),
        showTaxProfile: state?.showTaxProfile ?? DEFAULT_MONEY_STATE.showTaxProfile ?? false,
        showCsnProfile: state?.showCsnProfile ?? DEFAULT_MONEY_STATE.showCsnProfile ?? false,
    };
};

const getAlbinMonthlyIncomeSek = (state: MoneyStateNormalized, monthIso: string): number => (
    getMonthlyValue(state.monthlyAdditionalIncomeByMonthSek, monthIso, state.monthlyIncomeSek)
);

const getMisatoMonthlyIncomeSek = (state: MoneyStateNormalized, monthIso: string): number => (
    getMonthlyValue(state.monthlyIncomeByMonthSek, monthIso, state.monthlyIncomeSek)
);

export const getModeMonthlyIncomeSek = (state: MoneyStateNormalized, monthIso: string, mode: MoneyProfileMode): number => {
    if (mode === 'Albin') {
        return getAlbinMonthlyIncomeSek(state, monthIso);
    }

    if (mode === 'Misato') {
        return getMisatoMonthlyIncomeSek(state, monthIso);
    }

    return getAlbinMonthlyIncomeSek(state, monthIso) + getMisatoMonthlyIncomeSek(state, monthIso);
};

const getAlbinMonthlyExpensesSek = (state: MoneyStateNormalized, monthIso: string): number => (
    getMonthlyValue(state.monthlyExpensesByMonthSek, monthIso, state.monthlyExpensesSek)
);

const getMisatoMonthlyExpensesSek = (state: MoneyStateNormalized): number => state.monthlyExpensesSek;

export const getModeMonthlyExpensesSek = (state: MoneyStateNormalized, monthIso: string, mode: MoneyProfileMode): number => {
    if (mode === 'Albin') {
        return getAlbinMonthlyExpensesSek(state, monthIso);
    }

    if (mode === 'Misato') {
        return getMisatoMonthlyExpensesSek(state);
    }

    return getAlbinMonthlyExpensesSek(state, monthIso) + getMisatoMonthlyExpensesSek(state);
};

export const buildTaxProfile = (state: MoneyStateNormalized): TaxProfile => ({
    seMunicipalTaxRate: state.seMunicipalTaxRatePct / 100,
    seStateTaxThresholdSek: state.seStateTaxThresholdSek,
    seStateTaxRate: state.seStateTaxRatePct / 100,
    sePensionRate: state.sePensionRatePct / 100,
    seBasicDeductionSek: state.seBasicDeductionSek,
    seJobTaxCreditMaxSek: state.seJobTaxCreditMaxSek,
    sePublicServiceFeeRate: state.sePublicServiceFeeRatePct / 100,
    sePublicServiceFeeMaxSek: state.sePublicServiceFeeMaxSek,
    seBurialFeeRate: state.seBurialFeeRatePct / 100,
    seChurchFeeRate: state.seChurchFeeRatePct / 100,
    seIncludeChurchFee: state.seIncludeChurchFee,
    jpHealthInsuranceRate: state.jpHealthInsuranceRatePct / 100,
    jpPensionRate: state.jpPensionRatePct / 100,
    jpUnemploymentRate: state.jpUnemploymentRatePct / 100,
    jpLongTermCareRate: state.jpLongTermCareRatePct / 100,
    jpAge: state.jpAge,
    jpResidentTaxRate: state.jpResidentTaxRatePct / 100,
    jpResidentPerCapitaAnnualJpy: state.jpResidentPerCapitaAnnualJpy,
    jpBasicDeductionNationalJpy: state.jpBasicDeductionNationalJpy,
    jpBasicDeductionResidentJpy: state.jpBasicDeductionResidentJpy,
    jpDependentDeductionAnnualJpy: state.jpDependentDeductionAnnualJpy,
});

export const getMonthlyValue = (map: Record<string, number>, monthIso: string, fallback: number): number => map[monthIso] ?? fallback;

export const normalizeJobState = (state?: Partial<JobCalendarState>): JobCalendarState => ({
    ...JOB_STATE_DEFAULT,
    ...state,
    bonusMonthOverrides: state?.bonusMonthOverrides ?? {},
    dayShiftOverrides: state?.dayShiftOverrides ?? {},
    workingDayOverrides: state?.workingDayOverrides ?? {},
    shiftPreset: state?.shiftPreset ?? null,
});

export const calculateJapanIncomeTax = (taxableAnnualJpy: number): number => {
    const taxable = Math.max(taxableAnnualJpy, 0);

    if (taxable <= 1_950_000) {
        return taxable * 0.05;
    }
    if (taxable <= 3_300_000) {
        return taxable * 0.10 - 97_500;
    }
    if (taxable <= 6_950_000) {
        return taxable * 0.20 - 427_500;
    }
    if (taxable <= 9_000_000) {
        return taxable * 0.23 - 636_000;
    }
    if (taxable <= 18_000_000) {
        return taxable * 0.33 - 1_536_000;
    }
    if (taxable <= 40_000_000) {
        return taxable * 0.40 - 2_796_000;
    }

    return taxable * 0.45 - 4_796_000;
};

export const calculateJapanEmploymentIncomeDeduction = (annualIncomeJpy: number): number => {
    if (annualIncomeJpy <= 1_625_000) {
        return 550_000;
    }
    if (annualIncomeJpy <= 1_800_000) {
        return annualIncomeJpy * 0.40 - 100_000;
    }
    if (annualIncomeJpy <= 3_600_000) {
        return annualIncomeJpy * 0.30 + 80_000;
    }
    if (annualIncomeJpy <= 6_600_000) {
        return annualIncomeJpy * 0.20 + 440_000;
    }
    if (annualIncomeJpy <= 8_500_000) {
        return annualIncomeJpy * 0.10 + 1_100_000;
    }

    return 1_950_000;
};

export const calculateMonthlyTaxBreakdown = (grossMonthlyIncome: number, currency: CurrencyCode, profile: TaxProfile): TaxBreakdown => {
    if (grossMonthlyIncome <= 0) {
        return {
            effectiveRate: 0,
            totalTax: 0,
            lines: [
                { label: 'Income tax', amount: 0 },
                { label: 'Health insurance', amount: 0 },
                { label: 'Pension', amount: 0 },
            ],
        };
    }

    if (currency === 'SEK') {
        const annualIncome = grossMonthlyIncome * 12;
        const municipalTaxRate = profile.seMunicipalTaxRate;
        const stateTaxThreshold = profile.seStateTaxThresholdSek;
        const stateTaxRate = profile.seStateTaxRate;
        const basicDeduction = profile.seBasicDeductionSek;
        const pensionRate = profile.sePensionRate;
        const pensionContributionCapIncome = 614_000;
        const jobTaxCredit = Math.min(annualIncome * 0.03, profile.seJobTaxCreditMaxSek);

        const pensionAnnual = Math.min(annualIncome, pensionContributionCapIncome) * pensionRate;
        const taxableAnnual = Math.max(annualIncome - basicDeduction, 0);
        const municipalAnnual = taxableAnnual * municipalTaxRate;
        const stateAnnual = Math.max(annualIncome - stateTaxThreshold, 0) * stateTaxRate;
        const burialFeeAnnual = taxableAnnual * profile.seBurialFeeRate;
        const churchFeeAnnual = profile.seIncludeChurchFee ? (taxableAnnual * profile.seChurchFeeRate) : 0;
        const publicServiceFeeAnnual = Math.min(taxableAnnual * profile.sePublicServiceFeeRate, profile.sePublicServiceFeeMaxSek);
        const healthAnnual = 0;
        const totalAnnual = Math.max(
            municipalAnnual
            + stateAnnual
            + pensionAnnual
            + burialFeeAnnual
            + churchFeeAnnual
            + publicServiceFeeAnnual
            + healthAnnual
            - jobTaxCredit,
            0,
        );

        const monthlyMunicipal = municipalAnnual / 12;
        const monthlyState = stateAnnual / 12;
        const monthlyPension = pensionAnnual / 12;
        const monthlyBurialFee = burialFeeAnnual / 12;
        const monthlyChurchFee = churchFeeAnnual / 12;
        const monthlyPublicServiceFee = publicServiceFeeAnnual / 12;
        const monthlyHealth = healthAnnual / 12;
        const monthlyCredit = jobTaxCredit / 12;
        const totalTax = totalAnnual / 12;

        return {
            effectiveRate: totalTax / grossMonthlyIncome,
            totalTax,
            lines: [
                { label: 'Municipal tax', amount: monthlyMunicipal },
                { label: 'State tax', amount: monthlyState },
                { label: 'Pension contribution', amount: monthlyPension },
                { label: 'Burial fee', amount: monthlyBurialFee },
                { label: 'Church fee', amount: monthlyChurchFee },
                { label: 'Public service fee', amount: monthlyPublicServiceFee },
                { label: 'Health insurance', amount: monthlyHealth },
                { label: 'Tax credit', amount: -monthlyCredit },
            ],
        };
    }

    const annualIncome = grossMonthlyIncome * 12;
    const healthRate = profile.jpHealthInsuranceRate;
    const pensionRate = profile.jpPensionRate;
    const unemploymentRate = profile.jpUnemploymentRate;
    const longTermCareRate = profile.jpAge >= 40 && profile.jpAge <= 64 ? profile.jpLongTermCareRate : 0;
    const basicDeductionNational = profile.jpBasicDeductionNationalJpy;
    const basicDeductionResident = profile.jpBasicDeductionResidentJpy;
    const dependentDeduction = profile.jpDependentDeductionAnnualJpy;

    const employmentDeduction = calculateJapanEmploymentIncomeDeduction(annualIncome);
    const socialAnnual = annualIncome * (healthRate + pensionRate + unemploymentRate + longTermCareRate);
    const taxableNational = Math.max(annualIncome - employmentDeduction - basicDeductionNational - dependentDeduction - socialAnnual, 0);
    const taxableResident = Math.max(annualIncome - employmentDeduction - basicDeductionResident - dependentDeduction - socialAnnual, 0);

    const nationalIncomeAnnual = calculateJapanIncomeTax(taxableNational);
    const reconstructionAnnual = nationalIncomeAnnual * 0.021;
    const residentAnnual = taxableResident * profile.jpResidentTaxRate + profile.jpResidentPerCapitaAnnualJpy;
    const healthAnnual = annualIncome * healthRate;
    const pensionAnnual = annualIncome * pensionRate;
    const unemploymentAnnual = annualIncome * unemploymentRate;
    const longTermCareAnnual = annualIncome * longTermCareRate;

    const totalAnnual = nationalIncomeAnnual + reconstructionAnnual + residentAnnual + healthAnnual + pensionAnnual + unemploymentAnnual + longTermCareAnnual;
    const totalTax = totalAnnual / 12;

    return {
        effectiveRate: totalTax / grossMonthlyIncome,
        totalTax,
        lines: [
            { label: 'National income tax', amount: nationalIncomeAnnual / 12 },
            { label: 'Reconstruction surtax', amount: reconstructionAnnual / 12 },
            { label: 'Resident tax', amount: residentAnnual / 12 },
            { label: 'Health insurance', amount: healthAnnual / 12 },
            { label: 'Pension contribution', amount: pensionAnnual / 12 },
            { label: 'Unemployment insurance', amount: unemploymentAnnual / 12 },
            { label: 'Long-term care insurance', amount: longTermCareAnnual / 12 },
            { label: 'Resident per-capita levy', amount: profile.jpResidentPerCapitaAnnualJpy / 12 },
        ],
    };
};

export const getExpectedJobSalaryForMonth = (monthDate: Date, jobState: JobCalendarState): number => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    if (monthEnd < WORK_DATA_START_DATE) {
        return 0;
    }

    if (monthStart >= FULL_TIME_EMPLOYMENT_START_DATE) {
        const monthKey = toMonthIso(monthStart);
        const bonus = jobState.bonusMonthOverrides[monthKey] ? jobState.monthlyBonusSek : 0;
        return jobState.monthlySalarySek + bonus;
    }

    const intervalStart = monthStart < WORK_DATA_START_DATE ? WORK_DATA_START_DATE : monthStart;
    const intervalDays = eachDayOfInterval({ start: intervalStart, end: monthEnd });
    const workingDays = intervalDays.filter((day) => isWorkingDay(day, jobState)).length;
    const workingHours = intervalDays.reduce((total, day) => total + getWorkingHoursForDate(day, jobState), 0);

    return workingHours * jobState.wagePerHourSek;
};

export const getSalaryPaidInMonth = (monthDate: Date, jobState: JobCalendarState): number => {
    const salaryEarnedMonth = subMonths(startOfMonth(monthDate), 1);
    return getExpectedJobSalaryForMonth(salaryEarnedMonth, jobState);
};

export const getFiscalYearStartMonth = (date: Date): Date => {
    const year = date.getFullYear();
    const monthIndex = date.getMonth();

    return monthIndex >= 3 ? new Date(year, 3, 1) : new Date(year - 1, 3, 1);
};

export const getMonthDiff = (start: Date, end: Date): number => (
    (end.getFullYear() - start.getFullYear()) * 12
    + (end.getMonth() - start.getMonth())
);

type MonthCashflow = {
    incomeDisplay: number;
    expensesDisplay: number;
    taxDisplay: number;
    loanDisplay: number;
    netDisplay: number;
    netSek: number;
};

type CsnSimulationMonth = {
    monthIso: string;
    paymentSek: number;
    interestSek: number;
    principalAmortizationSek: number;
    remainingPrincipalSek: number;
};

export const getPmt = (rate: number, periods: number, principal: number): number => {
    if (periods <= 0) {
        return 0;
    }

    if (rate <= 0) {
        return principal / periods;
    }

    const factor = Math.pow(1 + rate, periods);
    return principal * ((rate * factor) / (factor - 1));
};

export const simulateCsnSchedule = (state: MoneyStateNormalized, maxMonth: Date): Record<string, CsnSimulationMonth> => {
    if (!state.csnEnabled || state.csnOutstandingPrincipalSek <= 0) {
        return {};
    }

    const nowMonth = startOfMonth(new Date());
    const startMonth = startOfMonth(parseISO(state.csnRepaymentStartMonthIso));
    const endMonth = startOfMonth(maxMonth);
    const monthlyRate = Math.max(state.csnAnnualInterestRatePct, 0) / 100 / 12;
    const monthlyAdminFee = Math.max(state.csnAdminFeeAnnualSek, 0) / 12;
    const totalMonths = Math.max(Math.round(state.csnRepaymentYears * 12), 1);
    const schedule: Record<string, CsnSimulationMonth> = {};

    let balance = Math.max(state.csnOutstandingPrincipalSek, 0);
    let processedMonths = 0;

    for (let cursor = nowMonth; cursor <= endMonth; cursor = addMonths(cursor, 1)) {
        const monthIso = toMonthIso(cursor);

        if (cursor < startMonth || balance <= 0) {
            schedule[monthIso] = {
                monthIso,
                paymentSek: 0,
                interestSek: 0,
                principalAmortizationSek: 0,
                remainingPrincipalSek: Math.max(balance, 0),
            };
            continue;
        }

        const interestSek = balance * monthlyRate;
        const remainingMonths = Math.max(totalMonths - processedMonths, 1);

        let principalPayment = 0;
        if (state.csnRepaymentModel === 'fixed') {
            principalPayment = Math.min(balance, state.csnOutstandingPrincipalSek / totalMonths);
        } else {
            const annuityPayment = getPmt(monthlyRate, remainingMonths, balance);
            principalPayment = Math.min(balance, Math.max(annuityPayment - interestSek, 0));
        }

        const paymentSek = interestSek + principalPayment + monthlyAdminFee;
        balance = Math.max(balance - principalPayment, 0);
        processedMonths += 1;

        schedule[monthIso] = {
            monthIso,
            paymentSek,
            interestSek,
            principalAmortizationSek: principalPayment,
            remainingPrincipalSek: balance,
        };
    }

    return schedule;
};

const mergeTaxLines = (leftLines: TaxLine[], rightLines: TaxLine[]): TaxLine[] => {
    const totalsByLabel = new Map<string, number>();

    [...leftLines, ...rightLines].forEach((line) => {
        totalsByLabel.set(line.label, (totalsByLabel.get(line.label) ?? 0) + line.amount);
    });

    return Array.from(totalsByLabel.entries()).map(([label, amount]) => ({ label, amount }));
};

type ProfileIncomeComponentsSek = {
    salaryFromJobSek: number;
    albinIncomeSek: number;
    misatoIncomeSek: number;
    totalIncomeSek: number;
};

export const getProfileIncomeComponentsSek = (
    state: MoneyStateNormalized,
    monthDate: Date,
    jobState: JobCalendarState,
    profileMode: MoneyProfileMode,
): ProfileIncomeComponentsSek => {
    const monthIso = toMonthIso(monthDate);
    const salaryFromJobSek = profileMode === 'Misato' ? 0 : getSalaryPaidInMonth(monthDate, jobState);
    const albinIncomeSek = profileMode === 'Misato' ? 0 : getAlbinMonthlyIncomeSek(state, monthIso);
    const misatoIncomeSek = profileMode === 'Albin' ? 0 : getMisatoMonthlyIncomeSek(state, monthIso);

    return {
        salaryFromJobSek,
        albinIncomeSek,
        misatoIncomeSek,
        totalIncomeSek: salaryFromJobSek + albinIncomeSek + misatoIncomeSek,
    };
};

export const calculateModeTaxBreakdown = (
    profileMode: MoneyProfileMode,
    incomeComponentsSek: ProfileIncomeComponentsSek,
    displayCurrency: CurrencyCode,
    safeRate: number,
    taxProfile: TaxProfile,
): TaxBreakdown => {
    const albinGrossDisplay = fromSekAmount(
        incomeComponentsSek.salaryFromJobSek + incomeComponentsSek.albinIncomeSek,
        displayCurrency,
        safeRate,
    );
    const misatoGrossDisplay = fromSekAmount(incomeComponentsSek.misatoIncomeSek, displayCurrency, safeRate);
    const totalIncomeDisplay = albinGrossDisplay + misatoGrossDisplay;

    if (profileMode === 'Both') {
        const albinTax = calculateMonthlyTaxBreakdown(albinGrossDisplay, displayCurrency, taxProfile);
        const misatoTax = calculateMonthlyTaxBreakdown(misatoGrossDisplay, displayCurrency, taxProfile);
        const totalTax = albinTax.totalTax + misatoTax.totalTax;

        return {
            effectiveRate: totalIncomeDisplay > 0 ? totalTax / totalIncomeDisplay : 0,
            totalTax,
            lines: mergeTaxLines(albinTax.lines, misatoTax.lines),
        };
    }

    return calculateMonthlyTaxBreakdown(totalIncomeDisplay, displayCurrency, taxProfile);
};

export const calculateMonthCashflow = (
    state: MoneyStateNormalized,
    monthDate: Date,
    safeRate: number,
    displayCurrency: CurrencyCode,
    jobState: JobCalendarState,
    taxProfile: TaxProfile,
    csnSchedule: Record<string, CsnSimulationMonth>,
    profileMode: MoneyProfileMode,
): MonthCashflow => {
    const monthIso = toMonthIso(monthDate);
    const incomeComponentsSek = getProfileIncomeComponentsSek(state, monthDate, jobState, profileMode);
    const expensesSek = getModeMonthlyExpensesSek(state, monthIso, profileMode);
    const incomeDisplay = fromSekAmount(incomeComponentsSek.totalIncomeSek, displayCurrency, safeRate);
    const expensesDisplay = fromSekAmount(expensesSek, displayCurrency, safeRate);
    const taxBreakdown = calculateModeTaxBreakdown(profileMode, incomeComponentsSek, displayCurrency, safeRate, taxProfile);
    const csnPaymentSek = profileMode === 'Misato' ? 0 : (csnSchedule[monthIso]?.paymentSek ?? 0);
    const loanDisplay = fromSekAmount(csnPaymentSek, displayCurrency, safeRate);
    const netDisplay = incomeDisplay - expensesDisplay - taxBreakdown.totalTax - loanDisplay;

    return {
        incomeDisplay,
        expensesDisplay,
        taxDisplay: taxBreakdown.totalTax,
        loanDisplay,
        netDisplay,
        netSek: toSekAmount(netDisplay, displayCurrency, safeRate),
    };
};

export const makeProjection = (
    state: MoneyStateNormalized,
    safeRate: number,
    displayCurrency: CurrencyCode,
    jobState: JobCalendarState,
    taxProfile: TaxProfile,
    projectionStartMonth: Date,
    profileMode: MoneyProfileMode,
): ProjectionPoint[] => {
    const today = startOfDay(new Date());
    const currentMonth = startOfMonth(today);
    const startMonth = startOfMonth(projectionStartMonth);
    let rollingTotalSek = state.sekTotal + state.jpyTotal / safeRate;
    const lastProjectionMonth = addMonths(startMonth, 12);
    const csnSchedule = simulateCsnSchedule(state, lastProjectionMonth);

    const monthDiff = getMonthDiff(currentMonth, startMonth);

    if (monthDiff > 0) {
        for (let offset = 1; offset <= monthDiff; offset += 1) {
            const monthDate = addMonths(currentMonth, offset);
            const cashflow = calculateMonthCashflow(state, monthDate, safeRate, displayCurrency, jobState, taxProfile, csnSchedule, profileMode);
            rollingTotalSek += cashflow.netSek;
        }
    }

    const points: ProjectionPoint[] = [
        {
            label: format(startMonth, 'MMM yy'),
            monthIso: toMonthIso(startMonth),
            total: fromSekAmount(rollingTotalSek, displayCurrency, safeRate),
            income: 0,
            expenses: 0,
            tax: 0,
            loan: 0,
            net: 0,
            isBaseline: true,
        },
    ];

    for (let index = 0; index < 12; index += 1) {
        const monthDate = addMonths(startMonth, index + 1);
        const monthIso = toMonthIso(monthDate);
        const cashflow = calculateMonthCashflow(state, monthDate, safeRate, displayCurrency, jobState, taxProfile, csnSchedule, profileMode);

        rollingTotalSek += cashflow.netSek;

        points.push({
            label: format(monthDate, 'MMM yy'),
            monthIso,
            total: fromSekAmount(rollingTotalSek, displayCurrency, safeRate),
            income: cashflow.incomeDisplay,
            expenses: cashflow.expensesDisplay,
            tax: cashflow.taxDisplay,
            loan: cashflow.loanDisplay,
            net: cashflow.netDisplay,
            isBaseline: false,
        });
    }

    return points;
};

const formatAxisValue = (value: number, currency: CurrencyCode): string => {
    if (currency === 'JPY') {
        return `${Math.round(value).toLocaleString('sv-SE')} ¥`;
    }

    return `${Math.round(value).toLocaleString('sv-SE')} kr`;
};

export const toSekAmount = (value: number, currency: CurrencyCode, jpyPerSek: number): number => {
    if (currency === 'SEK') {
        return value;
    }

    return value / Math.max(jpyPerSek, 0.0001);
};

export const fromSekAmount = (valueSek: number, currency: CurrencyCode, jpyPerSek: number): number => {
    if (currency === 'SEK') {
        return valueSek;
    }

    return valueSek * Math.max(jpyPerSek, 0.0001);
};

export const MoneyPage: React.FC = () => {
    const [storedMoneyState, setStoredMoneyState] = usePersistedState<MoneyState>('money-state', DEFAULT_MONEY_STATE);
    const [storedJobState] = usePersistedState<JobCalendarState>('job-calendar-state', JOB_STATE_DEFAULT);
    const [displayCurrency, setDisplayCurrency] = usePersistedState<CurrencyCode>('money-display-currency', 'SEK');
    const [jpyPerSekRate, setJpyPerSekRate] = usePersistedState<number>('global-jpy-per-sek-rate', DEFAULT_MONEY_STATE.jpyPerSek);
    const [showTaxBreakdown, setShowTaxBreakdown] = React.useState(false);

    const moneyState = React.useMemo(() => normalizeMoneyState(storedMoneyState), [storedMoneyState]);
    const jobState = React.useMemo(() => normalizeJobState(storedJobState), [storedJobState]);
    const taxProfile = React.useMemo(() => buildTaxProfile(moneyState), [moneyState]);
    const profileMode = moneyState.moneyProfileMode ?? 'Albin';
    const isAlbinMode = profileMode === 'Albin';
    const isMisatoMode = profileMode === 'Misato';
    const isBothMode = profileMode === 'Both';

    const safeRate = Math.max(jpyPerSekRate, 0.0001);
    const visibleMonth = React.useMemo(() => parseISO(moneyState.visibleMonthIso), [moneyState.visibleMonthIso]);
    const visibleMonthIso = React.useMemo(() => toMonthIso(visibleMonth), [visibleMonth]);
    const combinedTotalSek = moneyState.sekTotal + moneyState.jpyTotal / safeRate;
    const combinedTotalJpy = moneyState.jpyTotal + moneyState.sekTotal * safeRate;
    const incomeComponentsSek = React.useMemo(
        () => getProfileIncomeComponentsSek(moneyState, visibleMonth, jobState, profileMode),
        [jobState, moneyState, profileMode, visibleMonth],
    );
    const monthlyIncomeSek = getModeMonthlyIncomeSek(moneyState, visibleMonthIso, profileMode);
    const monthlyExpensesSek = getModeMonthlyExpensesSek(moneyState, visibleMonthIso, profileMode);
    const csnScheduleForVisibleMonth = React.useMemo(() => simulateCsnSchedule(moneyState, visibleMonth), [moneyState, visibleMonth]);
    const csnMonth = isMisatoMode ? undefined : csnScheduleForVisibleMonth[visibleMonthIso];
    const csnPaymentDisplay = fromSekAmount(csnMonth?.paymentSek ?? 0, displayCurrency, safeRate);
    const grossIncomeDisplay = fromSekAmount(incomeComponentsSek.totalIncomeSek, displayCurrency, safeRate);
    const expensesDisplayValue = fromSekAmount(monthlyExpensesSek, displayCurrency, safeRate);
    const taxBreakdown = React.useMemo(
        () => calculateModeTaxBreakdown(profileMode, incomeComponentsSek, displayCurrency, safeRate, taxProfile),
        [displayCurrency, incomeComponentsSek, profileMode, safeRate, taxProfile],
    );
    const monthlyNetDisplay = grossIncomeDisplay - expensesDisplayValue - taxBreakdown.totalTax - csnPaymentDisplay;
    const projectionStartMonth = React.useMemo(() => getFiscalYearStartMonth(visibleMonth), [visibleMonth]);
    const projection = React.useMemo(
        () => makeProjection(moneyState, safeRate, displayCurrency, jobState, taxProfile, projectionStartMonth, profileMode),
        [displayCurrency, jobState, moneyState, profileMode, projectionStartMonth, safeRate, taxProfile],
    );

    const monthlyIncomeDisplayValue = isBothMode
        ? grossIncomeDisplay
        : fromSekAmount(monthlyIncomeSek, displayCurrency, safeRate);
    const importedSalaryDisplayValue = fromSekAmount(incomeComponentsSek.salaryFromJobSek, displayCurrency, safeRate);
    const monthTotalIncomeDisplay = grossIncomeDisplay;

    const updateMoneyState = (mutator: (previous: MoneyStateNormalized) => MoneyStateNormalized): void => {
        setStoredMoneyState((previous) => mutator(normalizeMoneyState(previous)));
    };

    const updateState = <K extends keyof MoneyStateNormalized>(key: K, value: number): void => {
        updateMoneyState((previous) => ({
            ...previous,
            [key]: value,
        }));
    };

    const updateProfileMode = (nextMode: MoneyProfileMode): void => {
        updateMoneyState((previous) => ({
            ...previous,
            moneyProfileMode: nextMode,
        }));
    };

    const updateVisibleMonth = (direction: -1 | 1): void => {
        const nextMonth = direction === -1 ? subMonths(visibleMonth, 1) : addMonths(visibleMonth, 1);

        updateMoneyState((previous) => ({
            ...previous,
            visibleMonthIso: toMonthIso(nextMonth),
        }));
    };

    const updateMonthlyIncome = (valueInDisplayCurrency: number): void => {
        updateMoneyState((previous) => ({
            ...previous,
            ...(isAlbinMode ? {
                monthlyAdditionalIncomeByMonthSek: {
                    ...previous.monthlyAdditionalIncomeByMonthSek,
                    [visibleMonthIso]: toSekAmount(valueInDisplayCurrency, displayCurrency, safeRate),
                },
            } : isMisatoMode ? {
                monthlyIncomeByMonthSek: {
                    ...previous.monthlyIncomeByMonthSek,
                    [visibleMonthIso]: toSekAmount(valueInDisplayCurrency, displayCurrency, safeRate),
                },
            } : {
                monthlyIncomeSek: toSekAmount(valueInDisplayCurrency, displayCurrency, safeRate),
            }),
        }));
    };

    const updateMonthlyExpenses = (valueInDisplayCurrency: number): void => {
        updateMoneyState((previous) => ({
            ...previous,
            ...(isAlbinMode ? {
                monthlyExpensesByMonthSek: {
                    ...previous.monthlyExpensesByMonthSek,
                    [visibleMonthIso]: toSekAmount(valueInDisplayCurrency, displayCurrency, safeRate),
                },
            } : {
                monthlyExpensesSek: toSekAmount(valueInDisplayCurrency, displayCurrency, safeRate),
            }),
        }));
    };

    const ProjectionTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ProjectionPoint }> }): React.ReactElement | null => {
        if (!active || !payload || payload.length === 0) {
            return null;
        }

        const point = payload[0].payload;

        return (
            <div className={css.chartTooltip}>
                <div className={css.tooltipTitle}>{point.label}</div>
                <div className={css.tooltipRow}><span>Total</span><strong>{currencyFormatter(point.total, displayCurrency)}</strong></div>
                {!point.isBaseline && (
                    <>
                        <div className={css.tooltipRow}><span>Income</span><strong>{currencyFormatter(point.income, displayCurrency)}</strong></div>
                        <div className={css.tooltipRow}><span>Expenses</span><strong>{currencyFormatter(point.expenses, displayCurrency)}</strong></div>
                        <div className={css.tooltipRow}><span>Tax</span><strong>{currencyFormatter(point.tax, displayCurrency)}</strong></div>
                        <div className={css.tooltipRow}><span>CSN loan</span><strong>{currencyFormatter(point.loan, displayCurrency)}</strong></div>
                        <div className={css.tooltipRow}><span>Net</span><strong>{currencyFormatter(point.net, displayCurrency)}</strong></div>
                    </>
                )}
            </div>
        );
    };

    return (
        <section className={css.page}>
            <div className={css.headerRow}>
                <div>
                    <h2 className={css.title}>Money</h2>
                    <p className={css.subtitle}>Track totals, month-specific cashflow, imported salary, and tax impact with forward projections.</p>
                </div>

                <div className={css.headerControls}>
                    <label className={css.selectField}>
                        <span>Profile</span>
                        <select value={profileMode} onChange={(event) => updateProfileMode(event.target.value as MoneyProfileMode)}>
                            {Object.entries(moneyProfileModeLabels).map(([mode, label]) => (
                                <option key={mode} value={mode}>{label}</option>
                            ))}
                        </select>
                    </label>

                    <label className={css.selectField}>
                        <span>Display currency</span>
                        <select value={displayCurrency} onChange={(event) => setDisplayCurrency(event.target.value as CurrencyCode)}>
                            <option value="SEK">SEK</option>
                            <option value="JPY">JPY</option>
                        </select>
                    </label>

                    <div className={css.monthControls}>
                        <button type="button" className={css.controlButton} onClick={() => updateVisibleMonth(-1)}>Previous</button>
                        <div className={css.monthLabel}>{format(visibleMonth, 'MMMM yyyy')}</div>
                        <button type="button" className={css.controlButton} onClick={() => updateVisibleMonth(1)}>Next</button>
                    </div>
                </div>
            </div>

            <div className={css.summaryGrid}>
                <article className={css.summaryCard}>
                    <span>SEK total</span>
                    <strong>{currencyFormatter(moneyState.sekTotal, 'SEK')}</strong>
                </article>
                <article className={css.summaryCard}>
                    <span>JPY total</span>
                    <strong>{currencyFormatter(moneyState.jpyTotal, 'JPY')}</strong>
                </article>
                <article className={css.summaryCard}>
                    <span>Combined total</span>
                    <strong>{currencyFormatter(displayCurrency === 'SEK' ? combinedTotalSek : combinedTotalJpy, displayCurrency)}</strong>
                </article>
                <article className={css.summaryCard}>
                    <span>Monthly net ({format(visibleMonth, 'MMM yyyy')})</span>
                    <strong>{currencyFormatter(monthlyNetDisplay, displayCurrency)}</strong>
                </article>
                <article className={css.summaryCard}>
                    <span>Effective tax rate</span>
                    <strong>{(taxBreakdown.effectiveRate * 100).toFixed(1)}%</strong>
                </article>
                <article className={css.summaryCard}>
                    <span>Tax expense ({format(visibleMonth, 'MMM yyyy')})</span>
                    <button type="button" className={css.taxValueButton} onClick={() => setShowTaxBreakdown(true)}>
                        {currencyFormatter(taxBreakdown.totalTax, displayCurrency)}
                    </button>
                </article>
                <article className={css.summaryCard}>
                    <span>CSN payment ({format(visibleMonth, 'MMM yyyy')})</span>
                    <strong>{currencyFormatter(csnPaymentDisplay, displayCurrency)}</strong>
                </article>
            </div>

            <div className={css.gridLayout}>
                <form className={css.panel}>
                    <h3 className={css.panelTitle}>Balances and monthly inputs</h3>
                    <p className={css.panelSubtitle}>
                        {isAlbinMode && 'Albin mode keeps the current job-import flow and month-specific overrides.'}
                        {isMisatoMode && 'Misato mode uses month-specific income and fixed monthly expenses from the current inputs.'}
                        {isBothMode && 'Both mode combines the current balance and monthly values into one locked view.'}
                    </p>

                    <div className={css.inputGrid}>
                        <label className={css.field}>
                            <span>SEK balance</span>
                            <input type="number" min="0" step="100" value={moneyState.sekTotal} onChange={(event) => updateState('sekTotal', Number(event.target.value))} disabled={isBothMode} />
                        </label>

                        <label className={css.field}>
                            <span>JPY balance</span>
                            <input type="number" min="0" step="1000" value={moneyState.jpyTotal} onChange={(event) => updateState('jpyTotal', Number(event.target.value))} disabled={isBothMode} />
                        </label>

                        <label className={css.field}>
                            <span>{isMisatoMode ? 'Job income' : 'Imported salary'} ({displayCurrency})</span>
                            <input type="number" value={Math.round(importedSalaryDisplayValue)} readOnly />
                        </label>

                        <label className={css.field}>
                            <span>{isAlbinMode ? 'Additional income' : isBothMode ? 'Combined monthly income' : 'Monthly income'} ({displayCurrency})</span>
                            <input
                                type="number"
                                min="0"
                                step={displayCurrency === 'SEK' ? '100' : '1000'}
                                value={Math.round(monthlyIncomeDisplayValue)}
                                onChange={(event) => updateMonthlyIncome(Number(event.target.value))}
                                disabled={isBothMode}
                            />
                        </label>

                        <label className={css.field}>
                            <span>{isBothMode ? 'Combined monthly expenses' : 'Monthly expenses'} ({displayCurrency})</span>
                            <input
                                type="number"
                                min="0"
                                step={displayCurrency === 'SEK' ? '100' : '1000'}
                                value={Math.round(expensesDisplayValue)}
                                onChange={(event) => updateMonthlyExpenses(Number(event.target.value))}
                                disabled={isBothMode}
                            />
                        </label>

                        <label className={css.field}>
                            <span>Total monthly income ({displayCurrency})</span>
                            <input type="number" value={Math.round(monthTotalIncomeDisplay)} readOnly />
                        </label>

                        <label className={css.field}>
                            <span>JPY per SEK rate</span>
                            <input type="number" min="0.0001" step="0.01" value={jpyPerSekRate} onChange={(event) => setJpyPerSekRate(Number(event.target.value))} />
                        </label>
                    </div>

                    <div className={css.taxProfilePanel}>
                        <button
                            type="button"
                            className={css.profileToggle}
                            onClick={() => updateMoneyState((previous) => ({ ...previous, showTaxProfile: !previous.showTaxProfile }))}
                            aria-expanded={moneyState.showTaxProfile}
                        >
                            <span>Tax profile ({displayCurrency})</span>
                            <span>{moneyState.showTaxProfile ? 'Hide' : 'Show'}</span>
                        </button>

                        {moneyState.showTaxProfile && (
                            <div className={css.taxProfileGrid}>
                                <div className={css.taxProfileTitle}>Tax settings</div>
                                {displayCurrency === 'SEK' ? (
                                    <>
                                    <label className={css.field}>
                                        <span>Municipal tax rate (%)</span>
                                        <input type="number" min="0" step="0.1" value={moneyState.seMunicipalTaxRatePct} onChange={(event) => updateState('seMunicipalTaxRatePct', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>State tax threshold (SEK/year)</span>
                                        <input type="number" min="0" step="1000" value={moneyState.seStateTaxThresholdSek} onChange={(event) => updateState('seStateTaxThresholdSek', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>State tax rate (%)</span>
                                        <input type="number" min="0" step="0.1" value={moneyState.seStateTaxRatePct} onChange={(event) => updateState('seStateTaxRatePct', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Pension contribution (%)</span>
                                        <input type="number" min="0" step="0.1" value={moneyState.sePensionRatePct} onChange={(event) => updateState('sePensionRatePct', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Basic deduction (SEK/year)</span>
                                        <input type="number" min="0" step="1000" value={moneyState.seBasicDeductionSek} onChange={(event) => updateState('seBasicDeductionSek', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Tax credit max (SEK/year)</span>
                                        <input type="number" min="0" step="1000" value={moneyState.seJobTaxCreditMaxSek} onChange={(event) => updateState('seJobTaxCreditMaxSek', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Public service fee rate (%)</span>
                                        <input type="number" min="0" step="0.01" value={moneyState.sePublicServiceFeeRatePct} onChange={(event) => updateState('sePublicServiceFeeRatePct', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Public service fee cap (SEK/year)</span>
                                        <input type="number" min="0" step="100" value={moneyState.sePublicServiceFeeMaxSek} onChange={(event) => updateState('sePublicServiceFeeMaxSek', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Burial fee rate (%)</span>
                                        <input type="number" min="0" step="0.01" value={moneyState.seBurialFeeRatePct} onChange={(event) => updateState('seBurialFeeRatePct', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Church fee rate (%)</span>
                                        <input type="number" min="0" step="0.01" value={moneyState.seChurchFeeRatePct} onChange={(event) => updateState('seChurchFeeRatePct', Number(event.target.value))} />
                                    </label>
                                    <label className={css.checkboxField}>
                                        <input type="checkbox" checked={moneyState.seIncludeChurchFee} onChange={(event) => updateMoneyState((previous) => ({ ...previous, seIncludeChurchFee: event.target.checked }))} />
                                        <span>Include church fee</span>
                                    </label>
                                    </>
                                ) : (
                                    <>
                                    <label className={css.field}>
                                        <span>Health insurance rate (%)</span>
                                        <input type="number" min="0" step="0.01" value={moneyState.jpHealthInsuranceRatePct} onChange={(event) => updateState('jpHealthInsuranceRatePct', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Pension rate (%)</span>
                                        <input type="number" min="0" step="0.01" value={moneyState.jpPensionRatePct} onChange={(event) => updateState('jpPensionRatePct', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Unemployment insurance (%)</span>
                                        <input type="number" min="0" step="0.01" value={moneyState.jpUnemploymentRatePct} onChange={(event) => updateState('jpUnemploymentRatePct', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Long-term care insurance (%)</span>
                                        <input type="number" min="0" step="0.01" value={moneyState.jpLongTermCareRatePct} onChange={(event) => updateState('jpLongTermCareRatePct', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Age (for care insurance)</span>
                                        <input type="number" min="0" max="120" step="1" value={moneyState.jpAge} onChange={(event) => updateState('jpAge', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Resident tax rate (%)</span>
                                        <input type="number" min="0" step="0.1" value={moneyState.jpResidentTaxRatePct} onChange={(event) => updateState('jpResidentTaxRatePct', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Resident per-capita levy (JPY/year)</span>
                                        <input type="number" min="0" step="100" value={moneyState.jpResidentPerCapitaAnnualJpy} onChange={(event) => updateState('jpResidentPerCapitaAnnualJpy', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>National basic deduction (JPY/year)</span>
                                        <input type="number" min="0" step="1000" value={moneyState.jpBasicDeductionNationalJpy} onChange={(event) => updateState('jpBasicDeductionNationalJpy', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Resident basic deduction (JPY/year)</span>
                                        <input type="number" min="0" step="1000" value={moneyState.jpBasicDeductionResidentJpy} onChange={(event) => updateState('jpBasicDeductionResidentJpy', Number(event.target.value))} />
                                    </label>
                                    <label className={css.field}>
                                        <span>Dependent deduction (JPY/year)</span>
                                        <input type="number" min="0" step="1000" value={moneyState.jpDependentDeductionAnnualJpy} onChange={(event) => updateState('jpDependentDeductionAnnualJpy', Number(event.target.value))} />
                                    </label>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={css.profilePanel}>
                        <button
                            type="button"
                            className={css.profileToggle}
                            onClick={() => updateMoneyState((previous) => ({ ...previous, showCsnProfile: !previous.showCsnProfile }))}
                            aria-expanded={moneyState.showCsnProfile}
                        >
                            <span>CSN loan profile</span>
                            <span>{moneyState.showCsnProfile ? 'Hide' : 'Show'}</span>
                        </button>

                        {moneyState.showCsnProfile && (
                            <div className={css.taxProfileGrid}>
                                <label className={css.checkboxField}>
                                    <input type="checkbox" checked={moneyState.csnEnabled} onChange={(event) => updateMoneyState((previous) => ({ ...previous, csnEnabled: event.target.checked }))} />
                                    <span>Enable CSN repayment</span>
                                </label>
                                <label className={css.field}>
                                    <span>Repayment model</span>
                                    <select value={moneyState.csnRepaymentModel} onChange={(event) => updateMoneyState((previous) => ({ ...previous, csnRepaymentModel: event.target.value as 'annuity' | 'fixed' }))}>
                                        <option value="annuity">Annuity</option>
                                        <option value="fixed">Fixed amortization</option>
                                    </select>
                                </label>
                                <label className={css.field}>
                                    <span>Outstanding principal (SEK)</span>
                                    <input type="number" min="0" step="1000" value={moneyState.csnOutstandingPrincipalSek} onChange={(event) => updateState('csnOutstandingPrincipalSek', Number(event.target.value))} />
                                </label>
                                <label className={css.field}>
                                    <span>Annual interest rate (%)</span>
                                    <input type="number" min="0" step="0.01" value={moneyState.csnAnnualInterestRatePct} onChange={(event) => updateState('csnAnnualInterestRatePct', Number(event.target.value))} />
                                </label>
                                <label className={css.field}>
                                    <span>Admin fee (SEK/year)</span>
                                    <input type="number" min="0" step="10" value={moneyState.csnAdminFeeAnnualSek} onChange={(event) => updateState('csnAdminFeeAnnualSek', Number(event.target.value))} />
                                </label>
                                <label className={css.field}>
                                    <span>Repayment years</span>
                                    <input type="number" min="1" step="1" value={moneyState.csnRepaymentYears} onChange={(event) => updateState('csnRepaymentYears', Number(event.target.value))} />
                                </label>
                                <label className={css.field}>
                                    <span>Repayment start month</span>
                                    <input type="month" value={moneyState.csnRepaymentStartMonthIso.slice(0, 7)} onChange={(event) => updateMoneyState((previous) => ({ ...previous, csnRepaymentStartMonthIso: `${event.target.value}-01` }))} />
                                </label>
                                <div className={css.profileNote}>
                                    Estimated monthly payment: {currencyFormatter(csnPaymentDisplay, displayCurrency)}
                                </div>
                            </div>
                        )}
                    </div>
                </form>

                <article className={css.panel}>
                    <h3 className={css.panelTitle}>Projection</h3>
                    <p className={css.panelSubtitle}>Projection starts from today. Hover a point to see total, income, expenses, tax, and net for that month.</p>

                    <div className={css.chartWrap}>
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={projection} margin={{ top: 16, right: 18, bottom: 8, left: 22 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" />
                                <YAxis width={94} tickFormatter={(value) => formatAxisValue(Number(value), displayCurrency)} />
                                <Tooltip content={<ProjectionTooltip />} />
                                <Line type="monotone" dataKey="total" name="Total" stroke="rgb(47 94 219)" strokeWidth={3} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </article>
            </div>

            {showTaxBreakdown && (
                <div className={css.modalBackdrop} role="dialog" aria-modal="true" aria-label="Tax breakdown">
                    <div className={css.modalCard}>
                        <div className={css.modalHeader}>
                            <h3 className={css.panelTitle}>Tax breakdown for {format(visibleMonth, 'MMMM yyyy')}</h3>
                            <button type="button" className={css.controlButton} onClick={() => setShowTaxBreakdown(false)}>Close</button>
                        </div>

                        <div className={css.breakdownMeta}>
                            <div><strong>Gross income:</strong> {currencyFormatter(grossIncomeDisplay, displayCurrency)}</div>
                            <div><strong>Effective tax rate:</strong> {(taxBreakdown.effectiveRate * 100).toFixed(2)}%</div>
                            <div><strong>Total tax:</strong> {currencyFormatter(taxBreakdown.totalTax, displayCurrency)}</div>
                        </div>

                        <div className={css.breakdownList}>
                            {taxBreakdown.lines.map((line) => (
                                <div key={line.label} className={css.breakdownRow}>
                                    <span>{line.label}</span>
                                    <strong>{currencyFormatter(line.amount, displayCurrency)}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};