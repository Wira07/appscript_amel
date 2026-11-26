#!/usr/bin/env python3
"""Generate a clean 6-table relational Excel workbook & CSV files for Google AppSheet
(Offline & Online Backup) from output/master_data_prrp_2026.json.

Outputs inside appsheet/:
  - Database_AppSheet_PRRP_Sumatera_2026.xlsx (6 sheets, inlineStr, styled frozen headers)
  - csv/Master_Wilayah.csv
  - csv/Master_KUB.csv
  - csv/Master_Anggota_IK.csv
  - csv/Master_Mesin.csv
  - csv/Form_Monitoring_KUB.csv
  - csv/Form_Verifikasi_Mesin.csv
"""

from __future__ import annotations

import csv
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
MASTER_JSON = ROOT / "output" / "master_data_prrp_2026.json"
OUT_DIR = ROOT / "appsheet"
CSV_DIR = OUT_DIR / "csv"
XLSX_PATH = OUT_DIR / "Database_AppSheet_PRRP_Sumatera_2026.xlsx"

MONITORING_HEADERS = [
    "Monitoring_ID", "Timestamp", "Nama_Petugas", "Instansi_Petugas", "HP_Petugas",
    "Tanggal_Kunjungan", "Tahap_Kunjungan", "Provinsi", "Kab_Kota", "KUB_ID",
    "Info_Ketua_Kontak", "Info_Lokasi_Kec_Desa", "Info_Industri_Produk", "Info_Ringkasan_KUB",
    "Anggota_IK_Hadir", "Nama_Perwakilan_KUB", "Jabatan_HP_Perwakilan",
    "Kesiapan_Lokasi_Listrik", "Lokasi_GPS", "Foto_Lokasi_KUB", "Foto_BAST_Dokumen",
    "Tanda_Tangan_Perwakilan", "Catatan_Umum", "Konfirmasi_Petugas",
]

VERIFIKASI_MESIN_HEADERS = [
    "Verifikasi_ID", "Monitoring_ID", "KUB_ID", "Mesin_ID",
    "Auto_Merk_Tipe", "Auto_Spesifikasi", "Auto_Jenis_Tipe_Energi",
    "Auto_Volume_Target", "Auto_Wajib_Instalasi_Training",
    "Status_Penerimaan_Spek", "Volume_Diterima_Aktual", "Status_Instalasi_Training",
    "Nomor_Seri_Mesin", "Foto_Mesin", "Catatan_Mesin",
]


def col_letter(idx_1based: int) -> str:
    s = ""
    n = idx_1based
    while n > 0:
        n, rem = divmod(n - 1, 26)
        s = chr(65 + rem) + s
    return s


def build_sheet_xml(rows: list[list[str]]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        "<sheetViews><sheetView tabSelected=\"0\" workbookViewId=\"0\">"
        "<pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/>"
        "</sheetView></sheetViews>",
        "<sheetFormatPr defaultRowHeight=\"18\"/>",
        "<sheetData>",
    ]
    for r_idx, row in enumerate(rows, start=1):
        style_idx = "1" if r_idx == 1 else "2"
        lines.append(f'<row r="{r_idx}">')
        for c_idx, val in enumerate(row, start=1):
            ref = f"{col_letter(c_idx)}{r_idx}"
            text = escape(str(val if val is not None else ""))
            # Preserve whitespace/newlines cleanly in inlineStr
            lines.append(
                f'<c r="{ref}" s="{style_idx}" t="inlineStr"><is><t xml:space="preserve">{text}</t></is></c>'
            )
        lines.append("</row>")
    lines.extend(["</sheetData>", "</worksheet>"])
    return "".join(lines)


def write_xlsx(sheets: list[tuple[str, list[list[str]]]], out_path: Path) -> None:
    content_types = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ]
    wb_sheets = []
    wb_rels = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    ]

    for i, (name, _) in enumerate(sheets, start=1):
        content_types.append(
            f'<Override PartName="/xl/worksheets/sheet{i}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )
        wb_sheets.append(f'<sheet name="{escape(name)}" sheetId="{i}" r:id="rId{i}"/>')
        wb_rels.append(
            f'<Relationship Id="rId{i}" '
            f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            f'Target="worksheets/sheet{i}.xml"/>'
        )

    content_types.append("</Types>")
    wb_rels.append("</Relationships>")

    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        "<sheets>" + "".join(wb_sheets) + "</sheets>"
        "</workbook>"
    )

    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )

    # Style 0 = default, Style 1 = bold white on #0F4C5C text format '@', Style 2 = text format '@'
    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2">'
        '<font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
        '</fonts>'
        '<fills count="3">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF0F4C5C"/><bgColor indexed="64"/></patternFill></fill>'
        '</fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="3">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>'
        '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
        '</cellXfs>'
        '</styleSheet>'
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "".join(content_types))
        zf.writestr("_rels/.rels", root_rels)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", "".join(wb_rels))
        zf.writestr("xl/styles.xml", styles_xml)
        for i, (_, rows) in enumerate(sheets, start=1):
            zf.writestr(f"xl/worksheets/sheet{i}.xml", build_sheet_xml(rows))


def build_tables(master: dict) -> list[tuple[str, list[list[str]]]]:
    wilayah_rows = [[
        "Wilayah_ID", "Provinsi", "Kab_Kota", "Jumlah_KUB", "Jumlah_Anggota_IK", "Jumlah_Jenis_Mesin"
    ]]
    kub_rows = [[
        "KUB_ID", "Provinsi", "Kab_Kota", "Nama_KUB", "Nama_KUB_Excel_IK", "Nama_KUB_Excel_Mesin",
        "Kecamatan", "Desa_Kel", "Ketua_Kontak", "Jenis_Industri", "Jenis_Produk", "KBLI",
        "Jumlah_Anggota", "Jumlah_Laki", "Jumlah_Perempuan", "Jumlah_Jenis_Mesin", "Total_Volume_Label"
    ]]
    ik_rows = [[
        "IK_ID", "KUB_ID", "Provinsi", "Kab_Kota", "Nama_KUB", "No", "Nama", "Nama_IK",
        "Jabatan", "Jenis_Kelamin", "Usia", "Email", "Telepon_HP", "Alamat",
        "Desa_Kel", "Kecamatan", "NIB", "KBLI", "Jenis_Industri", "Jenis_Produk", "Label_Anggota"
    ]]
    mesin_rows = [[
        "Mesin_ID", "KUB_ID", "Provinsi", "Kab_Kota", "Nama_KUB", "No", "Nama_Mesin", "Merk_Tipe",
        "Spesifikasi", "Jenis_Mesin", "Tipe_Mesin", "Sumber_Energi", "Perlu_Instalasi",
        "Perlu_Training", "Volume_Target", "Satuan", "Raw_Row_Count", "Label_Mesin"
    ]]

    for prov in master["provinsi"]:
        for kab in prov["kab_kota"]:
            kab_ik = sum(k["jumlah_anggota"] for k in kab["kubs"])
            kab_mesin = sum(k["jumlah_jenis_mesin"] for k in kab["kubs"])
            wilayah_rows.append([
                f"{prov['id']}__{kab['id']}",
                prov["nama"],
                kab["nama"],
                str(len(kab["kubs"])),
                str(kab_ik),
                str(kab_mesin),
            ])
            for kub in kab["kubs"]:
                kub_rows.append([
                    kub["id"],
                    kub["provinsi"],
                    kub["kab_kota"],
                    kub["nama_kub"],
                    kub["nama_kub_excel_ik"],
                    kub["nama_kub_excel_mesin"],
                    kub["kecamatan"],
                    kub["desa_kel"],
                    kub["ketua"],
                    kub["jenis_industri"],
                    kub["jenis_produk"],
                    kub["kbli"],
                    str(kub["jumlah_anggota"]),
                    str(kub["jumlah_laki"]),
                    str(kub["jumlah_perempuan"]),
                    str(kub["jumlah_jenis_mesin"]),
                    kub["total_volume_label"],
                ])
                for idx, m in enumerate(kub["anggota"], start=1):
                    ik_id = f"{kub['id']}__ik_{idx:02d}"
                    label_ik = f"{idx}. {m['nama']} — {m['nama_ik']} ({m['jabatan']})"
                    ik_rows.append([
                        ik_id,
                        kub["id"],
                        kub["provinsi"],
                        kub["kab_kota"],
                        kub["nama_kub"],
                        str(m["no"]),
                        m["nama"],
                        m["nama_ik"],
                        m["jabatan"],
                        m["jenis_kelamin"],
                        str(m["usia"]),
                        m["email"],
                        m["telepon_hp"],
                        m["alamat"],
                        m["desa_kel"],
                        m["kecamatan"],
                        m["nib"],
                        m["kbli"],
                        m["jenis_industri"],
                        m["jenis_produk"],
                        label_ik,
                    ])
                for idx, eq in enumerate(kub["mesin"], start=1):
                    mesin_id = f"{kub['id']}__m_{idx:02d}"
                    vol_txt = f"{eq['volume']} {eq['satuan']}" if eq["volume"] != "-" else "Cek fisik"
                    merk_txt = f" ({eq['merk_tipe']})" if eq["merk_tipe"] != "-" else ""
                    label_mesin = f"{idx}. {eq['nama_mesin']}{merk_txt} [{vol_txt}]"
                    mesin_rows.append([
                        mesin_id,
                        kub["id"],
                        kub["provinsi"],
                        kub["kab_kota"],
                        kub["nama_kub"],
                        str(eq["no"]),
                        eq["nama_mesin"],
                        eq["merk_tipe"],
                        eq["spesifikasi"],
                        eq["jenis_mesin"],
                        eq["tipe_mesin"],
                        eq["sumber_energi"],
                        eq["perlu_instalasi"],
                        eq["perlu_training"],
                        str(eq["volume"]),
                        eq["satuan"],
                        str(eq.get("raw_row_count", 1)),
                        label_mesin,
                    ])

    return [
        ("Master_Wilayah", wilayah_rows),
        ("Master_KUB", kub_rows),
        ("Master_Anggota_IK", ik_rows),
        ("Master_Mesin", mesin_rows),
        ("Form_Monitoring_KUB", [MONITORING_HEADERS]),
        ("Form_Verifikasi_Mesin", [VERIFIKASI_MESIN_HEADERS]),
    ]


def verify_generated_xlsx(xlsx_path: Path, expected_counts: dict[str, int]) -> None:
    ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(xlsx_path, "r") as zf:
        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        sheet_names = [s.attrib["name"] for s in wb.findall(".//a:sheet", ns)]
        assert sheet_names == list(expected_counts.keys()), f"Sheet names mismatch: {sheet_names}"
        for idx, name in enumerate(sheet_names, start=1):
            sh_xml = ET.fromstring(zf.read(f"xl/worksheets/sheet{idx}.xml"))
            rows = sh_xml.findall(".//a:sheetData/a:row", ns)
            assert len(rows) == expected_counts[name], f"{name}: expected {expected_counts[name]} rows, got {len(rows)}"
            if idx <= 4:
                keys = []
                for r in rows[1:]:
                    first_cell = r.find("a:c/a:is/a:t", ns)
                    assert first_cell is not None and first_cell.text, f"Blank primary key in {name}"
                    keys.append(first_cell.text)
                assert len(keys) == len(set(keys)), f"Duplicate primary keys in {name}"


def main() -> None:
    master = json.loads(MASTER_JSON.read_text(encoding="utf-8"))
    tables = build_tables(master)

    CSV_DIR.mkdir(parents=True, exist_ok=True)
    for name, rows in tables:
        with (CSV_DIR / f"{name}.csv").open("w", encoding="utf-8-sig", newline="") as f:
            csv.writer(f).writerows(rows)

    write_xlsx(tables, XLSX_PATH)
    expected = {name: len(rows) for name, rows in tables}
    verify_generated_xlsx(XLSX_PATH, expected)
    print(
        f"PASS [AppSheet DB]: Generated {XLSX_PATH.name} & 6 CSVs -> "
        + ", ".join(f"{k}={v-1} data rows" for k, v in expected.items())
    )


if __name__ == "__main__":
    main()
