import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Loader2, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { defaultSettings, receiptSettings } from '@shared/settings'
import type { StoreCurrency } from '@shared/money'
import { formatMoney } from '@shared/money'
import type { StoreDateFormat } from '@shared/dates'
import { formatISO } from '@shared/dates'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'

/** Features §9.3 — custom receipt header/footer, logo toggle. */
export function ReceiptTab(): React.JSX.Element {
  const { t } = useTranslation()
  const { data } = useSettings()
  const update = useUpdateSettings()

  const form = useForm({
    resolver: zodResolver(receiptSettings),
    values: data?.receipt ?? defaultSettings.receipt
  })
  const isDirty = form.formState.isDirty
  const isSaving = update.isPending

  const header = form.watch('header') ?? ''
  const footer = form.watch('footer') ?? ''
  const showLogo = form.watch('showLogo') ?? false
  const headerLen = header.length
  const footerLen = footer.length

  const business = data?.business ?? defaultSettings.business
  const currency = (data?.general.currency ?? 'USD') as StoreCurrency
  const dateFormat = (data?.general.dateFormat ?? 'MM/DD/YYYY') as StoreDateFormat
  const today = formatISO(new Date().toISOString(), dateFormat)
  const sampleTotal = formatMoney(25, currency)

  const onSubmit = form.handleSubmit((values) => {
    update.mutate({ section: 'receipt', patch: values })
  })

  const resetFooter = (): void => {
    form.setValue('footer', defaultSettings.receipt.footer, { shouldDirty: true })
  }

  return (
    <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-[1fr_320px]">
      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.tabs.receipt')}</CardTitle>
            <CardDescription>{t('settings.receiptDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex max-w-xl flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="rcptHeader">{t('settings.receiptHeader')}</Label>
                <span className="text-xs text-muted-foreground">{headerLen}/2000</span>
              </div>
              <Textarea id="rcptHeader" rows={3} maxLength={2000} {...form.register('header')} />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="rcptFooter">{t('settings.receiptFooter')}</Label>
                <span className="text-xs text-muted-foreground">{footerLen}/2000</span>
              </div>
              <Textarea id="rcptFooter" rows={3} maxLength={2000} {...form.register('footer')} />
              <div>
                <Button type="button" variant="ghost" size="sm" onClick={resetFooter}>
                  {t('settings.footerDefault')}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="rcptLogo">{t('settings.showLogo')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.showLogoDesc')}</p>
              </div>
              <Controller
                name="showLogo"
                control={form.control}
                render={({ field }) => (
                  <Switch id="rcptLogo" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button type="submit" disabled={isSaving || !isDirty}>
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('settings.saving')}
                </>
              ) : (
                t('settings.save')
              )}
            </Button>
            {isDirty && !isSaving ? (
              <span className="text-xs text-muted-foreground">● {t('settings.unsaved')}</span>
            ) : null}
          </CardFooter>
        </Card>
      </form>
      <Card className="lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('settings.receiptPreview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-1 rounded-md border border-dashed px-4 py-4 text-center text-sm">
            {showLogo ? (
              <span className="mb-1 flex size-10 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                <Store className="size-5" />
              </span>
            ) : null}
            <p className="font-semibold">{business.name || 'Acme Market'}</p>
            {business.address ? (
              <p className="text-xs text-muted-foreground">{business.address}</p>
            ) : null}
            {business.phone || business.email ? (
              <p className="text-xs text-muted-foreground">
                {[business.phone, business.email].filter(Boolean).join(' • ')}
              </p>
            ) : null}
            {header ? <p className="mt-1 text-xs whitespace-pre-line">{header}</p> : null}
            <p className="text-xs text-muted-foreground">{today}</p>
            <div className="my-2 w-full border-t border-dashed" />
            <div className="flex w-full items-center justify-between text-xs">
              <span>
                {t('settings.previewSample')} × 1
              </span>
              <span>{sampleTotal}</span>
            </div>
            <div className="mt-1 flex w-full items-center justify-between font-semibold">
              <span>Total</span>
              <span>{sampleTotal}</span>
            </div>
            <div className="my-2 w-full border-t border-dashed" />
            {footer ? <p className="text-xs whitespace-pre-line">{footer}</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
