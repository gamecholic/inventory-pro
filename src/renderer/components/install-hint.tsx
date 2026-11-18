import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { isIosSafari, isStandalone } from '@/lib/pwa'

/** One-time Add to Home Screen hint for Safari on iPhone/iPad (features §1.12). */
const HINT_KEY = 'inventory-pro:ios-install-hint-shown'
const SHOW_DELAY_MS = 1200

function hintWasShown(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1'
  } catch {
    // Private mode / storage disabled: showing it again is harmless.
    return false
  }
}

/** Mark on display, not dismiss: the hint is a one-time advertisement. */
function markHintShown(): void {
  try {
    window.localStorage.setItem(HINT_KEY, '1')
  } catch {
    // Ignore: the app must keep working without localStorage.
  }
}

function isRunningStandalone(): boolean {
  const displayMode = window.matchMedia('(display-mode: standalone)').matches
  const navigatorStandalone = (navigator as Navigator & { standalone?: boolean }).standalone
  return isStandalone(displayMode, navigatorStandalone)
}

export function InstallHint(): React.JSX.Element | null {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (hintWasShown()) return
    if (!isIosSafari(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)) return
    if (isRunningStandalone()) return

    const timer = window.setTimeout(() => {
      markHintShown()
      setOpen(true)
    }, SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setOpen(false) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <img src="/icons/icon-192.png" alt="" className="mb-2 size-16 rounded-2xl" />
          <DialogTitle>{t('installHint.title')}</DialogTitle>
          <DialogDescription>{t('installHint.description')}</DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              1
            </span>
            <span>
              {t('installHint.shareStep')} <Share className="inline size-4 align-text-bottom" aria-hidden="true" />
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              2
            </span>
            <span>{t('installHint.addStep')}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              3
            </span>
            <span>{t('installHint.openStep')}</span>
          </li>
        </ol>

        <DialogFooter>
          <Button type="button" onClick={() => setOpen(false)}>
            {t('installHint.gotIt')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
