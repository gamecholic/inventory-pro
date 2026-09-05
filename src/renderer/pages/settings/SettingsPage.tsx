import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BusinessTab } from './BusinessTab'
import { DatabaseTab } from './DatabaseTab'
import { GeneralTab } from './GeneralTab'
import { ReceiptTab } from './ReceiptTab'

/** Features §9 — four sections, left-aligned tab navigation. */
export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="px-4 lg:px-6">
      <Tabs defaultValue="general" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="general">{t('settings.tabs.general')}</TabsTrigger>
          <TabsTrigger value="business">{t('settings.tabs.business')}</TabsTrigger>
          <TabsTrigger value="receipt">{t('settings.tabs.receipt')}</TabsTrigger>
          <TabsTrigger value="database">{t('settings.tabs.database')}</TabsTrigger>
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
    </div>
  )
}
