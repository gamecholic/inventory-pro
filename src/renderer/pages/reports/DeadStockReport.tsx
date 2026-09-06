import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatMoney } from '@shared/money'
import { formatISO } from '@shared/dates'
import { unitShort } from '@shared/units'
import { useDeadStockReport } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { ReportEmpty, ReportError, ReportLoading } from './ReportState'

const WINDOWS = [30, 60, 90] as const

/** Capital tied up in unsold inventory. */
export function DeadStockReport(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const [days, setDays] = useState<number>(60)
  const { data, isPending, isError, refetch } = useDeadStockReport({ days })
  const currency = settings?.general.currency ?? 'USD'
  const dateFormat = settings?.general.dateFormat ?? 'MM/DD/YYYY'

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => void refetch()} />
  if (!data || data.items.length === 0) return <ReportEmpty />

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.deadStock')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.deadStockDesc')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="deadDays">{t('reportPage.lastDays', { days })}</Label>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger id="deadDays" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOWS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{t('reportPage.totalTied')}</p>
          <p className="text-2xl font-bold">{formatMoney(data.totalValue, currency)}</p>
        </CardContent>
      </Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('reportPage.product')}</TableHead>
            <TableHead className="text-right">{t('reportPage.stock')}</TableHead>
            <TableHead className="text-right">{t('reportPage.tiedValue')}</TableHead>
            <TableHead className="text-right">{t('reportPage.lastSold')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((r) => (
            <TableRow key={r.productId}>
              <TableCell>{r.name}</TableCell>
              <TableCell className="text-right">
                {r.stockQty} {unitShort(r.unit, t)}
              </TableCell>
              <TableCell className="text-right">{formatMoney(r.tiedValue, currency)}</TableCell>
              <TableCell className="text-right">
                {r.lastSoldAt ? formatISO(r.lastSoldAt, dateFormat) : t('reportPage.never')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
