import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import type { SupplierRow } from '@shared/products'
import { useDeleteSupplier, useSuppliers } from '@/hooks/useCatalog'
import { SupplierFormDialog } from './SupplierFormDialog'

/** Features §4.6 — table + dialog. Delete blocked while products are linked. */
export function SuppliersTab({
  registerAdd
}: {
  registerAdd: (open: () => void) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data } = useSuppliers()
  const remove = useDeleteSupplier()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierRow | null>(null)

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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(s)
                          setDialogOpen(true)
                        }}
                      >
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
      <SupplierFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  )
}
