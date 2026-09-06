import { useTranslation } from 'react-i18next'
import { useSettings } from '@/hooks/useSettings'
import { MetricCards } from './MetricCards'
import { TopSellingPanel } from './TopSellingPanel'
import { SupplierPanel } from './SupplierPanel'
import { WeekdayPanel } from './WeekdayPanel'
import { MonthlyPanel } from './MonthlyPanel'
import { PaymentPanel } from './PaymentPanel'
import { InvSupplierPanel } from './InvSupplierPanel'
import { ExpensesTrendPanel } from './ExpensesTrendPanel'
import { RevProfitTrendPanel } from './RevProfitTrendPanel'
import { CategoryPanel } from './CategoryPanel'
import { InvCategoryPanel } from './InvCategoryPanel'

/** §2 — welcome line, 11 metric cards, 10 analysis panels. */
export function DashboardPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const businessName = settings?.business.name?.trim() ?? ''

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <h2 className="text-2xl font-semibold">
        {t('dashboard.welcome')}
        {businessName !== '' ? `, ${businessName}` : ''}
      </h2>
      <MetricCards />
      <div className="grid items-start gap-4 md:grid-cols-2">
        <TopSellingPanel />
        <SupplierPanel />
        <WeekdayPanel />
        <MonthlyPanel />
        <PaymentPanel />
        <InvSupplierPanel />
        <ExpensesTrendPanel />
        <RevProfitTrendPanel />
        <CategoryPanel />
        <InvCategoryPanel />
      </div>
    </div>
  )
}
