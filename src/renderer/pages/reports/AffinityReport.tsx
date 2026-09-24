import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import type { RangeInput } from '@shared/analytics'
import { useAffinityReport } from '@/hooks/useReports'
import { PeriodLabel, ReportEmpty, ReportError, ReportLoading } from './ReportState'

const LIMITS = [5, 10, 15] as const

/** Product pairs sharing the same completed sale in the range. */
export function AffinityReport({ range }: { range: RangeInput }): React.JSX.Element {
  const { t } = useTranslation()
  const [limit, setLimit] = useState<number>(10)
  // Stable input: a fresh object every render would change the query key.
  const input = useMemo(() => ({ ...range, limit }), [range, limit])
  const { data, isPending, isError, refetch } = useAffinityReport(input)

  if (isPending) return <ReportLoading />
  if (isError) return <ReportError onRetry={() => void refetch()} />
  if (!data || data.length === 0) return <ReportEmpty />

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('reportPage.affinity')}</h3>
        <p className="text-sm text-muted-foreground">{t('reportPage.affinityDesc')}</p>
        <PeriodLabel range={range} />
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="affinityShow">{t('reportPage.show')}</Label>
        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger id="affinityShow" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMITS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('reportPage.pair')}</TableHead>
            <TableHead className="text-right">{t('reportPage.together')}</TableHead>
            <TableHead className="text-right">{t('reportPage.support')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={`${r.aProductId ?? 'x'}-${r.aName}|${r.bProductId ?? 'x'}-${r.bName}`}>
              <TableCell>
                {r.aName} + {r.bName}
              </TableCell>
              <TableCell className="text-right">{r.together}</TableCell>
              <TableCell className="text-right">{r.support.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
