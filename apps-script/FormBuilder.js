/**
 * Pembangun Google Form Cascading Otomatis PRRP Sumatera TA 2026.
 * Mendukung resumable batching (anti-timeout 6 menit Apps Script),
 * auto-chunking deskripsi panjang, serta verifikasi struktur branching menyeluruh.
 */

/**
 * Menyelesaikan Form ID target (prioritas: argumen > Form baru tersimpan > Config.FORM_ID).
 */
function resolveFormId_(optionalFormId) {
  const propFormId = PropertiesService.getScriptProperties().getProperty(PRRP_CONFIG.PROP_FORM_ID_KEY);
  const id = (optionalFormId || propFormId || PRRP_CONFIG.FORM_ID || '').trim();
  if (!id) {
    throw new Error('Google Form ID belum tersedia. Jalankan buildNewFormFromEmbedded() atau isi PRRP_CONFIG.FORM_ID.');
  }
  return id;
}

/**
 * Membuat Google Form baru otomatis di Drive akun aktif, menyimpan ID-nya,
 * lalu langsung mengisi seluruh struktur cascading & data PRRP Sumatera TA 2026.
 * @param {'embedded'|'spreadsheet'} mode
 * @param {string=} optionalSpreadsheetId
 * @return {string} Form ID yang baru dibuat.
 */
function startBuildNewForm_(mode, optionalSpreadsheetId) {
  const newForm = FormApp.create(PRRP_CONFIG.FORM_TITLE);
  const newFormId = newForm.getId();
  PropertiesService.getScriptProperties().setProperty(PRRP_CONFIG.PROP_FORM_ID_KEY, newFormId);
  Logger.log('Google Form baru berhasil dibuat!');
  Logger.log('Form ID  : ' + newFormId);
  Logger.log('Edit URL : ' + newForm.getEditUrl());
  startBuildForm_(mode, optionalSpreadsheetId, newFormId, true);
  return newFormId;
}

/**
 * Memulai build penuh Google Form dari awal.
 * @param {'embedded'|'spreadsheet'} mode
 * @param {string=} optionalSpreadsheetId
 * @param {string=} optionalFormId
 * @param {boolean=} isBrandNew
 */
function startBuildForm_(mode, optionalSpreadsheetId, optionalFormId, isBrandNew) {
  clearContinueTriggers_();

  const resolvedFormId = resolveFormId_(optionalFormId);
  const resolvedSheetId = mode === 'spreadsheet' ? resolveSpreadsheetId_(optionalSpreadsheetId) : '';
  const masterData = loadMasterData_(mode, resolvedSheetId);
  validateMasterData_(masterData);

  const state = {
    phase: isBrandNew ? 'INIT' : 'CLEAR',
    mode: mode,
    formId: resolvedFormId,
    spreadsheetId: resolvedSheetId,
    provDropdownId: null,
    provPageIds: {},
    kabDropdownIds: {},
    kabPageIds: {},
    kubDropdownIds: {},
    kubPageIds: {},
    kubOrder: [],
    kubCursor: 0,
    closingPageId: null
  };
  saveBuildState_(state);
  processBuildStep_(masterData, state);
}

/**
 * Melanjutkan build yang tertunda akibat penjaga waktu (time guard).
 */
function continueBuildForm_() {
  clearContinueTriggers_();
  const state = loadBuildState_();
  if (!state || state.phase === 'DONE') {
    Logger.log('Tidak ada proses build yang tertunda. Status: ' + (state ? state.phase : 'KOSONG'));
    return;
  }
  const masterData = loadMasterData_(state.mode, state.spreadsheetId);
  processBuildStep_(masterData, state);
}

/**
 * Menghapus state dan trigger lanjutan agar build dapat diulang bersih.
 */
function resetBuildState_() {
  clearContinueTriggers_();
  PropertiesService.getScriptProperties().deleteProperty(PRRP_CONFIG.PROP_STATE_KEY);
  Logger.log('State build dan trigger lanjutan telah dibersihkan.');
}

function loadMasterData_(mode, spreadsheetId) {
  if (mode === 'spreadsheet') {
    return loadDataFromSpreadsheet_(spreadsheetId);
  }
  return PRRP_MASTER_DATA;
}

function validateMasterData_(masterData) {
  if (!masterData || !masterData.provinsi || !masterData.provinsi.length) {
    throw new Error('Data master kosong atau tidak memiliki daftar Provinsi.');
  }
  const provNames = {};
  masterData.provinsi.forEach(function (prov) {
    if (provNames[prov.nama]) {
      throw new Error('Nama Provinsi duplikat: ' + prov.nama);
    }
    provNames[prov.nama] = true;
    const kabNames = {};
    prov.kab_kota.forEach(function (kab) {
      if (kabNames[kab.nama]) {
        throw new Error('Nama Kab/Kota duplikat pada ' + prov.nama + ': ' + kab.nama);
      }
      kabNames[kab.nama] = true;
      const kubNames = {};
      kab.kubs.forEach(function (kub) {
        if (kubNames[kub.nama_kub]) {
          throw new Error('Nama KUB duplikat pada ' + kab.nama + ': ' + kub.nama_kub);
        }
        kubNames[kub.nama_kub] = true;
        if (!kub.anggota || !kub.anggota.length) {
          throw new Error('KUB "' + kub.nama_kub + '" tidak memiliki data Anggota IK.');
        }
        if (!kub.mesin || !kub.mesin.length) {
          throw new Error('KUB "' + kub.nama_kub + '" tidak memiliki data Spesifikasi Mesin.');
        }
      });
    });
  });
}

function flattenKubs_(masterData) {
  const flat = [];
  masterData.provinsi.forEach(function (prov) {
    prov.kab_kota.forEach(function (kab) {
      kab.kubs.forEach(function (kub) {
        flat.push({ prov: prov, kab: kab, kub: kub });
      });
    });
  });
  return flat;
}

function processBuildStep_(masterData, state) {
  const startMs = Date.now();
  const formId = resolveFormId_(state.formId);
  state.formId = formId;
  const form = FormApp.openById(formId);
  const flatKubs = flattenKubs_(masterData);

  // Fase 1: CLEAR item lama secara bertahap agar aman dari timeout
  if (state.phase === 'CLEAR') {
    const items = form.getItems();
    for (let i = items.length - 1; i >= 0; i--) {
      form.deleteItem(i);
      if ((items.length - i) % 20 === 0 && isTimeExceeded_(startMs)) {
        saveBuildState_(state);
        scheduleContinueTrigger_();
        Logger.log('Fase CLEAR dijeda aman (sisa item: ' + i + '). Trigger lanjutan dijadwalkan.');
        return;
      }
    }
    state.phase = 'INIT';
    saveBuildState_(state);
    if (isTimeExceeded_(startMs)) {
      scheduleContinueTrigger_();
      Logger.log('Fase CLEAR selesai, lanjut ke fase INIT via trigger.');
      return;
    }
  }

  // Fase 2: INIT Section 1, 3 Provinsi, dan 8 Kab/Kota
  if (state.phase === 'INIT') {
    buildBaseSections_(form, masterData, state);
    state.phase = 'KUBS';
    saveBuildState_(state);
    if (isTimeExceeded_(startMs)) {
      scheduleContinueTrigger_();
      Logger.log('Fase INIT selesai, lanjut ke fase KUBS via trigger.');
      return;
    }
  }

  // Fase 3: KUBS (52 Section KUB dengan seluruh detail IK + Mesin)
  if (state.phase === 'KUBS') {
    while (state.kubCursor < flatKubs.length) {
      const entry = flatKubs[state.kubCursor];
      buildSingleKubSection_(form, entry.kub, state);
      state.kubCursor++;
      saveBuildState_(state);

      if (state.kubCursor < flatKubs.length && isTimeExceeded_(startMs)) {
        scheduleContinueTrigger_();
        Logger.log(
          'Fase KUBS dijeda aman di KUB ' + state.kubCursor + '/' + flatKubs.length +
          '. Trigger lanjutan dijadwalkan.'
        );
        return;
      }
    }
    state.phase = 'FINALIZE';
    saveBuildState_(state);
    if (isTimeExceeded_(startMs)) {
      scheduleContinueTrigger_();
      Logger.log('Fase KUBS selesai (52/52), lanjut ke FINALIZE via trigger.');
      return;
    }
  }

  // Fase 4: FINALIZE (Section Penutup + Wiring semua cabang & anti-fallthrough PageBreak)
  if (state.phase === 'FINALIZE') {
    finalizeForm_(form, masterData, state);
    state.phase = 'DONE';
    state.completedAt = new Date().toISOString();
    saveBuildState_(state);
  }
}

function buildBaseSections_(form, masterData, state) {
  form.setTitle(PRRP_CONFIG.FORM_TITLE);
  form.setDescription(PRRP_CONFIG.FORM_DESCRIPTION);
  form.setConfirmationMessage(PRRP_CONFIG.CONFIRMATION_MESSAGE);
  form.setProgressBar(true);
  form.setCollectEmail(false);
  form.setAllowResponseEdits(true);
  form.setShowLinkToRespondAgain(true);

  // Section 1: Identitas Petugas & Pilih Provinsi
  form.addTextItem()
    .setTitle('Nama Lengkap Petugas')
    .setHelpText('Masukkan nama lengkap petugas monitoring/verifikasi.')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Instansi / Unit Kerja Petugas')
    .setHelpText('Contoh: Dit. LMEA Kementerian Perindustrian / Dinas Perindag Kab./Prov.')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Nomor HP / WhatsApp Petugas')
    .setHelpText('Masukkan nomor aktif (contoh: 0812xxxxxxxx).')
    .setRequired(true);

  form.addDateItem()
    .setTitle('Tanggal Kunjungan / Monitoring')
    .setHelpText('Pilih tanggal pelaksanaan verifikasi lapangan.')
    .setRequired(true);

  form.addListItem()
    .setTitle('Tahap / Tujuan Kunjungan')
    .setHelpText('Pilih tahapan kegiatan monitoring saat kunjungan ini.')
    .setChoiceValues(PRRP_CONFIG.TAHAP_KUNJUNGAN_OPTIONS)
    .setRequired(true);

  const provDropdown = form.addListItem()
    .setTitle('Pilih Provinsi')
    .setHelpText('Setelah memilih Provinsi dan klik Berikutnya, daftar Kabupaten/Kota akan muncul otomatis sesuai Provinsi.')
    .setChoiceValues(['Memuat daftar Provinsi...'])
    .setRequired(true);
  state.provDropdownId = provDropdown.getId();

  // Level 2: Section Provinsi (3 section)
  masterData.provinsi.forEach(function (prov) {
    const provPb = form.addPageBreakItem()
      .setTitle('Wilayah Provinsi: ' + prov.nama)
      .setHelpText('Pilih Kabupaten/Kota di Provinsi ' + prov.nama + ' (' + prov.kab_kota.length + ' Kab/Kota penerima PRRP TA 2026).');
    state.provPageIds[prov.nama] = provPb.getId();

    const kabDropdown = form.addListItem()
      .setTitle('Pilih Kabupaten / Kota (' + prov.nama + ')')
      .setHelpText('Hanya menampilkan Kabupaten/Kota yang berada di Provinsi ' + prov.nama + '.')
      .setChoiceValues(['Memuat daftar Kab/Kota...'])
      .setRequired(true);
    state.kabDropdownIds[prov.nama] = kabDropdown.getId();
  });

  // Level 3: Section Kabupaten/Kota (8 section)
  masterData.provinsi.forEach(function (prov) {
    prov.kab_kota.forEach(function (kab) {
      const kabPb = form.addPageBreakItem()
        .setTitle('Pilih KUB — ' + kab.nama + ' (' + prov.nama + ')')
        .setHelpText(
          'Terdapat ' + kab.kubs.length + ' KUB penerima bantuan di ' + kab.nama +
          '. Pilih salah satu KUB untuk langsung membuka profil anggota IK dan rincian spesifikasi mesinnya.'
        );
      state.kabPageIds[kab.id] = kabPb.getId();

      const kubDropdown = form.addListItem()
        .setTitle('Pilih Nama KUB — ' + kab.nama)
        .setHelpText('Sistem akan otomatis menampilkan hanya data milik KUB yang dipilih.')
        .setChoiceValues(['Memuat daftar KUB...'])
        .setRequired(true);
      state.kubDropdownIds[kab.id] = kubDropdown.getId();
    });
  });
}

function buildSingleKubSection_(form, kub, state) {
  const kubSummaryDesc = [
    'RINGKASAN PROFIL KUB PENERIMA BANTUAN PRRP SUMATERA TA 2026',
    '• Provinsi / Kab.Kota : ' + kub.provinsi + ' / ' + kub.kab_kota,
    '• Nama KUB (Excel IK) : ' + (kub.nama_kub_excel_ik || kub.nama_kub),
    '• Nama KUB (Excel Mesin) : ' + (kub.nama_kub_excel_mesin || kub.nama_kub),
    '• Kecamatan : ' + (kub.kecamatan || '-'),
    '• Desa / Kelurahan : ' + (kub.desa_kel || '-'),
    '• Ketua & Kontak : ' + (kub.ketua || '-'),
    '• Jenis Industri / Usaha : ' + (kub.jenis_industri || '-'),
    '• Jenis Produk : ' + (kub.jenis_produk || '-'),
    '• KBLI : ' + (kub.kbli || '-'),
    '• Total Anggota IK : ' + kub.jumlah_anggota + ' orang (L: ' + kub.jumlah_laki + ', P: ' + kub.jumlah_perempuan + ')',
    '• Total Jenis Mesin/Alat : ' + kub.jumlah_jenis_mesin + ' jenis (' + kub.total_volume_label + ')'
  ].join('\n');

  const kubPb = form.addPageBreakItem()
    .setTitle('[KUB] ' + kub.nama_kub + ' — ' + kub.kab_kota)
    .setHelpText(kubSummaryDesc);

  const pbId = kubPb.getId();
  state.kubPageIds[kub.id] = pbId;
  state.kubOrder.push(pbId);

  // 1) Daftar Lengkap Anggota IK (auto-chunk <= 3500 chars)
  const memberEntries = kub.anggota.map(function (m, idx) {
    return (
      (idx + 1) + '. ' + m.nama + ' | Usaha/IK: ' + m.nama_ik + ' (' + m.jabatan + ')\n' +
      '   JK/Usia: ' + m.jenis_kelamin + '/' + m.usia + ' | HP: ' + m.telepon_hp + ' | Email: ' + m.email + '\n' +
      '   Alamat: ' + m.alamat + ', Ds/Kel. ' + m.desa_kel + ', Kec. ' + m.kecamatan + '\n' +
      '   NIB: ' + m.nib + ' | KBLI: ' + String(m.kbli || '-').replace(/\n+/g, '; ') + '\n' +
      '   Industri: ' + m.jenis_industri + ' | Produk: ' + m.jenis_produk
    );
  });

  const memberChunks = chunkTextLines_(memberEntries, PRRP_CONFIG.MAX_TEXT_CHUNK_CHARS);
  memberChunks.forEach(function (chunkText, idx) {
    const partSuffix = memberChunks.length > 1 ? ' (Bagian ' + (idx + 1) + '/' + memberChunks.length + ')' : '';
    form.addSectionHeaderItem()
      .setTitle('Daftar Lengkap Anggota IK Penerima — ' + kub.nama_kub + ' (' + kub.anggota.length + ' Anggota)' + partSuffix)
      .setHelpText(chunkText);
  });

  // 2) Checkbox Verifikasi Kehadiran / Keaktifan Anggota IK
  const memberChoices = kub.anggota.map(function (m, idx) {
    return truncateLabel_((idx + 1) + '. ' + m.nama + ' / ' + m.nama_ik + ' (' + m.jabatan + ')', 140);
  });
  memberChoices.push('Tidak ada anggota yang hadir / belum terverifikasi saat kunjungan');

  form.addCheckboxItem()
    .setTitle('Verifikasi Kehadiran / Keaktifan Anggota IK (' + kub.nama_kub + ')')
    .setHelpText('Centang anggota IK yang hadir atau berhasil diverifikasi keberadaannya di lapangan.')
    .setChoiceValues(memberChoices)
    .setRequired(true);

  // 3) Daftar Lengkap Spesifikasi Teknis Mesin/Alat (auto-chunk <= 3500 chars)
  const machineEntries = kub.mesin.map(function (eq, idx) {
    const rawNote = eq.raw_row_count && eq.raw_row_count > 1
      ? ' [Gabungan ' + eq.raw_row_count + ' baris identik di Excel]'
      : '';
    const spekOneLine = String(eq.spesifikasi || '-').replace(/\n+/g, '; ');
    return (
      (idx + 1) + '. ' + eq.nama_mesin + ' | Merk/Tipe: ' + eq.merk_tipe +
      ' | Vol: ' + eq.volume + ' ' + eq.satuan + rawNote + '\n' +
      '   Jenis: ' + eq.jenis_mesin + ' | Tipe: ' + eq.tipe_mesin + ' | Energi: ' + eq.sumber_energi +
      ' | Instalasi: ' + eq.perlu_instalasi + ' | Training: ' + eq.perlu_training + '\n' +
      '   Spek: ' + spekOneLine
    );
  });

  const machineChunks = chunkTextLines_(machineEntries, PRRP_CONFIG.MAX_TEXT_CHUNK_CHARS);
  machineChunks.forEach(function (chunkText, idx) {
    const partSuffix = machineChunks.length > 1 ? ' (Bagian ' + (idx + 1) + '/' + machineChunks.length + ')' : '';
    form.addSectionHeaderItem()
      .setTitle('Daftar Spesifikasi Teknis Mesin/Alat — ' + kub.nama_kub + ' (' + kub.mesin.length + ' Jenis)' + partSuffix)
      .setHelpText(chunkText);
  });

  // 4) Grid Verifikasi Penerimaan & Kesesuaian Spesifikasi Mesin
  const spekRows = kub.mesin.map(function (eq, idx) {
    const volText = eq.volume && eq.volume !== '-' ? (' (' + eq.volume + ' ' + eq.satuan + ')') : ' (Vol: cek fisik)';
    const merkText = eq.merk_tipe && eq.merk_tipe !== '-' ? (' — ' + eq.merk_tipe) : '';
    return truncateLabel_((idx + 1) + '. ' + eq.nama_mesin + merkText + volText, PRRP_CONFIG.MAX_GRID_ROW_CHARS);
  });

  form.addGridItem()
    .setTitle('Verifikasi Penerimaan & Kesesuaian Spesifikasi Mesin (' + kub.nama_kub + ')')
    .setHelpText('Pilih status kesesuaian fisik, spesifikasi, dan volume untuk setiap mesin/alat di atas.')
    .setRows(spekRows)
    .setColumns(PRRP_CONFIG.GRID_SPEK_COLUMNS)
    .setRequired(true);

  // 5) Grid Status Instalasi & Training Operator
  const instRows = kub.mesin.map(function (eq, idx) {
    const flagText = ' [Inst: ' + eq.perlu_instalasi + ' | Train: ' + eq.perlu_training + ']';
    return truncateLabel_((idx + 1) + '. ' + eq.nama_mesin + flagText, PRRP_CONFIG.MAX_GRID_ROW_CHARS);
  });

  form.addGridItem()
    .setTitle('Status Instalasi & Training Operator Mesin (' + kub.nama_kub + ')')
    .setHelpText('Pilih status instalasi dan pelatihan operator aktual di lapangan untuk tiap mesin.')
    .setRows(instRows)
    .setColumns(PRRP_CONFIG.GRID_INSTALASI_COLUMNS)
    .setRequired(true);

  // 6) Catatan Teknis KUB
  form.addParagraphTextItem()
    .setTitle('Catatan Teknis, Selisih Volume, Nomor Seri & Kendala Mesin (' + kub.nama_kub + ')')
    .setHelpText('Opsional: catat selisih jumlah/volume (khususnya jika di Excel belum tercantum volume), nomor seri mesin, atau kendala teknis.')
    .setRequired(false);
}

function finalizeForm_(form, masterData, state) {
  // Buat Section Penutup
  const closingPb = form.addPageBreakItem()
    .setTitle('Konfirmasi, Dokumentasi & Pengiriman')
    .setHelpText('Langkah terakhir: lengkapi data perwakilan KUB yang ditemui, kesiapan lokasi, tautan dokumentasi, dan konfirmasi petugas sebelum menekan Kirim.');
  state.closingPageId = closingPb.getId();

  // Pastikan section KUB terakhir (yang berada tepat sebelum closingPb) lanjut ke closingPb
  closingPb.setGoToPage(FormApp.PageNavigationType.CONTINUE);

  form.addTextItem()
    .setTitle('Nama Perwakilan KUB yang Ditemui')
    .setHelpText('Masukkan nama lengkap pengurus/anggota KUB yang mendampingi monitoring.')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Jabatan & Nomor HP Perwakilan KUB')
    .setHelpText('Contoh: Ketua — 0812xxxxxxxx')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Kesiapan Lokasi, Daya Listrik & Ruang Produksi')
    .setHelpText('Evaluasi kesiapan lokasi penempatan mesin/peralatan bantuan.')
    .setChoiceValues(PRRP_CONFIG.KESIAPAN_LOKASI_OPTIONS)
    .setRequired(true);

  form.addTextItem()
    .setTitle('Link Folder Google Drive Foto Dokumentasi / BAST (Opsional)')
    .setHelpText('Tempelkan tautan Google Drive foto mesin/lokasi/BAST. (Catatan: Google Apps Script tidak mendukung pembuatan pertanyaan File Upload secara API; jika ingin upload langsung di form, tambahkan item "Upload File" secara manual di bagian penutup ini).')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('Catatan Umum & Rekomendasi Tindak Lanjut')
    .setHelpText('Opsional: ringkasan temuan lapangan atau tindak lanjut yang diperlukan Dit. LMEA / Dinas.')
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('Konfirmasi Petugas')
    .setChoiceValues(['Saya menyatakan data monitoring & verifikasi yang diinput sesuai kondisi lapangan yang sebenarnya.'])
    .setRequired(true);

  // Wiring Dropdown Provinsi -> Section Provinsi
  const provDropdown = form.getItemById(state.provDropdownId).asListItem();
  const provChoices = masterData.provinsi.map(function (prov) {
    const targetPb = form.getItemById(state.provPageIds[prov.nama]).asPageBreakItem();
    return provDropdown.createChoice(prov.nama, targetPb);
  });
  provDropdown.setChoices(provChoices);

  // Wiring Dropdown Kab/Kota -> Section Kab/Kota & Dropdown KUB -> Section KUB
  masterData.provinsi.forEach(function (prov) {
    const kabDropdown = form.getItemById(state.kabDropdownIds[prov.nama]).asListItem();
    const kabChoices = prov.kab_kota.map(function (kab) {
      const kabTargetPb = form.getItemById(state.kabPageIds[kab.id]).asPageBreakItem();
      return kabDropdown.createChoice(kab.nama, kabTargetPb);
    });
    kabDropdown.setChoices(kabChoices);

    prov.kab_kota.forEach(function (kab) {
      const kubDropdown = form.getItemById(state.kubDropdownIds[kab.id]).asListItem();
      const kubChoices = kab.kubs.map(function (kub) {
        const kubTargetPb = form.getItemById(state.kubPageIds[kub.id]).asPageBreakItem();
        return kubDropdown.createChoice(kub.nama_kub, kubTargetPb);
      });
      kubDropdown.setChoices(kubChoices);
    });
  });

  // ATURAN KRITIS PageBreakItem.setGoToPage():
  // Pada FormApp, pb.setGoToPage(target) mengatur navigasi "Setelah bagian sebelumnya" (SEBELUM pb).
  // Maka agar KUB i (i = 0 .. kubOrder.length - 2) langsung lompat ke closingPb dan TIDAK jatuh ke KUB i+1,
  // setGoToPage(closingPb) dipasang pada kubOrder[i + 1]!
  for (let i = 0; i < state.kubOrder.length - 1; i++) {
    const nextKubPb = form.getItemById(state.kubOrder[i + 1]).asPageBreakItem();
    nextKubPb.setGoToPage(closingPb);
  }

  Logger.log('==========================================================');
  Logger.log('BUILD GOOGLE FORM SELESAI & SUKSES!');
  Logger.log('Form ID          : ' + form.getId());
  Logger.log('Mode sumber data : ' + state.mode);
  Logger.log('Total Provinsi   : ' + masterData.provinsi.length);
  Logger.log('Total KUB        : ' + state.kubOrder.length);
  Logger.log('Total Item Form  : ' + form.getItems().length);
  Logger.log('Edit URL         : ' + form.getEditUrl());
  Logger.log('Published URL    : ' + form.getPublishedUrl());
  Logger.log('==========================================================');
}

/**
 * Mengaudit seluruh struktur & cabang Google Form secara langsung dari objek FormApp.
 * @param {Object} masterData
 * @param {string=} optionalFormId
 */
function verifyFormStructure_(masterData, optionalFormId) {
  const form = FormApp.openById(resolveFormId_(optionalFormId));
  const items = form.getItems();
  const sections = [];
  let current = { title: form.getTitle() + ' (Section 1)', pageBreakId: null, items: [] };
  sections.push(current);

  items.forEach(function (it) {
    if (it.getType() === FormApp.ItemType.PAGE_BREAK) {
      const pb = it.asPageBreakItem();
      current = {
        title: pb.getTitle(),
        pageBreakId: pb.getId(),
        pbItem: pb,
        items: []
      };
      sections.push(current);
    } else {
      current.items.push(it);
    }
  });

  const errors = [];
  const expectedKubs = flattenKubs_(masterData);
  const expectedSections = 1 + masterData.provinsi.length +
    masterData.provinsi.reduce(function (s, p) { return s + p.kab_kota.length; }, 0) +
    expectedKubs.length + 1;

  if (sections.length !== expectedSections) {
    errors.push('Jumlah section tidak cocok: ditemukan ' + sections.length + ', diharapkan ' + expectedSections);
  }

  const closingSec = sections[sections.length - 1];
  if (!closingSec || closingSec.title !== 'Konfirmasi, Dokumentasi & Pengiriman') {
    errors.push('Section terakhir bukan "Konfirmasi, Dokumentasi & Pengiriman"');
  }

  // Cek Section 1 dropdown Provinsi
  const provList = findListItemInSection_(sections[0], 'Pilih Provinsi');
  if (!provList) {
    errors.push('Dropdown "Pilih Provinsi" tidak ditemukan di Section 1');
  } else {
    const choices = provList.getChoices();
    if (choices.length !== masterData.provinsi.length) {
      errors.push('Jumlah opsi Provinsi = ' + choices.length + ', diharapkan ' + masterData.provinsi.length);
    }
    choices.forEach(function (ch) {
      const target = ch.getGotoPage();
      if (!target || target.getTitle() !== 'Wilayah Provinsi: ' + ch.getValue()) {
        errors.push('Cabang Provinsi "' + ch.getValue() + '" salah target: ' + (target ? target.getTitle() : 'NULL'));
      }
    });
  }

  // Peta section berdasarkan pageBreakId
  const secIndexByPbId = {};
  sections.forEach(function (s, idx) {
    if (s.pageBreakId !== null) {
      secIndexByPbId[s.pageBreakId] = idx;
    }
  });

  // Cek dropdown Kab/Kota dan KUB
  masterData.provinsi.forEach(function (prov) {
    const provSec = sections.find(function (s) { return s.title === 'Wilayah Provinsi: ' + prov.nama; });
    if (!provSec) {
      errors.push('Section Provinsi tidak ditemukan: ' + prov.nama);
      return;
    }
    const kabList = findListItemInSection_(provSec, 'Pilih Kabupaten / Kota (' + prov.nama + ')');
    if (!kabList) {
      errors.push('Dropdown Kab/Kota tidak ditemukan untuk Provinsi ' + prov.nama);
      return;
    }
    if (kabList.getChoices().length !== prov.kab_kota.length) {
      errors.push('Jumlah opsi Kab/Kota pada ' + prov.nama + ' tidak cocok');
    }
    kabList.getChoices().forEach(function (ch) {
      const kabTarget = ch.getGotoPage();
      if (!kabTarget || kabTarget.getTitle().indexOf('Pilih KUB — ' + ch.getValue()) !== 0) {
        errors.push('Cabang Kab/Kota "' + ch.getValue() + '" salah target');
        return;
      }
      const kabSec = sections[secIndexByPbId[kabTarget.getId()]];
      const kubList = findListItemInSection_(kabSec, 'Pilih Nama KUB — ' + ch.getValue());
      if (!kubList) {
        errors.push('Dropdown KUB tidak ditemukan untuk Kab/Kota ' + ch.getValue());
        return;
      }
      const kabData = prov.kab_kota.find(function (k) { return k.nama === ch.getValue(); });
      if (kubList.getChoices().length !== kabData.kubs.length) {
        errors.push('Jumlah opsi KUB pada ' + ch.getValue() + ' = ' + kubList.getChoices().length + ', diharapkan ' + kabData.kubs.length);
      }
      kubList.getChoices().forEach(function (kch) {
        const kubTarget = kch.getGotoPage();
        if (!kubTarget || kubTarget.getTitle() !== '[KUB] ' + kch.getValue() + ' — ' + ch.getValue()) {
          errors.push('Cabang KUB "' + kch.getValue() + '" salah target: ' + (kubTarget ? kubTarget.getTitle() : 'NULL'));
          return;
        }
        const kubSecIdx = secIndexByPbId[kubTarget.getId()];
        const nextPb = sections[kubSecIdx + 1].pbItem;
        if (kubSecIdx < sections.length - 2) {
          const afterGoto = nextPb.getGoToPage();
          if (!afterGoto || afterGoto.getId() !== closingSec.pageBreakId) {
            errors.push('KUB "' + kch.getValue() + '" bocor ke section berikutnya, tidak lompat ke Penutup!');
          }
        } else {
          // KUB terakhir tepat sebelum Section Penutup: navigasi CONTINUE atau eksplisit ke Penutup
          const navType = nextPb.getPageNavigationType();
          const afterGoto = nextPb.getGoToPage();
          const ok = navType === FormApp.PageNavigationType.CONTINUE ||
            (afterGoto && afterGoto.getId() === closingSec.pageBreakId);
          if (!ok) {
            errors.push('KUB terakhir "' + kch.getValue() + '" tidak menuju ke Penutup!');
          }
        }
      });
    });
  });

  // Cek panjang helpText SectionHeaderItem tidak melebihi batas aman
  items.forEach(function (it) {
    if (it.getType() === FormApp.ItemType.SECTION_HEADER) {
      const txt = it.getHelpText() || '';
      if (txt.length > PRRP_CONFIG.MAX_TEXT_CHUNK_CHARS + 200) {
        errors.push('SectionHeaderItem terlalu panjang (' + txt.length + ' karakter): ' + it.getTitle());
      }
    }
  });

  const summary = {
    ok: errors.length === 0,
    totalSections: sections.length,
    totalItems: items.length,
    totalKubsVerified: expectedKubs.length,
    errors: errors
  };
  Logger.log('VERIFIKASI STRUKTUR FORM: ' + (summary.ok ? 'PASS' : 'FAIL'));
  Logger.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) {
    throw new Error('Verifikasi Form gagal dengan ' + errors.length + ' error:\n- ' + errors.join('\n- '));
  }
  return summary;
}

function findListItemInSection_(section, title) {
  for (let i = 0; i < section.items.length; i++) {
    const it = section.items[i];
    if (it.getType() === FormApp.ItemType.LIST && it.getTitle() === title) {
      return it.asListItem();
    }
  }
  return null;
}

function chunkTextLines_(entries, maxChars) {
  const chunks = [];
  let buf = [];
  let bufLen = 0;

  entries.forEach(function (entry) {
    const sep = buf.length > 0 ? 2 : 0; // '\n\n'
    if (buf.length > 0 && bufLen + sep + entry.length > maxChars) {
      chunks.push(buf.join('\n\n'));
      buf = [entry];
      bufLen = entry.length;
    } else {
      buf.push(entry);
      bufLen += sep + entry.length;
    }
  });
  if (buf.length > 0) {
    chunks.push(buf.join('\n\n'));
  }
  return chunks.length ? chunks : ['-'];
}

function truncateLabel_(text, maxLen) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) {
    return clean;
  }
  return clean.slice(0, maxLen - 3) + '...';
}

function isTimeExceeded_(startMs) {
  return Date.now() - startMs >= PRRP_CONFIG.MAX_EXECUTION_MS;
}

function saveBuildState_(state) {
  PropertiesService.getScriptProperties().setProperty(PRRP_CONFIG.PROP_STATE_KEY, JSON.stringify(state));
}

function loadBuildState_() {
  const raw = PropertiesService.getScriptProperties().getProperty(PRRP_CONFIG.PROP_STATE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function clearContinueTriggers_() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (tr) {
    if (tr.getHandlerFunction() === 'continueBuildForm') {
      ScriptApp.deleteTrigger(tr);
    }
  });
}

function scheduleContinueTrigger_() {
  clearContinueTriggers_();
  ScriptApp.newTrigger('continueBuildForm')
    .timeBased()
    .after(PRRP_CONFIG.CONTINUE_DELAY_MS)
    .create();
}
