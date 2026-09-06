import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { unitShort } from '@shared/units'
import { useReorderReport } from '@/hooks/useReports'
import { ReportEmpty, ReportError, ReportLoading } from './ReportState'

/** Days of cover from trailing-30d sales, most urgent first. */
export function ReorderReport(): React.JSX.Element {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useReorderReport()

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => void refetch()} />
  if (!data || data.length === 0) return <ReportEmpty />

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.reorder')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.reorderDesc')}</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('reportPage.product')}</TableHead>
            <TableHead className="text-right">{t('reportPage.stock')}</TableHead>
            <TableHead className="text-right">{t('reportPage.avgDaily')}</TableHead>
            <TableHead className="text-right">{t('reportPage.cover')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={r.productId}>
              <TableCell>{r.name}</TableCell>
              <TableCell className="text-right">
                {r.stockQty} {unitShort(r.unit, t)}
              </TableCell>
              <TableCell className="text-right">{r.avgDailySales.toFixed(1)}</TableCell>
              <TableCell className="text-right">
                {r.daysOfCover === null ? (
                  <Badge variant="secondary">{t('reportPage.neverSold')}</Badge>
                ) : (
                  <Badge variant={r.daysOfCover < 7 ? 'destructive' : r.daysOfCover < 30 ? 'default' : 'secondary'}>
                    {r.daysOfCover.toFixed(1)}
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
