import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useDownloadUpdate, useUpdaterCheck } from '@/hooks/useUpdater'

type Phase = 'available' | 'downloaded'

/** Features §1.6 — small top-right card when a new release is available. Auto-dismisses after 60 seconds. */
export function UpdateCard(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { data } = useUpdaterCheck()
  const { downloading, percent, download } = useDownloadUpdate()
  const [dismissed, setDismissed] = useState(false)
  const [phase, setPhase] = useState<Phase>('available')

  useEffect(() => {
    if (phase !== 'available' || dismissed || downloading) return
    const id = setTimeout(() => setDismissed(true), 60_000)
    return () => clearTimeout(id)
  }, [phase, dismissed, downloading])

  // The server reports 'downloaded' when the installer is already staged,
  // so the card offers Restart Now instead of downloading again.
  useEffect(() => {
    if (data?.status === 'downloaded' && phase !== 'downloaded') setPhase('downloaded')
  }, [data?.status, phase])

  if (!data || (data.status !== 'available' && data.status !== 'downloaded') || dismissed) return null
  const version = data.version ?? ''

  return (
    <div className="fixed top-4 right-4 z-50 w-80">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">{t('updates.title')}</CardTitle>
          <Button variant="ghost" size="icon" aria-label={t('updates.close')} onClick={() => setDismissed(true)}>
            <X className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {phase === 'downloaded' ? t('updates.downloaded') : t('updates.message', { version })}
          </p>
          {phase === 'available' && !downloading && (
            <Button variant="outline" size="sm" onClick={download}>
              {t('updates.download')}
            </Button>
          )}
          {downloading && (
            <div className="flex flex-col gap-2">
              <Progress value={percent} />
              <p className="text-xs text-muted-foreground text-center">{t('updates.downloading', { percent })}</p>
            </div>
          )}
          {phase === 'downloaded' && (
            <Button variant="outline" size="sm" onClick={() => void window.api.updater.install()}>
              {t('updates.restart')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
