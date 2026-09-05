import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
import { defaultSettings, generalSettings, type SettingsValues } from '@shared/settings'
import { settingsKey, useSettings, useUpdateSettings } from '@/hooks/useSettings'

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'TRY', label: 'TRY (₺)' }
] as const

const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const

/** Features §9.1 — language, currency, dates, notifications, card fee, reset. */
export function GeneralTab(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { data } = useSettings()
  const update = useUpdateSettings()
  const queryClient = useQueryClient()
  const [resetting, setResetting] = useState(false)

  const form = useForm({
    resolver: zodResolver(generalSettings),
    values: data?.general ?? defaultSettings.general
  })

  const onSubmit = form.handleSubmit((values) => {
    update.mutate({ section: 'general', patch: values })
  })

  const onReset = async (): Promise<void> => {
    setResetting(true)
    try {
      const sections: Array<keyof SettingsValues> = ['general', 'business', 'receipt']
      for (const section of sections) {
        await window.api.settings.update(section, defaultSettings[section] as Record<string, unknown>)
      }
      queryClient.setQueryData(settingsKey, defaultSettings)
      await i18n.changeLanguage(defaultSettings.general.language)
      toast.success(t('settings.saved'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('settings.saveFailed'))
    } finally {
      setResetting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.tabs.general')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="language">{t('settings.language')}</Label>
            <Controller
              name="language"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="tr">Türkçe</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="currency">{t('settings.currency')}</Label>
            <Controller
              name="currency"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dateFormat">{t('settings.dateFormat')}</Label>
            <Controller
              name="dateFormat"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="dateFormat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="lowStock">{t('settings.lowStock')}</Label>
            <Controller
              name="lowStockNotifications"
              control={form.control}
              render={({ field }) => (
                <Switch id="lowStock" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cardFee">{t('settings.cardFee')}</Label>
            <Controller
              name="cardFeePercent"
              control={form.control}
              render={({ field, fieldState }) => (
                <>
                  <Input
                    id="cardFee"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                  {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                </>
              )}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={update.isPending}>
              {t('settings.save')}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={resetting}>
                  {t('settings.reset')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.resetTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('settings.resetDesc')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void onReset()}>{t('settings.confirm')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
