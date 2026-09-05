import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { categoryInput, type CategoryInput, type CategoryRow } from '@shared/products'
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/hooks/useCatalog'

/** Features §4.5 — form left, list right. Delete blocked while products exist. */
export function CategoriesTab(): React.JSX.Element {
  const { t } = useTranslation()
  const { data } = useCategories()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const [editing, setEditing] = useState<CategoryRow | null>(null)

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categoryInput) as Resolver<CategoryInput>,
    values: editing ? { name: editing.name, description: editing.description ?? '' } : { name: '', description: '' }
  })

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
          <CardTitle>{editing ? t('products.editCategory') : t('products.addCategory')}</CardTitle>
        </CardHeader>
        <CardContent>
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
            <div className="flex gap-2">
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editing ? t('products.updateCategory') : t('products.saveCategory')}
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
            <p className="p-4 text-center text-muted-foreground">{t('products.noCategories')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('products.categoryName')}</TableHead>
                  <TableHead>{t('products.colCount')}</TableHead>
                  <TableHead className="text-right">{t('products.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.productCount}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(c)}>
                        <Pencil className="size-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={c.productCount > 0}
                            title={c.productCount > 0 ? t('products.categoryBlocked') : t('products.deleteCategoryTitle')}
                            onClick={
                              c.productCount > 0
                                ? (e) => {
                                    e.preventDefault()
                                    toast.error(t('products.categoryBlocked'))
                                  }
                                : undefined
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('products.deleteCategoryTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>{t('products.deleteCategoryDesc')}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('products.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove.mutate(c.id)}>
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
