import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format, subYears } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatISO } from '@shared/dates'
import { presetRange, type DatePreset } from '@shared/dates'
import { useSettings } from '@/hooks/useSettings'

const PRESETS: DatePreset[] = ['today', 'week', 'month', 'year', 'lastMonth', 'lastYear', 'last5Years']

/**
 * Draft date-range picker: preset shortcuts plus a calendar with month/year
 * dropdowns. Selection stays local until the parent commits (Apply Filter).
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
  const dateFormat = settings?.general.dateFormat ?? 'MM/DD/YYYY'
  const today = new Date()
  const locale = i18n.language === 'tr' ? tr : enUS

  const label =
    range?.from && range?.to
      ? `${formatISO(range.from.toISOString(), dateFormat)} – ${formatISO(range.to.toISOString(), dateFormat)}`
      : t('sales.pickRange')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-64 justify-start font-normal">
          <CalendarIcon className="size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto gap-2 p-2" align="start">
        <div className="flex min-w-32 flex-col gap-1">
          {PRESETS.map((p) => (
            <Button key={p} variant="ghost" size="sm" className="justify-start" onClick={() => onSelect(presetRange(p, today))}>
              {t(`sales.presets.${p}`)}
            </Button>
          ))}
        </div>
        <Calendar
          mode="range"
          captionLayout="dropdown"
          locale={locale}
          formatters={{
            // The stock calendar formats dropdowns with the OS locale — pin to the app language.
            formatMonthDropdown: (d) => format(d, 'MMM', { locale }),
            formatWeekdayName: (d) => format(d, 'EEEEEE', { locale })
          }}
          startMonth={subYears(today, 10)}
          endMonth={today}
          selected={range}
          onSelect={onSelect}
        />
      </PopoverContent>
    </Popover>
  )
}
