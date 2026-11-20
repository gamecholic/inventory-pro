import { Store } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar'
import { SidebarBackup } from '@/components/sidebar-backup'
import type { AppRoute } from '@/routes'

export function AppSidebar({ routes }: { routes: readonly AppRoute[] }): React.JSX.Element {
  const { t } = useTranslation()
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  // On phones the sidebar is an overlay; a chosen destination should reveal the
  // page instead of leaving the drawer covering it.
  useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [location.pathname, isMobile, setOpenMobile])

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="data-[slot=sidebar-menu-button]:p-1.5! h-11 md:h-8">
              <Store className="size-5!" />
              <span className="text-base font-semibold">{t('app.name')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {routes.map((r) => (
                <SidebarMenuItem key={r.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === r.path}
                    className="h-11 md:h-8 [&>svg]:size-5 md:[&>svg]:size-4"
                  >
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
      <SidebarFooter>
        <SidebarBackup />
      </SidebarFooter>
    </Sidebar>
  )
}
