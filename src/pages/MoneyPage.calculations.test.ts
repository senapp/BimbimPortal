import { addMonths, parseISO, startOfMonth } from 'date-fns';
import {
    buildTaxProfile,
    calculateMonthCashflow,
    calculateMonthlyTaxBreakdown,
    calculateJapanEmploymentIncomeDeduction,
    calculateJapanIncomeTax,
    DEFAULT_MONEY_STATE,
    getMonthDiff,
    getModeMonthlyExpensesSek,
    getModeMonthlyIncomeSek,
    getPmt,
    makeProjection,
    normalizeJobState,
    normalizeMoneyState,
    toSekAmount,
    fromSekAmount,
    toMonthIso,
} from './MoneyPage';

describe('MoneyPage calculation logic', () => {
    test('Misato income is stored and read per month', () => {
        const aprilIso = '2028-04-01';
        const mayIso = '2028-05-01';
        const incomeA = Math.floor(Math.random() * 5000);
        const incomeB = Math.floor(Math.random() * 5000);

        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: incomeA,
            monthlyIncomeByMonthSek: {
                [aprilIso]: incomeB,
            },
        });

        expect(getModeMonthlyIncomeSek(state, aprilIso, 'Misato')).toBe(incomeB);
        expect(getModeMonthlyIncomeSek(state, mayIso, 'Misato')).toBe(incomeA);
    });

    test('Both mode monthly income combines Albin and Misato income', () => {
        const monthIso = '2028-04-01';
        const incomeA = Math.floor(Math.random() * 2000);
        const incomeB = Math.floor(Math.random() * 2000);
        const incomeC = Math.floor(Math.random() * 2000);

        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: incomeA,
            monthlyAdditionalIncomeByMonthSek: {
                [monthIso]: incomeB,
            },
            monthlyIncomeByMonthSek: {
                [monthIso]: incomeC,
            },
        });

        expect(getModeMonthlyIncomeSek(state, monthIso, 'Both')).toBe(incomeB + incomeC);
    });

    test('Both mode monthly expenses combine Albin and Misato expenses', () => {
        const monthIso = '2028-04-01';
        const expensesA = Math.floor(Math.random() * 1000);
        const expensesB = Math.floor(Math.random() * 1000);

        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyExpensesSek: expensesA,
            monthlyExpensesByMonthSek: {
                [monthIso]: expensesB,
            },
        });

        expect(getModeMonthlyExpensesSek(state, monthIso, 'Both')).toBe(expensesA + expensesB);
    });

    test('Both mode cashflow uses combined income and expenses in chart math', () => {
        const monthDate = parseISO('2028-04-01');
        const monthIso = '2028-04-01';
        const incomeA = Math.floor(Math.random() * 2000);
        const expensesA = Math.floor(Math.random() * 1000);
        const incomeB = Math.floor(Math.random() * 2000);
        const incomeC = Math.floor(Math.random() * 2000);
        const expensesB = Math.floor(Math.random() * 1000);

        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: incomeA,
            monthlyExpensesSek: expensesA,
            monthlyAdditionalIncomeByMonthSek: {
                [monthIso]: incomeB,
            },
            monthlyIncomeByMonthSek: {
                [monthIso]: incomeC,
            },
            monthlyExpensesByMonthSek: {
                [monthIso]: expensesB,
            },
            csnEnabled: false,
            seMunicipalTaxRatePct: 0,
            seStateTaxRatePct: 0,
            sePensionRatePct: 0,
            sePublicServiceFeeRatePct: 0,
            seBurialFeeRatePct: 0,
            seChurchFeeRatePct: 0,
            seIncludeChurchFee: false,
            seJobTaxCreditMaxSek: 0,
        });

        const jobState = normalizeJobState({
            wagePerHourSek: 0,
            workingHoursPerDay: 0,
            monthlySalarySek: 0,
            monthlyBonusSek: 0,
        });

        const taxProfile = buildTaxProfile(state);
        const cashflow = calculateMonthCashflow(state, monthDate, 14.8, 'SEK', jobState, taxProfile, {}, 'Both');

        expect(cashflow.incomeDisplay).toBe(incomeB + incomeC);
        expect(cashflow.expensesDisplay).toBe(expensesA + expensesB);
        expect(cashflow.loanDisplay).toBe(0);
        expect(cashflow.netDisplay).toBe((incomeB + incomeC) - (expensesA + expensesB));
    });

    test('Both mode projection monthly delta equals Albin + Misato when tax and loan are neutral', () => {
        const startMonth = startOfMonth(new Date());
        const firstProjectedMonthIso = toMonthIso(addMonths(startMonth, 1));
        const incomeA = Math.floor(Math.random() * 2000);
        const expensesA = Math.floor(Math.random() * 1000);
        const incomeB = Math.floor(Math.random() * 2000);
        const incomeC = Math.floor(Math.random() * 2000);
        const expensesB = Math.floor(Math.random() * 1000);

        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: incomeA,
            monthlyExpensesSek: expensesA,
            monthlyAdditionalIncomeByMonthSek: {
                [firstProjectedMonthIso]: incomeB,
            },
            monthlyIncomeByMonthSek: {
                [firstProjectedMonthIso]: incomeC,
            },
            monthlyExpensesByMonthSek: {
                [firstProjectedMonthIso]: expensesB,
            },
            csnEnabled: false,
            seMunicipalTaxRatePct: 0,
            seStateTaxRatePct: 0,
            sePensionRatePct: 0,
            sePublicServiceFeeRatePct: 0,
            seBurialFeeRatePct: 0,
            seChurchFeeRatePct: 0,
            seIncludeChurchFee: false,
            seJobTaxCreditMaxSek: 0,
        });

        const jobState = normalizeJobState({
            wagePerHourSek: 0,
            workingHoursPerDay: 0,
            monthlySalarySek: 0,
            monthlyBonusSek: 0,
        });

        const taxProfile = buildTaxProfile(state);

        const albin = makeProjection(state, 14.8, 'SEK', jobState, taxProfile, startMonth, 'Albin');
        const misato = makeProjection(state, 14.8, 'SEK', jobState, taxProfile, startMonth, 'Misato');
        const both = makeProjection(state, 14.8, 'SEK', jobState, taxProfile, startMonth, 'Both');

        const albinDelta = albin[1].total - albin[0].total;
        const misatoDelta = misato[1].total - misato[0].total;
        const bothDelta = both[1].total - both[0].total;

        expect(bothDelta).toBe(albinDelta + misatoDelta);
    });

    test('Both mode tax equals Albin tax + Misato tax (separate taxation)', () => {
        const monthDate = parseISO('2028-04-01');
        const monthIso = '2028-04-01';
        const incomeA = Math.floor(Math.random() * 50000);
        const incomeB = Math.floor(Math.random() * 50000);

        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: 0,
            monthlyAdditionalIncomeByMonthSek: {
                [monthIso]: incomeA,
            },
            monthlyIncomeByMonthSek: {
                [monthIso]: incomeB,
            },
            monthlyExpensesSek: 0,
            monthlyExpensesByMonthSek: {
                [monthIso]: 0,
            },
            csnEnabled: false,
        });
        const jobState = normalizeJobState({
            wagePerHourSek: 0,
            workingHoursPerDay: 0,
            monthlySalarySek: 0,
            monthlyBonusSek: 0,
        });
        const taxProfile = buildTaxProfile(state);

        const albin = calculateMonthCashflow(state, monthDate, 14.8, 'SEK', jobState, taxProfile, {}, 'Albin');
        const misato = calculateMonthCashflow(state, monthDate, 14.8, 'SEK', jobState, taxProfile, {}, 'Misato');
        const both = calculateMonthCashflow(state, monthDate, 14.8, 'SEK', jobState, taxProfile, {}, 'Both');

        expect(Math.round(both.taxDisplay * 100) / 100).toBe(Math.round((albin.taxDisplay + misato.taxDisplay) * 100) / 100);
    });

    test('Both mode tax is lower than combined-income tax in split-threshold scenario', () => {
        const monthDate = parseISO('2028-04-01');
        const monthIso = '2028-04-01';
        const incomeA = Math.floor(Math.random() * 40000) + 20000;
        const incomeB = Math.floor(Math.random() * 40000) + 20000;

        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: 0,
            monthlyAdditionalIncomeByMonthSek: {
                [monthIso]: incomeA,
            },
            monthlyIncomeByMonthSek: {
                [monthIso]: incomeB,
            },
            monthlyExpensesSek: 0,
            monthlyExpensesByMonthSek: {
                [monthIso]: 0,
            },
            csnEnabled: false,
        });
        const jobState = normalizeJobState({
            wagePerHourSek: 0,
            workingHoursPerDay: 0,
            monthlySalarySek: 0,
            monthlyBonusSek: 0,
        });
        const taxProfile = buildTaxProfile(state);

        const both = calculateMonthCashflow(state, monthDate, 14.8, 'SEK', jobState, taxProfile, {}, 'Both');
        const combinedSingleTax = calculateMonthlyTaxBreakdown(incomeA + incomeB, 'SEK', taxProfile);

        expect(both.taxDisplay).toBeLessThan(combinedSingleTax.totalTax);
    });

    test('Both mode projection delta equals Albin+Misato with realistic taxes', () => {
        const startMonth = startOfMonth(new Date());
        const firstProjectedMonthIso = toMonthIso(addMonths(startMonth, 1));
        const incomeA = Math.floor(Math.random() * 30000) + 10000;
        const incomeB = Math.floor(Math.random() * 30000) + 10000;
        const expensesA = Math.floor(Math.random() * 10000) + 5000;
        const expensesB = Math.floor(Math.random() * 10000) + 5000;

        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: 0,
            monthlyAdditionalIncomeByMonthSek: {
                [firstProjectedMonthIso]: incomeA,
            },
            monthlyIncomeByMonthSek: {
                [firstProjectedMonthIso]: incomeB,
            },
            monthlyExpensesSek: expensesA,
            monthlyExpensesByMonthSek: {
                [firstProjectedMonthIso]: expensesB,
            },
            csnEnabled: false,
        });
        const jobState = normalizeJobState({
            wagePerHourSek: 0,
            workingHoursPerDay: 0,
            monthlySalarySek: 0,
            monthlyBonusSek: 0,
        });
        const taxProfile = buildTaxProfile(state);

        const albin = makeProjection(state, 14.8, 'SEK', jobState, taxProfile, startMonth, 'Albin');
        const misato = makeProjection(state, 14.8, 'SEK', jobState, taxProfile, startMonth, 'Misato');
        const both = makeProjection(state, 14.8, 'SEK', jobState, taxProfile, startMonth, 'Both');

        const albinDelta = albin[1].total - albin[0].total;
        const misatoDelta = misato[1].total - misato[0].total;
        const bothDelta = both[1].total - both[0].total;

        expect(Math.round(bothDelta * 100) / 100).toBe(Math.round((albinDelta + misatoDelta) * 100) / 100);
    });

    test('Japan national tax brackets return expected values at boundary points', () => {
        expect(calculateJapanIncomeTax(1_950_000)).toBe(1_950_000 * 0.05);
        expect(calculateJapanIncomeTax(3_300_000)).toBe(3_300_000 * 0.10 - 97_500);
        expect(calculateJapanIncomeTax(6_950_000)).toBe(6_950_000 * 0.20 - 427_500);
    });

    test('Japan employment income deduction caps at 1,950,000 JPY', () => {
        expect(calculateJapanEmploymentIncomeDeduction(1_500_000)).toBe(550_000);
        expect(calculateJapanEmploymentIncomeDeduction(9_000_000 + Math.random() * 1000000)).toBe(1_950_000);
    });

    test('PMT with zero rate falls back to principal/periods', () => {
        const principal = Math.random() * 200000;
        const periods = Math.floor(Math.random() * 300) + 1;
        expect(getPmt(0, periods, principal)).toBe(principal / periods);
    });

    test('Month diff works across year boundary', () => {
        const start = parseISO('2027-11-01');
        const end = parseISO('2028-02-01');
        expect(getMonthDiff(start, end)).toBe(3);
    });

    test('SEK/JPY conversion stays numerically consistent', () => {
        const sek = Math.random() * 50000;
        const rate = Math.random() * 20 + 5;
        const jpy = fromSekAmount(sek, 'JPY', rate);
        const roundTripSek = toSekAmount(jpy, 'JPY', rate);

        expect(Math.round(roundTripSek * 10000) / 10000).toBe(sek);
    });
});
