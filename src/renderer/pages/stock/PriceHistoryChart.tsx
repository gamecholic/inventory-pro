import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatMoney } from '@shared/money'
import { formatISO } from '@shared/dates'
import { usePriceHistory } from '@/hooks/useStock'
import { useSettings } from '@/hooks/useSettings'

/** Cost vs selling trail from the movement log (user-requested addition to §5). */
export function PriceHistoryChart({ productId }: { productId: number }): React.JSX.Element | null {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data } = usePriceHistory(productId)
  const currency = settings?.general.currency ?? 'USD'
  const dateFormat = settings?.general.dateFormat ?? 'MM/DD/YYYY'

  const points = (data ?? []).map((p) => {
    const d = new Date(p.createdAt)
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return {
      at: `${formatISO(p.createdAt, dateFormat)} ${time}`,
      cost: p.costPrice,
      selling: p.sellingPrice
    }
  })
  if (points.length === 0) return null

  const config = {
    cost: { label: t('stock.currentCost'), color: 'var(--chart-1)' },
    selling: { label: t('stock.currentSelling'), color: 'var(--chart-2)' }
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('stock.historyTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <LineChart data={points} margin={{ left: 0, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="at" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v: number) => formatMoney(v, currency)}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value), currency)} />}
            />
            <Line type="monotone" dataKey="cost" stroke="var(--color-cost)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="selling" stroke="var(--color-selling)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
