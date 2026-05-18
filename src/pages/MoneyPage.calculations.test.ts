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

        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: 1000,
            monthlyIncomeByMonthSek: {
                [aprilIso]: 2500,
            },
        });

        expect(getModeMonthlyIncomeSek(state, aprilIso, 'Misato')).toBe(2500);
        expect(getModeMonthlyIncomeSek(state, mayIso, 'Misato')).toBe(1000);
    });

    test('Both mode monthly income combines Albin and Misato income', () => {
        const monthIso = '2028-04-01';
        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: 1000,
            monthlyAdditionalIncomeByMonthSek: {
                [monthIso]: 1300,
            },
            monthlyIncomeByMonthSek: {
                [monthIso]: 900,
            },
        });

        expect(getModeMonthlyIncomeSek(state, monthIso, 'Both')).toBe(2200);
    });

    test('Both mode monthly expenses combine Albin and Misato expenses', () => {
        const monthIso = '2028-04-01';
        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyExpensesSek: 700,
            monthlyExpensesByMonthSek: {
                [monthIso]: 1000,
            },
        });

        expect(getModeMonthlyExpensesSek(state, monthIso, 'Both')).toBe(1700);
    });

    test('Both mode cashflow uses combined income and expenses in chart math', () => {
        const monthDate = parseISO('2028-04-01');
        const monthIso = '2028-04-01';
        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: 1000,
            monthlyExpensesSek: 700,
            monthlyAdditionalIncomeByMonthSek: {
                [monthIso]: 1300,
            },
            monthlyIncomeByMonthSek: {
                [monthIso]: 900,
            },
            monthlyExpensesByMonthSek: {
                [monthIso]: 1000,
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

        expect(cashflow.incomeDisplay).toBe(2200);
        expect(cashflow.expensesDisplay).toBe(1700);
        expect(cashflow.loanDisplay).toBe(0);
        expect(cashflow.netDisplay).toBe(500);
    });

    test('Both mode projection monthly delta equals Albin + Misato when tax and loan are neutral', () => {
        const startMonth = startOfMonth(new Date());
        const firstProjectedMonthIso = toMonthIso(addMonths(startMonth, 1));

        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: 1000,
            monthlyExpensesSek: 700,
            monthlyAdditionalIncomeByMonthSek: {
                [firstProjectedMonthIso]: 1300,
            },
            monthlyIncomeByMonthSek: {
                [firstProjectedMonthIso]: 900,
            },
            monthlyExpensesByMonthSek: {
                [firstProjectedMonthIso]: 1000,
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
        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: 0,
            monthlyAdditionalIncomeByMonthSek: {
                [monthIso]: 30000,
            },
            monthlyIncomeByMonthSek: {
                [monthIso]: 30000,
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
        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: 0,
            monthlyAdditionalIncomeByMonthSek: {
                [monthIso]: 30000,
            },
            monthlyIncomeByMonthSek: {
                [monthIso]: 30000,
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
        const combinedSingleTax = calculateMonthlyTaxBreakdown(60000, 'SEK', taxProfile);

        expect(both.taxDisplay).toBeLessThan(combinedSingleTax.totalTax);
    });

    test('Both mode projection delta equals Albin+Misato with realistic taxes', () => {
        const startMonth = startOfMonth(new Date());
        const firstProjectedMonthIso = toMonthIso(addMonths(startMonth, 1));

        const state = normalizeMoneyState({
            ...DEFAULT_MONEY_STATE,
            monthlyIncomeSek: 0,
            monthlyAdditionalIncomeByMonthSek: {
                [firstProjectedMonthIso]: 26000,
            },
            monthlyIncomeByMonthSek: {
                [firstProjectedMonthIso]: 19000,
            },
            monthlyExpensesSek: 9000,
            monthlyExpensesByMonthSek: {
                [firstProjectedMonthIso]: 12000,
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
        expect(calculateJapanIncomeTax(1_950_000)).toBe(97_500);
        expect(calculateJapanIncomeTax(3_300_000)).toBe(232_500);
        expect(calculateJapanIncomeTax(6_950_000)).toBe(962_500);
    });

    test('Japan employment income deduction caps at 1,950,000 JPY', () => {
        expect(calculateJapanEmploymentIncomeDeduction(1_500_000)).toBe(550_000);
        expect(calculateJapanEmploymentIncomeDeduction(9_000_000)).toBe(1_950_000);
    });

    test('PMT with zero rate falls back to principal/periods', () => {
        expect(getPmt(0, 300, 120000)).toBe(400);
    });

    test('Month diff works across year boundary', () => {
        const start = parseISO('2027-11-01');
        const end = parseISO('2028-02-01');
        expect(getMonthDiff(start, end)).toBe(3);
    });

    test('SEK/JPY conversion stays numerically consistent', () => {
        const sek = 12345;
        const rate = 14.8;
        const jpy = fromSekAmount(sek, 'JPY', rate);
        const roundTripSek = toSekAmount(jpy, 'JPY', rate);

        expect(Math.round(roundTripSek * 10000) / 10000).toBe(sek);
    });
});
