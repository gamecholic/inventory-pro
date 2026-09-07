import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Toaster } from '@/components/ui/sonner'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { UpdateCard } from '@/components/update-card'
import { useSettings } from '@/hooks/useSettings'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ExpensesPage } from '@/pages/expenses/ExpensesPage'
import { ProductsPage } from '@/pages/products/ProductsPage'
import { PosPage } from '@/pages/pos/PosPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { SalesPage } from '@/pages/sales/SalesPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { StockPage } from '@/pages/stock/StockPage'
import { routes, type AppRoute } from '@/routes'

const PAGES: Record<AppRoute['key'], () => React.JSX.Element> = {
  dashboard: () => <DashboardPage />,
  settings: () => <SettingsPage />,
  products: () => <ProductsPage />,
  stock: () => <StockPage />,
  pos: () => <PosPage />,
  sales: () => <SalesPage />,
  expenses: () => <ExpensesPage />,
  reports: () => <ReportsPage />
}

function pageFor(key: string): React.JSX.Element {
  return PAGES[key as AppRoute['key']]?.() ?? <Placeholder titleKey={key} />
}

/** Applies the persisted language immediately, including on boot (features §1.2). */
function ApplySettings(): React.JSX.Element | null {
  const { data } = useSettings()
  const { i18n } = useTranslation()
  useEffect(() => {
    if (data && i18n.language !== data.general.language) {
      void i18n.changeLanguage(data.general.language)
    }
  }, [data, i18n])
  return null
}

function Placeholder({ titleKey }: { titleKey: string }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="px-4 lg:px-6">
      <h2 className="text-2xl font-semibold">{t(`nav.${titleKey}`)}</h2>
      <p className="text-muted-foreground mt-2">{t('app.comingSoon')}</p>
    </div>
  )
}

function Shell(): React.JSX.Element {
  const { t } = useTranslation()
  const location = useLocation()
  const active = routes.find((r) => r.path === location.pathname) ?? routes[0]

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 64)',
          '--header-height': 'calc(var(--spacing) * 12 + 1px)'
        } as React.CSSProperties
      }
    >
      <AppSidebar routes={routes} />
      <SidebarInset className="md:peer-data-[variant=inset]:overflow-clip">
        <SiteHeader title={t(`nav.${active.key}`)} />
        <UpdateCard />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <Routes>
                {routes.map((r) => (
                  <Route key={r.key} path={r.path} element={pageFor(r.key)} />
                ))}
              </Routes>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function App(): React.JSX.Element {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <HashRouter>
            <ApplySettings />
            <Shell />
          </HashRouter>
          <Toaster richColors />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
