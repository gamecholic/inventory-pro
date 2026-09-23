import { useMemo, type ReactNode } from 'react'
import { CircleHelp, Package, TrendingUp, Wallet } from 'lucide-react'
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
  trend,
  sub
}: {
  label: string
  help: ReactNode
  value: string | null
  error: boolean
  onRetry: () => void
  trend?: 'up' | 'down'
  sub?: string | null
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Card className="gap-0 py-3">
      <CardContent className="flex min-h-[92px] flex-col justify-center gap-0.5 px-4">
        <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground">
          {label}
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={label} className="-m-1 p-1">
                <CircleHelp className="size-4" />
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
          <span className="flex flex-col gap-1.5">
            <Skeleton className="h-7 w-24" />
            {sub !== undefined && <Skeleton className="h-3 w-32" />}
          </span>
        ) : (
          <span className="flex flex-col gap-1">
            <span className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{value}</span>
              {trend && (
                <span className={trend === 'up' ? 'text-sm text-green-600' : 'text-sm text-red-500'}>
                  {trend === 'up' ? '↑' : '↓'} {t(`dashboard.metrics.${trend === 'up' ? 'positive' : 'negative'}`)}
                </span>
              )}
            </span>
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          </span>
        )}
      </CardContent>
    </Card>
  )
}

/** One labeled row inside a composite card tooltip: bold metric name + its definition. */
function HelpRow({ name, text }: { name: string; text: string }): React.JSX.Element {
  return (
    <p>
      <span className="font-semibold">{name}: </span>
      {text}
    </p>
  )
}

/** §2.1 — all eleven metrics merged into six cards (one query per card). */
export function MetricCards(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const currency = settings?.general.currency ?? 'USD'
  const range = useMemo(() => currentMonthRange(), [])
  const inv = useInventoryOverview()
  const fin = useFinancialMetrics(range)
  const m = (key: string): string => t(`dashboard.metrics.${key}`)
  const retryInv = (): void => void inv.refetch()
  const retryFin = (): void => void fin.refetch()

  // Turnover reads 0.0x when costs are missing (products with cost 0) or the
  // ratio is tiny enough to round away. Show — for the missing-data case and
  // two decimals below 1x so small but real movement stays visible.
  const noCostData =
    inv.data !== undefined && fin.data !== undefined && inv.data.monthCogs === 0 && fin.data.revenue > 0
  const turnoverSub =
    inv.data === undefined
      ? null
      : noCostData || inv.data.inventoryValue <= 0
        ? `${m('turnover')}: — · ${t('dashboard.metrics.noCostData')}`
        : `${m('turnover')}: ${inv.data.turnover < 1 ? inv.data.turnover.toFixed(2) : inv.data.turnover.toFixed(1)}x`

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <section aria-label={t('dashboard.sections.sales')} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <TrendingUp className="size-4" aria-hidden />
          {t('dashboard.sections.sales')}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <MetricCard label={m('todaySales')} help={t('dashboard.metrics.todaySalesHelp')} value={inv.data ? formatMoney(inv.data.todaySales, currency) : null} error={inv.isError} onRetry={retryInv} />
          <MetricCard
            label={m('monthlyRevenue')}
            help={
              <span className="flex flex-col gap-1.5">
                <HelpRow name={m('monthlyRevenue')} text={t('dashboard.metrics.monthlyRevenueHelp')} />
                <HelpRow name={m('monthlyProfit')} text={t('dashboard.metrics.monthlyProfitHelp')} />
                <HelpRow name={m('margin')} text={t('dashboard.metrics.marginHelp')} />
              </span>
            }
            value={fin.data ? formatMoney(fin.data.revenue, currency) : null}
            error={fin.isError}
            onRetry={retryFin}
            sub={fin.data ? `${m('monthlyProfit')}: ${formatMoney(fin.data.profit, currency)} · ${m('margin')}: ${fin.data.margin.toFixed(1)}%` : null}
          />
        </div>
      </section>
      <section aria-label={t('dashboard.sections.inventory')} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Package className="size-4" aria-hidden />
          {t('dashboard.sections.inventory')}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <MetricCard
            label={m('lowStock')}
            help={
              <span className="flex flex-col gap-1.5">
                <HelpRow name={m('lowStock')} text={t('dashboard.metrics.lowStockHelp')} />
                <HelpRow name={m('totalProducts')} text={t('dashboard.metrics.totalProductsHelp')} />
              </span>
            }
            value={inv.data ? String(inv.data.lowStockItems) : null}
            error={inv.isError}
            onRetry={retryInv}
            sub={inv.data ? `${m('totalProducts')}: ${inv.data.totalProducts}` : null}
          />
          <MetricCard
            label={m('inventoryValue')}
            help={
              <span className="flex flex-col gap-1.5">
                <HelpRow name={m('inventoryValue')} text={t('dashboard.metrics.inventoryValueHelp')} />
                <HelpRow name={m('turnover')} text={t('dashboard.metrics.turnoverHelp')} />
              </span>
            }
            value={inv.data ? formatMoney(inv.data.inventoryValue, currency) : null}
            error={inv.isError}
            onRetry={retryInv}
            sub={turnoverSub}
          />
        </div>
      </section>
      <section aria-label={t('dashboard.sections.cash')} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Wallet className="size-4" aria-hidden />
          {t('dashboard.sections.cash')}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <MetricCard label={m('monthlyExpenses')} help={t('dashboard.metrics.monthlyExpensesHelp')} value={fin.data ? formatMoney(fin.data.expenses, currency) : null} error={fin.isError} onRetry={retryFin} />
          <MetricCard
            label={m('totalCash')}
            help={
              <span className="flex flex-col gap-1.5">
                <HelpRow name={m('totalCash')} text={t('dashboard.metrics.totalCashHelp')} />
                <HelpRow name={m('revenueDiff')} text={t('dashboard.metrics.revenueDiffHelp')} />
              </span>
            }
            value={fin.data ? formatMoney(fin.data.totalCash, currency) : null}
            error={fin.isError}
            onRetry={retryFin}
            trend={fin.data && fin.data.totalCash < 0 ? 'down' : 'up'}
            sub={fin.data ? `${m('revenueDiff')}: ${formatMoney(fin.data.revenueExpenseDiff, currency)}` : null}
          />
        </div>
      </section>
    </div>
  )
}
