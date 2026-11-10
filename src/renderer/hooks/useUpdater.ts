import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { UpdaterCheck, UpdaterProgress } from '@shared/updater'
import { useUpdaterStore } from '@/stores/updater'

export const updaterKey = ['updater'] as const

/** Check GitHub Releases once on launch (features §1.6). Silent unless an update is available. */
export function useUpdaterCheck() {
  return useQuery<UpdaterCheck>({
    queryKey: updaterKey,
    queryFn: () => window.api.updater.check(),
    staleTime: Infinity,
    retry: false
  })
}

/**
 * Download the installer with live progress. Shared by the update card and
 * Settings > About: whoever starts it, both surfaces show the same bar.
 */
export function useDownloadUpdate() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const downloading = useUpdaterStore((s) => s.downloading)
  const percent = useUpdaterStore((s) => s.percent)
  const setDownloading = useUpdaterStore((s) => s.setDownloading)
  const setPercent = useUpdaterStore((s) => s.setPercent)

  // Poll the server-side progress while the installer downloads.
  useEffect(() => {
    if (!downloading) return
    const id = setInterval(() => {
      void window.api.updater.progress().then((p: UpdaterProgress) => setPercent(Math.round(p.percent)))
    }, 500)
    return () => clearInterval(id)
  }, [downloading, setPercent])

  const download = (): void => {
    setDownloading(true)
    setPercent(0)
    void window.api.updater.download().then(
      (res) => {
        setDownloading(false)
        if (res.status === 'downloaded') {
          setPercent(100)
          toast.success(t('updates.downloaded'))
          // The server now reports 'downloaded'; refresh the shared state so
          // every surface switches to Restart Now.
          void queryClient.invalidateQueries({ queryKey: updaterKey })
        } else {
          toast.error(res.message ?? t('updates.failed'))
        }
      },
      (failure: unknown) => {
        setDownloading(false)
        toast.error(failure instanceof Error ? failure.message : t('updates.failed'))
      }
    )
  }

  return { downloading, percent, download }
}
