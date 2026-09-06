import { useMemo } from 'react'
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
import { currentMonthRange, useSupplierReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { Panel } from './Panel'
import { ReportEmpty, ReportError, ReportLoading } from '@/pages/reports/ReportState'

/** §2.3 — current month, grouped bars + table + discount note. */
export function SupplierPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const range = useMemo(() => currentMonthRange(), [])
  const { data, isPending, isError, refetch } = useSupplierReport(range)
  const currency = settings?.general.currency ?? 'USD'

  const config = {
    revenue: { label: t('reportPage.revenue'), color: 'var(--chart-2)' },
    profit: { label: t('reportPage.profit'), color: 'var(--chart-4)' }
  } satisfies ChartConfig

  const totalRevenue = round2((data ?? []).reduce((s, r) => s + r.revenue, 0))
  const totalProfit = round2((data ?? []).reduce((s, r) => s + r.profit, 0))

  return (
    <Panel title={t('dashboard.supplier')}>
      {isPending ? (
        <ReportLoading />
      ) : isError ? (
        <ReportError onRetry={() => void refetch()} />
      ) : !data || data.length === 0 ? (
        <ReportEmpty />
      ) : (
        <>
          <ChartContainer config={config} className="h-64 w-full">
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
                <TableCell className="text-right">
                  {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0'}%
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <p className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
            {t('reportPage.discountWarning')}
          </p>
        </>
      )}
    </Panel>
  )
}
