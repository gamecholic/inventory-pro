import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import type { CategoryRow } from '@shared/products'
import { useCategories, useDeleteCategory } from '@/hooks/useCatalog'
import { CategoryFormDialog } from './CategoryFormDialog'

/** Features §4.5 — table + dialog. Delete blocked while products exist. */
export function CategoriesTab({
  registerAdd
}: {
  registerAdd: (open: () => void) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data } = useCategories()
  const remove = useDeleteCategory()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRow | null>(null)

  useEffect(() => {
    registerAdd(() => {
      setEditing(null)
      setDialogOpen(true)
    })
  })

  return (
    <div className="flex flex-col gap-4">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(c)
                          setDialogOpen(true)
                        }}
                      >
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
      <CategoryFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  )
}
