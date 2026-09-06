import { useMemo } from 'react'
import { CircleHelp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatMoney } from '@shared/money'
import { currentMonthRange, useFinancialMetrics, useInventoryOverview } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'

function MetricCard({
  label,
  help,
  value,
  error,
  onRetry,
  trend
}: {
  label: string
  help: string
  value: string | null
  error: boolean
  onRetry: () => void
  trend?: 'up' | 'down'
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-6">
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          {label}
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={label}>
                <CircleHelp className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-60">{help}</TooltipContent>
          </Tooltip>
        </p>
        {error ? (
          <span className="flex items-center gap-2 text-sm">
            {t('dashboard.failed')}
            <Button variant="outline" size="sm" onClick={onRetry}>
              {t('reportPage.retry')}
            </Button>
          </span>
        ) : value === null ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <span className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{value}</span>
            {trend && (
              <span className={trend === 'up' ? 'text-sm text-green-600' : 'text-sm text-red-500'}>
                {trend === 'up' ? '↑' : '↓'} {t(`dashboard.metrics.${trend === 'up' ? 'positive' : 'negative'}`)}
              </span>
            )}
          </span>
        )}
      </CardContent>
    </Card>
  )
}

/** §2.1 — eleven cards from two queries; each card fails/retries with its own query. */
export function MetricCards(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const currency = settings?.general.currency ?? 'USD'
  const range = useMemo(() => currentMonthRange(), [])
  const inv = useInventoryOverview()
  const fin = useFinancialMetrics(range)
  const m = (key: string): string => t(`dashboard.metrics.${key}`)

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <MetricCard label={m('totalProducts')} help={t('dashboard.metrics.totalProductsHelp')} value={inv.data ? String(inv.data.totalProducts) : null} error={inv.isError} onRetry={() => void inv.refetch()} />
      <MetricCard label={m('lowStock')} help={t('dashboard.metrics.lowStockHelp')} value={inv.data ? String(inv.data.lowStockItems) : null} error={inv.isError} onRetry={() => void inv.refetch()} />
      <MetricCard label={m('todaySales')} help={t('dashboard.metrics.todaySalesHelp')} value={inv.data ? formatMoney(inv.data.todaySales, currency) : null} error={inv.isError} onRetry={() => void inv.refetch()} />
      <MetricCard label={m('monthlyRevenue')} help={t('dashboard.metrics.monthlyRevenueHelp')} value={fin.data ? formatMoney(fin.data.revenue, currency) : null} error={fin.isError} onRetry={() => void fin.refetch()} />
      <MetricCard label={m('monthlyProfit')} help={t('dashboard.metrics.monthlyProfitHelp')} value={fin.data ? formatMoney(fin.data.profit, currency) : null} error={fin.isError} onRetry={() => void fin.refetch()} />
      <MetricCard label={m('margin')} help={t('dashboard.metrics.marginHelp')} value={fin.data ? `${fin.data.margin.toFixed(1)}%` : null} error={fin.isError} onRetry={() => void fin.refetch()} />
      <MetricCard label={m('turnover')} help={t('dashboard.metrics.turnoverHelp')} value={inv.data ? `${inv.data.turnover.toFixed(1)}x` : null} error={inv.isError} onRetry={() => void inv.refetch()} />
      <MetricCard label={m('inventoryValue')} help={t('dashboard.metrics.inventoryValueHelp')} value={inv.data ? formatMoney(inv.data.inventoryValue, currency) : null} error={inv.isError} onRetry={() => void inv.refetch()} />
      <MetricCard label={m('monthlyExpenses')} help={t('dashboard.metrics.monthlyExpensesHelp')} value={fin.data ? formatMoney(fin.data.expenses, currency) : null} error={fin.isError} onRetry={() => void fin.refetch()} />
      <MetricCard label={m('totalCash')} help={t('dashboard.metrics.totalCashHelp')} value={fin.data ? formatMoney(fin.data.totalCash, currency) : null} error={fin.isError} onRetry={() => void fin.refetch()} trend={fin.data && fin.data.totalCash < 0 ? 'down' : 'up'} />
      <MetricCard label={m('revenueDiff')} help={t('dashboard.metrics.revenueDiffHelp')} value={fin.data ? formatMoney(fin.data.revenueExpenseDiff, currency) : null} error={fin.isError} onRetry={() => void fin.refetch()} trend={fin.data && fin.data.revenueExpenseDiff < 0 ? 'down' : 'up'} />
    </div>
  )
}
