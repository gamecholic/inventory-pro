import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useUpdaterCheck } from '@/hooks/useUpdater'

type Phase = 'available' | 'downloading' | 'downloaded' | 'error'

/** Features §1.6 — small top-right card when a new release is available. Auto-dismisses after 10 seconds. */
export function UpdateCard(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { data } = useUpdaterCheck()
  const [dismissed, setDismissed] = useState(false)
  const [phase, setPhase] = useState<Phase>('available')
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (phase !== 'available' || dismissed) return
    const id = setTimeout(() => setDismissed(true), 10_000)
    return () => clearTimeout(id)
  }, [phase, dismissed])

  useEffect(() => {
    if (phase !== 'downloading') return
    const id = setInterval(() => {
      void window.api.updater.progress().then((p) => setPercent(Math.round(p.percent)))
    }, 500)
    return () => clearInterval(id)
  }, [phase])

  if (data?.status !== 'available' || dismissed) return null
  const version = data.version ?? ''

  const startDownload = (): void => {
    setPhase('downloading')
    setPercent(0)
    void window.api.updater.download().then(
      (result) => {
        if (result.status === 'downloaded') {
          setPhase('downloaded')
        } else {
          setPhase('error')
          setError(result.message ?? t('updates.failed'))
        }
      },
      (failure: unknown) => {
        setPhase('error')
        setError(failure instanceof Error ? failure.message : t('updates.failed'))
      }
    )
  }

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
          {phase === 'error' ? (
            <p className="text-sm text-muted-foreground">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {phase === 'downloaded' ? t('updates.downloaded') : t('updates.message', { version })}
            </p>
          )}
          {phase === 'available' && (
            <Button variant="outline" size="sm" onClick={startDownload}>
              {t('updates.download')}
            </Button>
          )}
          {phase === 'downloading' && (
            <Button variant="outline" size="sm" disabled>
              {t('updates.downloading', { percent })}
            </Button>
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
