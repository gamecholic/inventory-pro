import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { formatMoney, round2 } from '@shared/money'
import type { RangeInput } from '@shared/analytics'
import { useLowMarginReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { PeriodLabel, ReportEmpty, ReportError, ReportLoading } from './ReportState'

const THRESHOLDS = [10, 20, 30] as const

/** Net margin per product with discounts prorated, worst first. */
export function MarginReport({ range }: { range: RangeInput }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const [threshold, setThreshold] = useState<number>(20)
  // Stable input: a fresh object every render would change the query key.
  const input = useMemo(() => ({ ...range, threshold, limit: 20 }), [range, threshold])
  const { data, isPending, isError, refetch } = useLowMarginReport(input)
  const currency = settings?.general.currency ?? 'USD'

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => void refetch()} />
  if (!data || data.length === 0) return <ReportEmpty />

  const lossCount = data.filter((r) => r.margin < 0).length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.lowMargin')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.lowMarginDesc')}</p>
        <PeriodLabel range={range} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>{t('reportPage.threshold')}</Label>
          <Select value={String(threshold)} onValueChange={(v) => setThreshold(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THRESHOLDS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{t('reportPage.flagged')}</p>
              <p className="text-2xl font-bold">{data.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{t('reportPage.loss')}</p>
              <p className="text-2xl font-bold text-destructive">{lossCount}</p>
            </CardContent>
          </Card>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('reportPage.product')}</TableHead>
            <TableHead className="text-right">{t('reportPage.quantity')}</TableHead>
            <TableHead className="text-right">{t('reportPage.netRevenue')}</TableHead>
            <TableHead className="text-right">{t('reportPage.profit')}</TableHead>
            <TableHead className="text-right">{t('reportPage.margin')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={`${r.productId ?? 'x'}-${r.name}`}>
              <TableCell>{r.name}</TableCell>
              <TableCell className="text-right">{r.quantity}</TableCell>
              <TableCell className="text-right">{formatMoney(r.netRevenue, currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(r.profit, currency)}</TableCell>
              <TableCell className="text-right">
                <Badge variant={r.margin < 0 ? 'destructive' : 'default'}>{r.margin.toFixed(1)}%</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>{t('reportPage.total')}</TableCell>
            <TableCell className="text-right">{data.reduce((s, r) => s + r.quantity, 0)}</TableCell>
            <TableCell className="text-right">
              {formatMoney(round2(data.reduce((s, r) => s + r.netRevenue, 0)), currency)}
            </TableCell>
            <TableCell className="text-right">
              {formatMoney(round2(data.reduce((s, r) => s + r.profit, 0)), currency)}
            </TableCell>
            <TableCell className="text-right">
              {(() => {
                const rev = data.reduce((s, r) => s + r.netRevenue, 0)
                const prof = data.reduce((s, r) => s + r.profit, 0)
                return `${rev !== 0 ? ((prof / rev) * 100).toFixed(1) : '0.0'}%`
              })()}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
