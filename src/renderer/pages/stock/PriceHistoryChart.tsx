import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { formatMoney, type StoreCurrency } from '@shared/money'
import { formatDateTime } from '@shared/dates'
import { usePriceHistory } from '@/hooks/useStock'
import { useSettings } from '@/hooks/useSettings'

interface HistoryDatum {
  at: string
  cost: number | null
  selling: number | null
  note: string | null
}

interface HistoryTooltipProps {
  active?: boolean
  label?: string | number
  payload?: Array<{ payload: HistoryDatum }>
  currency: StoreCurrency
  costLabel: string
  sellingLabel: string
}

/** Tooltip with labeled prices plus the saved note for that movement. */
function HistoryTooltip({
  active,
  label,
  payload,
  currency,
  costLabel,
  sellingLabel
}: HistoryTooltipProps): React.JSX.Element | null {
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null
  return (
    <div className="grid min-w-[10rem] max-w-[16rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{label}</div>
      <div className="grid gap-1.5">
        {datum.cost !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: 'var(--chart-1)' }}
              />
              {costLabel}
            </span>
            <span className="font-mono font-medium tabular-nums">
              {formatMoney(datum.cost, currency)}
            </span>
          </div>
        )}
        {datum.selling !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: 'var(--chart-2)' }}
              />
              {sellingLabel}
            </span>
            <span className="font-mono font-medium tabular-nums">
              {formatMoney(datum.selling, currency)}
            </span>
          </div>
        )}
      </div>
      {datum.note && (
        <p className="border-t border-border/50 pt-1.5 break-words text-muted-foreground">
          {datum.note}
        </p>
      )}
    </div>
  )
}

/** Cost vs selling trail from the movement log (user-requested addition to §5). */
export function PriceHistoryChart({ productId }: { productId: number }): React.JSX.Element | null {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data } = usePriceHistory(productId)
  const currency = settings?.general.currency ?? 'USD'
  const dateFormat = settings?.general.dateFormat ?? 'MM/DD/YYYY'

  const points: HistoryDatum[] = (data ?? []).map((p) => ({
    at: formatDateTime(p.createdAt, dateFormat),
    cost: p.costPrice,
    selling: p.sellingPrice,
    // The empty-note filler carries no information, so hide it.
    note: p.reason && p.reason !== 'Stock adjustment' ? p.reason : null
  }))
  if (points.length === 0) return null

  const config = {
    cost: { label: t('stock.historyCost'), color: 'var(--chart-1)' },
    selling: { label: t('stock.historySelling'), color: 'var(--chart-2)' }
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
              content={
                <HistoryTooltip
                  currency={currency}
                  costLabel={t('stock.historyCost')}
                  sellingLabel={t('stock.historySelling')}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line type="monotone" dataKey="cost" stroke="var(--color-cost)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="selling" stroke="var(--color-selling)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
