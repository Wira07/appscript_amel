/**
 * Modul Hybrid Google Sheets Sync untuk PRRP Sumatera TA 2026.
 * Menyediakan generator template Spreadsheet dari PRRP_MASTER_DATA dan parser kembali ke skema master.
 */

const IK_SHEET_HEADERS_ = [
  'Provinsi', 'Kab/Kota', 'KUB_ID', 'Nama KUB Canonical', 'Nama KUB (Excel IK)',
  'No', 'Nama', 'Nama IK', 'Jabatan', 'Jenis Kelamin', 'Usia',
  'Email', 'Telepon/HP', 'Alamat', 'Desa/Kel', 'Kecamatan',
  'NIB', 'KBLI', 'Jenis Industri/Usaha', 'Jenis Produk'
];

const MESIN_SHEET_HEADERS_ = [
  'Provinsi', 'Kab/Kota', 'KUB_ID', 'Nama KUB Canonical', 'Nama KUB (Excel Mesin)',
  'No', 'Nama Mesin/Alat', 'Merk/Tipe', 'Spesifikasi Mesin/Alat',
  'Jenis Mesin (PDN/TKDN/Impor)', 'Tipe Mesin (TTG/Barang Jadi)',
  'Sumber Energi', 'Perlu Diinstalasi', 'Perlu Training Operator',
  'Volume', 'Satuan', 'Raw_Row_Count'
];

/**
 * Membuat Google Spreadsheet template baru berisi 100% data terstandarisasi dari Excel
 * (Master_IK_KUB dan Master_Spek_Mesin), lalu menyimpan ID-nya di ScriptProperties.
 * @return {string} ID Spreadsheet yang baru dibuat.
 */
function createMasterSpreadsheetTemplate_() {
  const ss = SpreadsheetApp.create('Master Data PRRP Sumatera TA 2026 (Auto-Form Source)');
  const defaultSheet = ss.getSheets()[0];
  defaultSheet.setName(PRRP_CONFIG.SHEET_IK_KUB);

  const mesinSheet = ss.insertSheet(PRRP_CONFIG.SHEET_SPEK_MESIN);

  const ikRows = [IK_SHEET_HEADERS_];
  const mesinRows = [MESIN_SHEET_HEADERS_];

  PRRP_MASTER_DATA.provinsi.forEach(function (prov) {
    prov.kab_kota.forEach(function (kab) {
      kab.kubs.forEach(function (kub) {
        kub.anggota.forEach(function (m) {
          ikRows.push([
            prov.nama,
            kab.nama,
            kub.id,
            kub.nama_kub,
            kub.nama_kub_excel_ik || m.nama_kub_excel_ik || kub.nama_kub,
            m.no || '',
            m.nama || '-',
            m.nama_ik || '-',
            m.jabatan || '-',
            m.jenis_kelamin || '-',
            m.usia || '-',
            m.email || '-',
            m.telepon_hp || '-',
            m.alamat || '-',
            m.desa_kel || '-',
            m.kecamatan || '-',
            m.nib || '-',
            m.kbli || '-',
            m.jenis_industri || '-',
            m.jenis_produk || '-'
          ]);
        });
        kub.mesin.forEach(function (eq) {
          mesinRows.push([
            prov.nama,
            kab.nama,
            kub.id,
            kub.nama_kub,
            kub.nama_kub_excel_mesin || eq.nama_kub_excel_mesin || kub.nama_kub,
            eq.no || '',
            eq.nama_mesin || '-',
            eq.merk_tipe || '-',
            eq.spesifikasi || '-',
            eq.jenis_mesin || '-',
            eq.tipe_mesin || '-',
            eq.sumber_energi || '-',
            eq.perlu_instalasi || '-',
            eq.perlu_training || '-',
            eq.volume || '-',
            eq.satuan || '-',
            String(eq.raw_row_count || 1)
          ]);
        });
      });
    });
  });

  writeFormattedSheet_(defaultSheet, ikRows);
  writeFormattedSheet_(mesinSheet, mesinRows);

  PropertiesService.getScriptProperties().setProperty(PRRP_CONFIG.PROP_SHEET_ID_KEY, ss.getId());
  Logger.log('Master Spreadsheet berhasil dibuat!');
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Total baris IK (termasuk header): ' + ikRows.length);
  Logger.log('Total baris Mesin (termasuk header): ' + mesinRows.length);
  return ss.getId();
}

/**
 * Menulis matrix ke sheet sebagai teks polos agar angka HP/NIB tidak kehilangan nol di depan.
 */
function writeFormattedSheet_(sheet, rows) {
  if (!rows || !rows.length) {
    return;
  }
  const numRows = rows.length;
  const numCols = rows[0].length;
  const range = sheet.getRange(1, 1, numRows, numCols);
  range.setNumberFormat('@');
  range.setValues(rows.map(function (row) {
    return row.map(function (val) {
      return val === null || val === undefined ? '' : String(val);
    });
  }));
  sheet.setFrozenRows(1);
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#0F4C5C');
  headerRange.setFontColor('#FFFFFF');
}

/**
 * Menyelesaikan ID Spreadsheet dari argumen, Config, atau ScriptProperties.
 */
function resolveSpreadsheetId_(optionalId) {
  const propId = PropertiesService.getScriptProperties().getProperty(PRRP_CONFIG.PROP_SHEET_ID_KEY);
  const id = (optionalId || PRRP_CONFIG.SPREADSHEET_ID || propId || '').trim();
  if (!id) {
    throw new Error(
      'Spreadsheet ID belum dikonfigurasi. Jalankan createMasterSpreadsheetTemplate() terlebih dahulu atau isi PRRP_CONFIG.SPREADSHEET_ID.'
    );
  }
  return id;
}

/**
 * Memuat dan menyusun ulang hierarki data master dari Google Spreadsheet Hybrid.
 * @param {string=} optionalSpreadsheetId
 * @return {Object} Skema master identik dengan PRRP_MASTER_DATA.
 */
function loadDataFromSpreadsheet_(optionalSpreadsheetId) {
  const ssId = resolveSpreadsheetId_(optionalSpreadsheetId);
  const ss = SpreadsheetApp.openById(ssId);
  const ikSheet = ss.getSheetByName(PRRP_CONFIG.SHEET_IK_KUB);
  const mesinSheet = ss.getSheetByName(PRRP_CONFIG.SHEET_SPEK_MESIN);

  if (!ikSheet) {
    throw new Error('Sheet "' + PRRP_CONFIG.SHEET_IK_KUB + '" tidak ditemukan pada Spreadsheet ' + ssId);
  }
  if (!mesinSheet) {
    throw new Error('Sheet "' + PRRP_CONFIG.SHEET_SPEK_MESIN + '" tidak ditemukan pada Spreadsheet ' + ssId);
  }

  const ikValues = ikSheet.getDataRange().getDisplayValues();
  const mesinValues = mesinSheet.getDataRange().getDisplayValues();

  const provOrder = [];
  const provMap = {};

  function ensureKub(provName, kabName, kubId, kubCanonical) {
    const pName = cleanCell_(provName);
    const kName = cleanCell_(kabName);
    const cName = cleanCell_(kubCanonical);
    const cKey = cName.toLowerCase();

    if (!pName || !kName || !cName) {
      throw new Error('Baris Spreadsheet tidak lengkap (Provinsi/Kab/Nama KUB kosong): ' + [pName, kName, cName].join(' | '));
    }

    if (!provMap[pName]) {
      provMap[pName] = {
        nama: pName,
        id: slugify_(pName),
        kabOrder: [],
        kabMap: {}
      };
      provOrder.push(pName);
    }
    const pObj = provMap[pName];
    if (!pObj.kabMap[kName]) {
      pObj.kabMap[kName] = {
        nama: kName,
        id: slugify_(kName),
        kubOrder: [],
        kubMap: {},
        kubByName: {}
      };
      pObj.kabOrder.push(kName);
    }
    const kObj = pObj.kabMap[kName];
    const existingId = kObj.kubByName[cKey];
    const kId = existingId || cleanCell_(kubId) || (slugify_(kName) + '__' + slugify_(cName));
    if (!kObj.kubMap[kId]) {
      kObj.kubMap[kId] = {
        id: kId,
        nama_kub: cName,
        nama_kub_excel_ik: '',
        nama_kub_excel_mesin: '',
        provinsi: pName,
        kab_kota: kName,
        anggota: [],
        mesin: []
      };
      kObj.kubOrder.push(kId);
      kObj.kubByName[cKey] = kId;
    }
    return kObj.kubMap[kId];
  }

  // Parse Master_IK_KUB (skip header row 0)
  for (let i = 1; i < ikValues.length; i++) {
    const r = ikValues[i];
    if (!r || !cleanCell_(r[0])) {
      continue;
    }
    const kub = ensureKub(r[0], r[1], r[2], r[3]);
    const f2Kub = cleanCell_(r[4]);
    if (f2Kub && !kub.nama_kub_excel_ik) {
      kub.nama_kub_excel_ik = f2Kub;
    }
    kub.anggota.push({
      no: cleanCell_(r[5]) || String(kub.anggota.length + 1),
      nama: cleanCell_(r[6]) || '-',
      nama_ik: cleanCell_(r[7]) || '-',
      nama_kub_excel_ik: f2Kub || kub.nama_kub,
      jabatan: cleanCell_(r[8]) || '-',
      jenis_kelamin: cleanCell_(r[9]) || '-',
      usia: cleanCell_(r[10]) || '-',
      email: cleanCell_(r[11]) || '-',
      telepon_hp: cleanCell_(r[12]) || '-',
      alamat: cleanCell_(r[13]) || '-',
      desa_kel: cleanCell_(r[14]) || '-',
      kecamatan: cleanCell_(r[15]) || '-',
      kab_kota: cleanCell_(r[1]),
      provinsi: cleanCell_(r[0]),
      nib: cleanCell_(r[16]) || '-',
      kbli: cleanCell_(r[17]) || '-',
      jenis_industri: cleanCell_(r[18]) || '-',
      jenis_produk: cleanCell_(r[19]) || '-'
    });
  }

  // Parse Master_Spek_Mesin (skip header row 0)
  for (let i = 1; i < mesinValues.length; i++) {
    const r = mesinValues[i];
    if (!r || !cleanCell_(r[0])) {
      continue;
    }
    const kub = ensureKub(r[0], r[1], r[2], r[3]);
    const f1Kub = cleanCell_(r[4]);
    if (f1Kub && !kub.nama_kub_excel_mesin) {
      kub.nama_kub_excel_mesin = f1Kub;
    }
    kub.mesin.push({
      no: cleanCell_(r[5]) || String(kub.mesin.length + 1),
      nama_kub_excel_mesin: f1Kub || kub.nama_kub,
      nama_mesin: cleanCell_(r[6]) || '-',
      merk_tipe: cleanCell_(r[7]) || '-',
      spesifikasi: cleanCell_(r[8]) || '-',
      jenis_mesin: cleanCell_(r[9]) || '-',
      tipe_mesin: cleanCell_(r[10]) || '-',
      sumber_energi: cleanCell_(r[11]) || '-',
      perlu_instalasi: cleanCell_(r[12]) || '-',
      perlu_training: cleanCell_(r[13]) || '-',
      volume: cleanCell_(r[14]) || '-',
      satuan: cleanCell_(r[15]) || '-',
      raw_row_count: Number(cleanCell_(r[16]) || '1') || 1
    });
  }

  let totalKab = 0;
  let totalKub = 0;
  let totalIk = 0;
  let totalMesin = 0;

  const provinsiOut = provOrder.map(function (pName) {
    const pObj = provMap[pName];
    const kabsOut = pObj.kabOrder.map(function (kName) {
      totalKab++;
      const kObj = pObj.kabMap[kName];
      const kubsOut = kObj.kubOrder.map(function (kId) {
        totalKub++;
        const kub = kObj.kubMap[kId];
        enrichKubSummary_(kub);
        totalIk += kub.anggota.length;
        totalMesin += kub.mesin.length;
        return kub;
      });
      return {
        nama: kObj.nama,
        id: kObj.id,
        kubs: kubsOut
      };
    });
    return {
      nama: pObj.nama,
      id: pObj.id,
      kab_kota: kabsOut
    };
  });

  return {
    metadata: {
      program: 'PRRP Sumatera TA 2026 (Dit. LMEA)',
      source: 'Google Spreadsheet: ' + ssId,
      counts: {
        provinsi: provinsiOut.length,
        kab_kota: totalKab,
        kub: totalKub,
        anggota_ik: totalIk,
        mesin_unique: totalMesin
      }
    },
    provinsi: provinsiOut
  };
}

/**
 * Menghitung ringkasan profil KUB secara dinamis dari anggota & mesin.
 */
function enrichKubSummary_(kub) {
  const members = kub.anggota;
  const machines = kub.mesin;

  const ketuas = [];
  const kecSet = {};
  const desaSet = {};
  const indSet = {};
  const prodSet = {};
  const kbliSet = {};
  let countL = 0;
  let countP = 0;

  members.forEach(function (m) {
    const jab = (m.jabatan || '').toLowerCase();
    if (jab.indexOf('ketua') !== -1 && jab.indexOf('wakil') === -1) {
      ketuas.push(m.nama + ' (' + m.nama_ik + ') — HP: ' + m.telepon_hp);
    }
    if (m.kecamatan && m.kecamatan !== '-') kecSet[m.kecamatan] = true;
    if (m.desa_kel && m.desa_kel !== '-') desaSet[m.desa_kel] = true;
    if (m.jenis_industri && m.jenis_industri !== '-') indSet[m.jenis_industri] = true;
    if (m.jenis_produk && m.jenis_produk !== '-') prodSet[m.jenis_produk] = true;
    if (m.kbli && m.kbli !== '-') kbliSet[m.kbli.replace(/\s+/g, ' ')] = true;
    const jk = (m.jenis_kelamin || '').toLowerCase();
    if (jk.indexOf('laki') !== -1) countL++;
    if (jk.indexOf('perempuan') !== -1) countP++;
  });

  const volBySatuan = {};
  let hasNumericVol = false;
  let rawCountSum = 0;
  machines.forEach(function (eq) {
    rawCountSum += eq.raw_row_count || 1;
    const vNum = parseFloat(String(eq.volume || '').replace(',', '.'));
    if (!isNaN(vNum)) {
      hasNumericVol = true;
      const sat = eq.satuan && eq.satuan !== '-' ? eq.satuan : 'Unit';
      volBySatuan[sat] = (volBySatuan[sat] || 0) + vNum;
    }
  });

  const volParts = Object.keys(volBySatuan).map(function (sat) {
    const v = volBySatuan[sat];
    const vStr = Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
    return vStr + ' ' + sat;
  });

  kub.nama_kub_excel_ik = kub.nama_kub_excel_ik || kub.nama_kub;
  kub.nama_kub_excel_mesin = kub.nama_kub_excel_mesin || kub.nama_kub;
  kub.kecamatan = Object.keys(kecSet).sort().join(', ') || '-';
  kub.desa_kel = Object.keys(desaSet).sort().join(', ') || '-';
  kub.ketua = ketuas.length ? ketuas.join('; ') : 'Tidak tercantum jabatan Ketua di data master';
  kub.jenis_industri = Object.keys(indSet).sort().join(', ') || '-';
  kub.jenis_produk = Object.keys(prodSet).sort().join(', ') || '-';
  kub.kbli = Object.keys(kbliSet).sort().join('; ') || '-';
  kub.jumlah_anggota = members.length;
  kub.jumlah_laki = countL;
  kub.jumlah_perempuan = countP;
  kub.jumlah_jenis_mesin = machines.length;
  kub.jumlah_baris_mesin_raw = rawCountSum;
  kub.total_volume_label = hasNumericVol
    ? volParts.join(', ')
    : 'Belum tercantum di data master (verifikasi jumlah fisik saat kunjungan)';
}

function cleanCell_(val) {
  return String(val === null || val === undefined ? '' : val).trim();
}

function slugify_(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pad2_(num) {
  return num < 10 ? '0' + num : String(num);
}

/**
 * Membuat Google Spreadsheet relasional 6 tab siap pakai untuk Google AppSheet (Offline & Online Backup):
 * Master_Wilayah, Master_KUB, Master_Anggota_IK, Master_Mesin, Form_Monitoring_KUB, Form_Verifikasi_Mesin.
 * @return {string} ID Spreadsheet AppSheet yang baru dibuat.
 */
function createAppSheetDatabase_() {
  const ss = SpreadsheetApp.create('Database AppSheet PRRP Sumatera TA 2026 (Online & Offline)');
  const shWilayah = ss.getSheets()[0];
  shWilayah.setName('Master_Wilayah');
  const shKub = ss.insertSheet('Master_KUB');
  const shIk = ss.insertSheet('Master_Anggota_IK');
  const shMesin = ss.insertSheet('Master_Mesin');
  const shMon = ss.insertSheet('Form_Monitoring_KUB');
  const shVer = ss.insertSheet('Form_Verifikasi_Mesin');

  const wilayahRows = [[
    'Wilayah_ID', 'Provinsi', 'Kab_Kota', 'Jumlah_KUB', 'Jumlah_Anggota_IK', 'Jumlah_Jenis_Mesin'
  ]];
  const kubRows = [[
    'KUB_ID', 'Provinsi', 'Kab_Kota', 'Nama_KUB', 'Nama_KUB_Excel_IK', 'Nama_KUB_Excel_Mesin',
    'Kecamatan', 'Desa_Kel', 'Ketua_Kontak', 'Jenis_Industri', 'Jenis_Produk', 'KBLI',
    'Jumlah_Anggota', 'Jumlah_Laki', 'Jumlah_Perempuan', 'Jumlah_Jenis_Mesin', 'Total_Volume_Label'
  ]];
  const ikRows = [[
    'IK_ID', 'KUB_ID', 'Provinsi', 'Kab_Kota', 'Nama_KUB', 'No', 'Nama', 'Nama_IK',
    'Jabatan', 'Jenis_Kelamin', 'Usia', 'Email', 'Telepon_HP', 'Alamat',
    'Desa_Kel', 'Kecamatan', 'NIB', 'KBLI', 'Jenis_Industri', 'Jenis_Produk', 'Label_Anggota'
  ]];
  const mesinRows = [[
    'Mesin_ID', 'KUB_ID', 'Provinsi', 'Kab_Kota', 'Nama_KUB', 'No', 'Nama_Mesin', 'Merk_Tipe',
    'Spesifikasi', 'Jenis_Mesin', 'Tipe_Mesin', 'Sumber_Energi', 'Perlu_Instalasi',
    'Perlu_Training', 'Volume_Target', 'Satuan', 'Raw_Row_Count', 'Label_Mesin'
  ]];
  const monRows = [[
    'Monitoring_ID', 'Timestamp', 'Nama_Petugas', 'Instansi_Petugas', 'HP_Petugas',
    'Tanggal_Kunjungan', 'Tahap_Kunjungan', 'Provinsi', 'Kab_Kota', 'KUB_ID',
    'Info_Ketua_Kontak', 'Info_Lokasi_Kec_Desa', 'Info_Industri_Produk', 'Info_Ringkasan_KUB',
    'Anggota_IK_Hadir', 'Nama_Perwakilan_KUB', 'Jabatan_HP_Perwakilan',
    'Kesiapan_Lokasi_Listrik', 'Lokasi_GPS', 'Foto_Lokasi_KUB', 'Foto_BAST_Dokumen',
    'Tanda_Tangan_Perwakilan', 'Catatan_Umum', 'Konfirmasi_Petugas'
  ]];
  const verRows = [[
    'Verifikasi_ID', 'Monitoring_ID', 'KUB_ID', 'Mesin_ID',
    'Auto_Merk_Tipe', 'Auto_Spesifikasi', 'Auto_Jenis_Tipe_Energi',
    'Auto_Volume_Target', 'Auto_Wajib_Instalasi_Training',
    'Status_Penerimaan_Spek', 'Volume_Diterima_Aktual', 'Status_Instalasi_Training',
    'Nomor_Seri_Mesin', 'Foto_Mesin', 'Catatan_Mesin'
  ]];

  PRRP_MASTER_DATA.provinsi.forEach(function (prov) {
    prov.kab_kota.forEach(function (kab) {
      let kabIk = 0;
      let kabMesin = 0;
      kab.kubs.forEach(function (k) {
        kabIk += k.jumlah_anggota;
        kabMesin += k.jumlah_jenis_mesin;
      });
      wilayahRows.push([
        prov.id + '__' + kab.id,
        prov.nama,
        kab.nama,
        String(kab.kubs.length),
        String(kabIk),
        String(kabMesin)
      ]);

      kab.kubs.forEach(function (kub) {
        kubRows.push([
          kub.id,
          kub.provinsi,
          kub.kab_kota,
          kub.nama_kub,
          kub.nama_kub_excel_ik,
          kub.nama_kub_excel_mesin,
          kub.kecamatan,
          kub.desa_kel,
          kub.ketua,
          kub.jenis_industri,
          kub.jenis_produk,
          kub.kbli,
          String(kub.jumlah_anggota),
          String(kub.jumlah_laki),
          String(kub.jumlah_perempuan),
          String(kub.jumlah_jenis_mesin),
          kub.total_volume_label
        ]);

        kub.anggota.forEach(function (m, idx) {
          const ikId = kub.id + '__ik_' + pad2_(idx + 1);
          const labelIk = (idx + 1) + '. ' + m.nama + ' — ' + m.nama_ik + ' (' + m.jabatan + ')';
          ikRows.push([
            ikId,
            kub.id,
            kub.provinsi,
            kub.kab_kota,
            kub.nama_kub,
            String(m.no || (idx + 1)),
            m.nama || '-',
            m.nama_ik || '-',
            m.jabatan || '-',
            m.jenis_kelamin || '-',
            String(m.usia || '-'),
            m.email || '-',
            m.telepon_hp || '-',
            m.alamat || '-',
            m.desa_kel || '-',
            m.kecamatan || '-',
            m.nib || '-',
            m.kbli || '-',
            m.jenis_industri || '-',
            m.jenis_produk || '-',
            labelIk
          ]);
        });

        kub.mesin.forEach(function (eq, idx) {
          const mesinId = kub.id + '__m_' + pad2_(idx + 1);
          const volTxt = eq.volume !== '-' ? (eq.volume + ' ' + eq.satuan) : 'Cek fisik';
          const merkTxt = eq.merk_tipe !== '-' ? (' (' + eq.merk_tipe + ')') : '';
          const labelMesin = (idx + 1) + '. ' + eq.nama_mesin + merkTxt + ' [' + volTxt + ']';
          mesinRows.push([
            mesinId,
            kub.id,
            kub.provinsi,
            kub.kab_kota,
            kub.nama_kub,
            String(eq.no || (idx + 1)),
            eq.nama_mesin || '-',
            eq.merk_tipe || '-',
            eq.spesifikasi || '-',
            eq.jenis_mesin || '-',
            eq.tipe_mesin || '-',
            eq.sumber_energi || '-',
            eq.perlu_instalasi || '-',
            eq.perlu_training || '-',
            String(eq.volume || '-'),
            eq.satuan || '-',
            String(eq.raw_row_count || 1),
            labelMesin
          ]);
        });
      });
    });
  });

  writeFormattedSheet_(shWilayah, wilayahRows);
  writeFormattedSheet_(shKub, kubRows);
  writeFormattedSheet_(shIk, ikRows);
  writeFormattedSheet_(shMesin, mesinRows);
  writeFormattedSheet_(shMon, monRows);
  writeFormattedSheet_(shVer, verRows);

  PropertiesService.getScriptProperties().setProperty(PRRP_CONFIG.PROP_APPSHEET_ID_KEY, ss.getId());
  Logger.log('Database AppSheet 6 Tab berhasil dibuat!');
  Logger.log('Spreadsheet ID  : ' + ss.getId());
  Logger.log('Spreadsheet URL : ' + ss.getUrl());
  Logger.log('Langkah berikut : Buka URL di atas -> Ekstensi -> AppSheet -> Buat aplikasi.');
  return ss.getId();
}
