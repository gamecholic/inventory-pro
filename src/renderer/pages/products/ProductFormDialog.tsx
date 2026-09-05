import { Controller, useForm } from 'react-hook-form'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { productInput, type CategoryRow, type ProductInput, type ProductRow } from '@shared/products'
import { UNITS } from '@shared/units'
import type { SupplierRow } from '@shared/products'
import { useCreateProduct, useUpdateProduct } from '@/hooks/useCatalog'

const num = (v: number): number => (Number.isNaN(v) ? 0 : v)

/** Shared create/edit form (features §4.1–§4.2). Blank with defaults on create. */
export function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  suppliers,
  editing
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: CategoryRow[]
  suppliers: SupplierRow[]
  editing: ProductRow | null
}): React.JSX.Element {
  const { t } = useTranslation()
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const pending = create.isPending || update.isPending

  const form = useForm<ProductInput>({
    // Schema defaults make zod input/output differ; validated output is ProductInput.
    resolver: zodResolver(productInput) as Resolver<ProductInput>,
    values: editing
      ? {
          name: editing.name,
          barcode: editing.barcode ?? '',
          categoryId: editing.categoryId ?? 0,
          unit: (editing.unit as ProductInput['unit']) ?? 'pcs',
          sellingPrice: editing.sellingPrice,
          costPrice: editing.costPrice,
          stockQty: editing.stockQty,
          minStock: editing.minStock,
          supplierId: editing.supplierId,
          description: editing.description ?? ''
        }
      : {
          name: '',
          barcode: '',
          categoryId: 0,
          unit: 'pcs',
          sellingPrice: 0,
          costPrice: 0,
          stockQty: 0,
          minStock: 5,
          supplierId: null,
          description: ''
        }
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    if (editing) {
      update.mutate(
        { id: editing.id, input: values },
        { onSuccess: () => onOpenChange(false) }
      )
    } else {
      create.mutate(values, { onSuccess: () => onOpenChange(false) })
    }
  })

  const err = (name: keyof ProductInput): string | undefined => {
    const e = errors[name]
    return e ? t('settings.required') : undefined
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t('products.editProduct') : t('products.addProduct')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pName">{t('products.name')} *</Label>
            <Input id="pName" {...form.register('name')} />
            {err('name') && <p className="text-sm text-destructive">{err('name')}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pBarcode">{t('products.barcode')}</Label>
            <Input id="pBarcode" {...form.register('barcode')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pCategory">{t('products.category')} *</Label>
              <Controller
                name="categoryId"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value > 0 ? String(field.value) : ''}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <SelectTrigger id="pCategory">
                      <SelectValue placeholder={t('products.category')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {err('categoryId') && <p className="text-sm text-destructive">{err('categoryId')}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pUnit">{t('products.unit')}</Label>
              <Controller
                name="unit"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="pUnit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.value} — {u.long}
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
              <Label htmlFor="pSell">{t('products.sellingPrice')} *</Label>
              <Controller
                name="sellingPrice"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="pSell"
                    type="number"
                    min={0}
                    step={0.01}
                    value={field.value}
                    onChange={(e) => field.onChange(num(e.target.valueAsNumber))}
                  />
                )}
              />
              {err('sellingPrice') && <p className="text-sm text-destructive">{err('sellingPrice')}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pCost">{t('products.costPrice')} *</Label>
              <Controller
                name="costPrice"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="pCost"
                    type="number"
                    min={0}
                    step={0.01}
                    value={field.value}
                    onChange={(e) => field.onChange(num(e.target.valueAsNumber))}
                  />
                )}
              />
              {err('costPrice') && <p className="text-sm text-destructive">{err('costPrice')}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pStock">{t('products.stockQty')} *</Label>
              <Controller
                name="stockQty"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="pStock"
                    type="number"
                    min={0}
                    value={field.value}
                    onChange={(e) => field.onChange(num(e.target.valueAsNumber))}
                  />
                )}
              />
              {err('stockQty') && <p className="text-sm text-destructive">{err('stockQty')}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pMin">{t('products.minStock')} *</Label>
              <Controller
                name="minStock"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="pMin"
                    type="number"
                    min={0}
                    value={field.value}
                    onChange={(e) => field.onChange(num(e.target.valueAsNumber))}
                  />
                )}
              />
              {err('minStock') && <p className="text-sm text-destructive">{err('minStock')}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pSupplier">{t('products.supplier')}</Label>
            <Controller
              name="supplierId"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value === null ? 'none' : String(field.value)}
                  onValueChange={(v) => field.onChange(v === 'none' ? null : Number(v))}
                >
                  <SelectTrigger id="pSupplier">
                    <SelectValue placeholder={t('products.noSupplier')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('products.noSupplier')}</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pDesc">{t('products.description')}</Label>
            <Textarea id="pDesc" {...form.register('description')} />
          </div>
          {Object.keys(errors).length > 0 && (
            <p className="text-sm text-destructive">{t('products.fixErrors')}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('products.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {editing ? t('products.updateProduct') : t('products.saveProduct')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
