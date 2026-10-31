import type { AppApi } from '@shared/api-surface'

declare global {
  interface Window {
    api: AppApi
  }
}

export {}
