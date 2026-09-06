import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { chartMoneyFormatter, formatMoney, round2 } from '@shared/money'
import type { RangeInput } from '@shared/analytics'
import { useSupplierReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { PeriodLabel, ReportEmpty, ReportError, ReportLoading } from './ReportState'

/** §8.4 — grouped Revenue/Profit bars plus table with overall margin. */
export function SupplierReport({ range }: { range: RangeInput }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data, isPending, isError, refetch } = useSupplierReport(range)
  const currency = settings?.general.currency ?? 'USD'

  const config = {
    revenue: { label: t('reportPage.revenue'), color: 'var(--chart-2)' },
    profit: { label: t('reportPage.profit'), color: 'var(--chart-4)' }
  } satisfies ChartConfig

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => void refetch()} />
  if (!data || data.length === 0) return <ReportEmpty />

  const totalRevenue = round2(data.reduce((s, r) => s + r.revenue, 0))
  const totalProfit = round2(data.reduce((s, r) => s + r.profit, 0))
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.supplier')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.supplierDesc')}</p>
        <PeriodLabel range={range} />
      </div>
      <ChartContainer config={config} className="h-72 w-full">
        <BarChart data={data.map((r) => ({ name: r.name === '' ? '—' : r.name, revenue: r.revenue, profit: r.profit }))}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={64} />
          <ChartTooltip content={<ChartTooltipContent formatter={chartMoneyFormatter(currency)} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
          <Bar dataKey="profit" fill="var(--color-profit)" radius={4} />
        </BarChart>
      </ChartContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('reportPage.supplierCol')}</TableHead>
            <TableHead className="text-right">{t('reportPage.revenue')}</TableHead>
            <TableHead className="text-right">{t('reportPage.profit')}</TableHead>
            <TableHead className="text-right">{t('reportPage.margin')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={`${r.supplierId ?? 'x'}-${r.name}`}>
              <TableCell>{r.name === '' ? '—' : r.name}</TableCell>
              <TableCell className="text-right">{formatMoney(r.revenue, currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(r.profit, currency)}</TableCell>
              <TableCell className="text-right">{r.margin.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>{t('reportPage.total')}</TableCell>
            <TableCell className="text-right">{formatMoney(totalRevenue, currency)}</TableCell>
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
