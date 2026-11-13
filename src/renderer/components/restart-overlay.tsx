import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useRestartStore, type RestartPhase } from '@/stores/restart'

const PHASES: RestartPhase[] = ['preparing', 'installing', 'starting', 'ready']

type StepState = 'done' | 'current' | 'pending'

/**
 * Full-screen overlay shown while the app restarts itself.
 *
 * Installing an update replaces the running exe, so the local server goes
 * away for a few seconds. Without this the tab looks frozen: the page is
 * still there but every request fails. The overlay explains what is
 * happening, and the tab reloads itself once the new server answers.
 */
export function RestartOverlay(): React.JSX.Element | null {
  const { t } = useTranslation()
  const active = useRestartStore((s) => s.active)
  const reason = useRestartStore((s) => s.reason)
  const phase = useRestartStore((s) => s.phase)
  const version = useRestartStore((s) => s.version)
  const startedAt = useRestartStore((s) => s.startedAt)
  const error = useRestartStore((s) => s.error)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active) return
    const tick = (): void => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [active, startedAt])

  if (!active) return null

  const currentIndex = PHASES.indexOf(phase)
  // Same four steps, different wording: an update installs files, a settings
  // restart only stops and starts the local server.
  const labels =
    reason === 'server'
      ? [
          t('updates.serverRestartSteps.preparing'),
          t('updates.serverRestartSteps.stopping'),
          t('updates.serverRestartSteps.starting'),
          t('updates.serverRestartSteps.ready')
        ]
      : [
          t('updates.restartSteps.preparing'),
          t('updates.restartSteps.installing'),
          t('updates.restartSteps.starting'),
          t('updates.restartSteps.ready')
        ]
  const steps: Array<{ key: RestartPhase; label: string }> = PHASES.map((key, index) => ({
    key,
    label: labels[index] ?? ''
  }))

  const stepState = (index: number): StepState => {
    // The last step is "ready": everything before it is done, and the tab
    // is about to reload.
    if (phase === 'ready') return index <= currentIndex ? 'done' : 'pending'
    if (index < currentIndex) return 'done'
    if (index === currentIndex) return 'current'
    return 'pending'
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('updates.restartTitle')}
      className="fixed inset-0 z-[1000000000] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm"
    >
      <Card className="w-full max-w-md gap-0 py-6">
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="" className="size-10 rounded-xl" />
            <div className="flex min-w-0 flex-col">
              <p className="text-sm font-semibold">{t('updates.restartTitle')}</p>
              <p className="truncate text-xs text-muted-foreground">
                {version
                  ? t('updates.restartSubtitle', { version })
                  : t('updates.restartSubtitleGeneric')}
              </p>
            </div>
          </div>

          {/* The duration is unknown, so the bar slides instead of filling. */}
          <Progress value={null} aria-label={t('updates.restartTitle')} />

          <ol className="flex flex-col gap-2" aria-live="polite">
            {steps.map((step, index) => {
              const state = stepState(index)
              return (
                <li
                  key={step.key}
                  className={`flex items-center gap-2 text-sm ${
                    state === 'pending' ? 'text-muted-foreground' : ''
                  }`}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    {state === 'done' ? (
                      <Check className="size-4 text-primary" />
                    ) : state === 'current' ? (
                      error ? (
                        <TriangleAlert className="size-4 text-destructive" />
                      ) : (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      )
                    ) : (
                      <span className="size-2 rounded-full bg-border" />
                    )}
                  </span>
                  {step.label}
                </li>
              )
            })}
          </ol>

          {error ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                {t('updates.restartReload')}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('updates.restartElapsed', { seconds: elapsed })} · {t('updates.restartNote')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
