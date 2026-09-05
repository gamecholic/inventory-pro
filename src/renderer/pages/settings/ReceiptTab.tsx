import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { defaultSettings, receiptSettings } from '@shared/settings'
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

  const onSubmit = form.handleSubmit((values) => {
    update.mutate({ section: 'receipt', patch: values })
  })

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.tabs.receipt')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rcptHeader">{t('settings.receiptHeader')}</Label>
              <Textarea id="rcptHeader" {...form.register('header')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rcptFooter">{t('settings.receiptFooter')}</Label>
              <Textarea id="rcptFooter" {...form.register('footer')} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="rcptLogo">{t('settings.showLogo')}</Label>
              <Controller
                name="showLogo"
                control={form.control}
                render={({ field }) => (
                  <Switch id="rcptLogo" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
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
