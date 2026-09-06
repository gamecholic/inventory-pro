import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { endOfDay, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import type { DateRange } from 'react-day-picker'
import { DateRangePicker } from '@/components/date-range-picker'
import { formatMoney, round2 } from '@shared/money'
import { categoryColor, EXPENSE_PAYMENTS, type ExpenseRow } from '@shared/expenses'
import { formatISO, presetRange, toISO } from '@shared/dates'
import { useDeleteExpense, useExpenseCategories, useExpenses } from '@/hooks/useExpenses'
import { useSettings } from '@/hooks/useSettings'
import { ExpenseCategoryDialog } from './ExpenseCategoryDialog'
import { ExpenseCategoryManager } from './ExpenseCategoryManager'
import { ExpenseFormDialog } from './ExpenseFormDialog'

/** Features §7 — actions, range filter, summary cards, table. */
export function ExpensesPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data: categories } = useExpenseCategories()
  const remove = useDeleteExpense()
  const currency = settings?.general.currency ?? 'USD'
  const dateFormat = settings?.general.dateFormat ?? 'MM/DD/YYYY'

  // Default window is Last 1 Month on every page using the picker.
  const lastMonthRange = (): { from: string; to: string } => {
    const r = presetRange('lastMonth')
    return { from: toISO(startOfDay(r.from)), to: toISO(endOfDay(r.to)) }
  }
  const [draft, setDraft] = useState<DateRange | undefined>(() => presetRange('lastMonth'))
  const [applied, setApplied] = useState(lastMonthRange)
  const [draftCategory, setDraftCategory] = useState<number | null>(null)
  const [appliedCategory, setAppliedCategory] = useState<number | null>(null)
  const [draftPayment, setDraftPayment] = useState<'all' | (typeof EXPENSE_PAYMENTS)[number]>('all')
  const [appliedPayment, setAppliedPayment] = useState<'all' | (typeof EXPENSE_PAYMENTS)[number]>('all')
  const [draftSearch, setDraftSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  const [expenseOpen, setExpenseOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseRow | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isPending, isError, refetch } = useExpenses({
    from: applied.from,
    to: applied.to,
    categoryId: appliedCategory,
    payment: appliedPayment,
    search: appliedSearch
  })

  const items = data ?? []
  const total = round2(items.reduce((s, e) => s + e.amount, 0))
  const byCategory = new Map<string, { name: string; color: string; total: number }>()
  for (const e of items) {
    const key = e.categoryId === null ? 'other' : String(e.categoryId)
    const entry = byCategory.get(key) ?? {
      name: e.categoryName ?? t('expenses.other'),
      color: categoryColor(e.categoryId),
      total: 0
    }
    entry.total = round2(entry.total + e.amount)
    byCategory.set(key, entry)
  }

  const applyAll = (): void => {
    if (draft?.from && draft?.to) {
      setApplied({ from: toISO(startOfDay(draft.from)), to: toISO(endOfDay(draft.to)) })
    }
    setAppliedCategory(draftCategory)
    setAppliedPayment(draftPayment)
    setAppliedSearch(draftSearch)
  }

  const resetAll = (): void => {
    setDraft(presetRange('lastMonth'))
    setApplied(lastMonthRange())
    setDraftCategory(null)
    setAppliedCategory(null)
    setDraftPayment('all')
    setAppliedPayment('all')
    setDraftSearch('')
    setAppliedSearch('')
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t('expenses.title')}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setManagerOpen(true)}>
            {t('expenses.manageCategories')}
          </Button>
          <Button variant="outline" onClick={() => setCategoryOpen(true)}>
            {t('expenses.addCategory')}
          </Button>
          <Button
            onClick={() => {
              setEditing(null)
              setExpenseOpen(true)
            }}
          >
            {t('expenses.addExpense')}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <DateRangePicker range={draft} onSelect={setDraft} />
        <Select
          value={draftCategory === null ? 'all' : String(draftCategory)}
          onValueChange={(v) => setDraftCategory(v === 'all' ? null : Number(v))}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('expenses.allCategories')}</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={draftPayment} onValueChange={(v) => setDraftPayment(v as typeof draftPayment)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('expenses.allPayments')}</SelectItem>
            {EXPENSE_PAYMENTS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`expenses.payments.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="max-w-xs"
          placeholder={t('expenses.search')}
          value={draftSearch}
          onChange={(e) => setDraftSearch(e.target.value)}
        />
        <Button onClick={applyAll}>{t('expenses.apply')}</Button>
        <Button variant="outline" onClick={resetAll}>
          {t('expenses.reset')}
        </Button>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t('expenses.totalExpenses')}</p>
            <p className="text-2xl font-bold">{formatMoney(total, currency)}</p>
          </CardContent>
        </Card>
        {[...byCategory.values()].map((c) => (
          <Card key={c.name}>
            <CardContent className="pt-6">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </p>
              <p className="text-2xl font-bold">{formatMoney(c.total, currency)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
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
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-border p-8 text-center text-muted-foreground">{t('expenses.noExpenses')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('expenses.date')}</TableHead>
              <TableHead>{t('expenses.description')}</TableHead>
              <TableHead>{t('expenses.reference')}</TableHead>
              <TableHead>{t('expenses.recipient')}</TableHead>
              <TableHead>{t('expenses.category')}</TableHead>
              <TableHead>{t('expenses.payment')}</TableHead>
              <TableHead className="text-right">{t('expenses.amount')}</TableHead>
              <TableHead className="text-right">{t('products.colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{formatISO(e.date, dateFormat)}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell>{e.reference ?? '—'}</TableCell>
                <TableCell>{e.recipient ?? '—'}</TableCell>
                <TableCell>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: categoryColor(e.categoryId) }}
                  >
                    {e.categoryName ?? t('expenses.other')}
                  </span>
                </TableCell>
                <TableCell>{t(`expenses.payments.${e.paymentMethod as (typeof EXPENSE_PAYMENTS)[number]}`)}</TableCell>
                <TableCell className="text-right">{formatMoney(e.amount, currency)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(e)
                      setExpenseOpen(true)
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(e.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ExpenseFormDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        categories={categories ?? []}
        editing={editing}
      />
      <ExpenseCategoryDialog open={categoryOpen} onOpenChange={setCategoryOpen} editing={null} />
      <ExpenseCategoryManager open={managerOpen} onOpenChange={setManagerOpen} />

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('expenses.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('expenses.deleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('products.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId !== null) remove.mutate(deleteId)
                setDeleteId(null)
              }}
            >
              {t('settings.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
