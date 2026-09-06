import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import type { RangeInput } from '@shared/analytics'
import { useTopProductsReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { PeriodLabel, ReportEmpty, ReportError, ReportLoading } from './ReportState'

const SHOWS = [5, 10, 15, 20] as const
type Sort = 'revenue' | 'profit' | 'quantity'

/** §8.2 — horizontal bars plus table with Total footer. Revenue is pre-discount (see note). */
export function TopProductsReport({ range }: { range: RangeInput }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const [sort, setSort] = useState<Sort>('revenue')
  const [limit, setLimit] = useState<number>(10)
  const { data, isPending, isError, refetch } = useTopProductsReport({ ...range, sort, limit })
  const currency = settings?.general.currency ?? 'USD'

  const config = { value: { label: t('reportPage.value'), color: 'var(--chart-2)' } } satisfies ChartConfig

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => void refetch()} />
  if (!data || data.length === 0) return <ReportEmpty />

  const fmtValue = (v: number): string => (sort === 'quantity' ? String(v) : formatMoney(v, currency))
  const chartData = data.map((r) => ({
    name: r.name,
    value: sort === 'quantity' ? r.quantity : sort === 'profit' ? r.profit : r.revenue
  }))
  const totalQty = data.reduce((s, r) => s + r.quantity, 0)
  const totalRevenue = round2(data.reduce((s, r) => s + r.revenue, 0))
  const totalProfit = round2(data.reduce((s, r) => s + r.profit, 0))
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.topProducts')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.topProductsDesc')}</p>
        <PeriodLabel range={range} />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="tpSort">{t('reportPage.sortBy')}</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger id="tpSort" className="w-36">
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
          <Label htmlFor="tpShow">{t('reportPage.show')}</Label>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger id="tpShow" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHOWS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <ChartContainer config={config} className="h-72 w-full">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
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
            <TableCell className="text-right">{totalQty}</TableCell>
            <TableCell className="text-right">{formatMoney(totalRevenue, currency)}</TableCell>
            <TableCell className="text-right">{formatMoney(totalProfit, currency)}</TableCell>
            <TableCell className="text-right">{overallMargin.toFixed(1)}%</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <p className="text-xs text-muted-foreground">{t('reports.grossRevenueNote')}</p>
    </div>
  )
}
