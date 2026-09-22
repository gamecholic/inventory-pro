import { useTranslation } from 'react-i18next'
import { useSettings } from '@/hooks/useSettings'
import { MetricCards } from './MetricCards'
import { RhythmPanel } from './RhythmPanel'
import { ExpensesTrendPanel } from './ExpensesTrendPanel'
import { RevProfitTrendPanel } from './RevProfitTrendPanel'

/** §2 — welcome line, metric cards, 3 glanceable ops panels (breakdowns live in Reports). */
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
        <RevProfitTrendPanel />
        <ExpensesTrendPanel />
        <div className="md:col-span-2">
          <RhythmPanel />
        </div>
      </div>
    </div>
  )
}
