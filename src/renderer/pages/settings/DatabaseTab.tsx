import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
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

type BackupAction = 'export-json' | 'import-json' | 'export-excel' | 'import-excel' | 'reset'

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

  const runImport = (action: 'import-json' | 'import-excel'): void => {
    setBusy(action)
    const call = action === 'import-json' ? window.api.backup.importJson() : window.api.backup.importExcel()
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
        <CardContent className="flex items-center justify-between gap-4 pt-6">
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
        </CardContent>
      </Card>
    </div>
  )
}
