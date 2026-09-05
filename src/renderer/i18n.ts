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
      theme: { toggle: 'Toggle theme', light: 'Light', dark: 'Dark', system: 'System' },
      settings: {
        title: 'Settings',
        tabs: { general: 'General', business: 'Business Information', receipt: 'Receipt', database: 'Database' },
        language: 'Language',
        currency: 'Currency',
        dateFormat: 'Date Format',
        lowStock: 'Enable Low Stock Notifications',
        cardFee: 'Credit Card Vendor Fee (%)',
        save: 'Save Changes',
        saved: 'Settings saved',
        saveFailed: 'Failed to save settings',
        reset: 'Reset Settings',
        resetTitle: 'Reset all settings?',
        resetDesc: 'All settings return to defaults. Your data is not deleted.',
        cancel: 'Cancel',
        confirm: 'Confirm',
        businessName: 'Business Name',
        address: 'Address',
        phone: 'Phone Number',
        email: 'Email',
        taxId: 'Tax ID / Business Number',
        receiptHeader: 'Receipt Header',
        receiptFooter: 'Receipt Footer',
        showLogo: 'Show Business Logo on Receipt',
        required: 'This field is required',
        invalidEmail: 'Enter a valid email address',
        db: {
          exportJson: 'Export to JSON',
          exportJsonDesc: 'Full backup file, useful for transferring to another device.',
          importJson: 'Import from JSON',
          importJsonDesc: 'Restore from a JSON backup file.',
          exportExcel: 'Export to Excel',
          exportExcelDesc: 'Spreadsheet for external analysis or reporting.',
          importExcel: 'Import from Excel',
          importExcelDesc: 'Restore from a spreadsheet backup file.',
          resetDb: 'Reset Database',
          resetDbDesc: 'Delete all data. Cannot be undone.',
          backupOnClose: 'Backup on close (optional)',
          backupOnCloseDesc: 'Ask to export an Excel backup every time the app closes.',
          importTitle: 'Replace current data?',
          importDesc: 'Importing replaces all current data. This cannot be undone.',
          resetTitle: 'Delete all data?',
          resetDesc: 'All products, sales, expenses and settings will be deleted. Cannot be undone.',
          working: 'Working…',
          exportedTo: 'Backup saved',
          imported: 'Import complete, reloading…',
          importFailed: 'Import failed',
          resetDone: 'Database reset, reloading…',
          canceled: 'Canceled'
        }
      }
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
      theme: { toggle: 'Temayı değiştir', light: 'Açık', dark: 'Koyu', system: 'Sistem' },
      settings: {
        title: 'Ayarlar',
        tabs: { general: 'Genel', business: 'İşletme Bilgileri', receipt: 'Fiş', database: 'Veritabanı' },
        language: 'Dil',
        currency: 'Para Birimi',
        dateFormat: 'Tarih Biçimi',
        lowStock: 'Düşük Stok Bildirimlerini Aç',
        cardFee: 'Kredi Kartı Komisyonu (%)',
        save: 'Değişiklikleri Kaydet',
        saved: 'Ayarlar kaydedildi',
        saveFailed: 'Ayarlar kaydedilemedi',
        reset: 'Ayarları Sıfırla',
        resetTitle: 'Tüm ayarlar sıfırlansın mı?',
        resetDesc: 'Tüm ayarlar varsayılanlara döner. Verileriniz silinmez.',
        cancel: 'Vazgeç',
        confirm: 'Onayla',
        businessName: 'İşletme Adı',
        address: 'Adres',
        phone: 'Telefon Numarası',
        email: 'E-posta',
        taxId: 'Vergi / Ticaret Sicil No',
        receiptHeader: 'Fiş Başlığı',
        receiptFooter: 'Fiş Altbilgisi',
        showLogo: 'Fişte İşletme Logosunu Göster',
        required: 'Bu alan zorunludur',
        invalidEmail: 'Geçerli bir e-posta girin',
        db: {
          exportJson: "JSON'a Aktar",
          exportJsonDesc: 'Başka cihaza taşımak için tam yedek dosyası.',
          importJson: "JSON'dan İçe Aktar",
          importJsonDesc: 'JSON yedeğinden geri yükle.',
          exportExcel: "Excel'e Aktar",
          exportExcelDesc: 'Dış analiz veya raporlama için tablo.',
          importExcel: "Excel'den İçe Aktar",
          importExcelDesc: 'Tablo yedeğinden geri yükle.',
          resetDb: 'Veritabanını Sıfırla',
          resetDbDesc: 'Tüm verileri sil. Geri alınamaz.',
          backupOnClose: 'Kapanışta yedekle (isteğe bağlı)',
          backupOnCloseDesc: 'Uygulama her kapandığında Excel yedeği sor.',
          importTitle: 'Mevcut veriler değiştirilsin mi?',
          importDesc: 'İçe aktarma tüm mevcut verilerin yerine geçer. Geri alınamaz.',
          resetTitle: 'Tüm veriler silinsin mi?',
          resetDesc: 'Tüm ürünler, satışlar, giderler ve ayarlar silinir. Geri alınamaz.',
          working: 'Çalışıyor…',
          exportedTo: 'Yedek kaydedildi',
          imported: 'İçe aktarma tamamlandı, yeniden yükleniyor…',
          importFailed: 'İçe aktarma başarısız',
          resetDone: 'Veritabanı sıfırlandı, yeniden yükleniyor…',
          canceled: 'Vazgeçildi'
        }
      }
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
