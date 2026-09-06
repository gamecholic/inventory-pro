import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
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
import type { ExpenseCategoryRow } from '@shared/expenses'
import { useDeleteExpenseCategory, useExpenseCategories } from '@/hooks/useExpenses'
import { ExpenseCategoryDialog } from './ExpenseCategoryDialog'

/** Category list with edit/delete — deleting unlinks its expenses to Other. */
export function ExpenseCategoryManager({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data } = useExpenseCategories()
  const remove = useDeleteExpenseCategory()
  const [editing, setEditing] = useState<ExpenseCategoryRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('expenses.manageCategories')}</DialogTitle>
          </DialogHeader>
          {(data ?? []).length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{t('products.noCategories')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('expenses.categoryName')}</TableHead>
                  <TableHead className="text-right">{t('products.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(c)
                          setFormOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <ExpenseCategoryDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('expenses.deleteCategoryTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('expenses.deleteCategoryDesc')}</AlertDialogDescription>
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
    </>
  )
}
