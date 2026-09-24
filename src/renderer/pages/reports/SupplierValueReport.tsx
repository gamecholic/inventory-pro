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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart'
import { chartMoneyFormatter, formatMoney, round2 } from '@shared/money'
import { useInventoryValue } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { ReportEmpty, ReportError, ReportLoading } from './ReportState'

/** Current stock value distribution by supplier — a snapshot, no date range. */
export function SupplierValueReport(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data, isPending, isError, refetch } = useInventoryValue('supplier')
  const currency = settings?.general.currency ?? 'USD'

  const config = { value: { label: t('reportPage.value'), color: 'var(--chart-2)' } } satisfies ChartConfig
  const total = round2((data ?? []).reduce((s, r) => s + r.value, 0))
  const totalItems = (data ?? []).reduce((s, r) => s + r.items, 0)
  const truncateAxis = (s: string): string => (s.length > 18 ? `${s.slice(0, 17)}…` : s)

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => void refetch()} />
  if (!data || data.length === 0) return <ReportEmpty />

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.supValue')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.supValueDesc')}</p>
      </div>
      <ChartContainer config={config} className="h-64 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={140}
            tick={{ fontSize: 12 }}
            tickFormatter={(v: unknown): string => truncateAxis(String(v))}
          />
          <ChartTooltip content={<ChartTooltipContent formatter={chartMoneyFormatter(currency)} />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={4} />
        </BarChart>
      </ChartContainer>
      <div className="overflow-x-auto">
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
      </div>
    </div>
  )
}
