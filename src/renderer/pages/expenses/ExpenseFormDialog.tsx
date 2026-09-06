import { Controller, useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { endOfDay, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EXPENSE_PAYMENTS, expenseInput, type ExpenseInput } from '@shared/expenses'
import type { ExpenseCategoryRow, ExpenseRow } from '@shared/expenses'
import { toISO } from '@shared/dates'
import { useCreateExpense, useUpdateExpense } from '@/hooks/useExpenses'

const num = (v: number): number => (Number.isNaN(v) ? 0 : v)
const toInputDate = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fromInputDate = (v: string): string => {
  const [y, m, d] = v.split('-').map(Number)
  return toISO(startOfDay(new Date(y as number, (m as number) - 1, d)))
}

/** Features §7.2 — same form for add and edit. */
export function ExpenseFormDialog({
  open,
  onOpenChange,
  categories,
  editing
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: ExpenseCategoryRow[]
  editing: ExpenseRow | null
}): React.JSX.Element {
  const { t } = useTranslation()
  const create = useCreateExpense()
  const update = useUpdateExpense()

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseInput) as Resolver<ExpenseInput>,
    values: editing
      ? {
          date: editing.date,
          amount: editing.amount,
          description: editing.description,
          categoryId: editing.categoryId,
          paymentMethod: (editing.paymentMethod as ExpenseInput['paymentMethod']) ?? 'cash',
          recipient: editing.recipient ?? '',
          reference: editing.reference ?? '',
          notes: editing.notes ?? ''
        }
      : {
          date: toISO(endOfDay(new Date())),
          amount: 0,
          description: '',
          categoryId: null,
          paymentMethod: 'cash',
          recipient: '',
          reference: '',
          notes: ''
        }
  })
  const amountError = form.formState.errors.amount
  const descError = form.formState.errors.description

  const onSubmit = form.handleSubmit((values) => {
    if (editing) {
      update.mutate({ id: editing.id, input: values }, { onSuccess: () => onOpenChange(false) })
    } else {
      create.mutate(values, { onSuccess: () => onOpenChange(false) })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t('expenses.editExpense') : t('expenses.addExpense')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expDate">{t('expenses.date')} *</Label>
              <Controller
                name="date"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="expDate"
                    type="date"
                    value={toInputDate(field.value)}
                    onChange={(e) => field.onChange(fromInputDate(e.target.value))}
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expAmount">{t('expenses.amount')} *</Label>
              <Controller
                name="amount"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="expAmount"
                    type="number"
                    min={0}
                    step={0.01}
                    value={field.value === 0 ? '' : field.value}
                    placeholder="0.00"
                    onChange={(e) => field.onChange(num(e.target.valueAsNumber))}
                  />
                )}
              />
              {amountError && <p className="text-sm text-destructive">{t('expenses.invalidAmount')}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expDesc">{t('expenses.description')} *</Label>
            <Input id="expDesc" {...form.register('description')} />
            {descError && <p className="text-sm text-destructive">{t('settings.required')}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expCategory">{t('expenses.category')}</Label>
              <Controller
                name="categoryId"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value === null ? 'none' : String(field.value)}
                    onValueChange={(v) => field.onChange(v === 'none' ? null : Number(v))}
                  >
                    <SelectTrigger id="expCategory">
                      <SelectValue placeholder={t('expenses.other')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('expenses.other')}</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expPayment">{t('expenses.payment')} *</Label>
              <Controller
                name="paymentMethod"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="expPayment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_PAYMENTS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {t(`expenses.payments.${p}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expRecipient">{t('expenses.recipient')}</Label>
              <Input id="expRecipient" {...form.register('recipient')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expReference">{t('expenses.reference')}</Label>
              <Input id="expReference" {...form.register('reference')} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expNotes">{t('expenses.notes')}</Label>
            <Textarea id="expNotes" rows={2} {...form.register('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('products.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {editing ? t('expenses.updateExpense') : t('expenses.saveExpense')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
