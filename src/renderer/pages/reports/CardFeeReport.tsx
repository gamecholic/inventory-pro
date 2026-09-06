import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatMoney } from '@shared/money'
import type { RangeInput } from '@shared/analytics'
import { useCardFeeReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { PeriodLabel, ReportEmpty, ReportError, ReportLoading } from './ReportState'

/** Vendor fees on card takings, from the Settings fee percent. */
export function CardFeeReport({ range }: { range: RangeInput }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data, isPending, isError, refetch } = useCardFeeReport(range)
  const currency = settings?.general.currency ?? 'USD'

  const config = { feeAmount: { label: t('reportPage.fee'), color: 'var(--chart-4)' } } satisfies ChartConfig

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => void refetch()} />
  if (!data || data.cardRevenue === 0) return <ReportEmpty />

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.cardFees')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.cardFeesDesc')}</p>
        <PeriodLabel range={range} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t('reportPage.cardRevenue')}</p>
            <p className="text-2xl font-bold">{formatMoney(data.cardRevenue, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t('reportPage.fee')} ({data.feePercent}%)</p>
            <p className="text-2xl font-bold text-destructive">{formatMoney(data.feeAmount, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t('reportPage.net')}</p>
            <p className="text-2xl font-bold">{formatMoney(data.netCard, currency)}</p>
          </CardContent>
        </Card>
      </div>
      <ChartContainer config={config} className="h-64 w-full">
        <BarChart data={data.perDay}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} />
          <YAxis tickLine={false} axisLine={false} width={64} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatMoney(Number(v), currency)} />} />
          <Bar dataKey="feeAmount" fill="var(--color-feeAmount)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
