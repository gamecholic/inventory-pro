import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatMoney, type StoreCurrency } from '@shared/money'
import { useYearComparisonReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { ReportEmpty, ReportError, ReportLoading } from './ReportState'

type Metric = 'revenue' | 'profit'

/** This year plus the five before it — a shop can still compare an older year. */
const YEAR_SPAN = 6

/**
 * Signed change: percentage when there is a baseline, otherwise the money
 * move (last year had nothing to divide by, or was a loss). "—" only when
 * nothing moved at all.
 */
function DeltaCell({
  pct,
  delta,
  currency
}: {
  pct: number | null
  delta: number
  currency: StoreCurrency
}): React.JSX.Element {
  if (pct === null) {
    if (delta === 0) return <TableCell className="text-right text-muted-foreground">—</TableCell>
    const tone = delta > 0 ? 'text-green-600 dark:text-green-500' : 'text-destructive'
    const arrow = delta > 0 ? '↑' : '↓'
    return (
      <TableCell className={`text-right tabular-nums ${tone}`} title={formatMoney(delta, currency)}>
        {arrow} {formatMoney(Math.abs(delta), currency)}
      </TableCell>
    )
  }
  const tone =
    pct > 0 ? 'text-green-600 dark:text-green-500' : pct < 0 ? 'text-destructive' : 'text-muted-foreground'
  const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : ''
  return (
    <TableCell
      className={`text-right tabular-nums ${tone}`}
      title={`${delta > 0 ? '+' : ''}${formatMoney(delta, currency)}`}
    >
      {arrow} {Math.abs(pct).toFixed(1)}%
    </TableCell>
  )
}

/** Year-over-year: this year's revenue and profit against the same months last year. */
export function YearComparisonReport(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { data: settings } = useSettings()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear)
  const [metric, setMetric] = useState<Metric>('revenue')
  const { data, isPending, isError, refetch } = useYearComparisonReport(year)
  const currency = settings?.general.currency ?? 'USD'
  const locale = i18n.language === 'tr' ? tr : enUS
  const metricLabel = metric === 'revenue' ? t('reportPage.revenue') : t('reportPage.profit')

  const years = useMemo(() => Array.from({ length: YEAR_SPAN }, (_, i) => currentYear - i), [currentYear])
  const prevYear = data?.prevYear ?? year - 1

  const chartData = useMemo(
    () =>
      (data?.rows ?? []).map((r) => ({
        month: format(new Date(year, r.month - 1, 1), 'MMM', { locale }),
        current: metric === 'revenue' ? r.revenue : r.profit,
        previous: metric === 'revenue' ? r.prevRevenue : r.prevProfit
      })),
    [data, metric, year, locale]
  )

  const config = useMemo(
    () =>
      ({
        // This year in the strong blue, last year in the muted one.
        current: { label: String(year), color: 'var(--chart-2)' },
        previous: { label: String(prevYear), color: 'var(--chart-1)' }
      }) satisfies ChartConfig,
    [year, prevYear]
  )

  /**
   * A money `formatter` replaces the whole tooltip row, so the year and the
   * bar colour have to be put back by hand — otherwise two bare amounts sit
   * under the month with no way to tell which year is which.
   */
  const tooltipFormatter = useMemo(
    () =>
      (value: unknown, name: unknown): React.JSX.Element => {
        const key = String(name)
        const label = key === 'current' ? String(year) : key === 'previous' ? String(prevYear) : key
        const color = key === 'current' ? 'var(--chart-2)' : 'var(--chart-1)'
        return (
          <div className="flex flex-1 items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span className="text-muted-foreground">{label}</span>
            </span>
            <span className="font-mono font-medium text-foreground tabular-nums">
              {formatMoney(Number(value), currency)}
            </span>
          </div>
        )
      },
    [year, prevYear, currency]
  )

  const totals = data?.totals
  const hasData =
    totals !== undefined &&
    (totals.revenue !== 0 ||
      totals.profit !== 0 ||
      totals.prevRevenue !== 0 ||
      totals.prevProfit !== 0)

  const summary: Array<{
    label: string
    value: number
    pct: number | null
    delta: number
  }> = totals
    ? [
        {
          label: `${t('reportPage.revenue')} · ${year}`,
          value: totals.revenue,
          pct: totals.revenueDeltaPct,
          delta: totals.revenueDelta
        },
        {
          label: `${t('reportPage.profit')} · ${year}`,
          value: totals.profit,
          pct: totals.profitDeltaPct,
          delta: totals.profitDelta
        }
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.yearComparison')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.yearComparisonDesc')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="yearComparisonYear">{t('reportPage.year')}</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger id="yearComparisonYear" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y === currentYear
                    ? `${y} (${t('dashboard.thisYear')})`
                    : y === currentYear - 1
                      ? `${y} (${t('dashboard.lastYear')})`
                      : String(y)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="yearComparisonMetric">{t('reportPage.metric')}</Label>
          <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
            <SelectTrigger id="yearComparisonMetric" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">{t('reportPage.revenue')}</SelectItem>
              <SelectItem value="profit">{t('reportPage.profit')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isPending ? (
        <ReportLoading />
      ) : isError ? (
        <ReportError onRetry={() => void refetch()} />
      ) : !hasData || !data || !totals ? (
        <ReportEmpty />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {summary.map((s) => {
              const up = s.pct === null ? s.delta > 0 : s.pct > 0
              const down = s.pct === null ? s.delta < 0 : s.pct < 0
              const tone = up
                ? 'text-green-600 dark:text-green-500'
                : down
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              const arrow = up ? '↑' : down ? '↓' : ''
              const change =
                s.pct !== null
                  ? `${Math.abs(s.pct).toFixed(1)}%`
                  : s.delta !== 0
                    ? formatMoney(Math.abs(s.delta), currency)
                    : '—'
              return (
                <Card key={s.label}>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold">{formatMoney(s.value, currency)}</p>
                    <p className={`text-sm tabular-nums ${tone}`}>
                      {arrow} {change}{' '}
                      <span className="text-muted-foreground">
                        {t('reportPage.vsYear', { year: prevYear })}
                      </span>
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <ChartContainer config={config} className="h-72 w-full">
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tick={{ fontSize: 12 }}
              />
              <YAxis tickLine={false} axisLine={false} width={64} tick={{ fontSize: 12 }} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => `${label} · ${metricLabel}`}
                    formatter={tooltipFormatter}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="current" fill="var(--color-current)" radius={4} />
              <Bar dataKey="previous" fill="var(--color-previous)" radius={4} />
            </BarChart>
          </ChartContainer>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reportPage.month')}</TableHead>
                  <TableHead className="text-right">
                    {t('reportPage.revenue')}
                    <span className="block text-xs font-normal text-muted-foreground">{year}</span>
                  </TableHead>
                  <TableHead className="text-right">
                    {t('reportPage.revenue')}
                    <span className="block text-xs font-normal text-muted-foreground">{prevYear}</span>
                  </TableHead>
                  <TableHead className="text-right">{t('reportPage.change')}</TableHead>
                  <TableHead className="text-right">
                    {t('reportPage.profit')}
                    <span className="block text-xs font-normal text-muted-foreground">{year}</span>
                  </TableHead>
                  <TableHead className="text-right">
                    {t('reportPage.profit')}
                    <span className="block text-xs font-normal text-muted-foreground">{prevYear}</span>
                  </TableHead>
                  <TableHead className="text-right">{t('reportPage.change')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium">
                      {format(new Date(year, r.month - 1, 1), 'MMM', { locale })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.revenue, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(r.prevRevenue, currency)}
                    </TableCell>
                    <DeltaCell pct={r.revenueDeltaPct} delta={r.revenueDelta} currency={currency} />
                    <TableCell className="text-right tabular-nums">{formatMoney(r.profit, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(r.prevProfit, currency)}
                    </TableCell>
                    <DeltaCell pct={r.profitDeltaPct} delta={r.profitDelta} currency={currency} />
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell>{t('reportPage.total')}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(totals.revenue, currency)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatMoney(totals.prevRevenue, currency)}
                  </TableCell>
                  <DeltaCell pct={totals.revenueDeltaPct} delta={totals.revenueDelta} currency={currency} />
                  <TableCell className="text-right tabular-nums">{formatMoney(totals.profit, currency)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatMoney(totals.prevProfit, currency)}
                  </TableCell>
                  <DeltaCell pct={totals.profitDeltaPct} delta={totals.profitDelta} currency={currency} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
