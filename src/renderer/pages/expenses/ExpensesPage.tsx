import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Tag,
  Trash2,
  Wallet,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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
import { formatISO, dayBounds, presetRange } from '@shared/dates'
import { useDeleteExpense, useExpenseCategories, useExpenses } from '@/hooks/useExpenses'
import { useSettings } from '@/hooks/useSettings'
import { ExpenseCategoryDialog } from './ExpenseCategoryDialog'
import { ExpenseCategoryManager } from './ExpenseCategoryManager'
import { ExpenseFormDialog } from './ExpenseFormDialog'

/** Features §7 — quick filters on top, compact list + insight sidebar. */
export function ExpensesPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data: categories } = useExpenseCategories()
  const remove = useDeleteExpense()
  const currency = settings?.general.currency ?? 'USD'
  const dateFormat = settings?.general.dateFormat ?? 'MM/DD/YYYY'

  // Default window is Last 1 Month on every page using the picker.
  // Filters apply instantly — no Apply step. The range commits once both ends are picked.
  const lastMonthRange = (): { from: string; to: string } => dayBounds(presetRange('lastMonth'))
  const [range, setRange] = useState<DateRange | undefined>(() => presetRange('lastMonth'))
  const [applied, setApplied] = useState(lastMonthRange)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [payment, setPayment] = useState<'all' | (typeof EXPENSE_PAYMENTS)[number]>('all')
  const [search, setSearch] = useState('')

  const [expenseOpen, setExpenseOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseRow | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isPending, isError, refetch } = useExpenses({
    from: applied.from,
    to: applied.to,
    categoryId,
    payment,
    search
  })

  const items = data ?? []
  const total = round2(items.reduce((s, e) => s + e.amount, 0))

  // Client-side paging over the filtered set (summaries below still use the full set).
  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [applied.from, applied.to, categoryId, payment, search])
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const byCategory = useMemo(() => {
    const map = new Map<number | null, { id: number | null; name: string; color: string; total: number; count: number }>()
    for (const e of items) {
      const key = e.categoryId
      const entry = map.get(key) ?? {
        id: key,
        name: e.categoryName ?? t('expenses.other'),
        color: categoryColor(e.categoryId),
        total: 0,
        count: 0
      }
      entry.total = round2(entry.total + e.amount)
      entry.count += 1
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [items, t])

  const byPayment = useMemo(() => {
    const map = new Map<string, { key: string; total: number; count: number }>()
    for (const e of items) {
      const entry = map.get(e.paymentMethod) ?? { key: e.paymentMethod, total: 0, count: 0 }
      entry.total = round2(entry.total + e.amount)
      entry.count += 1
      map.set(e.paymentMethod, entry)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [items])

  const commitRange = (r: DateRange | undefined): void => {
    setRange(r)
    if (r?.from && r?.to) setApplied(dayBounds({ from: r.from, to: r.to }))
  }

  const resetAll = (): void => {
    setRange(presetRange('lastMonth'))
    setApplied(lastMonthRange())
    setCategoryId(null)
    setPayment('all')
    setSearch('')
  }

  const openCreate = (): void => {
    setEditing(null)
    setExpenseOpen(true)
  }

  const activeFilterCount =
    (categoryId !== null ? 1 : 0) + (payment !== 'all' ? 1 : 0) + (search !== '' ? 1 : 0)
  const appliedCategoryName =
    categoryId === null
      ? null
      : ((categories ?? []).find((c) => c.id === categoryId)?.name ?? t('expenses.category'))

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      {/* Compact toolbar: filters + actions in one row, everything applies instantly. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker range={range} onSelect={commitRange} />
          <div className="relative min-w-40 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t('expenses.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10">
                <SlidersHorizontal className="size-4" />
                {t('expenses.filters')}
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="px-1.5 tabular-nums">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex w-64 flex-col gap-3">
              <PopoverHeader>
                <PopoverTitle>{t('expenses.filters')}</PopoverTitle>
              </PopoverHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expFilterCategory">{t('expenses.category')}</Label>
                <Select
                  value={categoryId === null ? 'all' : String(categoryId)}
                  onValueChange={(v) => setCategoryId(v === 'all' ? null : Number(v))}
                >
                  <SelectTrigger id="expFilterCategory" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">{t('expenses.allCategories')}</SelectItem>
                      {(categories ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expFilterPayment">{t('expenses.payment')}</Label>
                <Select value={payment} onValueChange={(v) => setPayment(v as typeof payment)}>
                  <SelectTrigger id="expFilterPayment" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">{t('expenses.allPayments')}</SelectItem>
                      {EXPENSE_PAYMENTS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {t(`expenses.payments.${p}`)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" onClick={resetAll}>
                <RotateCcw className="size-4" />
                {t('expenses.reset')}
              </Button>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10">
                <Tag className="size-4" />
                {t('expenses.category')}
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => setCategoryOpen(true)}>
                  <Plus className="size-4" />
                  {t('expenses.addCategory')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setManagerOpen(true)}>
                  <Settings2 className="size-4" />
                  {t('expenses.manageCategories')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="ml-auto h-10" onClick={openCreate}>
            <Plus className="size-4" />
            {t('expenses.addExpense')}
          </Button>
        </div>
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {appliedCategoryName !== null && (
              <Badge variant="outline" className="font-normal">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryColor(categoryId) }}
                />
                <span className="max-w-32 truncate">{appliedCategoryName}</span>
                <button
                  type="button"
                  aria-label={t('products.cancel')}
                  className="flex size-4 items-center justify-center rounded-full hover:bg-accent"
                  onClick={() => setCategoryId(null)}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {payment !== 'all' && (
              <Badge variant="outline" className="font-normal">
                <span className="max-w-32 truncate">{t(`expenses.payments.${payment}`)}</span>
                <button
                  type="button"
                  aria-label={t('products.cancel')}
                  className="flex size-4 items-center justify-center rounded-full hover:bg-accent"
                  onClick={() => setPayment('all')}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {search !== '' && (
              <Badge variant="outline" className="font-normal">
                <span className="max-w-40 truncate">“{search}”</span>
                <button
                  type="button"
                  aria-label={t('products.cancel')}
                  className="flex size-4 items-center justify-center rounded-full hover:bg-accent"
                  onClick={() => setSearch('')}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Expense list */}
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">
              {t('expenses.title')} · {items.length}
            </CardTitle>
            <CardDescription>
              {formatISO(applied.from, dateFormat)} – {formatISO(applied.to, dateFormat)}
            </CardDescription>
          </CardHeader>
          {isPending ? (
            <CardContent className="flex flex-col gap-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          ) : isError ? (
            <CardContent className="p-4">
              <div className="flex items-center gap-4 rounded-lg border border-border p-6">
                <p>{t('products.loadFailed')}</p>
                <Button variant="outline" onClick={() => void refetch()}>
                  {t('products.retry')}
                </Button>
              </div>
            </CardContent>
          ) : items.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-muted">
                <Wallet className="size-5 text-muted-foreground" />
              </span>
              <p className="text-sm text-muted-foreground">{t('expenses.noExpenses')}</p>
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" />
                {t('expenses.addExpense')}
              </Button>
            </CardContent>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">{t('expenses.date')}</TableHead>
                      <TableHead>{t('expenses.description')}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t('expenses.reference')}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t('expenses.recipient')}</TableHead>
                      <TableHead>{t('expenses.category')}</TableHead>
                      <TableHead>{t('expenses.payment')}</TableHead>
                      <TableHead className="text-right">{t('expenses.amount')}</TableHead>
                      <TableHead className="text-right">{t('products.colActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((e) => (
                      <TableRow key={e.id} className="[&_td]:py-2.5">
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatISO(e.date, dateFormat)}
                        </TableCell>
                        <TableCell className="max-w-56">
                          <p className="truncate font-medium" title={e.description}>
                            {e.description}
                          </p>
                          {e.notes && (
                            <p className="truncate text-xs text-muted-foreground" title={e.notes}>
                              {e.notes}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="hidden max-w-32 truncate text-muted-foreground lg:table-cell">
                          {e.reference || '—'}
                        </TableCell>
                        <TableCell className="hidden max-w-32 truncate text-muted-foreground lg:table-cell">
                          {e.recipient || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: categoryColor(e.categoryId) }}
                            />
                            <span className="max-w-24 truncate">{e.categoryName ?? t('expenses.other')}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {t(`expenses.payments.${e.paymentMethod as (typeof EXPENSE_PAYMENTS)[number]}`)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(e.amount, currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => {
                                setEditing(e)
                                setExpenseOpen(true)
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteId(e.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Pad short pages so the table always shows 10 rows. */}
                    {Array.from({ length: PAGE_SIZE - pageItems.length }, (_, i) => (
                      <TableRow key={`filler-${i}`} aria-hidden="true" className="[&_td]:py-2.5 hover:bg-transparent">
                        <TableCell colSpan={8} className="text-sm text-transparent select-none">
                          {'\u00A0'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-3">
                  <span className="text-sm text-muted-foreground">
                    {t('products.pageOf', { page: safePage, pages: totalPages })} ·{' '}
                    {t('products.totalItems', { count: items.length })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={safePage <= 1}
                      onClick={() => setPage(safePage - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage(safePage + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Insight sidebar: total hero + share-of-spend breakdowns. */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t('expenses.totalExpenses')}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{formatMoney(total, currency)}</CardTitle>
              <CardDescription>{t('products.totalItems', { count: items.length })}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {byCategory.length > 0 && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2.5">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t('expenses.category')}
                    </p>
                    {byCategory.map((c) => {
                    const pct = total > 0 ? Math.round((c.total / total) * 100) : 0
                    return (
                      <div key={c.id === null ? 'other' : c.id} className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2 text-sm">
                          <span
                            className="size-2 shrink-0 self-center rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="flex-1 truncate">{c.name}</span>
                          <span className="font-medium tabular-nums">{formatMoney(c.total, currency)}</span>
                          <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: c.color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  </div>
                </>
              )}
              {byPayment.length > 0 && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t('expenses.payment')}
                    </p>
                    {byPayment.map((p) => (
                      <div key={p.key} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate text-muted-foreground">
                          {t(`expenses.payments.${p.key as (typeof EXPENSE_PAYMENTS)[number]}`)} · {p.count}
                        </span>
                        <span className="font-medium tabular-nums">{formatMoney(p.total, currency)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
