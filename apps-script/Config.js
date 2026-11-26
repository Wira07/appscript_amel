/**
 * Konfigurasi pusat Sistem Pembuat Form Otomatis PRRP Sumatera TA 2026 (Dit. LMEA).
 */
const PRRP_CONFIG = {
  // ID Google Form target (dari URL: .../forms/d/<FORM_ID>/edit)
  FORM_ID: '1INekzyoSYl8kyVxK-umT3U83p09TqfvcvnSjczITiug',

  // Opsional: isi dengan ID Google Spreadsheet jika menggunakan mode Sheet Sync manual.
  // Kosongkan jika memakai ID otomatis hasil createMasterSpreadsheetTemplate().
  SPREADSHEET_ID: '',

  SHEET_IK_KUB: 'Master_IK_KUB',
  SHEET_SPEK_MESIN: 'Master_Spek_Mesin',

  PROP_STATE_KEY: 'PRRP_BUILD_STATE',
  PROP_FORM_ID_KEY: 'PRRP_ACTIVE_FORM_ID',
  PROP_SHEET_ID_KEY: 'PRRP_MASTER_SPREADSHEET_ID',
  PROP_APPSHEET_ID_KEY: 'PRRP_APPSHEET_SPREADSHEET_ID',
  PROP_RESPONSE_SHEET_ID_KEY: 'PRRP_RESPONSE_SPREADSHEET_ID',

  // Soft time limit sebelum 6 menit (360.000 ms) batas eksekusi Google Apps Script
  MAX_EXECUTION_MS: 220000,
  CONTINUE_DELAY_MS: 15000,
  MAX_TEXT_CHUNK_CHARS: 3500,
  MAX_GRID_ROW_CHARS: 120,

  FORM_TITLE: 'Formulir Monitoring & Verifikasi Bantuan Mesin/Peralatan PRRP Sumatera TA 2026 (Dit. LMEA)',
  FORM_DESCRIPTION:
    'Formulir resmi untuk petugas lapangan dalam melakukan verifikasi identitas anggota IK, penerimaan fisik, kesesuaian spesifikasi teknis, volume, instalasi, serta pelatihan operator mesin/peralatan penerima program PRRP Sumatera TA 2026.\n\n' +
    'Alur Otomatis (Cascading):\n' +
    '1. Isi Identitas Petugas & pilih Provinsi\n' +
    '2. Pilih Kabupaten/Kota (otomatis terfilter sesuai Provinsi)\n' +
    '3. Pilih Nama KUB (otomatis terfilter sesuai Kab/Kota)\n' +
    '4. Sistem langsung menampilkan data lengkap Anggota IK & Spesifikasi Mesin milik KUB tersebut untuk diverifikasi\n' +
    '5. Isi Konfirmasi Penutup & Kirim.',

  CONFIRMATION_MESSAGE:
    'Terima kasih! Data monitoring dan verifikasi lapangan KUB penerima PRRP Sumatera TA 2026 telah berhasil direkam.',

  TAHAP_KUNJUNGAN_OPTIONS: [
    'Verifikasi Awal / Survei Kesiapan',
    'Serah Terima / Pengiriman Mesin',
    'Instalasi & Uji Coba (Commissioning)',
    'Training Operator',
    'Monitoring Pemanfaatan'
  ],

  GRID_SPEK_COLUMNS: [
    'Sesuai Spek & Volume',
    'Sesuai Spek (Volume Kurang)',
    'Tidak Sesuai Spek',
    'Belum Diterima',
    'Rusak / Bermasalah'
  ],

  GRID_INSTALASI_COLUMNS: [
    'Sudah Instalasi & Training',
    'Sudah Instalasi (Belum Training)',
    'Belum Instalasi',
    'Tidak Memerlukan'
  ],

  KESIAPAN_LOKASI_OPTIONS: [
    'Sangat Siap (Lokasi, daya listrik, dan ruang produksi memadai)',
    'Cukup Siap (Perlu penyesuaian ringan)',
    'Belum Siap (Perlu dukungan infrastruktur / daya)'
  ]
};
