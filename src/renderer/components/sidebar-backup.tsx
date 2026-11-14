import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CloudCheck, CloudOff, CloudUpload, HardDrive, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useSettings } from '@/hooks/useSettings'
import { formatDateTime, formatTime } from '@shared/dates'
import type { BackupStatusReason } from '@shared/backup'

const FAST_POLL_MS = 3_000
const SETTLE_POLL_MS = 5_000
const SLOW_POLL_MS = 60_000
const SETTLE_MS = 90_000

function sizeLabel(bytes: number | null): string {
  if (bytes === null) return '-'
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`
}

function whyKey(reason: BackupStatusReason): 'noFile' | 'noCloud' | 'noReference' | 'noOverlay' {
  switch (reason) {
    case 'no-file':
      return 'noFile'
    case 'no-cloud':
      return 'noCloud'
    case 'no-reference':
      return 'noReference'
    default:
      return 'noOverlay'
  }
}

/** Quick Excel backup plus the newest file's cloud sync badge, in the sidebar footer. */
export function SidebarBackup(): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: settings } = useSettings()
  const [open, setOpen] = useState(false)
  // Explorer needs a moment to draw the sync badge, so poll fast after a write.
  const [settleUntil, setSettleUntil] = useState(0)

  const quick = useMutation({
    mutationFn: () => window.api.backup.quick(),
    onSuccess: (result) => {
      toast.success(t('backup.saved', { file: result.fileName }))
      setSettleUntil(Date.now() + SETTLE_MS)
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['backup-status'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : ''
      // Excel keeps a lock on the file it has open, so a rename over it fails.
      toast.error(/EPERM|EBUSY|EACCES/i.test(message) ? t('backup.locked') : message || t('backup.failed'))
    }
  })

  const { data, isLoading } = useQuery({
    queryKey: ['backup-status'],
    queryFn: () => window.api.backup.status(),
    staleTime: 2_000,
    refetchInterval: (query) => {
      // Explorer's badge cannot change while nobody is looking; focus refetches.
      if (document.visibilityState === 'hidden') return false
      if (quick.isPending) return FAST_POLL_MS
      if (Date.now() < settleUntil && query.state.data?.sync !== 'synced') return SETTLE_POLL_MS
      return SLOW_POLL_MS
    }
  })

  const providerName = data ? t(`backup.providerName.${data.provider}`) : '-'
  const dateFormat = settings?.general.dateFormat ?? 'YYYY-MM-DD'

  const statusView = ((): { icon: React.JSX.Element; label: string } => {
    if (isLoading || !data) {
      return { icon: <CloudOff className="size-3.5" />, label: t('backup.state.unknown') }
    }
    switch (data.sync) {
      case 'synced': {
        const time = data.writtenAt ? ` · ${formatTime(data.writtenAt)}` : ''
        return {
          icon: <CloudCheck className="size-3.5 text-success" />,
          label: `${t('backup.state.synced', { provider: providerName })}${time}`
        }
      }
      case 'pending':
        return {
          icon: <CloudUpload className="size-3.5 animate-pulse" />,
          label: t('backup.state.pending', { provider: providerName })
        }
      case 'local':
        return { icon: <HardDrive className="size-3.5" />, label: t('backup.state.local') }
      case 'unknown':
        return {
          icon: <CloudOff className="size-3.5" />,
          label: data.reason === 'no-file' ? t('backup.state.noFile') : t('backup.state.unknown')
        }
    }
  })()

  const why = !data
    ? ''
    : data.sync === 'synced'
      ? t('backup.why.synced')
      : data.sync === 'pending'
        ? t('backup.why.pending')
        : data.sync === 'local'
          ? t('backup.why.noCloud')
          : t(`backup.why.${whyKey(data.reason)}`)

  const openFolder = (): void => {
    void window.api.backup.openDir().then((ok) => {
      if (!ok) toast.error(t('settings.db.openFolderFailed'))
    })
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => quick.mutate()}
            disabled={quick.isPending}
            tooltip={t('backup.quick')}
          >
            {quick.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <CloudUpload />
            )}
            <span>{quick.isPending ? t('backup.working') : t('backup.quick')}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <button
        type="button"
        aria-live="polite"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden"
      >
        {statusView.icon}
        <span className="truncate">{statusView.label}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('backup.detailsTitle')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">{t('backup.provider')}</span>
            <span>{providerName}</span>
            <span className="text-muted-foreground">{t('backup.file')}</span>
            <span className="break-all">{data?.fileName ?? t('backup.noFile')}</span>
            <span className="text-muted-foreground">{t('backup.size')}</span>
            <span>{sizeLabel(data?.sizeBytes ?? null)}</span>
            <span className="text-muted-foreground">{t('backup.written')}</span>
            <span>{data?.writtenAt ? formatDateTime(data.writtenAt, dateFormat) : '-'}</span>
            <span className="text-muted-foreground">{t('backup.folder')}</span>
            <span className="break-all font-mono text-xs">{data?.folder ?? '-'}</span>
          </div>
          <DialogDescription>{why || t('backup.state.unknown')}</DialogDescription>
          <p className="text-xs text-muted-foreground">{t('backup.explorerNote')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={openFolder}>
              {t('backup.openFolder')}
            </Button>
            <Button disabled={quick.isPending} onClick={() => quick.mutate()}>
              {quick.isPending && <Loader2 className="animate-spin" />}
              {t('backup.quick')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
