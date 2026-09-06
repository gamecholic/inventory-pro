import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format, startOfMonth, subYears } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatISO } from '@shared/dates'
import { presetRange, type DatePreset } from '@shared/dates'
import { useSettings } from '@/hooks/useSettings'

const PRESETS: DatePreset[] = ['today', 'week', 'month', 'year', 'lastMonth', 'lastYear', 'last5Years']

const CHIP_CLASS =
  'px-2.5 py-1 text-xs rounded-full border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer'

/**
 * Draft date-range picker: trigger button, two calendars (left tracks the
 * range start, right the end), preset chips below. Selection stays local
 * until the parent commits (Apply Filter).
 */
export function DateRangePicker({
  range,
  onSelect
}: {
  range: DateRange | undefined
  onSelect: (range: DateRange | undefined) => void
}): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { data: settings } = useSettings()
  const [open, setOpen] = useState(false)
  // Two independent months: left tracks the range start, right tracks the end.
  // Synced on preset pick and popover open, and to whichever end just changed;
  // free navigation otherwise.
  const [startMonth, setStartMonth] = useState<Date>(() => startOfMonth(range?.from ?? new Date()))
  const [endMonth, setEndMonth] = useState<Date>(() => startOfMonth(range?.to ?? new Date()))
  const dateFormat = settings?.general.dateFormat ?? 'MM/DD/YYYY'
  const today = new Date()
  const locale = i18n.language === 'tr' ? tr : enUS

  const reopen = (o: boolean): void => {
    setOpen(o)
    if (o) {
      if (range?.from) setStartMonth(startOfMonth(range.from))
      if (range?.to) setEndMonth(startOfMonth(range.to))
    }
  }

  const pickPreset = (p: DatePreset): void => {
    const r = presetRange(p, today)
    onSelect(r)
    setStartMonth(startOfMonth(r.from))
    setEndMonth(startOfMonth(r.to))
  }

  const handleSelect = (r: DateRange | undefined): void => {
    if (r?.from && r.from.getTime() !== range?.from?.getTime()) setStartMonth(startOfMonth(r.from))
    if (r?.to && r.to?.getTime() !== range?.to?.getTime()) setEndMonth(startOfMonth(r.to))
    onSelect(r)
  }

  const label =
    range?.from && range?.to
      ? `${formatISO(range.from.toISOString(), dateFormat)} – ${formatISO(range.to.toISOString(), dateFormat)}`
      : t('sales.pickRange')

  const calendarProps = {
    mode: 'range' as const,
    captionLayout: 'dropdown' as const,
    locale,
    formatters: {
      // The stock calendar formats dropdowns with the OS locale — pin to the app language.
      formatMonthDropdown: (d: Date) => format(d, 'MMM', { locale }),
      formatWeekdayName: (d: Date) => format(d, 'EEEEEE', { locale })
    },
    startMonth: subYears(today, 10),
    endMonth: today,
    selected: range,
    onSelect: handleSelect
  }

  return (
    <Popover open={open} onOpenChange={reopen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 w-[240px] justify-start px-2.5 text-left font-normal">
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="ml-1.5 truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex gap-2 p-2">
          <Calendar {...calendarProps} month={startMonth} onMonthChange={setStartMonth} />
          <Calendar {...calendarProps} month={endMonth} onMonthChange={setEndMonth} />
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-border p-3">
          {PRESETS.map((p) => (
            <button key={p} type="button" className={CHIP_CLASS} onClick={() => pickPreset(p)}>
              {t(`sales.presets.${p}`)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
