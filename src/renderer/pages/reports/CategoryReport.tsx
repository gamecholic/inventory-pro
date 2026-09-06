import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, XAxis, YAxis } from 'recharts'
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
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart'
import { chartMoneyFormatter, formatMoney, round2 } from '@shared/money'
import type { RangeInput } from '@shared/analytics'
import { useCategoryReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { PeriodLabel, ReportEmpty, ReportError, ReportLoading } from './ReportState'

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'] as const

/** §8.5 — Profit-vs-Cost bars or profit-share pie, plus table with overall margin. */
export function CategoryReport({ range }: { range: RangeInput }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const [mode, setMode] = useState<'bar' | 'pie'>('bar')
  const { data, isPending, isError, refetch } = useCategoryReport(range)
  const currency = settings?.general.currency ?? 'USD'

  const config = {
    profit: { label: t('reportPage.profit'), color: 'var(--chart-2)' },
    cost: { label: t('reportPage.cost'), color: 'var(--chart-4)' }
  } satisfies ChartConfig

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => void refetch()} />
  if (!data || data.length === 0) return <ReportEmpty />

  const totalRevenue = round2(data.reduce((s, r) => s + r.revenue, 0))
  const totalCost = round2(data.reduce((s, r) => s + r.cost, 0))
  const totalProfit = round2(data.reduce((s, r) => s + r.profit, 0))
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.category')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.categoryDesc')}</p>
        <PeriodLabel range={range} />
      </div>
      <div className="flex items-center gap-2">
        <Select value={mode} onValueChange={(v) => setMode(v as 'bar' | 'pie')}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bar">{t('reportPage.barChart')}</SelectItem>
            <SelectItem value="pie">{t('reportPage.pieChart')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === 'bar' ? (
        <ChartContainer config={config} className="h-72 w-full">
          <BarChart data={data.map((r) => ({ name: r.name === '' ? '—' : r.name, profit: r.profit, cost: r.cost }))}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={64} />
            <ChartTooltip content={<ChartTooltipContent formatter={chartMoneyFormatter(currency)} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="profit" fill="var(--color-profit)" radius={4} />
            <Bar dataKey="cost" fill="var(--color-cost)" radius={4} />
          </BarChart>
        </ChartContainer>
      ) : (
        <ChartContainer config={config} className="h-72 w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent formatter={chartMoneyFormatter(currency)} />} />
            <Pie data={data} dataKey="profit" nameKey="name" innerRadius={48}>
              {data.map((r, i) => (
                <Cell key={r.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
          </PieChart>
        </ChartContainer>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('reportPage.categoryCol')}</TableHead>
            <TableHead className="text-right">{t('reportPage.revenue')}</TableHead>
            <TableHead className="text-right">{t('reportPage.cost')}</TableHead>
            <TableHead className="text-right">{t('reportPage.profit')}</TableHead>
            <TableHead className="text-right">{t('reportPage.margin')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={`${r.categoryId ?? 'x'}-${r.name}`}>
              <TableCell>{r.name === '' ? '—' : r.name}</TableCell>
              <TableCell className="text-right">{formatMoney(r.revenue, currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(r.cost, currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(r.profit, currency)}</TableCell>
              <TableCell className="text-right">{r.margin.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>{t('reportPage.total')}</TableCell>
            <TableCell className="text-right">{formatMoney(totalRevenue, currency)}</TableCell>
            <TableCell className="text-right">{formatMoney(totalCost, currency)}</TableCell>
            <TableCell className="text-right">{formatMoney(totalProfit, currency)}</TableCell>
            <TableCell className="text-right">{overallMargin.toFixed(1)}%</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <p className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
        {t('reportPage.discountWarning')}
      </p>
    </div>
  )
}
