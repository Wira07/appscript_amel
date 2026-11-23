#!/usr/bin/env python3
"""ETL and audit script for PRRP Sumatera TA 2026 Excel datasets.

Reads:
  - Database Spek Mesin.xlsx
  - IK (Dit LMEA) Penerima PRRP Sumatera TA 2026.xlsx

Produces:
  - output/master_data_prrp_2026.json
  - output/template_sheet_ik_kub.csv
  - output/template_sheet_spek_mesin.csv
  - output/audit_report.md
  - apps-script/DataPayload.js
"""

from __future__ import annotations

import csv
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILE_MESIN = ROOT / "Database Spek Mesin.xlsx"
FILE_IK = ROOT / "IK (Dit LMEA) Penerima PRRP Sumatera TA 2026.xlsx"
OUT_DIR = ROOT / "output"
GAS_DIR = ROOT / "apps-script"

SHEET_SPECS = [
    # (provinsi, kab_kota, file1_sheet, file2_sheet, swap_ik_nama)
    ("Aceh", "Aceh Singkil", "Aceh Singkil", "Aceh Singkil", False),
    ("Aceh", "Kota Subulussalam", "Subulussalam", "Subulussalam", False),
    ("Aceh", "Aceh Selatan", "Aceh Selatan", "Aceh Selatan", False),
    ("Aceh", "Nagan Raya", "Nagan Raya", "Nagan Raya", False),
    ("Aceh", "Aceh Barat", "Aceh Barat", "Aceh Barat", False),
    ("Sumatera Utara", "Batu Bara", "Batubara", "Batu Bara", False),
    ("Sumatera Utara", "Deli Serdang", "Deli Serdang", "Deli Serdang", False),
    ("Sumatera Barat", "Kabupaten Agam", "Agam", "Kab. Agam", True),
]

# Explicit cross-map: (kab_kota, lower(file1_kub_raw)) -> (file2_kub_exact, display_name)
KUB_CROSSMAP: dict[tuple[str, str], tuple[str, str]] = {
    # Aceh Singkil
    ("Aceh Singkil", "kub surya terali - bengkel las"): ("Surya Terali", "KUB Surya Terali — Bengkel Las"),
    ("Aceh Singkil", "kub bakeri taboh - roti & kue"): ("Bakeri Taboh", "KUB Bakeri Taboh — Roti & Kue"),
    ("Aceh Singkil", "kub budidaya madu trigona - olahan madu"): ("Budidaya Madu Trigona", "KUB Budidaya Madu Trigona — Olahan Madu"),
    ("Aceh Singkil", "kub taylor mende - konveksi/jahit pakaian"): ("Taylor Mende", "KUB Taylor Mende — Konveksi/Jahit Pakaian"),
    ("Aceh Singkil", "kub jajanan panganan - makanan ringan"): ("Jajanan Pangan", "KUB Jajanan Pangan — Makanan Ringan"),
    # Kota Subulussalam
    ("Kota Subulussalam", "kub berkah jaya taylor - konveksi/jahit pakaian"): ("Berkah Jaya Taylor", "KUB Berkah Jaya Taylor — Konveksi/Jahit Pakaian"),
    ("Kota Subulussalam", "kub suka maju bersama - bengkel sepeda motor"): ("Suka Maju Bersama", "KUB Suka Maju Bersama — Bengkel Sepeda Motor"),
    ("Kota Subulussalam", "kub karya otomotif muara batu-batu - bengkel sepeda motor"): ("Karya Otomotif Muara Batu-Batu", "KUB Karya Otomotif Muara Batu-Batu — Bengkel Sepeda Motor"),
    ("Kota Subulussalam", "kub rizki bongki - pembuatan kapal/perahu"): ("Rizky Bongki Mandiri", "KUB Rizky Bongki Mandiri — Pembuatan Kapal/Perahu"),
    # Aceh Selatan
    ("Aceh Selatan", "sawang sepakat"): ("SAWANG SEPAKAT", "KUB Sawang Sepakat"),
    ("Aceh Selatan", "giat bersama"): ("GIAT BERSAMA", "KUB Giat Bersama"),
    ("Aceh Selatan", "maju bersama"): ("MAJU BERSAMA", "KUB Maju Bersama"),
    ("Aceh Selatan", "jasa kawan"): ("JASA KAWAN", "KUB Jasa Kawan"),
    ("Aceh Selatan", "seuneubok bestari"): ("SEUNEUBOK BESTARI", "KUB Seuneubok Bestari"),
    ("Aceh Selatan", "tangga seribu berkarya"): ("TANGGA SERIBU BERKARYA", "KUB Tangga Seribu Berkarya"),
    ("Aceh Selatan", "pesona bidari"): ("PESONA BIDARI", "KUB Pesona Bidari"),
    ("Aceh Selatan", "bayu srikandi kreatif"): ("BAYU SRIKANDI KREATIF", "KUB Bayu Srikandi Kreatif"),
    ("Aceh Selatan", "bungong pusaka"): ("BUNGONG PUSAKA", "KUB Bungong Pusaka"),
    ("Aceh Selatan", "bungoeng canden leuser"): ("BUNGOENG CANDEN LEUSER", "KUB Bungoeng Canden Leuser"),
    # Nagan Raya (assigned by NO <= 26 vs NO >= 27)
    ("Nagan Raya", "kub bangkit bersama"): ("KUB Bangkit Bersama", "KUB Bangkit Bersama"),
    ("Nagan Raya", "kub jaya makmur"): ("KUB Jaya Makmur", "KUB Jaya Makmur"),
    # Aceh Barat
    ("Aceh Barat", "kub teuku umar furnitur - furnitur kayu"): ("KUB Teuku Umar Furnitur", "KUB Teuku Umar Furnitur — Furnitur Kayu"),
    ("Aceh Barat", "kub pangan mandiri - penggilingan padi"): ("KUB Pangan Mandiri", "KUB Pangan Mandiri — Penggilingan Padi"),
    ("Aceh Barat", "kub kue tradisi seuramoe - roti dan kue"): ("KUB Kue Tradisi Seuramoe", "KUB Kue Tradisi Seuramoe — Roti dan Kue"),
    ("Aceh Barat", "kub meulaboh bata jaya - batu bata"): ("KUB Meulaboh Bata Jaya", "KUB Meulaboh Bata Jaya — Batu Bata"),
    ("Aceh Barat", "kub sentra tahu tempe - tahu dan tempe"): ("KUB Sentra Tahu Tempe Aceh Barat", "KUB Sentra Tahu Tempe Aceh Barat — Tahu dan Tempe"),
    ("Aceh Barat", "kub seuramoe kopi - pengolahan kopi"): ("KUB Seuramoe Kopi Aceh Barat", "KUB Seuramoe Kopi Aceh Barat — Pengolahan Kopi"),
    ("Aceh Barat", "kub rencong logam - pandai besi (alat potong dan perkakas tangan)"): ("KUB Rencong Logam Aceh Barat", "KUB Rencong Logam Aceh Barat — Pandai Besi"),
    ("Aceh Barat", "kub usaha bengkel bersama - reparasi mobil, motor, dan alat rumah tangga"): ("KUB Usaha Bengkel Bersama", "KUB Usaha Bengkel Bersama — Reparasi Mobil/Motor/Alat RT"),
    # Batu Bara
    ("Batu Bara", "gula merah rayhan"): ("KUB Gula Merah Rayhan", "KUB Gula Merah Rayhan"),
    ("Batu Bara", "tenun padang genting"): ("KUB Tenun Padang Genting", "KUB Tenun Padang Genting"),
    ("Batu Bara", "kub maguro (budidaya perikanan)"): ("KUB Maguro (Budidaya Perikanan)", "KUB Maguro (Budidaya Perikanan)"),
    # Deli Serdang
    ("Deli Serdang", "paya geli berkah mandiri"): ("KUB Paya Geli Berkah Mandiri", "KUB Paya Geli Berkah Mandiri"),
    ("Deli Serdang", "tanjung morawa a"): ("KUB Tanjung Morawa A", "KUB Tanjung Morawa A"),
    ("Deli Serdang", "srikandi mandiri"): ("KUB Srikandi Mandiri", "KUB Srikandi Mandiri"),
    ("Deli Serdang", "dalu sepuluh b maju berkah"): ("KUB Dalu Sepuluh B Maju Berkah", "KUB Dalu Sepuluh B Maju Berkah"),
    ("Deli Serdang", "kriya deli"): ("KUB Kriya Deli", "KUB Kriya Deli"),
    ("Deli Serdang", "maju bersama"): ("KUB Maju Bersama", "KUB Maju Bersama"),
    # Kabupaten Agam
    ("Kabupaten Agam", "kub evco cake - pfbb"): ("Ekvo cake and bakery", "KUB Ekvo Cake & Bakery (Evco Cake - PFBB)"),
    ("Kabupaten Agam", "kub rh teknik"): ("RH Teknik", "KUB RH Teknik"),
    ("Kabupaten Agam", "kub maju jaya"): ("Penjahit Maju Jaya", "KUB Penjahit Maju Jaya"),
    ("Kabupaten Agam", "kub kampuang malayu b"): ("Kampuang Malayu Bersatu", "KUB Kampuang Malayu Bersatu"),
    ("Kabupaten Agam", "kub nak tareh"): ("Penjahit Nak Tareh", "KUB Penjahit Nak Tareh"),
    ("Kabupaten Agam", "kub umi berkarya"): ("Ummi Berkarya", "KUB Ummi Berkarya"),
    ("Kabupaten Agam", "kub cahaya collection"): ("Cahaya Collection", "KUB Cahaya Collection"),
    ("Kabupaten Agam", "kub belok ikan bersahaja"): ("Belok Ikan Bersahaja", "KUB Belok Ikan Bersahaja"),
    ("Kabupaten Agam", "kub batu asahan sepakat"): ("Batu Asahan Sepakat", "KUB Batu Asahan Sepakat"),
    ("Kabupaten Agam", "kub kampung lalang saiyo"): ("Kampung Lalang Saiyo", "KUB Kampung Lalang Saiyo"),
    ("Kabupaten Agam", "kub kampung jampita"): ("Kampung Jampita Indah", "KUB Kampung Jampita Indah"),
    ("Kabupaten Agam", "kub jembatan subarang"): ("Jembatan Subarang Saiyo", "KUB Jembatan Subarang Saiyo"),
    ("Kabupaten Agam", "kub lereng maju bersama"): ("Lereng Maju Bersama", "KUB Lereng Maju Bersama"),
    ("Kabupaten Agam", "kub ngalau indah sejahtera"): ("Ngalau Indah Sejahtera", "KUB Ngalau Indah Sejahtera"),
}

AGGREGATED_SHEETS = {"Batubara", "Deli Serdang"}


def col_idx(cell_ref: str) -> int:
    match = re.match(r"([A-Z]+)", cell_ref)
    idx = 0
    for ch in (match.group(1) if match else "A"):
        idx = idx * 26 + (ord(ch) - 64)
    return idx


def parse_xlsx(path: Path) -> dict[str, list[tuple[int, dict[int, str]]]]:
    """Read all sheets of an XLSX file into {sheet_name: [(row_num, {col_idx: value})]}."""
    ns = {
        "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }
    sheets: dict[str, list[tuple[int, dict[int, str]]]] = {}
    with zipfile.ZipFile(path, "r") as zf:
        sst: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            sst_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in sst_root.findall("a:si", ns):
                sst.append("".join(t.text or "" for t in si.findall(".//a:t", ns)))
        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rel_map = {r.attrib["Id"]: r.attrib["Target"] for r in rels}
        for sh in wb.findall(".//a:sheet", ns):
            name = sh.attrib["name"]
            rid = sh.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = rel_map[rid]
            if not target.startswith("xl/"):
                target = "xl/" + target.lstrip("/")
            sh_xml = ET.fromstring(zf.read(target))
            rows: list[tuple[int, dict[int, str]]] = []
            for row in sh_xml.findall(".//a:sheetData/a:row", ns):
                rnum = int(row.attrib.get("r", 0))
                cells: dict[int, str] = {}
                for c in row.findall("a:c", ns):
                    ci = col_idx(c.attrib["r"])
                    ctype = c.attrib.get("t", "")
                    v_el = c.find("a:v", ns)
                    is_el = c.find("a:is", ns)
                    val = None
                    if ctype == "s" and v_el is not None:
                        val = sst[int(v_el.text)]
                    elif ctype == "inlineStr" and is_el is not None:
                        val = "".join(x.text or "" for x in is_el.findall(".//a:t", ns))
                    elif v_el is not None:
                        val = v_el.text
                    if val is not None and str(val).strip() != "":
                        cells[ci] = str(val).strip()
                if cells:
                    rows.append((rnum, cells))
            sheets[name] = rows
    return sheets


def collapse_ws(val: str) -> str:
    return re.sub(r"\s+", " ", val or "").strip()


def clean_multiline(val: str) -> str:
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in (val or "").splitlines()]
    return "\n".join(ln for ln in lines if ln)


def clean_int_str(val: str) -> str:
    s = collapse_ws(val)
    if re.fullmatch(r"\d+\.0+", s):
        return s.split(".")[0]
    return s


def normalize_phone(val: str, stats: dict[str, int]) -> str:
    s = collapse_ws(val)
    if not s:
        return "-"
    digits = re.sub(r"\D", "", s)
    if digits.startswith("8") and 9 <= len(digits) <= 13:
        stats["phone_prepended_0"] += 1
        return "0" + s
    return s


def normalize_yes_no(val: str, stats: dict[str, int]) -> str:
    s = collapse_ws(val)
    if not s:
        return "-"
    if s.lower() == "iya":
        stats["iya_to_ya"] += 1
        return "Ya"
    if s.lower() == "ya":
        return "Ya"
    if s.lower() == "tidak":
        return "Tidak"
    return s


def normalize_energi(val: str, stats: dict[str, int]) -> str:
    s = collapse_ws(val)
    if not s:
        return "-"
    if s.lower() == "lsitrik":
        stats["typo_lsitrik_fixed"] += 1
        return "Listrik"
    return s


def normalize_merk(val: str, stats: dict[str, int]) -> str:
    s = clean_multiline(val)
    if not s:
        return "-"
    if "Produksi Lokasl" in s:
        stats["typo_lokasl_fixed"] += 1
        s = s.replace("Produksi Lokasl", "Produksi Lokal")
    return s


def normalize_volume_satuan(vol_raw: str, sat_raw: str, stats: dict[str, int]) -> tuple[str, str]:
    v = collapse_ws(vol_raw)
    sat = collapse_ws(sat_raw)
    if not v and not sat:
        return "-", "-"
    # Handle combined string like "2 Unit" or "1 Set" (Agam)
    m = re.fullmatch(r"(\d+(?:[.,]\d+)?)\s*([A-Za-z]+)", v)
    if m and not sat:
        stats["split_volume_satuan"] += 1
        num_str = clean_int_str(m.group(1).replace(",", "."))
        return num_str, m.group(2).capitalize()
    v_clean = clean_int_str(v) if v else "-"
    if v_clean != "-" and not sat:
        stats["default_satuan_unit"] += 1
        sat = "Unit"
    elif not sat:
        sat = "-"
    return v_clean, sat


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return s


def parse_num(vol_str: str) -> float | None:
    try:
        return float(vol_str.replace(",", "."))
    except Exception:
        return None


def fmt_num(val: float) -> str:
    if abs(val - round(val)) < 1e-9:
        return str(int(round(val)))
    return str(round(val, 2))


def main() -> None:
    wb_mesin = parse_xlsx(FILE_MESIN)
    wb_ik = parse_xlsx(FILE_IK)

    stats: dict[str, int] = defaultdict(int)
    audit_notes: list[str] = []

    provinsi_map: dict[str, list[dict]] = defaultdict(list)
    all_ik_flat: list[dict] = []
    all_mesin_flat: list[dict] = []
    kub_audit_rows: list[dict] = []

    total_raw_machines = 0
    total_unique_machines = 0
    total_ik_members = 0
    total_kubs = 0

    for prov, kab, sh1_name, sh2_name, swap_ik_nama in SHEET_SPECS:
        if sh1_name not in wb_mesin:
            raise KeyError(f"Missing sheet '{sh1_name}' in {FILE_MESIN.name}")
        if sh2_name not in wb_ik:
            raise KeyError(f"Missing sheet '{sh2_name}' in {FILE_IK.name}")

        # 1) Parse File 2 (IK members) for this Kab/Kota
        members_by_f2_kub: dict[str, list[dict]] = defaultdict(list)
        last_f2_kub = ""
        for rnum, cells in wb_ik[sh2_name][1:]:
            if 2 not in cells and 3 not in cells:
                stats["skipped_blank_ik_rows"] += 1
                continue
            raw_kub = collapse_ws(cells.get(4, ""))
            if raw_kub:
                last_f2_kub = raw_kub
            elif last_f2_kub:
                stats["forward_filled_ik_kub"] += 1
            f2_kub = last_f2_kub
            if not f2_kub:
                raise ValueError(f"Empty KUB on row {rnum} of {sh2_name}")

            col2 = collapse_ws(cells.get(2, ""))
            col3 = collapse_ws(cells.get(3, ""))
            if swap_ik_nama:
                nama_orang = col2 or "-"
                nama_ik = col3 or "-"
                stats["unswapped_agam_rows"] += 1
            else:
                nama_ik = col2 or "-"
                nama_orang = col3 or "-"

            raw_prov = collapse_ws(cells.get(14, "")) or prov
            if raw_prov.upper() == "NAD":
                stats["nad_to_aceh"] += 1

            member = {
                "no": clean_int_str(cells.get(1, "")) or str(len(members_by_f2_kub[f2_kub]) + 1),
                "nama": nama_orang,
                "nama_ik": nama_ik,
                "nama_kub_excel_ik": f2_kub,
                "jabatan": collapse_ws(cells.get(5, "")) or "-",
                "jenis_kelamin": collapse_ws(cells.get(6, "")) or "-",
                "usia": clean_int_str(cells.get(7, "")) or "-",
                "email": collapse_ws(cells.get(8, "")) or "-",
                "telepon_hp": normalize_phone(cells.get(9, ""), stats),
                "alamat": collapse_ws(cells.get(10, "")) or "-",
                "desa_kel": collapse_ws(cells.get(11, "")) or "-",
                "kecamatan": collapse_ws(cells.get(12, "")) or "-",
                "kab_kota": kab,
                "provinsi": prov,
                "nib": clean_int_str(cells.get(15, "")) or "-",
                "kbli": clean_multiline(cells.get(16, "")) or "-",
                "jenis_industri": collapse_ws(cells.get(17, "")) or "-",
                "jenis_produk": collapse_ws(cells.get(18, "")) or "-",
            }
            members_by_f2_kub[f2_kub].append(member)
            total_ik_members += 1

        # 2) Parse File 1 (Machines) for this Kab/Kota
        raw_machines_by_f1_kub: dict[str, list[dict]] = defaultdict(list)
        f1_kub_order: list[str] = []
        last_f1_kub = ""
        for rnum, cells in wb_mesin[sh1_name][1:]:
            if 3 not in cells:
                continue
            total_raw_machines += 1
            if sh1_name == "Nagan Raya":
                no_val = int(float(cells.get(1, "0")))
                f1_kub = "KUB Bangkit Bersama" if no_val <= 26 else "KUB Jaya Makmur"
                stats["nagan_raya_mapped_machines"] += 1
            else:
                raw_kub = collapse_ws(cells.get(2, ""))
                if raw_kub:
                    last_f1_kub = raw_kub
                elif last_f1_kub:
                    stats["forward_filled_mesin_kub"] += 1
                f1_kub = last_f1_kub

            if not f1_kub:
                raise ValueError(f"Empty KUB on row {rnum} of {sh1_name}")
            if f1_kub not in f1_kub_order:
                f1_kub_order.append(f1_kub)

            vol_str, sat_str = normalize_volume_satuan(cells.get(11, ""), cells.get(12, ""), stats)
            nama_mesin = collapse_ws(cells.get(3, ""))
            if "Mesin | " in nama_mesin:
                nama_mesin = nama_mesin.replace("Mesin | ", "Mesin ")

            raw_machines_by_f1_kub[f1_kub].append(
                {
                    "no": clean_int_str(cells.get(1, "")) or str(len(raw_machines_by_f1_kub[f1_kub]) + 1),
                    "nama_kub_excel_mesin": f1_kub,
                    "nama_mesin": nama_mesin,
                    "merk_tipe": normalize_merk(cells.get(4, ""), stats),
                    "spesifikasi": clean_multiline(cells.get(5, "")) or "-",
                    "jenis_mesin": collapse_ws(cells.get(6, "")) or "-",
                    "tipe_mesin": collapse_ws(cells.get(7, "")) or "-",
                    "sumber_energi": normalize_energi(cells.get(8, ""), stats),
                    "perlu_instalasi": normalize_yes_no(cells.get(9, ""), stats),
                    "perlu_training": normalize_yes_no(cells.get(10, ""), stats),
                    "volume": vol_str,
                    "satuan": sat_str,
                }
            )

        # 3) Cross-map File 1 KUBs to File 2 KUBs and aggregate identical rows where configured
        kubs_list: list[dict] = []
        matched_f2_kubs: set[str] = set()
        seen_display_names: set[str] = set()

        for f1_kub in f1_kub_order:
            key = (kab, f1_kub.lower())
            if key not in KUB_CROSSMAP:
                raise KeyError(f"Unmapped File 1 KUB: {key}")
            f2_kub, display_name = KUB_CROSSMAP[key]
            if f2_kub not in members_by_f2_kub:
                raise KeyError(f"Missing File 2 KUB '{f2_kub}' for Kab '{kab}'")
            if display_name in seen_display_names:
                raise ValueError(f"Duplicate display name '{display_name}' in '{kab}'")
            seen_display_names.add(display_name)
            matched_f2_kubs.add(f2_kub)

            raw_items = raw_machines_by_f1_kub[f1_kub]
            if sh1_name in AGGREGATED_SHEETS:
                grouped: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
                group_order: list[tuple[str, str, str]] = []
                for item in raw_items:
                    gkey = (
                        item["nama_mesin"].lower(),
                        item["merk_tipe"].lower(),
                        collapse_ws(item["spesifikasi"]).lower(),
                    )
                    if gkey not in grouped:
                        group_order.append(gkey)
                    grouped[gkey].append(item)
                final_items: list[dict] = []
                for idx, gkey in enumerate(group_order, start=1):
                    bucket = grouped[gkey]
                    base = dict(bucket[0])
                    base["no"] = str(idx)
                    base["raw_row_count"] = len(bucket)
                    if len(bucket) > 1:
                        nums = [parse_num(x["volume"]) for x in bucket]
                        if all(n is not None for n in nums):
                            base["volume"] = fmt_num(sum(n for n in nums if n is not None))
                        stats["aggregated_duplicate_groups"] += 1
                        stats["aggregated_rows_merged"] += len(bucket) - 1
                    final_items.append(base)
            else:
                final_items = []
                for idx, item in enumerate(raw_items, start=1):
                    rec = dict(item)
                    rec["no"] = str(idx)
                    rec["raw_row_count"] = 1
                    final_items.append(rec)

            total_unique_machines += len(final_items)
            members = members_by_f2_kub[f2_kub]

            # Summarize KUB profile
            ketua_entries = [
                f"{m['nama']} ({m['nama_ik']}) — HP: {m['telepon_hp']}"
                for m in members
                if "ketua" in m["jabatan"].lower() and "wakil" not in m["jabatan"].lower()
            ]
            kec_list = sorted({m["kecamatan"] for m in members if m["kecamatan"] != "-"})
            desa_list = sorted({m["desa_kel"] for m in members if m["desa_kel"] != "-"})
            industri_list = sorted({m["jenis_industri"] for m in members if m["jenis_industri"] != "-"})
            produk_list = sorted({m["jenis_produk"] for m in members if m["jenis_produk"] != "-"})
            kbli_list = sorted({collapse_ws(m["kbli"]) for m in members if m["kbli"] != "-"})

            count_l = sum(1 for m in members if "laki" in m["jenis_kelamin"].lower())
            count_p = sum(1 for m in members if "perempuan" in m["jenis_kelamin"].lower())

            vol_by_satuan: dict[str, float] = defaultdict(float)
            has_numeric_vol = False
            for m in final_items:
                n = parse_num(m["volume"])
                if n is not None:
                    has_numeric_vol = True
                    vol_by_satuan[m["satuan"] if m["satuan"] != "-" else "Unit"] += n
            vol_summary = (
                ", ".join(f"{fmt_num(v)} {s}" for s, v in vol_by_satuan.items())
                if has_numeric_vol
                else "Belum tercantum di Excel (verifikasi jumlah fisik saat kunjungan)"
            )

            kub_id = f"{slugify(kab)}__{slugify(f2_kub)}"
            kub_obj = {
                "id": kub_id,
                "nama_kub": display_name,
                "nama_kub_excel_ik": f2_kub,
                "nama_kub_excel_mesin": f1_kub,
                "provinsi": prov,
                "kab_kota": kab,
                "kecamatan": ", ".join(kec_list) or "-",
                "desa_kel": ", ".join(desa_list) or "-",
                "ketua": "; ".join(ketua_entries) if ketua_entries else "Tidak tercantum jabatan Ketua di Excel",
                "jenis_industri": ", ".join(industri_list) or "-",
                "jenis_produk": ", ".join(produk_list) or "-",
                "kbli": "; ".join(kbli_list) or "-",
                "jumlah_anggota": len(members),
                "jumlah_laki": count_l,
                "jumlah_perempuan": count_p,
                "jumlah_jenis_mesin": len(final_items),
                "jumlah_baris_mesin_raw": len(raw_items),
                "total_volume_label": vol_summary,
                "anggota": members,
                "mesin": final_items,
            }
            kubs_list.append(kub_obj)
            total_kubs += 1

            for m in members:
                all_ik_flat.append({"kub_id": kub_id, "nama_kub_canonical": display_name, **m})
            for m in final_items:
                all_mesin_flat.append(
                    {
                        "kub_id": kub_id,
                        "nama_kub_canonical": display_name,
                        "provinsi": prov,
                        "kab_kota": kab,
                        **m,
                    }
                )
            kub_audit_rows.append(
                {
                    "provinsi": prov,
                    "kab_kota": kab,
                    "display_name": display_name,
                    "f2_kub": f2_kub,
                    "f1_kub": f1_kub,
                    "anggota": len(members),
                    "mesin_raw": len(raw_items),
                    "mesin_unique": len(final_items),
                    "volume": vol_summary,
                }
            )

        # Ensure zero unmatched File 2 KUBs
        unmatched_f2 = set(members_by_f2_kub.keys()) - matched_f2_kubs
        if unmatched_f2:
            raise AssertionError(f"Unmatched File 2 KUBs in {kab}: {unmatched_f2}")

        provinsi_map[prov].append({"nama": kab, "id": slugify(kab), "kubs": kubs_list})

    # Strict global invariants
    assert len(provinsi_map) == 3, f"Expected 3 provinsi, got {len(provinsi_map)}"
    total_kab = sum(len(v) for v in provinsi_map.values())
    assert total_kab == 8, f"Expected 8 kab/kota, got {total_kab}"
    assert total_kubs == 52, f"Expected 52 KUBs, got {total_kubs}"
    assert total_ik_members == 523, f"Expected 523 IK members, got {total_ik_members}"
    assert total_raw_machines == 443, f"Expected 443 raw machines, got {total_raw_machines}"
    assert total_unique_machines == 418, f"Expected 418 unique machines, got {total_unique_machines}"

    master_payload = {
        "metadata": {
            "program": "PRRP Sumatera TA 2026 (Dit. LMEA)",
            "generated_from": [FILE_MESIN.name, FILE_IK.name],
            "counts": {
                "provinsi": len(provinsi_map),
                "kab_kota": total_kab,
                "kub": total_kubs,
                "anggota_ik": total_ik_members,
                "mesin_raw": total_raw_machines,
                "mesin_unique": total_unique_machines,
            },
        },
        "provinsi": [
            {"nama": prov_name, "id": slugify(prov_name), "kab_kota": kabs}
            for prov_name, kabs in provinsi_map.items()
        ],
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    GAS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. JSON
    (OUT_DIR / "master_data_prrp_2026.json").write_text(
        json.dumps(master_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 2. CSV Master_IK_KUB
    ik_headers = [
        "Provinsi", "Kab/Kota", "KUB_ID", "Nama KUB Canonical", "Nama KUB (Excel IK)",
        "No", "Nama", "Nama IK", "Jabatan", "Jenis Kelamin", "Usia",
        "Email", "Telepon/HP", "Alamat", "Desa/Kel", "Kecamatan",
        "NIB", "KBLI", "Jenis Industri/Usaha", "Jenis Produk",
    ]
    with (OUT_DIR / "template_sheet_ik_kub.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(ik_headers)
        for r in all_ik_flat:
            w.writerow([
                r["provinsi"], r["kab_kota"], r["kub_id"], r["nama_kub_canonical"], r["nama_kub_excel_ik"],
                r["no"], r["nama"], r["nama_ik"], r["jabatan"], r["jenis_kelamin"], r["usia"],
                r["email"], r["telepon_hp"], r["alamat"], r["desa_kel"], r["kecamatan"],
                r["nib"], r["kbli"], r["jenis_industri"], r["jenis_produk"],
            ])

    # 3. CSV Master_Spek_Mesin
    mesin_headers = [
        "Provinsi", "Kab/Kota", "KUB_ID", "Nama KUB Canonical", "Nama KUB (Excel Mesin)",
        "No", "Nama Mesin/Alat", "Merk/Tipe", "Spesifikasi Mesin/Alat",
        "Jenis Mesin (PDN/TKDN/Impor)", "Tipe Mesin (TTG/Barang Jadi)",
        "Sumber Energi", "Perlu Diinstalasi", "Perlu Training Operator",
        "Volume", "Satuan", "Raw_Row_Count",
    ]
    with (OUT_DIR / "template_sheet_spek_mesin.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(mesin_headers)
        for r in all_mesin_flat:
            w.writerow([
                r["provinsi"], r["kab_kota"], r["kub_id"], r["nama_kub_canonical"], r["nama_kub_excel_mesin"],
                r["no"], r["nama_mesin"], r["merk_tipe"], r["spesifikasi"],
                r["jenis_mesin"], r["tipe_mesin"],
                r["sumber_energi"], r["perlu_instalasi"], r["perlu_training"],
                r["volume"], r["satuan"], r["raw_row_count"],
            ])

    # 4. DataPayload.js for Google Apps Script
    js_content = (
        "// Auto-generated by scripts/build_dataset.py — DO NOT EDIT MANUALLY.\n"
        "// Source: Database Spek Mesin.xlsx + IK (Dit LMEA) Penerima PRRP Sumatera TA 2026.xlsx\n"
        "const PRRP_MASTER_DATA = "
        + json.dumps(master_payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    (GAS_DIR / "DataPayload.js").write_text(js_content, encoding="utf-8")

    # 5. Audit Report Markdown
    audit_lines = [
        "# Laporan Audit & Rekonsiliasi Data PRRP Sumatera TA 2026",
        "",
        "## Ringkasan Verifikasi Invarian",
        f"- **Total Provinsi:** {len(provinsi_map)} (`Aceh`, `Sumatera Utara`, `Sumatera Barat`)",
        f"- **Total Kab/Kota:** {total_kab}",
        f"- **Total KUB Terpetakan (1:1):** {total_kubs} / 52 (0 unmatched)",
        f"- **Total Anggota IK:** {total_ik_members}",
        f"- **Total Baris Mesin Mentah:** {total_raw_machines}",
        f"- **Total Jenis Mesin Setelah Agregasi Duplikat:** {total_unique_machines}",
        "",
        "## Statistik Pembersihan & Normalisasi",
        f"- `forward_filled_ik_kub`: {stats['forward_filled_ik_kub']}",
        f"- `forward_filled_mesin_kub`: {stats['forward_filled_mesin_kub']}",
        f"- `skipped_blank_ik_rows`: {stats['skipped_blank_ik_rows']} (baris bernomor kosong Nagan Raya)",
        f"- `nagan_raya_mapped_machines`: {stats['nagan_raya_mapped_machines']} (1–26 Bangkit Bersama, 27–48 Jaya Makmur)",
        f"- `aggregated_duplicate_groups`: {stats['aggregated_duplicate_groups']} ({stats['aggregated_rows_merged']} baris digabung volume-nya)",
        f"- `unswapped_agam_rows`: {stats['unswapped_agam_rows']} (penukaran kolom Nama/Nama IK di sheet Kab. Agam)",
        f"- `nad_to_aceh`: {stats['nad_to_aceh']}",
        f"- `phone_prepended_0`: {stats['phone_prepended_0']}",
        f"- `iya_to_ya`: {stats['iya_to_ya']}",
        f"- `typo_lsitrik_fixed`: {stats['typo_lsitrik_fixed']}",
        f"- `typo_lokasl_fixed`: {stats['typo_lokasl_fixed']}",
        f"- `split_volume_satuan`: {stats['split_volume_satuan']}",
        f"- `default_satuan_unit`: {stats['default_satuan_unit']}",
        "",
        "## Tabel Rekonsiliasi 52 KUB",
        "| No | Provinsi | Kab/Kota | Nama KUB di Form | Excel IK | Excel Mesin | IK | Mesin (Raw → Unik) | Total Volume |",
        "|---:|---|---|---|---|---|---:|---:|---|",
    ]
    for i, row in enumerate(kub_audit_rows, start=1):
        audit_lines.append(
            f"| {i} | {row['provinsi']} | {row['kab_kota']} | {row['display_name']} | "
            f"{row['f2_kub']} | {row['f1_kub']} | {row['anggota']} | "
            f"{row['mesin_raw']} → {row['mesin_unique']} | {row['volume']} |"
        )
    (OUT_DIR / "audit_report.md").write_text("\n".join(audit_lines) + "\n", encoding="utf-8")

    print(
        f"PASS: {len(provinsi_map)} provinsi, {total_kab} kab/kota, {total_kubs} KUB, "
        f"{total_ik_members} anggota IK, {total_raw_machines} raw -> {total_unique_machines} unique machines, 0 unmatched"
    )


if __name__ == "__main__":
    main()
