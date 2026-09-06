import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { RangeInput } from '@shared/analytics'

/** Long localized period label, e.g. "For period: 1 September 2026 to 30 September 2026" (§8.1). */
export function PeriodLabel({ range }: { range: RangeInput }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'tr' ? tr : enUS
  const fmt = (iso: string): string => format(new Date(iso), 'PPP', { locale })
  return (
    <p className="text-sm text-muted-foreground">
      {t('reportPage.period', { from: fmt(range.from), to: fmt(range.to) })}
    </p>
  )
}

export function ReportLoading(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2" aria-label={t('reportPage.loading')}>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function ReportError({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border p-6">
      <p>{t('reportPage.loadFailed')}</p>
      <Button variant="outline" onClick={onRetry}>
        {t('reportPage.retry')}
      </Button>
    </div>
  )
}

export function ReportEmpty(): React.JSX.Element {
  const { t } = useTranslation()
  return <p className="rounded-lg border border-border p-8 text-center text-muted-foreground">{t('reportPage.noData')}</p>
}
