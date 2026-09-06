import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
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
import { useInventoryValue } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { Panel } from './Panel'
import { ReportEmpty, ReportError, ReportLoading } from '@/pages/reports/ReportState'

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'] as const

function ValueToggle({
  mode,
  onChange
}: {
  mode: 'pie' | 'bar'
  onChange: (m: 'pie' | 'bar') => void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Select value={mode} onValueChange={(v) => onChange(v as 'pie' | 'bar')}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pie">{t('reportPage.pieChart')}</SelectItem>
        <SelectItem value="bar">{t('reportPage.barChart')}</SelectItem>
      </SelectContent>
    </Select>
  )
}

/** §2.7 — current stock value by supplier, pie/bar toggle. */
export function InvSupplierPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const [mode, setMode] = useState<'pie' | 'bar'>('pie')
  const { data, isPending, isError, refetch } = useInventoryValue('supplier')
  const currency = settings?.general.currency ?? 'USD'

  const config = { value: { label: t('reportPage.value'), color: 'var(--chart-2)' } } satisfies ChartConfig
  const total = round2((data ?? []).reduce((s, r) => s + r.value, 0))
  const totalItems = (data ?? []).reduce((s, r) => s + r.items, 0)

  return (
    <Panel title={t('dashboard.invSupplier')} controls={<ValueToggle mode={mode} onChange={setMode} />}>
      {isPending ? (
        <ReportLoading />
      ) : isError ? (
        <ReportError onRetry={() => void refetch()} />
      ) : !data || data.length === 0 ? (
        <ReportEmpty />
      ) : (
        <>
          {mode === 'pie' ? (
            <ChartContainer config={config} className="h-64 w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent formatter={chartMoneyFormatter(currency)} />} />
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={48}>
                  {data.map((r, i) => (
                    <Cell key={r.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          ) : (
            <ChartContainer config={config} className="h-64 w-full">
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={140} />
                <ChartTooltip content={<ChartTooltipContent formatter={chartMoneyFormatter(currency)} />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reportPage.supplierCol')}</TableHead>
                <TableHead className="text-right">{t('reportPage.value')}</TableHead>
                <TableHead className="text-right">{t('reportPage.items')}</TableHead>
                <TableHead className="text-right">{t('reportPage.share')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{r.name === '' ? '—' : r.name}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.value, currency)}</TableCell>
                  <TableCell className="text-right">{r.items}</TableCell>
                  <TableCell className="text-right">{r.share.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>{t('reportPage.total')}</TableCell>
                <TableCell className="text-right">{formatMoney(total, currency)}</TableCell>
                <TableCell className="text-right">{totalItems}</TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </>
      )}
    </Panel>
  )
}
