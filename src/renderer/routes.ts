import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  BarChart3,
  History,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Wallet
} from 'lucide-react'

export interface AppRoute {
  path: string
  key: 'dashboard' | 'pos' | 'products' | 'stock' | 'sales' | 'expenses' | 'reports' | 'settings'
  icon: LucideIcon
}

export const routes: readonly AppRoute[] = [
  { path: '/', key: 'dashboard', icon: LayoutDashboard },
  { path: '/pos', key: 'pos', icon: ShoppingCart },
  { path: '/products', key: 'products', icon: Package },
  { path: '/stock', key: 'stock', icon: ArrowLeftRight },
  { path: '/sales', key: 'sales', icon: History },
  { path: '/expenses', key: 'expenses', icon: Wallet },
  { path: '/reports', key: 'reports', icon: BarChart3 },
  { path: '/settings', key: 'settings', icon: Settings }
] as const
