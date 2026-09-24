import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from 'date-fns'
import {
  Archive,
  Boxes,
  CreditCard,
  LayoutGrid,
  Link2,
  Package,
  Receipt,
  ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
  Warehouse,
  type LucideIcon
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DateRange } from 'react-day-picker'
import { DateRangePicker } from '@/components/date-range-picker'
import { dayBounds, toISO } from '@shared/dates'
import type { RangeInput } from '@shared/analytics'
import { BasketReport } from './BasketReport'
import { CardFeeReport } from './CardFeeReport'
import { CategoryReport } from './CategoryReport'
import { DeadStockReport } from './DeadStockReport'
import { DiscountReport } from './DiscountReport'
import { AffinityReport } from './AffinityReport'
import { MarginReport } from './MarginReport'
import { InventoryValueReport } from './InventoryValueReport'
import { SupplierValueReport } from './SupplierValueReport'
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
  | 'affinity'
  | 'lowMargin'
  | 'invValue'
  | 'supValue'

const NO_RANGE_REPORTS: ReadonlySet<ReportKey> = new Set(['reorder', 'deadStock', 'invValue', 'supValue'])

const REPORT_GROUPS: Array<{ labelKey: string; items: Array<{ key: ReportKey; icon: LucideIcon }> }> = [
  {
    labelKey: 'reportPage.performance',
    items: [
      { key: 'financial', icon: Wallet },
      { key: 'topProducts', icon: TrendingUp },
      { key: 'basket', icon: ShoppingCart },
      { key: 'discounts', icon: Tag }
    ]
  },
  {
    labelKey: 'reportPage.payments',
    items: [
      { key: 'payment', icon: CreditCard },
      { key: 'cardFees', icon: Receipt }
    ]
  },
  {
    labelKey: 'reportPage.breakdowns',
    items: [
      { key: 'supplier', icon: Truck },
      { key: 'category', icon: LayoutGrid },
      { key: 'invValue', icon: Boxes },
      { key: 'supValue', icon: Warehouse }
    ]
  },
  {
    labelKey: 'reportPage.stockActions',
    items: [
      { key: 'reorder', icon: Package },
      { key: 'deadStock', icon: Archive },
      { key: 'lowMargin', icon: TrendingDown },
      { key: 'affinity', icon: Link2 }
    ]
  }
]

/** §8 — report sidebar, range applies instantly on commit. */
export function ReportsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [report, setReport] = useState<ReportKey>('financial')
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const now = new Date()
    return { from: startOfDay(startOfMonth(now)), to: endOfDay(endOfMonth(now)) }
  })
  const [applied, setApplied] = useState<RangeInput>(() => {
    const now = new Date()
    return { from: toISO(startOfDay(startOfMonth(now))), to: toISO(endOfDay(endOfMonth(now))) }
  })

  const commitRange = (r: DateRange | undefined): void => {
    setRange(r)
    if (r?.from && r?.to) setApplied(dayBounds({ from: r.from, to: r.to }))
  }

  const reportTrigger = ({ key, icon: Icon }: { key: ReportKey; icon: LucideIcon }): React.JSX.Element => (
    <TabsTrigger key={key} value={key} className="justify-start gap-2 px-3">
      <Icon className="size-4 shrink-0" aria-hidden />
      {t(`reportPage.${key}`)}
    </TabsTrigger>
  )

  return (
    <div className="px-4 lg:px-6">
      <Tabs
        orientation="vertical"
        value={report}
        onValueChange={(value) => setReport(value as ReportKey)}
        className="flex-col gap-6 md:flex-row"
      >
        <TabsList className="h-fit w-full shrink-0 flex-col items-stretch gap-1 p-1.5 md:w-60">
          {REPORT_GROUPS.map((group, i) => (
            <Fragment key={group.labelKey}>
              <p
                className={
                  i === 0
                    ? 'px-3 pt-1 text-xs font-medium text-muted-foreground'
                    : 'px-3 pt-2 text-xs font-medium text-muted-foreground'
                }
              >
                {t(group.labelKey)}
              </p>
              {group.items.map(reportTrigger)}
            </Fragment>
          ))}
        </TabsList>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {!NO_RANGE_REPORTS.has(report) && (
            <div className="flex flex-wrap items-end gap-2">
              <DateRangePicker range={range} onSelect={commitRange} />
            </div>
          )}
          <TabsContent value="financial" className="mt-0">
            <FinancialReport range={applied} />
          </TabsContent>
          <TabsContent value="topProducts" className="mt-0">
            <TopProductsReport range={applied} />
          </TabsContent>
          <TabsContent value="payment" className="mt-0">
            <PaymentReport range={applied} />
          </TabsContent>
          <TabsContent value="supplier" className="mt-0">
            <SupplierReport range={applied} />
          </TabsContent>
          <TabsContent value="category" className="mt-0">
            <CategoryReport range={applied} />
          </TabsContent>
          <TabsContent value="reorder" className="mt-0">
            <ReorderReport />
          </TabsContent>
          <TabsContent value="deadStock" className="mt-0">
            <DeadStockReport />
          </TabsContent>
          <TabsContent value="basket" className="mt-0">
            <BasketReport range={applied} />
          </TabsContent>
          <TabsContent value="discounts" className="mt-0">
            <DiscountReport range={applied} />
          </TabsContent>
          <TabsContent value="cardFees" className="mt-0">
            <CardFeeReport range={applied} />
          </TabsContent>
          <TabsContent value="affinity" className="mt-0">
            <AffinityReport range={applied} />
          </TabsContent>
          <TabsContent value="lowMargin" className="mt-0">
            <MarginReport range={applied} />
          </TabsContent>
          <TabsContent value="invValue" className="mt-0">
            <InventoryValueReport />
          </TabsContent>
          <TabsContent value="supValue" className="mt-0">
            <SupplierValueReport />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
