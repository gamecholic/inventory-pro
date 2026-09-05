import { useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useTranslation } from 'react-i18next'

const routes = [
  { path: '/', key: 'dashboard' },
  { path: '/pos', key: 'pos' },
  { path: '/products', key: 'products' },
  { path: '/stock', key: 'stock' },
  { path: '/sales', key: 'sales' },
  { path: '/expenses', key: 'expenses' },
  { path: '/reports', key: 'reports' },
  { path: '/settings', key: 'settings' }
] as const

function Placeholder({ titleKey }: { titleKey: string }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">{t(`nav.${titleKey}`)}</h1>
      <p className="text-muted-foreground mt-2">{t('app.comingSoon')}</p>
    </main>
  )
}

export default function App(): React.JSX.Element {
  const { t } = useTranslation()
  const [queryClient] = useState(() => new QueryClient())

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <div className="flex min-h-screen bg-background text-foreground">
            <aside className="w-56 shrink-0 border-r border-border p-4">
              <p className="mb-4 font-bold">{t('app.name')}</p>
              <nav className="flex flex-col gap-1">
                {routes.map((r) => (
                  <NavLink
                    key={r.key}
                    to={r.path}
                    className={({ isActive }) =>
                      `rounded px-3 py-2 text-sm ${isActive ? 'bg-muted font-medium' : 'hover:bg-muted/60'}`
                    }
                  >
                    {t(`nav.${r.key}`)}
                  </NavLink>
                ))}
              </nav>
            </aside>
            <div className="flex-1">
              <Routes>
                {routes.map((r) => (
                  <Route key={r.key} path={r.path} element={<Placeholder titleKey={r.key} />} />
                ))}
              </Routes>
            </div>
          </div>
        </HashRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
