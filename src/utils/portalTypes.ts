export type PortalTabKey = 'Money' | 'Job' | 'Contacts' | 'Todo' | 'Timeline';

export type CurrencyCode = 'SEK' | 'JPY';

export type MoneyProfileMode = 'Albin' | 'Misato' | 'Both';

export type MoneyState = {
    sekTotal: number;
    jpyTotal: number;
    monthlyIncomeSek: number;
    monthlyExpensesSek: number;
    moneyProfileMode?: MoneyProfileMode;
    jpyPerSek: number;
    visibleMonthIso?: string;
    monthlyAdditionalIncomeByMonthSek?: Record<string, number>;
    monthlyIncomeByMonthSek?: Record<string, number>;
    monthlyExpensesByMonthSek?: Record<string, number>;
    seMunicipalTaxRatePct?: number;
    seStateTaxThresholdSek?: number;
    seStateTaxRatePct?: number;
    sePensionRatePct?: number;
    seBasicDeductionSek?: number;
    seJobTaxCreditMaxSek?: number;
    sePublicServiceFeeRatePct?: number;
    sePublicServiceFeeMaxSek?: number;
    seBurialFeeRatePct?: number;
    seChurchFeeRatePct?: number;
    seIncludeChurchFee?: boolean;
    jpHealthInsuranceRatePct?: number;
    jpPensionRatePct?: number;
    jpUnemploymentRatePct?: number;
    jpLongTermCareRatePct?: number;
    jpAge?: number;
    jpResidentTaxRatePct?: number;
    jpResidentPerCapitaAnnualJpy?: number;
    jpBasicDeductionNationalJpy?: number;
    jpBasicDeductionResidentJpy?: number;
    jpDependentDeductionAnnualJpy?: number;
    csnEnabled?: boolean;
    csnRepaymentModel?: 'annuity' | 'fixed';
    csnOutstandingPrincipalSek?: number;
    csnAnnualInterestRatePct?: number;
    csnAdminFeeAnnualSek?: number;
    csnRepaymentYears?: number;
    csnRepaymentStartMonthIso?: string;
    showTaxProfile?: boolean;
    showCsnProfile?: boolean;
};

export type JobHolidayCountry = 'SE' | 'JP';

export type JobWorkingDayOverrides = Record<string, boolean>;

export type JobCalendarState = {
    visibleMonthIso: string;
    selectedDayIso: string | null;
    holidayCountry: JobHolidayCountry;
    wagePerHourSek: number;
    workingHoursPerDay: number;
    monthlySalarySek: number;
    monthlyBonusSek: number;
    bonusMonthOverrides: Record<string, boolean>;
    workingDayOverrides: JobWorkingDayOverrides;
};

export type Contact = {
    id: string;
    name: string;
    nationalityCode: string;
    avatarUrl: string;
    useInstagramAvatar: boolean;
    dateOfBirth: string;
    occupation: string;
    linkedInUrl: string;
    instagramUrl: string;
    latitude: number;
    longitude: number;
    city: string;
    notes: string;
};

export type ContactsState = {
    contacts: Contact[];
    filter: string;
};

export type TodoStatus = 'todo' | 'in-progress' | 'done';

export type TodoPriority = 'low' | 'medium' | 'high';

export type TodoItem = {
    id: string;
    title: string;
    description: string;
    dueDate: string;
    status: TodoStatus;
    priority: TodoPriority;
    createdAt: string;
};

export type TodoSortBy = 'created' | 'due' | 'priority';

export type TodoPageState = {
    items: TodoItem[];
    filterStatus: 'all' | TodoStatus;
    filterQuery: string;
    sortBy: TodoSortBy;
};

export type EventCategory = 'period' | 'start' | 'finish' | 'milestone';

export type TimelineEventPoint = {
    type: 'point';
    id: string;
    title: string;
    description: string;
    date: string;
    category: EventCategory;
    color: string;
    createdAt: string;
};

export type TimelineEventPeriod = {
    type: 'period';
    id: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    category: EventCategory;
    color: string;
    createdAt: string;
};

export type TimelineEvent = TimelineEventPoint | TimelineEventPeriod;

export type Timeline = {
    id: string;
    name: string;
    events: TimelineEvent[];
    createdAt: string;
    updatedAt: string;
};

export type TimelinePageState = {
    timelines: Timeline[];
    selectedTimelineId: string | null;
};
