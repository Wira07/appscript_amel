#!/usr/bin/env node
/**
 * Offline unit & simulation test suite for the Google Apps Script project (apps-script/).
 * Validates syntax, FormApp API constraints, PageBreak navigation semantics (including off-by-one),
 * resumable batching timeout + continuation triggers, Hybrid Sheet Sync round-trip, and all 52 KUB paths.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GAS_DIR = path.join(ROOT, 'apps-script');
const SCRIPT_FILES = ['Config.js', 'DataPayload.js', 'SheetSync.js', 'FormBuilder.js', 'WebApp.js', 'Kode.js'];

function checkSyntax() {
  for (const file of SCRIPT_FILES) {
    execFileSync(process.execPath, ['--check', path.join(GAS_DIR, file)], { stdio: 'inherit' });
  }
  console.log(`PASS [Syntax]: All ${SCRIPT_FILES.length} Apps Script JS files pass node --check.`);
}

function createGasMockEnv() {
  const propsStore = {};
  const triggers = [];
  const logs = [];
  const formsDb = {};
  const sheetsDb = {};
  let nextId = 1000;
  let triggerCounter = 1;
  let sheetCounter = 1;

  const ItemType = {
    TEXT: 'TEXT',
    DATE: 'DATE',
    LIST: 'LIST',
    MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
    CHECKBOX: 'CHECKBOX',
    GRID: 'GRID',
    PARAGRAPH_TEXT: 'PARAGRAPH_TEXT',
    SECTION_HEADER: 'SECTION_HEADER',
    PAGE_BREAK: 'PAGE_BREAK'
  };

  const PageNavigationType = {
    CONTINUE: 'CONTINUE',
    GO_TO_PAGE: 'GO_TO_PAGE',
    RESTART: 'RESTART',
    SUBMIT: 'SUBMIT'
  };

  class MockChoice {
    constructor(value, gotoPage) {
      this._value = String(value);
      this._gotoPage = gotoPage || null;
    }
    getValue() { return this._value; }
    getGotoPage() { return this._gotoPage; }
  }

  class MockItem {
    constructor(type) {
      this._id = ++nextId;
      this._type = type;
      this._title = '';
      this._helpText = '';
      this._required = false;
      this._choices = [];
      this._rows = [];
      this._columns = [];
      this._gotoPage = null;
      this._navType = PageNavigationType.CONTINUE;
    }
    getId() { return this._id; }
    getType() { return this._type; }
    getTitle() { return this._title; }
    setTitle(t) { this._title = String(t); return this; }
    getHelpText() { return this._helpText; }
    setHelpText(h) {
      const s = String(h);
      assert(s.length <= 4000, `helpText too long (${s.length} chars) on "${this._title}"`);
      this._helpText = s;
      return this;
    }
    isRequired() { return this._required; }
    setRequired(r) { this._required = Boolean(r); return this; }

    // Choice items
    setChoiceValues(vals) {
      assert(Array.isArray(vals) && vals.length > 0, `Empty choices on "${this._title}"`);
      const seen = new Set();
      for (const v of vals) {
        const s = String(v);
        assert(s.length > 0, `Blank choice on "${this._title}"`);
        assert(!seen.has(s), `Duplicate choice "${s}" on "${this._title}"`);
        seen.add(s);
      }
      this._choices = vals.map((v) => new MockChoice(v, null));
      return this;
    }
    createChoice(val, gotoPage) {
      return new MockChoice(val, gotoPage);
    }
    setChoices(choices) {
      assert(Array.isArray(choices) && choices.length > 0, `Empty choices on "${this._title}"`);
      const seen = new Set();
      for (const c of choices) {
        const v = c.getValue();
        assert(!seen.has(v), `Duplicate choice "${v}" on "${this._title}"`);
        seen.add(v);
      }
      this._choices = choices.slice();
      return this;
    }
    getChoices() { return this._choices.slice(); }

    // Grid items
    setRows(rows) {
      assert(Array.isArray(rows) && rows.length > 0, `Empty grid rows on "${this._title}"`);
      const seen = new Set();
      for (const r of rows) {
        const s = String(r);
        assert(s.length > 0, `Blank grid row on "${this._title}"`);
        assert(!seen.has(s), `Duplicate grid row "${s}" on "${this._title}"`);
        seen.add(s);
      }
      this._rows = rows.slice();
      return this;
    }
    getRows() { return this._rows.slice(); }
    setColumns(cols) {
      assert(Array.isArray(cols) && cols.length > 0, `Empty grid cols on "${this._title}"`);
      this._columns = cols.slice();
      return this;
    }
    getColumns() { return this._columns.slice(); }

    // PageBreakItem navigation
    setGoToPage(target) {
      if (target === PageNavigationType.CONTINUE || target === PageNavigationType.SUBMIT || target === PageNavigationType.RESTART) {
        this._navType = target;
        this._gotoPage = null;
      } else {
        assert(target && target._type === ItemType.PAGE_BREAK, 'setGoToPage target must be a PageBreakItem or PageNavigationType');
        this._navType = PageNavigationType.GO_TO_PAGE;
        this._gotoPage = target;
      }
      return this;
    }
    getGoToPage() { return this._gotoPage; }
    getPageNavigationType() { return this._navType; }

    asListItem() { assert.strictEqual(this._type, ItemType.LIST); return this; }
    asPageBreakItem() { assert.strictEqual(this._type, ItemType.PAGE_BREAK); return this; }
    asGridItem() { assert.strictEqual(this._type, ItemType.GRID); return this; }
    asCheckboxItem() { assert.strictEqual(this._type, ItemType.CHECKBOX); return this; }
  }

  class MockForm {
    constructor(id) {
      this._id = id;
      this._title = '';
      this._description = '';
      this._confirmationMessage = '';
      this._items = [];
    }
    getId() { return this._id; }
    getTitle() { return this._title; }
    setTitle(t) { this._title = String(t); return this; }
    getDescription() { return this._description; }
    setDescription(d) { this._description = String(d); return this; }
    setConfirmationMessage(m) { this._confirmationMessage = String(m); return this; }
    setProgressBar() { return this; }
    setCollectEmail() { return this; }
    setAllowResponseEdits() { return this; }
    setShowLinkToRespondAgain() { return this; }
    getEditUrl() { return `https://docs.google.com/forms/d/${this._id}/edit`; }
    getPublishedUrl() { return `https://docs.google.com/forms/d/e/${this._id}/viewform`; }

    getItems() { return this._items.slice(); }
    getItemById(id) {
      const found = this._items.find((it) => it._id === id);
      assert(found, `Item ID ${id} not found in form`);
      return found;
    }
    deleteItem(idxOrItem) {
      const idx = typeof idxOrItem === 'number' ? idxOrItem : this._items.indexOf(idxOrItem);
      assert(idx >= 0 && idx < this._items.length, `Invalid deleteItem index: ${idx}`);
      this._items.splice(idx, 1);
    }
    _add(type) {
      const item = new MockItem(type);
      this._items.push(item);
      return item;
    }
    addTextItem() { return this._add(ItemType.TEXT); }
    addDateItem() { return this._add(ItemType.DATE); }
    addListItem() { return this._add(ItemType.LIST); }
    addMultipleChoiceItem() { return this._add(ItemType.MULTIPLE_CHOICE); }
    addCheckboxItem() { return this._add(ItemType.CHECKBOX); }
    addGridItem() { return this._add(ItemType.GRID); }
    addParagraphTextItem() { return this._add(ItemType.PARAGRAPH_TEXT); }
    addSectionHeaderItem() { return this._add(ItemType.SECTION_HEADER); }
    addPageBreakItem() { return this._add(ItemType.PAGE_BREAK); }
  }

  class MockRange {
    constructor(sheet, r1, c1, nr, nc) {
      this._sheet = sheet;
      this._r1 = r1;
      this._c1 = c1;
      this._nr = nr;
      this._nc = nc;
    }
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
      return this._sheet._data.map((row) => row.slice());
    }
  }

  class MockSheet {
    constructor(name) {
      this._name = name;
      this._data = [];
      this._frozenRows = 0;
    }
    getName() { return this._name; }
    setName(n) { this._name = n; return this; }
    setFrozenRows(n) { this._frozenRows = n; return this; }
    getRange(r1, c1, nr, nc) { return new MockRange(this, r1, c1, nr, nc); }
    getDataRange() {
      const nr = this._data.length;
      const nc = nr ? this._data[0].length : 0;
      return new MockRange(this, 1, 1, nr, nc);
    }
  }

  class MockSpreadsheet {
    constructor(id, title) {
      this._id = id;
      this._title = title;
      this._sheets = [new MockSheet('Sheet1')];
    }
    getId() { return this._id; }
    getUrl() { return `https://docs.google.com/spreadsheets/d/${this._id}/edit`; }
    getSheets() { return this._sheets.slice(); }
    insertSheet(name) {
      const sh = new MockSheet(name);
      this._sheets.push(sh);
      return sh;
    }
    getSheetByName(name) {
      return this._sheets.find((s) => s.getName() === name) || null;
    }
  }

  const sandbox = {
    console,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    RegExp,
    Error,
    parseFloat,
    isNaN,
    FormApp: {
      ItemType,
      PageNavigationType,
      create(title) {
        const id = 'mock_created_form_' + Object.keys(formsDb).length;
        const form = new MockForm(id);
        form.setTitle(title);
        formsDb[id] = form;
        return form;
      },
      openById(id) {
        if (!formsDb[id]) formsDb[id] = new MockForm(id);
        return formsDb[id];
      }
    },
    SpreadsheetApp: {
      create(title) {
        const id = 'mock_ss_' + sheetCounter++;
        const ss = new MockSpreadsheet(id, title);
        sheetsDb[id] = ss;
        return ss;
      },
      openById(id) {
        const ss = sheetsDb[id];
        if (!ss) throw new Error('Mock Spreadsheet not found: ' + id);
        return ss;
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(k) { return Object.prototype.hasOwnProperty.call(propsStore, k) ? propsStore[k] : null; },
          setProperty(k, v) { propsStore[k] = String(v); },
          deleteProperty(k) { delete propsStore[k]; }
        };
      }
    },
    ScriptApp: {
      getProjectTriggers() { return triggers.slice(); },
      deleteTrigger(tr) {
        const idx = triggers.indexOf(tr);
        if (idx >= 0) triggers.splice(idx, 1);
      },
      newTrigger(fnName) {
        return {
          timeBased() {
            return {
              after(ms) {
                return {
                  create() {
                    const tr = {
                      id: 'tr_' + triggerCounter++,
                      afterMs: ms,
                      getHandlerFunction() { return fnName; }
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
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
      createHtmlOutput(html) {
        return {
          _html: String(html),
          _title: '',
          _xframe: '',
          setTitle(t) { this._title = t; return this; },
          setXFrameOptionsMode(m) { this._xframe = m; return this; },
          getContent() { return this._html; }
        };
      },
      createTemplateFromFile(name) {
        const htmlPath = path.join(GAS_DIR, name + '.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        return {
          evaluate() {
            return sandbox.HtmlService.createHtmlOutput(html);
          }
        };
      }
    },
    Logger: {
      log(msg) { logs.push(String(msg)); }
    }
  };

  vm.createContext(sandbox);
  for (const file of SCRIPT_FILES) {
    const code = fs.readFileSync(path.join(GAS_DIR, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }
  const getConst = (name) => vm.runInContext(name, sandbox);

  return { sandbox, getConst, formsDb, sheetsDb, propsStore, triggers, logs };
}

/**
 * Simulates a field officer stepping through Google Form UI from Section 1 -> Provinsi -> Kab/Kota -> KUB -> Next -> Closing.
 * Strictly enforces Google Forms navigation rules (dropdown GoTo + PageBreak AfterSection off-by-one).
 */
function simulateAll52OfficerJourneys(form, masterData) {
  const items = form.getItems();
  const sections = [];
  let sec = { index: 0, title: form.getTitle(), pbItem: null, items: [] };
  sections.push(sec);
  for (const it of items) {
    if (it.getType() === 'PAGE_BREAK') {
      sec = { index: sections.length, title: it.getTitle(), pbItem: it, items: [] };
      sections.push(sec);
    } else {
      sec.items.push(it);
    }
  }

  const pbToSecIdx = new Map();
  for (const s of sections) {
    if (s.pbItem) pbToSecIdx.set(s.pbItem.getId(), s.index);
  }

  const closingIdx = sections.length - 1;
  let pathsVerified = 0;

  const provList = sections[0].items.find((i) => i.getType() === 'LIST' && i.getTitle() === 'Pilih Provinsi');
  assert(provList, 'Missing Pilih Provinsi dropdown');

  for (const prov of masterData.provinsi) {
    const provChoice = provList.getChoices().find((c) => c.getValue() === prov.nama);
    assert(provChoice && provChoice.getGotoPage(), `Missing prov branch for ${prov.nama}`);
    const provSecIdx = pbToSecIdx.get(provChoice.getGotoPage().getId());

    const kabList = sections[provSecIdx].items.find((i) => i.getType() === 'LIST');
    assert(kabList, `Missing Kab/Kota dropdown in section ${provSecIdx}`);
    assert.strictEqual(kabList.getChoices().length, prov.kab_kota.length, `Kab count mismatch in ${prov.nama}`);

    for (const kab of prov.kab_kota) {
      const kabChoice = kabList.getChoices().find((c) => c.getValue() === kab.nama);
      assert(kabChoice && kabChoice.getGotoPage(), `Missing kab branch for ${kab.nama}`);
      const kabSecIdx = pbToSecIdx.get(kabChoice.getGotoPage().getId());

      const kubList = sections[kabSecIdx].items.find((i) => i.getType() === 'LIST');
      assert(kubList, `Missing KUB dropdown in section ${kabSecIdx}`);
      assert.strictEqual(kubList.getChoices().length, kab.kubs.length, `KUB count mismatch in ${kab.nama}`);

      for (const kub of kab.kubs) {
        const kubChoice = kubList.getChoices().find((c) => c.getValue() === kub.nama_kub);
        assert(kubChoice && kubChoice.getGotoPage(), `Missing KUB branch for ${kub.nama_kub}`);
        const kubSecIdx = pbToSecIdx.get(kubChoice.getGotoPage().getId());
        const kubSec = sections[kubSecIdx];

        // Verify full IK + machine counts present inside this KUB section
        const checkItem = kubSec.items.find((i) => i.getType() === 'CHECKBOX');
        assert(checkItem, `Missing attendance checkbox in ${kub.nama_kub}`);
        assert.strictEqual(checkItem.getChoices().length, kub.anggota.length + 1, `Member checkbox count mismatch in ${kub.nama_kub}`);

        const grids = kubSec.items.filter((i) => i.getType() === 'GRID');
        assert.strictEqual(grids.length, 2, `Expected 2 GridItems in ${kub.nama_kub}`);
        assert.strictEqual(grids[0].getRows().length, kub.mesin.length, `Spek grid row count mismatch in ${kub.nama_kub}`);
        assert.strictEqual(grids[1].getRows().length, kub.mesin.length, `Inst grid row count mismatch in ${kub.nama_kub}`);

        // Simulate clicking "Next" after finishing this KUB section -> reads PageBreakItem of sections[kubSecIdx + 1]!
        const afterPb = sections[kubSecIdx + 1].pbItem;
        assert(afterPb, `Missing next PageBreak after KUB section ${kubSecIdx}`);
        let landedSecIdx;
        if (afterPb.getPageNavigationType() === 'CONTINUE') {
          landedSecIdx = kubSecIdx + 1;
        } else if (afterPb.getPageNavigationType() === 'GO_TO_PAGE') {
          landedSecIdx = pbToSecIdx.get(afterPb.getGoToPage().getId());
        } else {
          assert.fail(`Unexpected navType ${afterPb.getPageNavigationType()} after KUB ${kub.nama_kub}`);
        }
        assert.strictEqual(
          landedSecIdx,
          closingIdx,
          `FALL-THROUGH BUG: KUB "${kub.nama_kub}" (sec ${kubSecIdx}) landed on section ${landedSecIdx} ("${sections[landedSecIdx].title}") instead of Closing (${closingIdx})`
        );
        pathsVerified++;
      }
    }
  }
  return { pathsVerified, totalSections: sections.length, totalItems: items.length };
}

function runEmbeddedAndVerificationTests() {
  const env = createGasMockEnv();
  const { sandbox, getConst, formsDb } = env;
  const PRRP_CONFIG = getConst('PRRP_CONFIG');
  const PRRP_MASTER_DATA = getConst('PRRP_MASTER_DATA');

  sandbox.buildFormFromEmbedded();
  const verifyRes = sandbox.verifyFormStructure();
  assert.strictEqual(verifyRes.ok, true);
  assert.strictEqual(verifyRes.totalSections, 65);
  assert.strictEqual(verifyRes.totalKubsVerified, 52);

  const formId = PRRP_CONFIG.FORM_ID;
  const form = formsDb[formId];
  const sim = simulateAll52OfficerJourneys(form, PRRP_MASTER_DATA);
  assert.strictEqual(sim.pathsVerified, 52);
  console.log(`PASS [Embedded Build & 52-Path Simulation]: 65 sections, ${sim.totalItems} items, ${sim.pathsVerified}/52 KUB paths cleanly jump to Closing.`);
}

function runResumableBatchingTest() {
  const env = createGasMockEnv();
  const { sandbox, getConst, formsDb, triggers } = env;
  const PRRP_CONFIG = getConst('PRRP_CONFIG');
  const PRRP_MASTER_DATA = getConst('PRRP_MASTER_DATA');

  // Seed existing items on target form first to exercise resumable CLEAR + INIT + KUBS + FINALIZE
  const form = sandbox.FormApp.openById(PRRP_CONFIG.FORM_ID);
  for (let i = 0; i < 45; i++) form.addTextItem().setTitle('Old ' + i);

  // Force time guard to fire on every check by mocking Date.now to advance per call with MAX_EXECUTION_MS=200
  let fakeTime = 1000000;
  const RealDate = Date;
  sandbox.Date = function (...args) {
    return args.length ? new RealDate(...args) : new RealDate(fakeTime);
  };
  sandbox.Date.now = () => {
    fakeTime += 35;
    return fakeTime;
  };
  PRRP_CONFIG.MAX_EXECUTION_MS = 200; // Pause very frequently!

  sandbox.buildFormFromEmbedded();
  let state = JSON.parse(env.propsStore[PRRP_CONFIG.PROP_STATE_KEY]);
  let resumeCalls = 0;
  while (state.phase !== 'DONE') {
    assert(triggers.length === 1, `Expected 1 scheduled trigger when paused at phase=${state.phase}, got ${triggers.length}`);
    assert.strictEqual(triggers[0].getHandlerFunction(), 'continueBuildForm');
    resumeCalls++;
    assert(resumeCalls < 100, 'Infinite resume loop detected');
    sandbox.continueBuildForm();
    state = JSON.parse(env.propsStore[PRRP_CONFIG.PROP_STATE_KEY]);
  }
  assert(resumeCalls >= 5, `Expected multi-batch pauses during forced timeout test, got ${resumeCalls}`);
  assert.strictEqual(triggers.length, 0, 'All continuation triggers should be cleaned after DONE');

  const verifyRes = sandbox.verifyFormStructure();
  assert.strictEqual(verifyRes.ok, true);
  assert.strictEqual(verifyRes.totalSections, 65);
  const sim = simulateAll52OfficerJourneys(formsDb[PRRP_CONFIG.FORM_ID], PRRP_MASTER_DATA);
  assert.strictEqual(sim.pathsVerified, 52);
  console.log(`PASS [Resumable Batching]: Completed seamlessly across ${resumeCalls} automatic trigger continuations with 0 leaks.`);
}

function runHybridSheetSyncRoundTripTest() {
  const env = createGasMockEnv();
  const { sandbox, getConst, formsDb, sheetsDb } = env;
  const PRRP_CONFIG = getConst('PRRP_CONFIG');

  const ssId = sandbox.createMasterSpreadsheetTemplate();
  assert(ssId && sheetsDb[ssId], 'Master spreadsheet was not created');
  const ss = sheetsDb[ssId];
  assert.strictEqual(ss.getSheetByName('Master_IK_KUB').getDataRange().getDisplayValues().length, 524); // 1 hdr + 523
  assert.strictEqual(ss.getSheetByName('Master_Spek_Mesin').getDataRange().getDisplayValues().length, 419); // 1 hdr + 418

  // Simulate admin adding 1 extra IK member row in Sheet with blank KUB_ID (to verify name-based matching!)
  const ikSheet = ss.getSheetByName('Master_IK_KUB');
  ikSheet._data.push([
    'Aceh', 'Aceh Singkil', '', 'KUB Surya Terali — Bengkel Las', 'Surya Terali',
    '11', 'Anggota Tambahan Uji', 'Bengkel Tambahan', 'Anggota', 'Laki-laki', '30',
    'uji@example.com', '081200000000', 'Jl. Uji', 'Pulo Sarok', 'Singkil',
    '1234567890123', '25111', 'Alat Angkut', 'Las'
  ]);

  sandbox.buildFormFromSpreadsheet();
  const verifyRes = sandbox.verifyFormStructure();
  assert.strictEqual(verifyRes.ok, true);
  assert.strictEqual(verifyRes.totalSections, 65);

  const loadedMaster = sandbox.loadDataFromSpreadsheet_(ssId);
  assert.strictEqual(loadedMaster.metadata.counts.anggota_ik, 524);
  const sim = simulateAll52OfficerJourneys(formsDb[PRRP_CONFIG.FORM_ID], loadedMaster);
  assert.strictEqual(sim.pathsVerified, 52);
  console.log('PASS [Hybrid Sheet Sync Round-Trip]: Created Sheet, verified 523+1 IK edit without KUB_ID, rebuilt Form cleanly.');
}

function runBuildNewFormTest() {
  const env = createGasMockEnv();
  const { sandbox, getConst, formsDb, propsStore } = env;
  const PRRP_CONFIG = getConst('PRRP_CONFIG');
  const PRRP_MASTER_DATA = getConst('PRRP_MASTER_DATA');

  const newFormId = sandbox.buildNewFormFromEmbedded();
  assert(newFormId && newFormId.startsWith('mock_created_form_'), `Expected created form ID, got ${newFormId}`);
  assert.strictEqual(propsStore[PRRP_CONFIG.PROP_FORM_ID_KEY], newFormId);
  assert.notStrictEqual(newFormId, PRRP_CONFIG.FORM_ID);

  const verifyRes = sandbox.verifyFormStructure();
  assert.strictEqual(verifyRes.ok, true);
  assert.strictEqual(verifyRes.totalSections, 65);
  assert.strictEqual(verifyRes.totalKubsVerified, 52);

  const sim = simulateAll52OfficerJourneys(formsDb[newFormId], PRRP_MASTER_DATA);
  assert.strictEqual(sim.pathsVerified, 52);

  // Verify subsequent buildFormFromEmbedded() updates the newly persisted active Form ID
  sandbox.buildFormFromEmbedded();
  const stateAfter = JSON.parse(propsStore[PRRP_CONFIG.PROP_STATE_KEY]);
  assert.strictEqual(stateAfter.formId, newFormId);
  console.log(`PASS [Auto Create New Form]: Created ${newFormId}, persisted active Form ID, verified 65 sections & 52/52 KUB paths.`);
}

function runWebAppEndToEndTest() {
  const env = createGasMockEnv();
  const { sandbox, getConst, formsDb } = env;
  const PRRP_MASTER_DATA = getConst('PRRP_MASTER_DATA');

  // 1) Initial doGet({}) renders WebApp.html dashboard
  const initialOut = sandbox.doGet({});
  assert(initialOut.getContent().includes('Generator Google Form Otomatis'), 'Missing WebApp dashboard HTML');

  const initStatus = sandbox.webAppGetStatus();
  assert.strictEqual(initStatus.hasActiveForm, false);
  assert.strictEqual(initStatus.totalKubs, 52);

  // 2) Start new build and loop batches of 8 KUBs until DONE
  const startRes = sandbox.webAppStartNewBuild('embedded');
  assert.strictEqual(startRes.ok, true);
  assert.strictEqual(startRes.phase, 'KUBS');
  assert(startRes.formId && formsDb[startRes.formId], 'New form not created in WebApp start');

  let stepRes = startRes;
  let batches = 0;
  while (stepRes.phase !== 'DONE') {
    batches++;
    assert(batches < 25, 'Too many WebApp batches');
    stepRes = sandbox.webAppRunNextBatch(8);
  }
  assert.strictEqual(stepRes.kubCursor, 52);
  assert(stepRes.publishedUrl && stepRes.editUrl, 'Missing form URLs on DONE');

  // 3) Verify structure & simulate all 52 KUB officer paths
  const verifyRes = sandbox.webAppVerifyForm();
  assert.strictEqual(verifyRes.ok, true);
  assert.strictEqual(verifyRes.summary.totalSections, 65);
  assert.strictEqual(verifyRes.summary.totalKubsVerified, 52);

  const sim = simulateAll52OfficerJourneys(formsDb[stepRes.formId], PRRP_MASTER_DATA);
  assert.strictEqual(sim.pathsVerified, 52);

  // 4) doGet({ parameter: { action: 'open' } }) redirects to publishedUrl
  const openOut = sandbox.doGet({ parameter: { action: 'open' } });
  assert(openOut.getContent().includes(stepRes.publishedUrl), 'Redirect HTML missing publishedUrl');

  // 5) Create Master Sheet via WebApp RPC
  const sheetRes = sandbox.webAppCreateMasterSheet();
  assert.strictEqual(sheetRes.ok, true);
  assert(sheetRes.spreadsheetUrl.includes(sheetRes.spreadsheetId), 'Invalid spreadsheet URL');
  console.log(`PASS [WebApp End-to-End]: doGet + ${batches} live batches + verify + action=open redirect all pass.`);
}

checkSyntax();
runEmbeddedAndVerificationTests();
runBuildNewFormTest();
runResumableBatchingTest();
runHybridSheetSyncRoundTripTest();
runWebAppEndToEndTest();
console.log('\nALL TESTS PASSED!');
