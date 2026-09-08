import { useTranslation } from 'react-i18next'
import { Building2, Database, Receipt, SlidersHorizontal } from 'lucide-react'
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
      <Tabs orientation="vertical" defaultValue="general" className="flex-col gap-6 md:flex-row">
        <TabsList className="h-fit w-full shrink-0 flex-col items-stretch gap-1 p-1.5 md:w-56">
          <TabsTrigger value="general" className="justify-start gap-2 px-3">
            <SlidersHorizontal />
            {t('settings.tabs.general')}
          </TabsTrigger>
          <TabsTrigger value="business" className="justify-start gap-2 px-3">
            <Building2 />
            {t('settings.tabs.business')}
          </TabsTrigger>
          <TabsTrigger value="receipt" className="justify-start gap-2 px-3">
            <Receipt />
            {t('settings.tabs.receipt')}
          </TabsTrigger>
          <TabsTrigger value="database" className="justify-start gap-2 px-3">
            <Database />
            {t('settings.tabs.database')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-0 min-w-0 flex-1">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="business" className="mt-0 min-w-0 flex-1">
          <BusinessTab />
        </TabsContent>
        <TabsContent value="receipt" className="mt-0 min-w-0 flex-1">
          <ReceiptTab />
        </TabsContent>
        <TabsContent value="database" className="mt-0 min-w-0 flex-1">
          <DatabaseTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
