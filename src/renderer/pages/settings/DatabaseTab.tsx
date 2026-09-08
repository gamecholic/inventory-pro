import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Copy,
  Database,
  Download,
  FolderOpen,
  Loader2,
  Trash2,
  Upload
} from 'lucide-react'
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
import { dbDirKey, useDbDir } from '@/hooks/useDbDir'

type BackupAction = 'export-json' | 'import-json' | 'export-excel' | 'import-excel' | 'import-legacy-excel' | 'reset'

function Working(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <>
      <Loader2 className="size-4 animate-spin" />
      {t('settings.db.working')}
    </>
  )
}

function ActionRow({
  icon,
  title,
  desc,
  children
}: {
  icon: ReactNode
  title: string
  desc: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-4 border-b border-border py-4 last:border-b-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
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
        <Button variant={danger ? 'destructive' : 'outline'} disabled={busy} className="gap-2">
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

function PathLine({ path }: { path: string | undefined }): React.JSX.Element {
  const { t } = useTranslation()
  const copy = (): void => {
    if (!path) return
    void navigator.clipboard.writeText(path).then(
      () => toast.success(t('settings.db.copied')),
      () => toast.error(t('settings.db.openFolderFailed'))
    )
  }
  return (
    <div className="flex min-w-0 items-center gap-1">
      <p className="truncate rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground" title={path}>
        {path ?? '…'}
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label={t('settings.db.copyPath')}
        title={t('settings.db.copyPath')}
        onClick={copy}
      >
        <Copy className="size-4" />
      </Button>
    </div>
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
          <PathLine path={dir?.resolved} />
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

/** Database file in use: first element of the Database card. Changes apply on restart. */
function DbLocationRow(): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: dir } = useDbDir()
  const [saving, setSaving] = useState(false)

  const saveDir = (dbDir: string): void => {
    setSaving(true)
    void window.api.db
      .setDir(dbDir)
      .then(
        (info) => {
          queryClient.setQueryData(dbDirKey, info)
          toast.success(t('settings.db.restartRequired'))
        },
        (error: unknown) => {
          toast.error(error instanceof Error ? error.message : t('settings.db.importFailed'))
        }
      )
      .finally(() => setSaving(false))
  }

  const browse = (): void => {
    void window.api.db.selectDir().then((picked) => {
      if (picked) saveDir(picked)
    })
  }

  const openFolder = (): void => {
    void window.api.db.openDir().then((ok) => {
      if (!ok) toast.error(t('settings.db.openFolderFailed'))
    })
  }

  return (
    <div className="flex items-center gap-4 border-b border-border py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Database className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t('settings.db.dbLocation')}</p>
        <p className="text-sm text-muted-foreground">{t('settings.db.dbLocationDesc')}</p>
        <div className="flex min-w-0 items-center gap-1">
          <PathLine path={dir?.resolved} />
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
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => saveDir('')}>
            {t('settings.db.useDefault')}
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={saving} onClick={browse}>
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
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.db.backupTitle')}</CardTitle>
          <CardDescription>{t('settings.db.backupDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DbLocationRow />
          <ActionRow
            icon={<Download className="size-4" />}
            title={t('settings.db.exportJson')}
            desc={t('settings.db.exportJsonDesc')}
          >
            <Button
              variant="outline"
              disabled={busy !== null}
              className="gap-2"
              onClick={() => runExport('export-json')}
            >
              {busy === 'export-json' ? (
                <Working />
              ) : (
                <>
                  <Download className="size-4" />
                  {t('settings.db.exportJson')}
                </>
              )}
            </Button>
          </ActionRow>
          <ActionRow
            icon={<Upload className="size-4" />}
            title={t('settings.db.importJson')}
            desc={t('settings.db.importJsonDesc')}
          >
            <ConfirmAction
              title={t('settings.db.importTitle')}
              desc={t('settings.db.importDesc')}
              actionLabel={t('settings.confirm')}
              busy={busy !== null}
              onConfirm={() => runImport('import-json')}
            >
              {busy === 'import-json' ? (
                <Working />
              ) : (
                <>
                  <Upload className="size-4" />
                  {t('settings.db.importJson')}
                </>
              )}
            </ConfirmAction>
          </ActionRow>
          <ActionRow
            icon={<Download className="size-4" />}
            title={t('settings.db.exportExcel')}
            desc={t('settings.db.exportExcelDesc')}
          >
            <Button
              variant="outline"
              disabled={busy !== null}
              className="gap-2"
              onClick={() => runExport('export-excel')}
            >
              {busy === 'export-excel' ? (
                <Working />
              ) : (
                <>
                  <Download className="size-4" />
                  {t('settings.db.exportExcel')}
                </>
              )}
            </Button>
          </ActionRow>
          <ActionRow
            icon={<Upload className="size-4" />}
            title={t('settings.db.importExcel')}
            desc={t('settings.db.importExcelDesc')}
          >
            <ConfirmAction
              title={t('settings.db.importTitle')}
              desc={t('settings.db.importDesc')}
              actionLabel={t('settings.confirm')}
              busy={busy !== null}
              onConfirm={() => runImport('import-excel')}
            >
              {busy === 'import-excel' ? (
                <Working />
              ) : (
                <>
                  <Upload className="size-4" />
                  {t('settings.db.importExcel')}
                </>
              )}
            </ConfirmAction>
          </ActionRow>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.db.migrationTitle')}</CardTitle>
          <CardDescription>{t('settings.db.migrationDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionRow
            icon={<ArrowRightLeft className="size-4" />}
            title={t('settings.db.importLegacyExcel')}
            desc={t('settings.db.importLegacyExcelDesc')}
          >
            <ConfirmAction
              title={t('settings.db.importLegacyTitle')}
              desc={t('settings.db.importLegacyDesc')}
              actionLabel={t('settings.confirm')}
              busy={busy !== null}
              onConfirm={() => runImport('import-legacy-excel')}
            >
              {busy === 'import-legacy-excel' ? (
                <Working />
              ) : (
                <>
                  <ArrowRightLeft className="size-4" />
                  {t('settings.db.importLegacyExcel')}
                </>
              )}
            </ConfirmAction>
          </ActionRow>
        </CardContent>
      </Card>
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">{t('settings.db.dangerTitle')}</CardTitle>
          <CardDescription>{t('settings.db.dangerDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionRow
            icon={<Trash2 className="size-4" />}
            title={t('settings.db.resetDb')}
            desc={t('settings.db.resetDbDesc')}
          >
            <ConfirmAction
              title={t('settings.db.resetTitle')}
              desc={t('settings.db.resetDesc')}
              actionLabel={t('settings.confirm')}
              danger
              busy={busy !== null}
              onConfirm={runReset}
            >
              {busy === 'reset' ? (
                <Working />
              ) : (
                <>
                  <Trash2 className="size-4" />
                  {t('settings.db.resetDb')}
                </>
              )}
            </ConfirmAction>
          </ActionRow>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.db.closeBackupTitle')}</CardTitle>
          <CardDescription>{t('settings.db.backupOnCloseDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="backupOnClose">{t('settings.db.backupOnClose')}</Label>
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
