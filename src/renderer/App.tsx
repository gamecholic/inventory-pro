import { Suspense, lazy, useEffect, useState } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { UpdateCard } from '@/components/update-card'
import { useSettings } from '@/hooks/useSettings'
import { routes, type AppRoute } from '@/routes'

const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ExpensesPage = lazy(() => import('./pages/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage })))
const ProductsPage = lazy(() => import('./pages/products/ProductsPage').then((m) => ({ default: m.ProductsPage })))
const PosPage = lazy(() => import('./pages/pos/PosPage').then((m) => ({ default: m.PosPage })))
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const SalesPage = lazy(() => import('./pages/sales/SalesPage').then((m) => ({ default: m.SalesPage })))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const StockPage = lazy(() => import('./pages/stock/StockPage').then((m) => ({ default: m.StockPage })))

function PageFallback(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6" aria-busy="true">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

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
    if (data) {
      document.documentElement.lang = data.general.language
      if (i18n.language !== data.general.language) {
        void i18n.changeLanguage(data.general.language)
      }
    }
  }, [data, i18n])
  return null
}

/** Scheduled backups are silent on success; only failures surface as a toast (§1.8, SSE). */
function ScheduledBackupToasts(): React.JSX.Element | null {
  const { t } = useTranslation()
  useEffect(() => {
    const source = new EventSource('/api/backup-events')
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { message?: string }
        toast.error(t('settings.db.scheduledBackupFailed', { message: data.message ?? '' }))
      } catch {
        // ignore keepalive comments / malformed payloads
      }
    }
    // A dropped stream must never break the app; EventSource retries on its own.
    source.onerror = () => undefined
    return () => source.close()
  }, [t])
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
      className="flex h-screen w-screen overflow-hidden flex-col md:flex-row"
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 64)',
          '--header-height': 'calc(var(--spacing) * 12 + 1px)'
        } as React.CSSProperties
      }
    >
      <AppSidebar routes={routes} />
      <SidebarInset className="min-h-0 overflow-hidden md:peer-data-[variant=inset]:overflow-clip">
        <div className="mb-2 native-scroll h-full min-h-0 flex-1 overflow-y-auto">
          <SiteHeader title={t(`nav.${active.key}`)} />
          <UpdateCard />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    {routes.map((r) => (
                      <Route key={r.key} path={r.path} element={pageFor(r.key)} />
                    ))}
                  </Routes>
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function App(): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } }
      })
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <HashRouter>
            <ApplySettings />
            <ScheduledBackupToasts />
            <Shell />
          </HashRouter>
          <Toaster richColors />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
