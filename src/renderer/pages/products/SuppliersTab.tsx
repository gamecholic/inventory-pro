import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { supplierInput, type SupplierInput, type SupplierRow } from '@shared/products'
import { useCreateSupplier, useDeleteSupplier, useSuppliers, useUpdateSupplier } from '@/hooks/useCatalog'

/** Features §4.6 — form left, list right. Delete blocked while products are linked. */
export function SuppliersTab(): React.JSX.Element {
  const { t } = useTranslation()
  const { data } = useSuppliers()
  const create = useCreateSupplier()
  const update = useUpdateSupplier()
  const remove = useDeleteSupplier()
  const [editing, setEditing] = useState<SupplierRow | null>(null)

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
      update.mutate(
        { id: editing.id, input: values },
        { onSuccess: () => setEditing(null) }
      )
    } else {
      create.mutate(values, { onSuccess: () => form.reset() })
    }
  })

  const cancelEdit = (): void => {
    setEditing(null)
    form.reset()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{editing ? t('products.editSupplier') : t('products.addSupplier')}</CardTitle>
        </CardHeader>
        <CardContent>
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
            <div className="flex gap-2">
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editing ? t('products.updateSupplier') : t('products.saveSupplier')}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  {t('products.cancel')}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          {(data ?? []).length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">{t('products.noSuppliers')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('products.companyName')}</TableHead>
                  <TableHead>{t('products.colContact')}</TableHead>
                  <TableHead>{t('products.colPhone')}</TableHead>
                  <TableHead className="text-right">{t('products.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.companyName}</TableCell>
                    <TableCell>{s.contactPerson ?? '—'}</TableCell>
                    <TableCell>{s.phone ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(s)}>
                        <Pencil className="size-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('products.deleteSupplierTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>{t('products.deleteSupplierDesc')}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('products.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove.mutate(s.id)}>
                              {t('settings.confirm')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
