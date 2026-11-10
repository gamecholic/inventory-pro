import { useTranslation } from 'react-i18next'
import { Download, RefreshCw, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAppVersion } from '@/hooks/useAppVersion'
import { useDownloadUpdate, useUpdaterCheck } from '@/hooks/useUpdater'

/**
 * Features §9 — About tab: app icon, version information and a manual
 * "check for updates" button (the automatic check still runs on launch).
 *
 * The updater state comes from the shared `updater` query, so this tab and
 * the top-right update card always show the same step: an update is
 * offered -> downloaded -> restart to apply.
 */
export function AboutTab(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: appVersion } = useAppVersion()
  const { data: update, refetch, isFetching } = useUpdaterCheck()
  const { downloading, percent, download } = useDownloadUpdate()

  const checkForUpdates = (): void => {
    void refetch().then(
      (result) => {
        const status = result.data?.status
        if (status === 'up-to-date') toast.success(t('settings.about.upToDate'))
        else if (status === 'available')
          toast.success(t('settings.about.available', { version: result.data?.version ?? '' }))
        else if (status === 'downloaded') toast.success(t('updates.downloaded'))
        else toast.error(t('settings.about.error', { message: result.data?.message ?? '' }))
      },
      (failure: unknown) =>
        toast.error(
          t('settings.about.error', {
            message: failure instanceof Error ? failure.message : String(failure)
          })
        )
    )
  }

  const installNow = (): void => {
    void window.api.updater.install().then(
      (ok) => {
        if (!ok) toast.error(t('updates.failed'))
      },
      () => toast.error(t('updates.failed'))
    )
  }

  const status = update?.status
  const version = update?.version ?? ''

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.about.title')}</CardTitle>
          <CardDescription>{t('settings.about.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <img src="/favicon.png" alt="Inventory Pro" className="size-16 rounded-xl" />
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold">{t('settings.about.appName')}</p>
              <p className="text-sm text-muted-foreground">{t('settings.about.tagline')}</p>
              <p className="font-mono text-sm text-muted-foreground">
                {t('settings.about.version', { version: appVersion ?? '…' })}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-sm font-medium">{t('settings.about.checkUpdates')}</p>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={isFetching}
              onClick={checkForUpdates}
            >
              {isFetching ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  {t('settings.about.checking')}
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  {t('settings.about.checkUpdates')}
                </>
              )}
            </Button>

            {status === 'up-to-date' ? (
              <p className="text-sm text-muted-foreground">{t('settings.about.upToDate')}</p>
            ) : null}

            {status === 'available' ? (
              <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">{t('settings.about.available', { version })}</p>
                  <Button type="button" size="sm" disabled={downloading} onClick={download}>
                    <Download className="size-4" />
                    {t('updates.download')}
                  </Button>
                </div>
                {downloading ? (
                  <div className="flex flex-col gap-1">
                    <Progress value={percent} />
                    <p className="text-xs text-muted-foreground text-center">
                      {t('updates.downloading', { percent })}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {status === 'downloaded' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted px-3 py-2">
                <p className="text-sm">{t('updates.downloaded')}</p>
                <Button type="button" size="sm" onClick={installNow}>
                  <RotateCcw className="size-4" />
                  {t('updates.restart')}
                </Button>
              </div>
            ) : null}

            {status === 'error' ? (
              <p className="text-sm text-destructive">
                {t('settings.about.error', { message: update?.message ?? '' })}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
