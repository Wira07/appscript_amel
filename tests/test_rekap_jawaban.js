#!/usr/bin/env node
/**
 * Offline unit & simulation test suite for rekap-jawaban/RekapJawaban.gs.
 * Tests:
 *   1) V8 syntax validation via vm.Script
 *   2) Trimmed/edited Form headers (matching Amel's screenshot where Instansi & HP Petugas were removed)
 *   3) Merging Grid 1 (Spek) + Grid 2 (Instalasi/Training) into 1 row per machine in Rekap_Verifikasi_Mesin
 *   4) Catch-all Info_Tambahan for custom questions added manually by Amel
 *   5) aktifkanRekapOtomatis() trigger install + initial backfill
 *   6) Idempotent rekapSemuaJawaban() (0 duplicates)
 *   7) Incremental onFormSubmitRekap(e) append + duplicate guard
 *   8) hapusTriggerRekap() cleanup
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT, 'rekap-jawaban', 'RekapJawaban.gs');

function createMockSpreadsheetEnv() {
  const logs = [];
  const triggers = [];
  let triggerSeq = 1;

  class MockRange {
    constructor(sheet, r1, c1, nr, nc) {
      this._sheet = sheet;
      this._r1 = r1;
      this._c1 = c1;
      this._nr = nr;
      this._nc = nc;
    }
    getRow() { return this._r1; }
    getSheet() { return this._sheet; }
    setNumberFormat() { return this; }
    setFontWeight() { return this; }
    setBackground() { return this; }
    setFontColor() { return this; }
    setValues(matrix) {
      for (let r = 0; r < matrix.length; r++) {
        const rr = this._r1 - 1 + r;
        if (!this._sheet._data[rr]) this._sheet._data[rr] = [];
        for (let c = 0; c < matrix[r].length; c++) {
          this._sheet._data[rr][this._c1 - 1 + c] = String(matrix[r][c]);
        }
      }
      return this;
    }
    getDisplayValues() {
      const out = [];
      for (let r = 0; r < this._nr; r++) {
        const rr = this._r1 - 1 + r;
        const srcRow = this._sheet._data[rr] || [];
        const rowOut = [];
        for (let c = 0; c < this._nc; c++) {
          const val = srcRow[this._c1 - 1 + c];
          rowOut.push(val === undefined || val === null ? '' : String(val));
        }
        out.push(rowOut);
      }
      return out;
    }
    getDisplayValue() {
      return this.getDisplayValues()[0][0];
    }
  }

  class MockSheet {
    constructor(name) {
      this._name = name;
      this._data = [];
      this._frozenRows = 0;
    }
    getName() { return this._name; }
    setFrozenRows(n) { this._frozenRows = n; return this; }
    clearContents() { this._data = []; return this; }
    getLastRow() { return this._data.length; }
    getLastColumn() {
      let maxC = 0;
      for (const r of this._data) {
        if (r && r.length > maxC) maxC = r.length;
      }
      return maxC;
    }
    getRange(r1, c1, nr = 1, nc = 1) {
      return new MockRange(this, r1, c1, nr, nc);
    }
  }

  class MockSpreadsheet {
    constructor() {
      this._sheets = [new MockSheet('Form Responses 1')];
    }
    getSheets() { return this._sheets.slice(); }
    getSheetByName(name) { return this._sheets.find((s) => s.getName() === name) || null; }
    insertSheet(name) {
      const sh = new MockSheet(name);
      this._sheets.push(sh);
      return sh;
    }
  }

  const ss = new MockSpreadsheet();
  const sandbox = {
    String,
    Array,
    Object,
    JSON,
    RegExp,
    Error,
    SpreadsheetApp: {
      getActiveSpreadsheet() { return ss; },
      getUi() {
        return {
          createMenu() {
            const m = {
              addItem() { return m; },
              addSeparator() { return m; },
              addToUi() {}
            };
            return m;
          }
        };
      }
    },
    ScriptApp: {
      getProjectTriggers() { return triggers.slice(); },
      deleteTrigger(tr) {
        const idx = triggers.indexOf(tr);
        if (idx >= 0) triggers.splice(idx, 1);
      },
      newTrigger(fn) {
        return {
          forSpreadsheet() {
            return {
              onFormSubmit() {
                return {
                  create() {
                    const tr = {
                      id: 'tr_' + triggerSeq++,
                      getHandlerFunction() { return fn; }
                    };
                    triggers.push(tr);
                    return tr;
                  }
                };
              }
            };
          }
        };
      }
    },
    Logger: {
      log(msg) { logs.push(String(msg)); }
    }
  };

  const code = fs.readFileSync(SCRIPT_PATH, 'utf8');
  // 1) Syntax check via vm.Script
  new vm.Script(code, { filename: 'RekapJawaban.gs' });
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'RekapJawaban.gs' });

  return { sandbox, ss, triggers, logs };
}

function runTests() {
  const { sandbox, ss, triggers } = createMockSpreadsheetEnv();
  const src = ss.getSheetByName('Form Responses 1');

  // Mimic Amel's edited Form headers (removed Instansi & HP Petugas, plus custom Upload Foto Lapangan)
  const headers = [
    'Timestamp',
    'Nama Petugas',
    'Tanggal Kunjungan / Monitoring',
    'Pilih Provinsi',
    'Pilih Kabupaten / Kota (Aceh)',
    'Pilih Kabupaten / Kota (Sumatera Barat)',
    'Pilih Nama KUB — Aceh Selatan',
    'Pilih Nama KUB — Kabupaten Agam',
    'Verifikasi Kehadiran / Keaktifan Anggota IK (KUB Giat Bersama)',
    'Verifikasi Penerimaan & Kesesuaian Spesifikasi Mesin (KUB Giat Bersama) [1. Mesin Bordir D Komputer Digital — Merk Janome BC 550E (10 Unit)]',
    'Verifikasi Penerimaan & Kesesuaian Spesifikasi Mesin (KUB Giat Bersama) [2. Mesin Jahit Biasa — Merk Jack (10 Unit)]',
    'Status Instalasi & Training Operator Mesin (KUB Giat Bersama) [1. Mesin Bordir D Komputer Digital [Inst: Ya | Train: Ya]]',
    'Status Instalasi & Training Operator Mesin (KUB Giat Bersama) [2. Mesin Jahit Biasa [Inst: Ya | Train: Tidak]]',
    'Catatan Teknis, Selisih Volume, Nomor Seri & Kendala Mesin (KUB Giat Bersama)',
    'Verifikasi Penerimaan & Kesesuaian Spesifikasi Mesin (KUB RH Teknik) [1. Travo Las — ESAB Rogue (2 Unit)]',
    'Status Instalasi & Training Operator Mesin (KUB RH Teknik) [1. Travo Las [Inst: Ya | Train: Ya]]',
    'Nama Perwakilan KUB yang Ditemui',
    'Jabatan & Nomor HP Perwakilan KUB',
    'Kesiapan Lokasi, Daya Listrik & Ruang Produksi',
    'Upload Foto Lapangan (Custom)',
    'Catatan Umum & Rekomendasi Tindak Lanjut',
    'Konfirmasi Petugas'
  ];

  const rowWira = new Array(headers.length).fill('');
  rowWira[0] = '26/11/2026 9:09:58';
  rowWira[1] = 'wira';
  rowWira[2] = '26/11/2026';
  rowWira[3] = 'Aceh';
  rowWira[4] = 'Aceh Selatan';
  rowWira[6] = 'KUB Giat Bersama';
  rowWira[8] = '1. Ade Sartika / Ade Sartika (Ketua)';
  rowWira[9] = 'Sesuai Spek & Volume';
  rowWira[10] = 'Sesuai Spek (Volume Kurang)';
  rowWira[11] = 'Sudah Instalasi & Training';
  rowWira[12] = 'Belum Instalasi';
  rowWira[13] = 'Mesin jahit kurang 1 unit';
  rowWira[16] = 'Ade Sartika';
  rowWira[17] = 'Ketua - 085370336955';
  rowWira[18] = 'Sangat Siap';
  rowWira[19] = 'https://drive.google.com/file/d/foto1';
  rowWira[21] = 'Saya menyatakan data benar';

  const rowAgam = new Array(headers.length).fill('');
  rowAgam[0] = '26/11/2026 10:15:00';
  rowAgam[1] = 'Amel';
  rowAgam[2] = '26/11/2026';
  rowAgam[3] = 'Sumatera Barat';
  rowAgam[5] = 'Kabupaten Agam';
  rowAgam[7] = 'KUB RH Teknik';
  rowAgam[14] = 'Sesuai Spek & Volume';
  rowAgam[15] = 'Sudah Instalasi & Training';
  rowAgam[16] = 'Roni Aleksander';
  rowAgam[17] = 'Ketua - 081370342489';
  rowAgam[18] = 'Cukup Siap';
  rowAgam[20] = 'Aman terkendali';
  rowAgam[21] = 'Saya menyatakan data benar';

  src._data = [headers, rowWira, rowAgam];

  // Test 1: aktifkanRekapOtomatis installs trigger and backfills both rows + 8 Kab/Kota tabs
  const res1 = sandbox.aktifkanRekapOtomatis();
  assert.strictEqual(triggers.length, 1);
  assert.strictEqual(triggers[0].getHandlerFunction(), 'onFormSubmitRekap');
  assert.strictEqual(res1.totalKunjungan, 2);
  assert.strictEqual(res1.totalMesin, 3);
  assert.strictEqual(res1.totalKabTabs, 8);

  const shKunj = ss.getSheetByName('Rekap_Kunjungan');
  const shMesin = ss.getSheetByName('Rekap_Verifikasi_Mesin');
  const shAcehSel = ss.getSheetByName('Aceh Selatan');
  const shAgam = ss.getSheetByName('Kabupaten Agam');
  assert(shKunj && shMesin && shAcehSel && shAgam, 'Recap and Kab/Kota sheets should exist');
  assert.strictEqual(shKunj.getLastRow(), 3); // header + 2
  assert.strictEqual(shMesin.getLastRow(), 4); // header + 3
  assert.strictEqual(shAcehSel.getLastRow(), 3); // header + 2 machines for wira
  assert.strictEqual(shAgam.getLastRow(), 2); // header + 1 machine for Amel
  assert.strictEqual(ss.getSheetByName('Aceh Singkil').getLastRow(), 1); // header only

  // Verify merged Grid 1 + Grid 2 for wira's 2 machines
  const mRows = shMesin.getRange(2, 1, 3, 12).getDisplayValues();
  assert.strictEqual(mRows[0][6], 'KUB Giat Bersama');
  assert.strictEqual(mRows[0][7], '1');
  assert.strictEqual(mRows[0][8], 'Mesin Bordir D Komputer Digital — Merk Janome BC 550E (10 Unit)');
  assert.strictEqual(mRows[0][9], 'Sesuai Spek & Volume');
  assert.strictEqual(mRows[0][10], 'Sudah Instalasi & Training');
  assert.strictEqual(mRows[1][7], '2');
  assert.strictEqual(mRows[1][9], 'Sesuai Spek (Volume Kurang)');
  assert.strictEqual(mRows[1][10], 'Belum Instalasi');
  assert.strictEqual(mRows[2][6], 'KUB RH Teknik');
  assert.strictEqual(mRows[2][8], 'Travo Las — ESAB Rogue (2 Unit)');

  // Verify custom Foto column preserved in Dokumentasi_BAST
  const kRow1 = shKunj.getRange(2, 1, 1, 20).getDisplayValues()[0];
  assert.strictEqual(kRow1[2], 'wira');
  assert.strictEqual(kRow1[7], 'Aceh');
  assert.strictEqual(kRow1[8], 'Aceh Selatan');
  assert.strictEqual(kRow1[9], 'KUB Giat Bersama');
  assert.strictEqual(kRow1[11], '2'); // Jumlah_Mesin_Dicek
  assert.strictEqual(kRow1[16], 'https://drive.google.com/file/d/foto1');

  // Test 2: Idempotent rekapSemuaJawaban
  const res2 = sandbox.rekapSemuaJawaban();
  assert.strictEqual(res2.totalKunjungan, 2);
  assert.strictEqual(res2.totalMesin, 3);
  assert.strictEqual(shKunj.getLastRow(), 3);
  assert.strictEqual(shMesin.getLastRow(), 4);

  // Test 3: Incremental onFormSubmitRekap(e) for row 4 + duplicate guard
  const row3 = rowAgam.slice();
  row3[0] = '26/11/2026 11:00:00';
  row3[1] = 'Petugas 3';
  src._data.push(row3);
  sandbox.onFormSubmitRekap({ range: src.getRange(4, 1, 1, headers.length) });
  assert.strictEqual(shKunj.getLastRow(), 4);
  assert.strictEqual(shMesin.getLastRow(), 5);

  // Calling again for same row 4 must NOT duplicate!
  sandbox.onFormSubmitRekap({ range: src.getRange(4, 1, 1, headers.length) });
  assert.strictEqual(shKunj.getLastRow(), 4);
  assert.strictEqual(shMesin.getLastRow(), 5);

  // Test 4: hapusTriggerRekap
  const removed = sandbox.hapusTriggerRekap();
  assert.strictEqual(removed, 1);
  assert.strictEqual(triggers.length, 0);

  console.log('PASS [RekapJawaban.gs]: Syntax, dynamic header parsing, Grid 1+2 merge, backfill, incremental submit & dedup all pass.');
}

runTests();
