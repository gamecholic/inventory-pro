import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Copy, Loader2 } from 'lucide-react'
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
import type { StoreCurrency } from '@shared/money'
import { formatMoney } from '@shared/money'
import type { StoreDateFormat } from '@shared/dates'
import { formatISO } from '@shared/dates'
import { settingsKey, useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useAppVersion } from '@/hooks/useAppVersion'
import QRCode from 'react-qr-code'

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
  const { theme, setTheme } = useTheme()
  const { data } = useSettings()
  const update = useUpdateSettings()
  const queryClient = useQueryClient()
  const { data: appVersion } = useAppVersion()
  const [resetting, setResetting] = useState(false)
  const [networkInfo, setNetworkInfo] = useState<{ lanIp: string | null; port: number; host: string; networkAccess: boolean; url: string | null; lanReachable: boolean } | null>(null)
  const [urlCopied, setUrlCopied] = useState(false)

  const form = useForm({
    resolver: zodResolver(generalSettings),
    values: data?.general ?? defaultSettings.general,
    // The language autosave below refreshes `values` from the cache;
    // keep any other unsaved edits the user already made.
    resetOptions: { keepDirtyValues: true }
  })
  const isDirty = form.formState.isDirty
  const isSaving = update.isPending

  const currency = form.watch('currency') as StoreCurrency
  const dateFormat = form.watch('dateFormat') as StoreDateFormat
  const networkAccess = form.watch('networkAccess')
  const preview = `${formatMoney(1234.5, currency)} • ${formatISO(new Date().toISOString(), dateFormat)}`

  useEffect(() => {
    if (!networkAccess) {
      setNetworkInfo(null)
      return
    }
    let cancelled = false
    fetch('/api/network-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: unknown) => {
        if (!cancelled && json && typeof json === 'object') {
          setNetworkInfo(json as typeof networkInfo)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [networkAccess])

  const onSubmit = form.handleSubmit((values) => {
    update.mutate({ section: 'general', patch: values })
  })

  const copyNetworkUrl = (): void => {
    const url = networkInfo?.url
    if (!url) return
    void navigator.clipboard.writeText(url).then(
      () => {
        setUrlCopied(true)
        setTimeout(() => setUrlCopied(false), 2000)
        toast.success(t('settings.networkUrlCopied'))
      },
      () => toast.error(t('settings.saveFailed'))
    )
  }

  const onReset = async (): Promise<void> => {
    setResetting(true)
    try {
      const sections: Array<keyof SettingsValues> = ['general', 'business', 'receipt']
      for (const section of sections) {
        await window.api.settings.update(section, defaultSettings[section] as Record<string, unknown>)
      }
      queryClient.setQueryData(settingsKey, defaultSettings)
      form.reset(defaultSettings.general)
      await i18n.changeLanguage(defaultSettings.general.language)
      toast.success(t('settings.saved'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('settings.saveFailed'))
    } finally {
      setResetting(false)
    }
  }

  const saveButton = (
    <>
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
    </>
  )

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.sections.appearance')}</CardTitle>
            <CardDescription>{t('settings.appearanceDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex max-w-xl flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="language">{t('settings.language')}</Label>
              <Controller
                name="language"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      // Spec §1.2: language applies immediately. Persist it at
                      // once too, so ApplySettings (App.tsx) and reloads agree
                      // with the preview. Other edits still use Save.
                      void i18n.changeLanguage(value)
                      update.mutate({ section: 'general', patch: { language: value } })
                    }}
                  >
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
              <p className="text-xs text-muted-foreground">{t('settings.languageHint')}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="theme">{t('settings.theme')}</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('theme.light')}</SelectItem>
                  <SelectItem value="dark">{t('theme.dark')}</SelectItem>
                  <SelectItem value="system">{t('theme.system')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('settings.themeHint')}</p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="startMaximized">{t('settings.startMaximized')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.startMaximizedDesc')}</p>
              </div>
              <Controller
                name="startMaximized"
                control={form.control}
                render={({ field }) => (
                  <Switch id="startMaximized" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
          </CardContent>
          <CardFooter className="gap-2">{saveButton}</CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.sections.regional')}</CardTitle>
            <CardDescription>{t('settings.regionalDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex max-w-xl flex-col gap-4">
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
            <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {t('settings.regionalPreview')}: {preview}
            </div>
          </CardContent>
          <CardFooter className="gap-2">{saveButton}</CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.sections.inventory')}</CardTitle>
            <CardDescription>{t('settings.inventoryDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex max-w-xl flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="lowStock">{t('settings.lowStock')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.lowStockDesc')}</p>
              </div>
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
                    <div className="relative">
                      <Input
                        id="cardFee"
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        className="pr-8"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                    {fieldState.error ? (
                      <p className="text-sm text-destructive">{fieldState.error.message}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t('settings.cardFeeHint')}</p>
                    )}
                  </>
                )}
              />
            </div>
          </CardContent>
          <CardFooter className="gap-2">{saveButton}</CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.sections.network')}</CardTitle>
            <CardDescription>{t('settings.networkDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex max-w-xl flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="networkAccess">{t('settings.networkAccess')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.networkAccessDesc')}</p>
              </div>
              <Controller
                name="networkAccess"
                control={form.control}
                render={({ field }) => (
                  <Switch id="networkAccess" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            {networkAccess ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="networkUrl">{t('settings.networkUrl')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="networkUrl"
                    readOnly
                    value={networkInfo?.url ?? '…'}
                    className="font-mono"
                    aria-label={t('settings.networkUrl')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!networkInfo?.url}
                    onClick={copyNetworkUrl}
                    aria-label={t('settings.networkUrlCopied')}
                    title={t('settings.networkUrlCopied')}
                  >
                    {urlCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
                {networkInfo?.url ? (
                  <>
                    <div className="flex items-center gap-4 rounded-md border bg-white p-3 dark:bg-white">
                      <QRCode value={networkInfo.url} size={144} fgColor="#000000" bgColor="#FFFFFF" aria-label={t('settings.networkUrl')} />
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-medium">{t('settings.networkUrlHint')}</p>
                        <p className="font-mono text-xs break-all">{networkInfo.url}</p>
                      </div>
                    </div>
                    {!networkInfo.lanReachable ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400">{t('settings.networkUrlPending')}</p>
                    ) : null}
                  </>
                ) : networkInfo && !networkInfo.url ? (
                  <p className="text-xs text-muted-foreground">{t('settings.networkUrlNoLan')}</p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="gap-2">{saveButton}</CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.sections.danger')}</CardTitle>
            <CardDescription>{t('settings.resetSettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium">{t('settings.reset')}</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" disabled={resetting}>
                  {resetting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('settings.saving')}
                    </>
                  ) : (
                    t('settings.reset')
                  )}
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
          </CardContent>
        </Card>
      </form>
      {appVersion ? (
        <p className="text-right text-xs text-muted-foreground">
          {t('settings.version', { version: appVersion })}
        </p>
      ) : null}
    </div>
  )
}
