import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  const onSubmit = form.handleSubmit((values) => {
    update.mutate({ section: 'business', patch: values })
  })

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.tabs.business')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bizName">{t('settings.businessName')}</Label>
              <Input id="bizName" {...form.register('name')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bizAddress">{t('settings.address')}</Label>
              <Textarea id="bizAddress" {...form.register('address')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bizPhone">{t('settings.phone')}</Label>
              <Input id="bizPhone" {...form.register('phone')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bizEmail">{t('settings.email')}</Label>
              <Input id="bizEmail" type="email" {...form.register('email')} />
              {emailError && <p className="text-sm text-destructive">{t('settings.invalidEmail')}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bizTax">{t('settings.taxId')}</Label>
              <Input id="bizTax" {...form.register('taxId')} />
            </div>
            <div>
              <Button type="submit" disabled={update.isPending}>
                {t('settings.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
