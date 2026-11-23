/**
 * Entry Point Utama — Google Apps Script Pembuat Form Otomatis PRRP Sumatera TA 2026 (Dit. LMEA).
 * Pilih salah satu fungsi di bawah ini dari menu dropdown editor Apps Script lalu klik "Run" / "Jalankan".
 */

/**
 * REKOMENDASI UTAMA (BUAT FORM BARU OTOMATIS):
 * Membuat Google Form baru langsung di akun Drive aktif Anda dan langsung mengisi
 * seluruh pertanyaan cascading dari data lengkap kedua file Excel (DataPayload.js).
 * Link Edit & Preview Form akan langsung dicetak di Execution Log.
 * @return {string} Form ID baru.
 */
function buildNewFormFromEmbedded() {
  return startBuildNewForm_('embedded');
}

/**
 * BUAT FORM BARU DARI GOOGLE SPREADSHEET:
 * Membuat Google Form baru otomatis menggunakan data dari Google Spreadsheet
 * (Master_IK_KUB & Master_Spek_Mesin).
 * @param {string=} optionalSpreadsheetId
 * @return {string} Form ID baru.
 */
function buildNewFormFromSpreadsheet(optionalSpreadsheetId) {
  return startBuildNewForm_('spreadsheet', optionalSpreadsheetId);
}

/**
 * MODE 1 (UPDATE FORM EKSISTING / FORM AKTIF):
 * Memperbarui Google Form aktif (hasil buildNewForm* atau PRRP_CONFIG.FORM_ID)
 * menggunakan data lengkap kedua file Excel yang tertanam di DataPayload.js.
 */
function buildFormFromEmbedded() {
  startBuildForm_('embedded');
}

/**
 * MODE 2 (UPDATE FORM DARI GOOGLE SPREADSHEET):
 * Memperbarui Google Form aktif menggunakan data langsung dari Google Spreadsheet
 * (Master_IK_KUB & Master_Spek_Mesin). Jalankan createMasterSpreadsheetTemplate() dulu jika belum punya Sheet.
 * @param {string=} optionalSpreadsheetId
 */
function buildFormFromSpreadsheet(optionalSpreadsheetId) {
  startBuildForm_('spreadsheet', optionalSpreadsheetId);
}

/**
 * Dipanggil otomatis oleh time-based trigger bila proses build dijeda aman sebelum batas 6 menit,
 * atau dapat dijalankan manual bila ingin melanjutkan build yang tertunda.
 */
function continueBuildForm() {
  continueBuildForm_();
}

/**
 * Membuat Google Spreadsheet Master baru (Master_IK_KUB & Master_Spek_Mesin)
 * berisi 100% data dari kedua Excel serta menyimpan ID-nya untuk sinkronisasi masa depan.
 * @return {string} Spreadsheet ID.
 */
function createMasterSpreadsheetTemplate() {
  return createMasterSpreadsheetTemplate_();
}

/**
 * Memverifikasi integritas Google Form aktif: jumlah section (65), dropdown berjenjang,
 * cabang 52 KUB, anti-fallthrough ke KUB lain, dan validasi panjang teks.
 * @return {Object} Ringkasan hasil audit Form.
 */
function verifyFormStructure() {
  const state = loadBuildState_();
  const mode = state && state.mode ? state.mode : 'embedded';
  const sheetId = state && state.spreadsheetId ? state.spreadsheetId : '';
  const formId = state && state.formId ? state.formId : '';
  const masterData = loadMasterData_(mode, sheetId);
  return verifyFormStructure_(masterData, formId);
}

/**
 * Membersihkan state build tertunda & trigger lanjutan sebelum memulai ulang jika diperlukan.
 */
function resetBuildState() {
  resetBuildState_();
}
