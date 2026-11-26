/**
 * Rekap Otomatis Jawaban Google Form PRRP Sumatera TA 2026 (Dit. LMEA) — Opsi B (Per Kab/Kota)
 * Mengubah tabel horizontal bawaan Google Form (Form Responses 1) menjadi tab vertikal yang rapi:
 *   1. Rekap_Kunjungan        (1 baris = 1 kunjungan KUB)
 *   2. Rekap_Verifikasi_Mesin (1 baris = 1 mesin yang diverifikasi)
 *   3. 8 Tab terpisah per Kab/Kota (persis seperti tab Excel asli: Aceh Singkil, Kota Subulussalam,
 *      Aceh Selatan, Nagan Raya, Aceh Barat, Batu Bara, Deli Serdang, Kabupaten Agam)
 *
 * Aman terhadap editan manual pada Google Form (pertanyaan ditambah/dihapus/diubah).
 * TIDAK mengubah struktur Google Form maupun isi tab Form Responses 1.
 */

const REKAP_CFG = {
  SHEET_KUNJUNGAN: 'Rekap_Kunjungan',
  SHEET_MESIN: 'Rekap_Verifikasi_Mesin',
  TRIGGER_HANDLER: 'onFormSubmitRekap',
  HEADER_BG: '#0F4C5C',
  HEADER_FG: '#FFFFFF'
};

const CANONICAL_KAB_TABS_ = [
  'Aceh Singkil',
  'Kota Subulussalam',
  'Aceh Selatan',
  'Nagan Raya',
  'Aceh Barat',
  'Batu Bara',
  'Deli Serdang',
  'Kabupaten Agam'
];

const KUNJUNGAN_HEADERS_ = [
  'Row_Sumber',
  'Timestamp',
  'Nama_Petugas',
  'Instansi_Petugas',
  'HP_Petugas',
  'Tanggal_Kunjungan',
  'Tahap_Kunjungan',
  'Provinsi',
  'Kab_Kota',
  'Nama_KUB',
  'Anggota_IK_Hadir',
  'Jumlah_Mesin_Dicek',
  'Catatan_Teknis_Mesin',
  'Nama_Perwakilan_KUB',
  'Jabatan_HP_Perwakilan',
  'Kesiapan_Lokasi',
  'Dokumentasi_BAST',
  'Catatan_Umum',
  'Konfirmasi_Petugas',
  'Info_Tambahan'
];

const MESIN_REKAP_HEADERS_ = [
  'Row_Sumber',
  'Timestamp',
  'Nama_Petugas',
  'Tanggal_Kunjungan',
  'Provinsi',
  'Kab_Kota',
  'Nama_KUB',
  'No_Mesin',
  'Nama_Mesin_Spek',
  'Status_Penerimaan_Spek',
  'Status_Instalasi_Training',
  'Catatan_Teknis_Mesin'
];

const KAB_REKAP_HEADERS_ = [
  'Row_Sumber',
  'Timestamp',
  'Nama_Petugas',
  'Tanggal_Kunjungan',
  'Tahap_Kunjungan',
  'Provinsi',
  'Kab_Kota',
  'Nama_KUB',
  'Anggota_IK_Hadir',
  'No_Mesin',
  'Nama_Mesin_Spek',
  'Status_Penerimaan_Spek',
  'Status_Instalasi_Training',
  'Catatan_Teknis_Mesin',
  'Nama_Perwakilan_KUB',
  'Dokumentasi_BAST'
];

/**
 * Menambahkan menu khusus di toolbar Google Sheets saat Spreadsheet dibuka.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Rekap PRRP')
      .addItem('Rekap Semua Jawaban Sekarang', 'rekapSemuaJawaban')
      .addItem('Aktifkan Rekap Otomatis (Saat Submit)', 'aktifkanRekapOtomatis')
      .addSeparator()
      .addItem('Hapus Trigger Rekap Otomatis', 'hapusTriggerRekap')
      .addToUi();
  } catch (err) {
    // Abaikan jika dijalankan di luar UI Spreadsheet
  }
}

function extractSpreadsheetId_(urlOrId) {
  const raw = String(urlOrId || '').trim();
  if (!raw) {
    return '';
  }
  const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : raw;
}

function resolveResponseSpreadsheet_(optionalUrlOrId) {
  const props = PropertiesService.getScriptProperties();
  const explicitId = extractSpreadsheetId_(optionalUrlOrId);
  if (explicitId) {
    props.setProperty(PRRP_CONFIG.PROP_RESPONSE_SHEET_ID_KEY, explicitId);
    return SpreadsheetApp.openById(explicitId);
  }
  const savedId = props.getProperty(PRRP_CONFIG.PROP_RESPONSE_SHEET_ID_KEY);
  if (savedId) {
    return SpreadsheetApp.openById(savedId);
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('Masukkan link atau ID Google Spreadsheet Jawaban terlebih dahulu.');
  }
  return active;
}

function aktifkanRekapOtomatis_(optionalUrlOrId) {
  const ss = resolveResponseSpreadsheet_(optionalUrlOrId);
  hapusTriggerRekap_();
  ScriptApp.newTrigger(REKAP_CFG.TRIGGER_HANDLER)
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
  const res = rekapSemuaJawaban_(ss.getId());
  Logger.log(
    'Trigger otomatis AKTIF (' + REKAP_CFG.TRIGGER_HANDLER + ') untuk Spreadsheet ' + ss.getId() +
    '. Rekap awal selesai: ' + res.totalKunjungan + ' kunjungan, ' + res.totalMesin +
    ' baris mesin, ' + res.totalKabTabs + ' tab Kab/Kota.'
  );
  return res;
}

function hapusTriggerRekap_() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  triggers.forEach(function (tr) {
    if (tr.getHandlerFunction() === REKAP_CFG.TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(tr);
      removed++;
    }
  });
  Logger.log('Trigger rekap dihapus: ' + removed);
  return removed;
}

/**
 * Trigger otomatis saat petugas mengirim (Submit) Google Form.
 * Menambahkan baris baru ke Rekap_Kunjungan, Rekap_Verifikasi_Mesin, dan tab Kab/Kota terkait.
 * @param {GoogleAppsScript.Events.SheetsOnFormSubmit=} e
 */
function onFormSubmitRekap(e) {
  if (!e || !e.range || typeof e.range.getRow !== 'function') {
    rekapSemuaJawaban_();
    return;
  }

  const srcSheet = typeof e.range.getSheet === 'function' ? e.range.getSheet() : null;
  const ss = (srcSheet && typeof srcSheet.getParent === 'function' && srcSheet.getParent()) ||
    resolveResponseSpreadsheet_('');
  const targetSrc = srcSheet || findSourceSheet_(ss);
  const rowNum = e.range.getRow();
  if (rowNum <= 1) {
    return;
  }

  const lastCol = targetSrc.getLastColumn();
  if (lastCol < 1) {
    return;
  }

  const headers = targetSrc.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const rowValues = targetSrc.getRange(rowNum, 1, 1, lastCol).getDisplayValues()[0];
  if (!rowHasAnyValue_(rowValues)) {
    return;
  }

  const parsed = parseResponseRow_(headers, rowValues, rowNum);
  const shKunjungan = ensureRecapSheet_(ss, REKAP_CFG.SHEET_KUNJUNGAN, KUNJUNGAN_HEADERS_);
  const shMesin = ensureRecapSheet_(ss, REKAP_CFG.SHEET_MESIN, MESIN_REKAP_HEADERS_);
  const shKab = ensureRecapSheet_(ss, parsed.kabTabName, KAB_REKAP_HEADERS_);

  if (!sheetHasSourceRow_(shKunjungan, rowNum)) {
    appendRowsAsText_(shKunjungan, [parsed.kunjunganRow]);
  }
  if (parsed.mesinRows.length > 0 && !sheetHasSourceRow_(shMesin, rowNum)) {
    appendRowsAsText_(shMesin, parsed.mesinRows);
  }
  if (parsed.kabRows.length > 0 && !sheetHasSourceRow_(shKab, rowNum)) {
    appendRowsAsText_(shKab, parsed.kabRows);
  }
}

/**
 * Membangun ulang seluruh isi Rekap_Kunjungan, Rekap_Verifikasi_Mesin, dan 8 tab per Kab/Kota.
 * @param {string=} optionalUrlOrId
 * @return {Object}
 */
function rekapSemuaJawaban_(optionalUrlOrId) {
  const ss = resolveResponseSpreadsheet_(optionalUrlOrId);
  const srcSheet = findSourceSheet_(ss);
  const lastRow = srcSheet.getLastRow();
  const lastCol = srcSheet.getLastColumn();

  const shKunjungan = ensureRecapSheet_(ss, REKAP_CFG.SHEET_KUNJUNGAN, KUNJUNGAN_HEADERS_);
  const shMesin = ensureRecapSheet_(ss, REKAP_CFG.SHEET_MESIN, MESIN_REKAP_HEADERS_);

  const kunjunganRows = [KUNJUNGAN_HEADERS_];
  const mesinRows = [MESIN_REKAP_HEADERS_];
  const kabTabOrder = [];
  const kabTabRowsMap = {};

  CANONICAL_KAB_TABS_.forEach(function (kabName) {
    kabTabOrder.push(kabName);
    kabTabRowsMap[kabName] = [KAB_REKAP_HEADERS_];
  });

  if (lastRow >= 2 && lastCol >= 1) {
    const allValues = srcSheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
    const headers = allValues[0];
    for (let r = 1; r < allValues.length; r++) {
      const rowValues = allValues[r];
      if (!rowHasAnyValue_(rowValues)) {
        continue;
      }
      const parsed = parseResponseRow_(headers, rowValues, r + 1);
      kunjunganRows.push(parsed.kunjunganRow);
      parsed.mesinRows.forEach(function (mr) {
        mesinRows.push(mr);
      });

      if (!kabTabRowsMap[parsed.kabTabName]) {
        kabTabOrder.push(parsed.kabTabName);
        kabTabRowsMap[parsed.kabTabName] = [KAB_REKAP_HEADERS_];
      }
      parsed.kabRows.forEach(function (kr) {
        kabTabRowsMap[parsed.kabTabName].push(kr);
      });
    }
  }

  overwriteSheetAsText_(shKunjungan, kunjunganRows);
  overwriteSheetAsText_(shMesin, mesinRows);

  kabTabOrder.forEach(function (tabName) {
    const shKab = ensureRecapSheet_(ss, tabName, KAB_REKAP_HEADERS_);
    overwriteSheetAsText_(shKab, kabTabRowsMap[tabName]);
  });

  const summary = {
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    sourceSheet: srcSheet.getName(),
    totalKunjungan: kunjunganRows.length - 1,
    totalMesin: mesinRows.length - 1,
    totalKabTabs: kabTabOrder.length
  };
  Logger.log('Rekap selesai: ' + JSON.stringify(summary));
  return summary;
}

function isRecapSheetName_(name) {
  if (name === REKAP_CFG.SHEET_KUNJUNGAN || name === REKAP_CFG.SHEET_MESIN || name === 'Lainnya') {
    return true;
  }
  return CANONICAL_KAB_TABS_.indexOf(name) !== -1;
}

function sanitizeSheetTabName_(name) {
  const cleaned = String(name || '')
    .replace(/[:\\/?*\[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return 'Lainnya';
  }
  return cleaned.length > 90 ? cleaned.slice(0, 90).trim() : cleaned;
}

function resolveKabTabName_(kabKota) {
  const raw = sanitizeSheetTabName_(kabKota);
  if (!raw || raw === 'Lainnya') {
    return 'Lainnya';
  }
  for (let i = 0; i < CANONICAL_KAB_TABS_.length; i++) {
    if (CANONICAL_KAB_TABS_[i].toLowerCase() === raw.toLowerCase()) {
      return CANONICAL_KAB_TABS_[i];
    }
  }
  return raw;
}

function findSourceSheet_(ss) {
  const preferredNames = ['Form Responses 1', 'Form_Responses'];
  for (let i = 0; i < preferredNames.length; i++) {
    const sh = ss.getSheetByName(preferredNames[i]);
    if (sh) {
      return sh;
    }
  }
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    if (isRecapSheetName_(sh.getName())) {
      continue;
    }
    const a1 = sh.getLastRow() >= 1 && sh.getLastColumn() >= 1
      ? String(sh.getRange(1, 1).getDisplayValue() || '').trim().toLowerCase()
      : '';
    if (a1 === 'timestamp' || a1 === 'cap waktu') {
      return sh;
    }
  }
  for (let i = 0; i < sheets.length; i++) {
    if (!isRecapSheetName_(sheets[i].getName())) {
      return sheets[i];
    }
  }
  throw new Error('Sheet sumber jawaban Google Form tidak ditemukan.');
}

function parseResponseRow_(headers, rowValues, rowNum) {
  const rec = {
    rowSumber: String(rowNum),
    timestamp: '',
    namaPetugas: '',
    instansiPetugas: '',
    hpPetugas: '',
    tanggalKunjungan: '',
    tahapKunjungan: '',
    provinsi: '',
    kabKota: '',
    namaKub: '',
    anggotaIkHadir: '',
    catatanTeknisMesin: '',
    namaPerwakilanKub: '',
    jabatanHpPerwakilan: '',
    kesiapanLokasi: '',
    dokumentasiBast: '',
    catatanUmum: '',
    konfirmasiPetugas: '',
    infoTambahan: []
  };

  const machineOrder = [];
  const machineMap = {};

  for (let c = 0; c < headers.length; c++) {
    const rawHeader = String(headers[c] || '').trim();
    const val = String(rowValues[c] === undefined || rowValues[c] === null ? '' : rowValues[c]).trim();
    if (!rawHeader || !val) {
      continue;
    }

    const hLow = rawHeader.toLowerCase();

    const gridMatch = rawHeader.match(/^([\s\S]+?)\s*\[([\s\S]+)\]\s*$/);
    if (gridMatch) {
      const gridTitleLow = gridMatch[1].trim().toLowerCase();
      const bracketInner = gridMatch[2].trim();
      const idxMatch = bracketInner.match(/^(\d+)\.\s*([\s\S]+)$/);
      const noMesin = idxMatch ? idxMatch[1] : String(machineOrder.length + 1);
      const rawLabel = idxMatch ? idxMatch[2].trim() : bracketInner;
      const machineKey = idxMatch ? ('no_' + noMesin) : ('lbl_' + rawLabel.toLowerCase());

      if (!machineMap[machineKey]) {
        machineMap[machineKey] = {
          noMesin: noMesin,
          namaMesin: cleanMachineDisplayName_(rawLabel),
          statusSpek: '',
          statusInstalasi: ''
        };
        machineOrder.push(machineKey);
      }

      const mObj = machineMap[machineKey];
      const isInstGrid = gridTitleLow.indexOf('instalasi') !== -1 || gridTitleLow.indexOf('training') !== -1;
      const isSpekGrid = gridTitleLow.indexOf('penerimaan') !== -1 ||
        gridTitleLow.indexOf('spesifikasi') !== -1 ||
        gridTitleLow.indexOf('kesesuaian') !== -1;

      if (isInstGrid) {
        mObj.statusInstalasi = val;
      } else if (isSpekGrid) {
        mObj.namaMesin = cleanMachineDisplayName_(rawLabel);
        mObj.statusSpek = val;
      } else if (!mObj.statusSpek) {
        mObj.statusSpek = val;
      } else {
        mObj.statusInstalasi = mObj.statusInstalasi ? (mObj.statusInstalasi + ' | ' + val) : val;
      }
      continue;
    }

    if ((hLow === 'timestamp' || hLow === 'cap waktu') && !rec.timestamp) {
      rec.timestamp = val;
    } else if (hLow.indexOf('nama') !== -1 && hLow.indexOf('petugas') !== -1 && !rec.namaPetugas) {
      rec.namaPetugas = val;
    } else if (hLow.indexOf('instansi') !== -1 && !rec.instansiPetugas) {
      rec.instansiPetugas = val;
    } else if ((hLow.indexOf('hp') !== -1 || hLow.indexOf('whatsapp') !== -1 || hLow.indexOf('telepon') !== -1) &&
      hLow.indexOf('petugas') !== -1 && !rec.hpPetugas) {
      rec.hpPetugas = val;
    } else if (hLow.indexOf('tanggal') !== -1 && !rec.tanggalKunjungan) {
      rec.tanggalKunjungan = val;
    } else if ((hLow.indexOf('tahap') !== -1 || hLow.indexOf('tujuan kunjungan') !== -1) && !rec.tahapKunjungan) {
      rec.tahapKunjungan = val;
    } else if (hLow.indexOf('provinsi') !== -1 && !rec.provinsi) {
      rec.provinsi = val;
    } else if ((hLow.indexOf('kabupaten') !== -1 || hLow.indexOf('kab/kota') !== -1) && !rec.kabKota) {
      rec.kabKota = val;
    } else if (hLow.indexOf('nama kub') !== -1 && !rec.namaKub) {
      rec.namaKub = val;
    } else if ((hLow.indexOf('kehadiran') !== -1 || hLow.indexOf('keaktifan anggota') !== -1) && !rec.anggotaIkHadir) {
      rec.anggotaIkHadir = val;
    } else if (hLow.indexOf('catatan teknis') !== -1 && !rec.catatanTeknisMesin) {
      rec.catatanTeknisMesin = val;
    } else if (hLow.indexOf('nama perwakilan') !== -1 && !rec.namaPerwakilanKub) {
      rec.namaPerwakilanKub = val;
    } else if (hLow.indexOf('jabatan') !== -1 && hLow.indexOf('perwakilan') !== -1 && !rec.jabatanHpPerwakilan) {
      rec.jabatanHpPerwakilan = val;
    } else if (hLow.indexOf('kesiapan lokasi') !== -1 && !rec.kesiapanLokasi) {
      rec.kesiapanLokasi = val;
    } else if (hLow.indexOf('link folder') !== -1 || hLow.indexOf('dokumentasi') !== -1 ||
      hLow.indexOf('bast') !== -1 || hLow.indexOf('upload') !== -1 || hLow.indexOf('foto') !== -1) {
      rec.dokumentasiBast = rec.dokumentasiBast ? (rec.dokumentasiBast + ' | ' + rawHeader + ': ' + val) : val;
    } else if (hLow.indexOf('catatan umum') !== -1 && !rec.catatanUmum) {
      rec.catatanUmum = val;
    } else if (hLow.indexOf('konfirmasi petugas') !== -1 && !rec.konfirmasiPetugas) {
      rec.konfirmasiPetugas = val;
    } else {
      rec.infoTambahan.push(rawHeader + ': ' + val);
    }
  }

  const kunjunganRow = [
    rec.rowSumber,
    rec.timestamp,
    rec.namaPetugas,
    rec.instansiPetugas,
    rec.hpPetugas,
    rec.tanggalKunjungan,
    rec.tahapKunjungan,
    rec.provinsi,
    rec.kabKota,
    rec.namaKub,
    rec.anggotaIkHadir,
    String(machineOrder.length),
    rec.catatanTeknisMesin,
    rec.namaPerwakilanKub,
    rec.jabatanHpPerwakilan,
    rec.kesiapanLokasi,
    rec.dokumentasiBast,
    rec.catatanUmum,
    rec.konfirmasiPetugas,
    rec.infoTambahan.join(' | ')
  ];

  const mesinRows = machineOrder.map(function (key) {
    const m = machineMap[key];
    return [
      rec.rowSumber,
      rec.timestamp,
      rec.namaPetugas,
      rec.tanggalKunjungan,
      rec.provinsi,
      rec.kabKota,
      rec.namaKub,
      m.noMesin,
      m.namaMesin,
      m.statusSpek,
      m.statusInstalasi,
      rec.catatanTeknisMesin
    ];
  });

  const kabTabName = resolveKabTabName_(rec.kabKota);
  const kabRows = machineOrder.length > 0
    ? machineOrder.map(function (key) {
      const m = machineMap[key];
      return [
        rec.rowSumber,
        rec.timestamp,
        rec.namaPetugas,
        rec.tanggalKunjungan,
        rec.tahapKunjungan,
        rec.provinsi,
        rec.kabKota,
        rec.namaKub,
        rec.anggotaIkHadir,
        m.noMesin,
        m.namaMesin,
        m.statusSpek,
        m.statusInstalasi,
        rec.catatanTeknisMesin,
        rec.namaPerwakilanKub,
        rec.dokumentasiBast
      ];
    })
    : [[
      rec.rowSumber,
      rec.timestamp,
      rec.namaPetugas,
      rec.tanggalKunjungan,
      rec.tahapKunjungan,
      rec.provinsi,
      rec.kabKota,
      rec.namaKub || '(Belum dipilih)',
      rec.anggotaIkHadir,
      '-',
      '(Belum ada verifikasi mesin)',
      '',
      '',
      rec.catatanTeknisMesin,
      rec.namaPerwakilanKub,
      rec.dokumentasiBast
    ]];

  return {
    kunjunganRow: kunjunganRow,
    mesinRows: mesinRows,
    kabTabName: kabTabName,
    kabRows: kabRows
  };
}

function cleanMachineDisplayName_(label) {
  return String(label || '').replace(/\s*\[Inst:[^\]]+\]\s*$/i, '').trim();
}

function rowHasAnyValue_(rowValues) {
  for (let i = 0; i < rowValues.length; i++) {
    if (String(rowValues[i] || '').trim() !== '') {
      return true;
    }
  }
  return false;
}

function ensureRecapSheet_(ss, sheetName, headers) {
  let sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    overwriteSheetAsText_(sh, [headers]);
  } else if (sh.getLastRow() === 0) {
    overwriteSheetAsText_(sh, [headers]);
  }
  return sh;
}

function sheetHasSourceRow_(sheet, rowNum) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return false;
  }
  const target = String(rowNum);
  const colA = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  for (let i = 0; i < colA.length; i++) {
    if (String(colA[i][0] || '').trim() === target) {
      return true;
    }
  }
  return false;
}

function overwriteSheetAsText_(sheet, rows) {
  sheet.clearContents();
  if (!rows || !rows.length) {
    return;
  }
  const numRows = rows.length;
  const numCols = rows[0].length;
  const range = sheet.getRange(1, 1, numRows, numCols);
  range.setNumberFormat('@');
  range.setValues(rows.map(function (row) {
    return row.map(function (cell) {
      return cell === null || cell === undefined ? '' : String(cell);
    });
  }));
  sheet.setFrozenRows(1);
  const hdr = sheet.getRange(1, 1, 1, numCols);
  hdr.setFontWeight('bold');
  hdr.setBackground(REKAP_CFG.HEADER_BG);
  hdr.setFontColor(REKAP_CFG.HEADER_FG);
}

function appendRowsAsText_(sheet, rows) {
  if (!rows || !rows.length) {
    return;
  }
  const startRow = sheet.getLastRow() + 1;
  const numCols = rows[0].length;
  const range = sheet.getRange(startRow, 1, rows.length, numCols);
  range.setNumberFormat('@');
  range.setValues(rows.map(function (row) {
    return row.map(function (cell) {
      return cell === null || cell === undefined ? '' : String(cell);
    });
  }));
}
