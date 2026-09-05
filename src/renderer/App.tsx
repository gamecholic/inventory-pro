import { useState } from 'react'
import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  History,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Wallet
} from 'lucide-react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useTranslation } from 'react-i18next'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

const routes = [
  { path: '/', key: 'dashboard', icon: LayoutDashboard },
  { path: '/pos', key: 'pos', icon: ShoppingCart },
  { path: '/products', key: 'products', icon: Package },
  { path: '/stock', key: 'stock', icon: ArrowLeftRight },
  { path: '/sales', key: 'sales', icon: History },
  { path: '/expenses', key: 'expenses', icon: Wallet },
  { path: '/reports', key: 'reports', icon: BarChart3 },
  { path: '/settings', key: 'settings', icon: Settings }
] as const

function Placeholder({ titleKey }: { titleKey: string }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">{t(`nav.${titleKey}`)}</h1>
      <p className="text-muted-foreground mt-2">{t('app.comingSoon')}</p>
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ClipboardList className="size-4" />
        {t('app.name')}
      </p>
    </main>
  )
}

function AppSidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const location = useLocation()
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <span className="font-bold">{t('app.name')}</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {routes.map((r) => (
                <SidebarMenuItem key={r.key}>
                  <SidebarMenuButton asChild isActive={location.pathname === r.path}>
                    <NavLink to={r.path}>
                      <r.icon />
                      <span>{t(`nav.${r.key}`)}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

export default function App(): React.JSX.Element {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <HashRouter>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <header className="flex items-center gap-2 border-b border-border p-2">
                  <SidebarTrigger />
                </header>
                <Routes>
                  {routes.map((r) => (
                    <Route key={r.key} path={r.path} element={<Placeholder titleKey={r.key} />} />
                  ))}
                </Routes>
              </SidebarInset>
            </SidebarProvider>
          </HashRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
