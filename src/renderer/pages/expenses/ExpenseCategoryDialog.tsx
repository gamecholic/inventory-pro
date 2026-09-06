import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
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
import { Textarea } from '@/components/ui/textarea'
import { expenseCategoryInput, type ExpenseCategoryInput, type ExpenseCategoryRow } from '@shared/expenses'
import { useCreateExpenseCategory, useUpdateExpenseCategory } from '@/hooks/useExpenses'

/** Features §7.3 — shared add/edit category form. */
export function ExpenseCategoryDialog({
  open,
  onOpenChange,
  editing
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: ExpenseCategoryRow | null
}): React.JSX.Element {
  const { t } = useTranslation()
  const create = useCreateExpenseCategory()
  const update = useUpdateExpenseCategory()

  const form = useForm<ExpenseCategoryInput>({
    resolver: zodResolver(expenseCategoryInput) as Resolver<ExpenseCategoryInput>,
    values: editing
      ? { name: editing.name, description: editing.description ?? '' }
      : { name: '', description: '' }
  })

  const onSubmit = form.handleSubmit((values) => {
    if (editing) {
      update.mutate({ id: editing.id, input: values }, { onSuccess: () => onOpenChange(false) })
    } else {
      create.mutate(values, { onSuccess: () => onOpenChange(false) })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t('expenses.editCategory') : t('expenses.addCategory')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="expCatName">{t('expenses.categoryName')} *</Label>
            <Input id="expCatName" {...form.register('name')} />
            {form.formState.errors.name && <p className="text-sm text-destructive">{t('settings.required')}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expCatDesc">{t('products.description')}</Label>
            <Textarea id="expCatDesc" {...form.register('description')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('products.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {editing ? t('expenses.updateCategory') : t('expenses.saveCategory')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
