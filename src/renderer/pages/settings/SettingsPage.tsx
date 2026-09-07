import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppVersion } from '@/hooks/useAppVersion'
import { BusinessTab } from './BusinessTab'
import { DatabaseTab } from './DatabaseTab'
import { GeneralTab } from './GeneralTab'
import { ReceiptTab } from './ReceiptTab'

/** Read-only packaged version below the tabs. */
function AppVersion(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { data: version } = useAppVersion()
  if (!version) return null
  return <p className="px-4 text-sm text-muted-foreground lg:px-6">{t('settings.version', { version })}</p>
}

/** Features §9 — four sections, left-aligned tab navigation. */
export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="px-4 lg:px-6">
      <Tabs defaultValue="general" className="flex flex-col gap-4">
        <TabsList className="w-fit gap-1 px-1.5">
          <TabsTrigger value="general" className="px-4">
            {t('settings.tabs.general')}
          </TabsTrigger>
          <TabsTrigger value="business" className="px-4">
            {t('settings.tabs.business')}
          </TabsTrigger>
          <TabsTrigger value="receipt" className="px-4">
            {t('settings.tabs.receipt')}
          </TabsTrigger>
          <TabsTrigger value="database" className="px-4">
            {t('settings.tabs.database')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="business">
          <BusinessTab />
        </TabsContent>
        <TabsContent value="receipt">
          <ReceiptTab />
        </TabsContent>
        <TabsContent value="database">
          <DatabaseTab />
        </TabsContent>
      </Tabs>
      <AppVersion />
    </div>
  )
}
