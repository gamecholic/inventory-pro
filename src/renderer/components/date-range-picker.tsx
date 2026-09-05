import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format, subYears } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
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
      <PopoverContent className="w-auto p-0" align="start">
        <Card className="border-0 shadow-none">
          <CardContent className="p-2">
            <Calendar
              mode="range"
              captionLayout="dropdown"
              numberOfMonths={2}
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
          </CardContent>
          <CardFooter className="flex max-w-xl flex-wrap gap-1.5 border-t px-2 py-2">
            {PRESETS.map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                className="flex-1 rounded-full"
                onClick={() => onSelect(presetRange(p, today))}
              >
                {t(`sales.presets.${p}`)}
              </Button>
            ))}
          </CardFooter>
        </Card>
      </PopoverContent>
    </Popover>
  )
}
