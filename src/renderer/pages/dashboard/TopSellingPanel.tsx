import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { subDays } from 'date-fns'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
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
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatMoney, round2 } from '@shared/money'
import { toISO } from '@shared/dates'
import type { RangeInput } from '@shared/analytics'
import { currentMonthRange, useTopProductsReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { Panel } from './Panel'
import { ReportEmpty, ReportError, ReportLoading } from '@/pages/reports/ReportState'

type Sort = 'revenue' | 'profit' | 'quantity'
type Period = 'week' | 'month' | 'year'

function rangeFor(period: Period): RangeInput {
  const now = new Date()
  if (period === 'week') {
    const from = subDays(now, 6)
    from.setHours(0, 0, 0, 0)
    return { from: toISO(from), to: now.toISOString() }
  }
  if (period === 'month') return currentMonthRange()
  const start = new Date(now.getFullYear(), 0, 1)
  return { from: toISO(start), to: now.toISOString() }
}

/** §2.2 — same aggregation as the report, with Week/Month/Year presets. */
export function TopSellingPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const [sort, setSort] = useState<Sort>('revenue')
  const [limit, setLimit] = useState(10)
  const [period, setPeriod] = useState<Period>('month')
  const { data, isPending, isError, refetch } = useTopProductsReport({ ...rangeFor(period), sort, limit })
  const currency = settings?.general.currency ?? 'USD'

  const config = { value: { label: t('reportPage.value'), color: 'var(--chart-2)' } } satisfies ChartConfig
  const fmtValue = (v: number): string => (sort === 'quantity' ? String(v) : formatMoney(v, currency))

  return (
    <Panel
      title={t('dashboard.topProducts')}
      controls={
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Label>{t('reportPage.sortBy')}</Label>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">{t('reportPage.byRevenue')}</SelectItem>
                <SelectItem value="profit">{t('reportPage.byProfit')}</SelectItem>
                <SelectItem value="quantity">{t('reportPage.byQuantity')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label>{t('reportPage.show')}</Label>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">{t('dashboard.periodWeek')}</SelectItem>
                <SelectItem value="month">{t('dashboard.periodMonth')}</SelectItem>
                <SelectItem value="year">{t('dashboard.periodYear')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    >
      {isPending ? (
        <ReportLoading />
      ) : isError ? (
        <ReportError onRetry={() => void refetch()} />
      ) : !data || data.length === 0 ? (
        <ReportEmpty />
      ) : (
        <>
          <ChartContainer config={config} className="h-64 w-full">
            <BarChart
              data={data.map((r) => ({
                name: r.name,
                value: sort === 'quantity' ? r.quantity : sort === 'profit' ? r.profit : r.revenue
              }))}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={140} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtValue(Number(v))} />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={4} />
            </BarChart>
          </ChartContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reportPage.product')}</TableHead>
                <TableHead className="text-right">{t('reportPage.quantity')}</TableHead>
                <TableHead className="text-right">{t('reportPage.revenue')}</TableHead>
                <TableHead className="text-right">{t('reportPage.profit')}</TableHead>
                <TableHead className="text-right">{t('reportPage.margin')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={`${r.productId ?? 'x'}-${r.name}`}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{r.quantity}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.revenue, currency)}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.profit, currency)}</TableCell>
                  <TableCell className="text-right">{r.margin.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>{t('reportPage.total')}</TableCell>
                <TableCell className="text-right">{data.reduce((s, r) => s + r.quantity, 0)}</TableCell>
                <TableCell className="text-right">
                  {formatMoney(round2(data.reduce((s, r) => s + r.revenue, 0)), currency)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(round2(data.reduce((s, r) => s + r.profit, 0)), currency)}
                </TableCell>
                <TableCell className="text-right">
                  {(() => {
                    const rev = data.reduce((s, r) => s + r.revenue, 0)
                    const prof = data.reduce((s, r) => s + r.profit, 0)
                    return `${rev > 0 ? ((prof / rev) * 100).toFixed(1) : '0.0'}%`
                  })()}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </>
      )}
    </Panel>
  )
}
