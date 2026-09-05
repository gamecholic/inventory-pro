import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  en: {
    translation: {
      nav: {
        dashboard: 'Dashboard',
        pos: 'Point of Sale',
        products: 'Products',
        stock: 'Stock Update',
        sales: 'Sales History',
        expenses: 'Expenses',
        reports: 'Reports',
        settings: 'Settings'
      },
      app: { name: 'Inventory Pro', comingSoon: 'Coming soon' },
      theme: { toggle: 'Toggle theme', light: 'Light', dark: 'Dark', system: 'System' }
    }
  },
  tr: {
    translation: {
      nav: {
        dashboard: 'Panel',
        pos: 'Satış Noktası',
        products: 'Ürünler',
        stock: 'Stok Güncelleme',
        sales: 'Satış Geçmişi',
        expenses: 'Giderler',
        reports: 'Raporlar',
        settings: 'Ayarlar'
      },
      app: { name: 'Inventory Pro', comingSoon: 'Çok yakında' },
      theme: { toggle: 'Temayı değiştir', light: 'Açık', dark: 'Koyu', system: 'Sistem' }
    }
  }
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

export default i18n
