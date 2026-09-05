import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
import { formatISO, toISO } from '@shared/dates'
import { useSales } from '@/hooks/useSales'
import { useSettings } from '@/hooks/useSettings'
import { SaleDetailPanel } from './SaleDetailPanel'

const PAYMENTS = ['all', 'cash', 'card', 'split'] as const

const dayStart = (d: Date): Date => {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}
const dayEnd = (d: Date): Date => {
  const c = new Date(d)
  c.setHours(23, 59, 59, 999)
  return c
}
const toInput = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromInput = (v: string, end: boolean): string => {
  const [y, m, d] = v.split('-').map(Number)
  return toISO(end ? dayEnd(new Date(y as number, (m as number) - 1, d)) : dayStart(new Date(y as number, (m as number) - 1, d)))
}

/** Features §6.1–§6.2 — filters, paginated table, detail side panel. */
export function SalesPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const currency = settings?.general.currency ?? 'USD'
  const dateFormat = settings?.general.dateFormat ?? 'MM/DD/YYYY'

  const [fromDraft, setFromDraft] = useState(() => toInput(new Date(Date.now() - 29 * 86400000)))
  const [toDraft, setToDraft] = useState(() => toInput(new Date()))
  const [applied, setApplied] = useState(() => ({
    from: toISO(dayStart(new Date(Date.now() - 29 * 86400000))),
    to: toISO(dayEnd(new Date()))
  }))
  const [payment, setPayment] = useState<'all' | 'cash' | 'card' | 'split'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data, isPending, isError, refetch } = useSales({
    from: applied.from,
    to: applied.to,
    payment,
    search,
    page
  })

  return (
    <div className="px-4 lg:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t('sales.title')}</h2>
        <Button variant="outline" size="icon" title={t('sales.refresh')} onClick={() => void refetch()}>
          <RefreshCw className="size-4" />
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="salesFrom">{t('sales.from')}</Label>
          <Input id="salesFrom" type="date" value={fromDraft} onChange={(e) => setFromDraft(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="salesTo">{t('sales.to')}</Label>
          <Input id="salesTo" type="date" value={toDraft} onChange={(e) => setToDraft(e.target.value)} />
        </div>
        <Button
          onClick={() => {
            setApplied({ from: fromInput(fromDraft, false), to: fromInput(toDraft, true) })
            setPage(1)
          }}
        >
          {t('sales.apply')}
        </Button>
        <Select
          value={payment}
          onValueChange={(v) => {
            setPayment(v as typeof payment)
            setPage(1)
          }}
        >
          <SelectTrigger id="salesPayment" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENTS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`sales.${p === 'all' ? 'allPayments' : p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="max-w-xs"
          placeholder={t('sales.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <div className="flex items-center gap-4 rounded-lg border border-border p-6">
          <p>{t('products.loadFailed')}</p>
          <Button variant="outline" onClick={() => void refetch()}>
            {t('products.retry')}
          </Button>
        </div>
      ) : data.items.length === 0 ? (
        <p className="rounded-lg border border-border p-8 text-center text-muted-foreground">{t('sales.noSales')}</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('sales.colReceipt')}</TableHead>
                <TableHead>{t('sales.colDate')}</TableHead>
                <TableHead>{t('sales.colItems')}</TableHead>
                <TableHead>{t('sales.colTotal')}</TableHead>
                <TableHead>{t('sales.colPayment')}</TableHead>
                <TableHead>{t('sales.colStatus')}</TableHead>
                <TableHead className="text-right">{t('sales.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((s) => {
                const canceled = s.status === 'canceled'
                return (
                  <TableRow
                    key={s.id}
                    className={`cursor-pointer ${s.id === selectedId ? 'bg-muted/60' : ''}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <TableCell className={canceled ? 'text-muted-foreground' : ''}>
                      {canceled ? <s>{s.receiptNo}</s> : s.receiptNo}
                    </TableCell>
                    <TableCell>{formatISO(s.createdAt, dateFormat)}</TableCell>
                    <TableCell>{s.itemCount}</TableCell>
                    <TableCell>{formatMoney(s.total, currency)}</TableCell>
                    <TableCell>
                      {s.paymentMethod === 'cash'
                        ? t('pos.receipt.cash')
                        : s.paymentMethod === 'card'
                          ? t('pos.receipt.card')
                          : t('pos.receipt.split')}
                    </TableCell>
                    <TableCell>
                      <span className={canceled ? 'font-medium text-destructive' : 'font-medium text-green-600 dark:text-green-500'}>
                        {canceled ? t('sales.canceled') : t('sales.completed')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelectedId(s.id)}>
                        {t('sales.viewDetails')}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {t('products.pageOf', { page: data.page, pages: data.totalPages })} ·{' '}
              {t('products.totalItems', { count: data.total })}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
                ←
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage(data.page + 1)}
              >
                →
              </Button>
            </div>
          </div>
        </>
      )}

      <SaleDetailPanel saleId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
