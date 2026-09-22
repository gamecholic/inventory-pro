import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import { subDays } from 'date-fns'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { formatMoney } from '@shared/money'
import { toISO } from '@shared/dates'
import type { RangeInput } from '@shared/analytics'
import { useHourlySales, useMonthlyAverages, useWeekdayAverages } from '@/hooks/useReports'
import { useSettings } from '@/hooks/useSettings'
import { Panel } from './Panel'
import { ReportEmpty, ReportError, ReportLoading } from '@/pages/reports/ReportState'

type Period = 'week' | 'month' | 'year'
type Metric = 'sales' | 'revenue'

function rangeFor(period: Period): RangeInput {
  const now = new Date()
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 365
  const from = subDays(now, days - 1)
  from.setHours(0, 0, 0, 0)
  return { from: toISO(from), to: now.toISOString() }
}

/** Explicit clock label: 8 → "08:00". */
const fmtHour = (h: number): string => String(h).padStart(2, '0')
/** Cell range label: 8 → "08:00–09:00" (wraps 23 → "23:00–00:00"). */
const fmtSlot = (h: number): string => `${fmtHour(h)}:00–${fmtHour((h + 1) % 24)}:00`

/** Monday-first short weekday labels in the app language (heatmap cells). */
function weekdayLabels(locale: 'tr' | 'en'): string[] {
  const base = new Date(2026, 8, 7) // a Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return format(d, 'EEE', { locale: locale === 'tr' ? tr : enUS })
  })
}

/** Monday-first long weekday labels (stat cards). */
function weekdayLongLabels(locale: 'tr' | 'en'): string[] {
  const base = new Date(2026, 8, 7) // a Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return format(d, 'EEEE', { locale: locale === 'tr' ? tr : enUS })
  })
}

function HeatCell({
  label,
  value,
  title,
  intensity,
  color
}: {
  label: string
  value: string
  title: string
  intensity: number
  color: string
}): React.JSX.Element {
  return (
    <div
      title={title}
      aria-label={title}
      className={`flex min-w-0 flex-col items-center gap-0.5 rounded-md border border-border px-1 py-1.5 ${
        intensity === 0 ? 'bg-muted/40' : ''
      }`}
      style={intensity === 0 ? undefined : { backgroundColor: `color-mix(in srgb, ${color} ${intensity}%, transparent)` }}
    >
      <span className={`text-[11px] font-medium tabular-nums ${intensity === 0 ? 'text-muted-foreground' : ''}`}>
        {label}
      </span>
      <span
        className={`max-w-full truncate text-[11px] tabular-nums ${intensity === 0 ? 'text-muted-foreground' : 'font-medium'}`}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * Sales rhythm: hourly heatmap plus a weekday strip below a separator,
 * both in shop local time. Full-width — 24 hour cells need the room.
 */
export function RhythmPanel(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { data: settings } = useSettings()
  const [period, setPeriod] = useState<Period>('month')
  const [metric, setMetric] = useState<Metric>('sales')
  // Memoized: rangeFor() embeds the current timestamp, so rebuilding it every
  // render would change the query key and refetch in a loop.
  const range = useMemo(() => rangeFor(period), [period])
  const hourly = useHourlySales(range)
  const weekly = useWeekdayAverages(range)
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear)
  const monthly = useMonthlyAverages(year)
  const currency = settings?.general.currency ?? 'USD'
  const locale = i18n.language === 'tr' ? tr : enUS
  const labels = weekdayLabels(i18n.language === 'tr' ? 'tr' : 'en')
  const longLabels = weekdayLongLabels(i18n.language === 'tr' ? 'tr' : 'en')

  const activeColor = metric === 'revenue' ? 'var(--chart-4)' : 'var(--chart-2)'
  const metricLabel = metric === 'revenue' ? t('reportPage.revenue') : t('dashboard.salesCount')
  const fmtValue = (sales: number, revenue: number): string =>
    metric === 'revenue' ? formatMoney(revenue, currency) : String(sales)
  const fmtDetail = (sales: number, revenue: number): string => `${metricLabel}: ${fmtValue(sales, revenue)}`
  const intensityOf = (v: number, max: number): number =>
    v === 0 || max === 0 ? 0 : Math.round(15 + (85 * v) / max)

  const retry = (): void => {
    void hourly.refetch()
    void weekly.refetch()
    void monthly.refetch()
  }

  return (
    <Panel
      title={t('dashboard.rhythm')}
      controls={
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Label>{t('reportPage.value')}</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">{t('dashboard.salesCount')}</SelectItem>
                <SelectItem value="revenue">{t('reportPage.revenue')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{t('dashboard.periodWeek')}</SelectItem>
              <SelectItem value="month">{t('dashboard.periodMonth')}</SelectItem>
              <SelectItem value="year">{t('dashboard.periodYear')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      {hourly.isPending || weekly.isPending || monthly.isPending ? (
        <ReportLoading />
      ) : hourly.isError || weekly.isError || monthly.isError ? (
        <ReportError onRetry={retry} />
      ) : !hourly.data ||
        !weekly.data ||
        !monthly.data ||
        (hourly.data.every((d) => d.sales === 0) &&
          weekly.data.every((d) => d.sales === 0) &&
          monthly.data.every((d) => d.sales === 0)) ? (
        <ReportEmpty />
      ) : (
        (() => {
          const hours = hourly.data ?? []
          const days = weekly.data ?? []
          const months = monthly.data ?? []
          const monthOf = (m: number): string => format(new Date(year, m, 1), 'MMM', { locale })
          const monthLongOf = (m: number): string => format(new Date(year, m, 1), 'MMMM', { locale })
          const hourMax = Math.max(...hours.map((d) => d[metric]), 0)
          const dayMax = Math.max(...days.map((d) => d[metric === 'revenue' ? 'revenue' : 'sales']), 0)
          const monthMax = Math.max(...months.map((d) => d[metric === 'revenue' ? 'revenue' : 'sales']), 0)
          const peakHour = hours.reduce((a, b) => (b[metric] > a[metric] ? b : a))
          const bestDay = days.reduce((a, b) =>
            b[metric === 'revenue' ? 'revenue' : 'sales'] > a[metric === 'revenue' ? 'revenue' : 'sales'] ? b : a
          )
          const bestMonth = months.reduce((a, b) =>
            b[metric === 'revenue' ? 'revenue' : 'sales'] > a[metric === 'revenue' ? 'revenue' : 'sales'] ? b : a
          )
          return (
            <>
              <div className="grid gap-2 sm:grid-cols-3" aria-live="polite">
                {[
                  {
                    label: t('dashboard.peakHour'),
                    headline: fmtSlot(peakHour.hour),
                    detail: fmtDetail(peakHour.sales, peakHour.revenue)
                  },
                  {
                    label: t('dashboard.bestDay'),
                    headline: longLabels[bestDay.weekday] ?? '',
                    detail: fmtDetail(bestDay.sales, bestDay.revenue)
                  },
                  {
                    label: t('dashboard.bestMonth'),
                    headline: `${monthLongOf(bestMonth.month)} ${year}`,
                    detail: fmtDetail(bestMonth.sales, bestMonth.revenue)
                  }
                ].map((s) => (
                  <div key={s.label} className="rounded-md border border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="truncate text-sm font-semibold tabular-nums" title={s.headline}>
                      {s.headline}
                    </p>
                    <p className="truncate text-xs text-muted-foreground tabular-nums" title={s.detail}>
                      {s.detail}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-muted-foreground">{t('dashboard.hours')}</p>
              <div className="grid grid-cols-6 gap-1 sm:grid-cols-12" role="img" aria-label={t('dashboard.hours')}>
                {hours.map((d) => (
                  <HeatCell
                    key={d.hour}
                    label={`${fmtHour(d.hour)}:00`}
                    value={fmtValue(d.sales, d.revenue)}
                    title={`${t('dashboard.hour')}: ${fmtSlot(d.hour)} · ${fmtValue(d.sales, d.revenue)}`}
                    intensity={intensityOf(d[metric], hourMax)}
                    color={activeColor}
                  />
                ))}
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">{t('dashboard.days')}</p>
              </div>
              <div className="grid grid-cols-7 gap-1" role="img" aria-label={t('dashboard.days')}>
                {days.map((d) => {
                  const v = metric === 'revenue' ? d.revenue : d.sales
                  return (
                    <HeatCell
                      key={d.weekday}
                      label={labels[d.weekday] ?? ''}
                      value={fmtValue(d.sales, d.revenue)}
                      title={`${labels[d.weekday]} · ${fmtValue(d.sales, d.revenue)}`}
                      intensity={intensityOf(v, dayMax)}
                      color={activeColor}
                    />
                  )
                })}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">{t('dashboard.months')}</p>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={String(currentYear)}>{t('dashboard.thisYear')}</SelectItem>
                    <SelectItem value={String(currentYear - 1)}>{t('dashboard.lastYear')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-6 gap-1 sm:grid-cols-12" role="img" aria-label={t('dashboard.months')}>
                {months.map((d) => {
                  const v = metric === 'revenue' ? d.revenue : d.sales
                  return (
                    <HeatCell
                      key={d.month}
                      label={monthOf(d.month)}
                      value={fmtValue(d.sales, d.revenue)}
                      title={`${monthOf(d.month)} ${year} · ${fmtValue(d.sales, d.revenue)}`}
                      intensity={intensityOf(v, monthMax)}
                      color={activeColor}
                    />
                  )
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('dashboard.quiet')}</span>
                <div
                  className="h-2 flex-1 rounded-full"
                  style={{ background: `linear-gradient(90deg, transparent, ${activeColor})` }}
                />
                <span className="text-xs text-muted-foreground">{t('dashboard.peak')}</span>
              </div>
            </>
          )
        })()
      )}
    </Panel>
  )
}
