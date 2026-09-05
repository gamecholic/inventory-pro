import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import type { SettingsSection } from '@shared/settings'

export const settingsKey = ['settings'] as const

/** Live settings from SQLite (main). All pages read display prefs from here. */
export function useSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: () => window.api.settings.get(), staleTime: 30_000 })
}

export function useUpdateSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ section, patch }: { section: SettingsSection; patch: Record<string, unknown> }) =>
      window.api.settings.update(section, patch),
    onSuccess: async (data, variables) => {
      queryClient.setQueryData(settingsKey, data)
      // Language first so the toast itself renders in the new language (§1.2).
      if (variables.section === 'general' && typeof variables.patch.language === 'string') {
        await i18n.changeLanguage(variables.patch.language)
      }
      toast.success(t('settings.saved'))
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('settings.saveFailed'))
    }
  })
}
