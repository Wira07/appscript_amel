/**
 * Handler Web App (doGet + RPC client-server) untuk Generator Google Form PRRP Sumatera TA 2026.
 * Memungkinkan pembuatan & pembukaan Google Form langsung dari link /exec tanpa timeout.
 */

/**
 * Entry point HTTP GET Web App Google Apps Script.
 * @param {GoogleAppsScript.Events.DoGet} e
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action ? String(e.parameter.action) : '';
  if (action === 'open') {
    const status = webAppGetStatus();
    if (status.hasActiveForm && status.phase === 'DONE' && status.publishedUrl) {
      return buildRedirectHtml_(status.publishedUrl, status.editUrl);
    }
  }
  return HtmlService.createTemplateFromFile('WebAppUI')
    .evaluate()
    .setTitle('Generator Form Otomatis PRRP Sumatera TA 2026')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Mengambil status build terakhir, URL Form aktif (bila ada), serta statistik dataset.
 * @return {Object}
 */
function webAppGetStatus() {
  const state = loadBuildState_();
  const props = PropertiesService.getScriptProperties();
  const activeFormId = (state && state.formId) || props.getProperty(PRRP_CONFIG.PROP_FORM_ID_KEY) || '';
  const sheetId = (state && state.spreadsheetId) ||
    PRRP_CONFIG.SPREADSHEET_ID ||
    props.getProperty(PRRP_CONFIG.PROP_SHEET_ID_KEY) ||
    '';
  const appSheetId = props.getProperty(PRRP_CONFIG.PROP_APPSHEET_ID_KEY) || '';

  let formInfo = { hasActiveForm: false, formId: '', editUrl: '', publishedUrl: '', totalItems: 0, formTitle: '' };
  if (activeFormId) {
    try {
      const form = FormApp.openById(activeFormId);
      formInfo = {
        hasActiveForm: true,
        formId: form.getId(),
        editUrl: form.getEditUrl(),
        publishedUrl: form.getPublishedUrl(),
        totalItems: form.getItems().length,
        formTitle: form.getTitle()
      };
    } catch (err) {
      formInfo.error = String(err && err.message ? err.message : err);
    }
  }

  let spreadsheetUrl = '';
  if (sheetId) {
    spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/' + sheetId + '/edit';
  }
  const appSheetUrl = appSheetId ? ('https://docs.google.com/spreadsheets/d/' + appSheetId + '/edit') : '';

  const totalKubs = flattenKubs_(PRRP_MASTER_DATA).length;
  return {
    hasActiveForm: formInfo.hasActiveForm,
    phase: state && state.phase ? state.phase : 'IDLE',
    mode: state && state.mode ? state.mode : 'embedded',
    kubCursor: state && typeof state.kubCursor === 'number' ? state.kubCursor : 0,
    totalKubs: totalKubs,
    formId: formInfo.formId,
    editUrl: formInfo.editUrl,
    publishedUrl: formInfo.publishedUrl,
    totalItems: formInfo.totalItems,
    formTitle: formInfo.formTitle,
    spreadsheetId: sheetId,
    spreadsheetUrl: spreadsheetUrl,
    appSheetId: appSheetId,
    appSheetUrl: appSheetUrl,
    completedAt: state && state.completedAt ? state.completedAt : '',
    counts: PRRP_MASTER_DATA.metadata.counts
  };
}

/**
 * Membuat Google Form baru via FormApp.create(), membangun Section 1 + 3 Provinsi + 8 Kab/Kota,
 * lalu menandai fase KUBS agar dilanjutkan bertahap oleh webAppRunNextBatch().
 * @param {'embedded'|'spreadsheet'=} mode
 * @return {Object}
 */
function webAppStartNewBuild(mode) {
  clearContinueTriggers_();
  const buildMode = mode === 'spreadsheet' ? 'spreadsheet' : 'embedded';
  const resolvedSheetId = buildMode === 'spreadsheet' ? resolveSpreadsheetId_('') : '';
  const masterData = loadMasterData_(buildMode, resolvedSheetId);
  validateMasterData_(masterData);

  const newForm = FormApp.create(PRRP_CONFIG.FORM_TITLE);
  const newFormId = newForm.getId();
  PropertiesService.getScriptProperties().setProperty(PRRP_CONFIG.PROP_FORM_ID_KEY, newFormId);

  const state = {
    phase: 'INIT',
    mode: buildMode,
    formId: newFormId,
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

  buildBaseSections_(newForm, masterData, state);
  state.phase = 'KUBS';
  saveBuildState_(state);

  const totalKubs = flattenKubs_(masterData).length;
  return {
    ok: true,
    phase: state.phase,
    kubCursor: 0,
    totalKubs: totalKubs,
    formId: newFormId,
    editUrl: newForm.getEditUrl(),
    publishedUrl: newForm.getPublishedUrl()
  };
}

/**
 * Mengeksekusi 1 batch pembuatan Section KUB (default 8 KUB) atau fase FINALIZE.
 * @param {number=} batchSize
 * @return {Object}
 */
function webAppRunNextBatch(batchSize) {
  const startMs = Date.now();
  const state = loadBuildState_();
  if (!state || !state.formId) {
    throw new Error('Tidak ada sesi pembuatan Form aktif. Klik "Buat Google Form Otomatis" untuk memulai.');
  }

  const masterData = loadMasterData_(state.mode || 'embedded', state.spreadsheetId || '');
  const form = FormApp.openById(state.formId);
  const flatKubs = flattenKubs_(masterData);
  const limit = Math.max(1, Number(batchSize || 8));

  if (state.phase === 'DONE') {
    return {
      ok: true,
      phase: 'DONE',
      kubCursor: flatKubs.length,
      totalKubs: flatKubs.length,
      totalItems: form.getItems().length,
      formId: form.getId(),
      editUrl: form.getEditUrl(),
      publishedUrl: form.getPublishedUrl()
    };
  }

  if (state.phase === 'KUBS') {
    let processed = 0;
    while (state.kubCursor < flatKubs.length && processed < limit) {
      const entry = flatKubs[state.kubCursor];
      buildSingleKubSection_(form, entry.kub, state);
      state.kubCursor++;
      processed++;
      if (isTimeExceeded_(startMs)) {
        break;
      }
    }
    if (state.kubCursor >= flatKubs.length) {
      state.phase = 'FINALIZE';
    }
    saveBuildState_(state);
    return {
      ok: true,
      phase: state.phase,
      kubCursor: state.kubCursor,
      totalKubs: flatKubs.length,
      formId: form.getId(),
      editUrl: form.getEditUrl(),
      publishedUrl: form.getPublishedUrl()
    };
  }

  if (state.phase === 'FINALIZE') {
    finalizeForm_(form, masterData, state);
    state.phase = 'DONE';
    state.completedAt = new Date().toISOString();
    saveBuildState_(state);
    clearContinueTriggers_();
    return {
      ok: true,
      phase: 'DONE',
      kubCursor: flatKubs.length,
      totalKubs: flatKubs.length,
      totalItems: form.getItems().length,
      formId: form.getId(),
      editUrl: form.getEditUrl(),
      publishedUrl: form.getPublishedUrl()
    };
  }

  throw new Error('Status fase tidak dikenali di WebApp: ' + state.phase);
}

/**
 * Mengaudit struktur Google Form aktif via WebApp.
 * @return {Object}
 */
function webAppVerifyForm() {
  try {
    const summary = verifyFormStructure();
    return { ok: true, summary: summary };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/**
 * Membuat Google Spreadsheet Master (Master_IK_KUB & Master_Spek_Mesin) dari WebApp.
 * @return {Object}
 */
function webAppCreateMasterSheet() {
  const ssId = createMasterSpreadsheetTemplate();
  return {
    ok: true,
    spreadsheetId: ssId,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + ssId + '/edit'
  };
}

/**
 * Membuat Google Spreadsheet relasional 6 tab siap pakai untuk Google AppSheet (Offline/Online).
 * @return {Object}
 */
function webAppCreateAppSheetDb() {
  const ssId = createAppSheetDatabase();
  return {
    ok: true,
    spreadsheetId: ssId,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + ssId + '/edit'
  };
}

function buildRedirectHtml_(publishedUrl, editUrl) {
  const safePub = escapeHtmlAttr_(publishedUrl);
  const safeEdit = escapeHtmlAttr_(editUrl || publishedUrl);
  const jsUrl = JSON.stringify(String(publishedUrl));
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<title>Membuka Google Form PRRP Sumatera TA 2026...</title>' +
    '<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f4f7f9;color:#112a36;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;}' +
    '.card{background:#fff;border-radius:14px;padding:28px;max-width:520px;width:100%;box-shadow:0 10px 30px rgba(15,76,92,.12);text-align:center;}' +
    'a.btn{display:inline-block;margin:8px 6px;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;background:#0f4c5c;color:#fff;}' +
    'a.btn.sec{background:#e7eff2;color:#0f4c5c;}</style></head><body><div class="card">' +
    '<h2>Membuka Google Form PRRP Sumatera TA 2026</h2>' +
    '<p>Jika halaman tidak berpindah otomatis, klik tombol di bawah:</p>' +
    '<a class="btn" href="' + safePub + '" target="_top" rel="noopener">Buka Formulir (Isi / Preview)</a>' +
    '<a class="btn sec" href="' + safeEdit + '" target="_top" rel="noopener">Buka Editor Form</a>' +
    '</div><script>try{window.top.location.href=' + jsUrl + ';}catch(e){window.location.href=' + jsUrl + ';}</script>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('Membuka Google Form PRRP Sumatera TA 2026')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapeHtmlAttr_(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
