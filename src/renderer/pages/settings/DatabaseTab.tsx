import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
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
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { backupDirKey, useBackupDir } from '@/hooks/useBackupDir'

type BackupAction = 'export-json' | 'import-json' | 'export-excel' | 'import-excel' | 'import-legacy-excel' | 'reset'

function ActionRow({
  title,
  desc,
  children
}: {
  title: string
  desc: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-4 last:border-b-0">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </div>
  )
}

function ConfirmAction({
  title,
  desc,
  actionLabel,
  danger,
  busy,
  onConfirm,
  children
}: {
  title: string
  desc: string
  actionLabel: string
  danger?: boolean
  busy: boolean
  onConfirm: () => void
  children: ReactNode
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={danger ? 'destructive' : 'outline'} disabled={busy}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{desc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{actionLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Close-backup target folder: shown only while backup-on-close is on. */
function BackupFolderRow(): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const update = useUpdateSettings()
  const { data: dir } = useBackupDir()

  const saveDir = (backupDir: string): void => {
    update.mutate(
      { section: 'general', patch: { backupDir } },
      { onSuccess: () => void queryClient.invalidateQueries({ queryKey: backupDirKey }) }
    )
  }

  const browse = (): void => {
    void window.api.backup.selectDir().then((picked) => {
      if (picked) saveDir(picked)
    })
  }

  const openFolder = (): void => {
    void window.api.backup.openDir().then((ok) => {
      if (!ok) toast.error(t('settings.db.openFolderFailed'))
    })
  }

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
      <div className="min-w-0">
        <p className="font-medium">{t('settings.db.backupFolder')}</p>
        <div className="flex min-w-0 items-center gap-1">
          <p className="truncate text-sm text-muted-foreground" title={dir?.resolved}>
            {dir?.resolved ?? '…'}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label={t('settings.db.openFolder')}
            title={t('settings.db.openFolder')}
            onClick={openFolder}
          >
            <FolderOpen className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {dir && dir.custom !== '' && (
          <Button variant="ghost" size="sm" disabled={update.isPending} onClick={() => saveDir('')}>
            {t('settings.db.useDefault')}
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={update.isPending} onClick={browse}>
          {t('settings.db.changeFolder')}
        </Button>
      </div>
    </div>
  )
}

/** Features §9.4 — JSON/Excel backup/restore, reset, backup-on-close. */
export function DatabaseTab(): React.JSX.Element {
  const { t } = useTranslation()
  const { data } = useSettings()
  const update = useUpdateSettings()
  const [busy, setBusy] = useState<BackupAction | null>(null)

  const fail = (error: unknown): void => {
    toast.error(error instanceof Error ? error.message : t('settings.db.importFailed'))
  }

  const runExport = (action: 'export-json' | 'export-excel'): void => {
    setBusy(action)
    const done = (filePath: string | null): void => {
      setBusy(null)
      if (filePath) toast.success(`${t('settings.db.exportedTo')}: ${filePath}`)
    }
    if (action === 'export-json') {
      void window.api.backup.exportJson().then(done, fail).finally(() => setBusy(null))
    } else {
      void window.api.backup.exportExcel().then(done, fail).finally(() => setBusy(null))
    }
  }

  const runImport = (action: 'import-json' | 'import-excel' | 'import-legacy-excel'): void => {
    setBusy(action)
    const call = action === 'import-json'
      ? window.api.backup.importJson()
      : action === 'import-excel'
        ? window.api.backup.importExcel()
        : window.api.backup.importLegacyExcel()
    void call.then(
      (result) => {
        setBusy(null)
        if (result) {
          toast.success(t('settings.db.imported'))
          window.location.reload()
        }
      },
      (error: unknown) => {
        setBusy(null)
        fail(error)
      }
    )
  }

  const runReset = (): void => {
    setBusy('reset')
    void window.api.db.reset().then(
      () => {
        toast.success(t('settings.db.resetDone'))
        window.location.reload()
      },
      (error: unknown) => {
        setBusy(null)
        fail(error)
      }
    )
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.tabs.database')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionRow title={t('settings.db.exportJson')} desc={t('settings.db.exportJsonDesc')}>
            <Button variant="outline" disabled={busy !== null} onClick={() => runExport('export-json')}>
              {busy === 'export-json' ? t('settings.db.working') : t('settings.db.exportJson')}
            </Button>
          </ActionRow>
          <ActionRow title={t('settings.db.importJson')} desc={t('settings.db.importJsonDesc')}>
            <ConfirmAction
              title={t('settings.db.importTitle')}
              desc={t('settings.db.importDesc')}
              actionLabel={t('settings.confirm')}
              busy={busy !== null}
              onConfirm={() => runImport('import-json')}
            >
              {busy === 'import-json' ? t('settings.db.working') : t('settings.db.importJson')}
            </ConfirmAction>
          </ActionRow>
          <ActionRow title={t('settings.db.exportExcel')} desc={t('settings.db.exportExcelDesc')}>
            <Button variant="outline" disabled={busy !== null} onClick={() => runExport('export-excel')}>
              {busy === 'export-excel' ? t('settings.db.working') : t('settings.db.exportExcel')}
            </Button>
          </ActionRow>
          <ActionRow title={t('settings.db.importExcel')} desc={t('settings.db.importExcelDesc')}>
            <ConfirmAction
              title={t('settings.db.importTitle')}
              desc={t('settings.db.importDesc')}
              actionLabel={t('settings.confirm')}
              busy={busy !== null}
              onConfirm={() => runImport('import-excel')}
            >
              {busy === 'import-excel' ? t('settings.db.working') : t('settings.db.importExcel')}
            </ConfirmAction>
          </ActionRow>
          <ActionRow title={t('settings.db.importLegacyExcel')} desc={t('settings.db.importLegacyExcelDesc')}>
            <ConfirmAction
              title={t('settings.db.importLegacyTitle')}
              desc={t('settings.db.importLegacyDesc')}
              actionLabel={t('settings.confirm')}
              busy={busy !== null}
              onConfirm={() => runImport('import-legacy-excel')}
            >
              {busy === 'import-legacy-excel' ? t('settings.db.working') : t('settings.db.importLegacyExcel')}
            </ConfirmAction>
          </ActionRow>
          <ActionRow title={t('settings.db.resetDb')} desc={t('settings.db.resetDbDesc')}>
            <ConfirmAction
              title={t('settings.db.resetTitle')}
              desc={t('settings.db.resetDesc')}
              actionLabel={t('settings.confirm')}
              danger
              busy={busy !== null}
              onConfirm={runReset}
            >
              {busy === 'reset' ? t('settings.db.working') : t('settings.db.resetDb')}
            </ConfirmAction>
          </ActionRow>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="backupOnClose">{t('settings.db.backupOnClose')}</Label>
              <CardDescription>{t('settings.db.backupOnCloseDesc')}</CardDescription>
            </div>
            <Switch
              id="backupOnClose"
              checked={data?.general.backupOnClose ?? false}
              disabled={update.isPending}
              onCheckedChange={(checked) => update.mutate({ section: 'general', patch: { backupOnClose: checked } })}
            />
          </div>
          {data?.general.backupOnClose === true && <BackupFolderRow />}
        </CardContent>
      </Card>
    </div>
  )
}
