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
import { supplierInput, type SupplierInput, type SupplierRow } from '@shared/products'
import { useCreateSupplier, useUpdateSupplier } from '@/hooks/useCatalog'

/** Create/edit dialog (features §4.6). */
export function SupplierFormDialog({
  open,
  onOpenChange,
  editing
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: SupplierRow | null
}): React.JSX.Element {
  const { t } = useTranslation()
  const create = useCreateSupplier()
  const update = useUpdateSupplier()

  const form = useForm<SupplierInput>({
    resolver: zodResolver(supplierInput) as Resolver<SupplierInput>,
    values: editing
      ? {
          companyName: editing.companyName,
          contactPerson: editing.contactPerson ?? '',
          phone: editing.phone ?? '',
          email: editing.email ?? '',
          address: editing.address ?? ''
        }
      : { companyName: '', contactPerson: '', phone: '', email: '', address: '' }
  })
  const emailError = form.formState.errors.email

  const onSubmit = form.handleSubmit((values) => {
    if (editing) {
      update.mutate({ id: editing.id, input: values }, { onSuccess: () => onOpenChange(false) })
    } else {
      create.mutate(values, { onSuccess: () => onOpenChange(false) })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t('products.editSupplier') : t('products.addSupplier')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="supCompany">{t('products.companyName')} *</Label>
            <Input id="supCompany" {...form.register('companyName')} />
            {form.formState.errors.companyName && (
              <p className="text-sm text-destructive">{t('settings.required')}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supContact">{t('products.contactPerson')}</Label>
            <Input id="supContact" {...form.register('contactPerson')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supPhone">{t('products.phone')}</Label>
            <Input id="supPhone" {...form.register('phone')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supEmail">{t('products.email')}</Label>
            <Input id="supEmail" type="email" {...form.register('email')} />
            {emailError && <p className="text-sm text-destructive">{t('settings.invalidEmail')}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supAddress">{t('products.address')}</Label>
            <Textarea id="supAddress" rows={2} {...form.register('address')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('products.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {editing ? t('products.updateSupplier') : t('products.saveSupplier')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
