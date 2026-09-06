import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from 'date-fns'
import { Button } from '@/components/ui/button'
import type { DateRange } from 'react-day-picker'
import { DateRangePicker } from '@/components/date-range-picker'
import { toISO } from '@shared/dates'
import type { RangeInput } from '@shared/analytics'
import { BasketReport } from './BasketReport'
import { CardFeeReport } from './CardFeeReport'
import { CategoryReport } from './CategoryReport'
import { DeadStockReport } from './DeadStockReport'
import { DiscountReport } from './DiscountReport'
import { FinancialReport } from './FinancialReport'
import { PaymentReport } from './PaymentReport'
import { ReorderReport } from './ReorderReport'
import { SupplierReport } from './SupplierReport'
import { TopProductsReport } from './TopProductsReport'

type ReportKey =
  | 'financial'
  | 'topProducts'
  | 'payment'
  | 'supplier'
  | 'category'
  | 'reorder'
  | 'deadStock'
  | 'basket'
  | 'discounts'
  | 'cardFees'

const SPEC_REPORTS: ReportKey[] = ['financial', 'topProducts', 'payment', 'supplier', 'category']
const INSIGHT_REPORTS: ReportKey[] = ['reorder', 'deadStock', 'basket', 'discounts', 'cardFees']

/** §8 — report sidebar, draft range committed only via Generate Report. */
export function ReportsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [report, setReport] = useState<ReportKey>('financial')
  const [draft, setDraft] = useState<DateRange | undefined>(() => {
    const now = new Date()
    return { from: startOfDay(startOfMonth(now)), to: endOfDay(endOfMonth(now)) }
  })
  const [applied, setApplied] = useState<RangeInput>(() => {
    const now = new Date()
    return { from: toISO(startOfDay(startOfMonth(now))), to: toISO(endOfDay(endOfMonth(now))) }
  })

  const groupButton = (key: ReportKey): React.JSX.Element => (
    <Button
      key={key}
      variant={report === key ? 'secondary' : 'ghost'}
      className="justify-start"
      onClick={() => setReport(key)}
    >
      {t(`reportPage.${key}`)}
    </Button>
  )

  return (
    <div className="px-4 lg:px-6">
      <h2 className="mb-4 text-2xl font-semibold">{t('reportPage.title')}</h2>
      <div className="grid items-start gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 rounded-lg border border-border p-3">
          <div className="flex flex-col gap-1">
            <p className="px-2 text-xs font-medium text-muted-foreground">{t('reportPage.types')}</p>
            {SPEC_REPORTS.map(groupButton)}
          </div>
          <div className="flex flex-col gap-1">
            <p className="px-2 text-xs font-medium text-muted-foreground">{t('reportPage.insights')}</p>
            {INSIGHT_REPORTS.map(groupButton)}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {report !== 'reorder' && report !== 'deadStock' && (
            <div className="flex flex-wrap items-end gap-2">
              <DateRangePicker range={draft} onSelect={setDraft} />
              <Button
                disabled={!draft?.from || !draft?.to}
                onClick={() => {
                  if (!draft?.from || !draft?.to) return
                  setApplied({ from: toISO(startOfDay(draft.from)), to: toISO(endOfDay(draft.to)) })
                }}
              >
                {t('reportPage.generate')}
              </Button>
            </div>
          )}
          {report === 'financial' && <FinancialReport range={applied} />}
          {report === 'topProducts' && <TopProductsReport range={applied} />}
          {report === 'payment' && <PaymentReport range={applied} />}
          {report === 'supplier' && <SupplierReport range={applied} />}
          {report === 'category' && <CategoryReport range={applied} />}
          {report === 'reorder' && <ReorderReport />}
          {report === 'deadStock' && <DeadStockReport />}
          {report === 'basket' && <BasketReport range={applied} />}
          {report === 'discounts' && <DiscountReport range={applied} />}
          {report === 'cardFees' && <CardFeeReport range={applied} />}
        </div>
      </div>
    </div>
  )
}
