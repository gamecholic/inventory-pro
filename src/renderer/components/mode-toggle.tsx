import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

/** Header theme toggle (addition to spec — features.md has no theme requirement). */
export function ModeToggle(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()

  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={() => setTheme(next)}
      title={t('theme.toggle')}
    >
      <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      {theme === 'system' && <Monitor className="absolute size-4 opacity-0" />}
      <span className="sr-only">{t('theme.toggle')}</span>
    </Button>
  )
}
