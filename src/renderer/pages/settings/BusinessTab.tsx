import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { businessSettings, defaultSettings } from '@shared/settings'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'

/** Features §9.2 — business identity shown on sale details and receipts. */
export function BusinessTab(): React.JSX.Element {
  const { t } = useTranslation()
  const { data } = useSettings()
  const update = useUpdateSettings()

  const form = useForm({
    resolver: zodResolver(businessSettings),
    values: data?.business ?? defaultSettings.business
  })
  const emailError = form.formState.errors.email?.message
  const isDirty = form.formState.isDirty
  const isSaving = update.isPending
  const nameLen = (form.watch('name') ?? '').length
  const addressLen = (form.watch('address') ?? '').length

  const onSubmit = form.handleSubmit((values) => {
    update.mutate({ section: 'business', patch: values })
  })

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.tabs.business')}</CardTitle>
            <CardDescription>{t('settings.businessDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex max-w-xl flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="bizName">{t('settings.businessName')}</Label>
                <span className="text-xs text-muted-foreground">{nameLen}/200</span>
              </div>
              <Input id="bizName" placeholder="Acme Market" maxLength={200} {...form.register('name')} />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="bizAddress">{t('settings.address')}</Label>
                <span className="text-xs text-muted-foreground">{addressLen}/1000</span>
              </div>
              <Textarea
                id="bizAddress"
                rows={3}
                placeholder="123 Main St, City"
                maxLength={1000}
                {...form.register('address')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bizPhone">{t('settings.phone')}</Label>
                <Input id="bizPhone" placeholder="+90 212 000 00 00" maxLength={50} {...form.register('phone')} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bizEmail">{t('settings.email')}</Label>
                <Input
                  id="bizEmail"
                  type="email"
                  placeholder="info@example.com"
                  maxLength={200}
                  {...form.register('email')}
                />
                {emailError && <p className="text-sm text-destructive">{t('settings.invalidEmail')}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bizTax">{t('settings.taxId')}</Label>
              <Input id="bizTax" placeholder="1234567890" maxLength={100} {...form.register('taxId')} />
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
    </div>
  )
}
