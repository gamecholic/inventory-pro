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
import { categoryInput, type CategoryInput, type CategoryRow } from '@shared/products'
import { useCreateCategory, useUpdateCategory } from '@/hooks/useCatalog'

/** Create/edit dialog (features §4.5). */
export function CategoryFormDialog({
  open,
  onOpenChange,
  editing
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: CategoryRow | null
}): React.JSX.Element {
  const { t } = useTranslation()
  const create = useCreateCategory()
  const update = useUpdateCategory()

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categoryInput) as Resolver<CategoryInput>,
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
          <DialogTitle>{editing ? t('products.editCategory') : t('products.addCategory')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="catName">{t('products.categoryName')} *</Label>
            <Input id="catName" {...form.register('name')} />
            {form.formState.errors.name && <p className="text-sm text-destructive">{t('settings.required')}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="catDesc">{t('products.description')}</Label>
            <Textarea id="catDesc" {...form.register('description')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('products.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {editing ? t('products.updateCategory') : t('products.saveCategory')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
