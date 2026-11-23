# Laporan Audit & Rekonsiliasi Data PRRP Sumatera TA 2026

## Ringkasan Verifikasi Invarian
- **Total Provinsi:** 3 (`Aceh`, `Sumatera Utara`, `Sumatera Barat`)
- **Total Kab/Kota:** 8
- **Total KUB Terpetakan (1:1):** 52 / 52 (0 unmatched)
- **Total Anggota IK:** 523
- **Total Baris Mesin Mentah:** 443
- **Total Jenis Mesin Setelah Agregasi Duplikat:** 418

## Statistik Pembersihan & Normalisasi
- `forward_filled_ik_kub`: 322
- `forward_filled_mesin_kub`: 45
- `skipped_blank_ik_rows`: 20 (baris bernomor kosong Nagan Raya)
- `nagan_raya_mapped_machines`: 48 (1–26 Bangkit Bersama, 27–48 Jaya Makmur)
- `aggregated_duplicate_groups`: 18 (25 baris digabung volume-nya)
- `unswapped_agam_rows`: 104 (penukaran kolom Nama/Nama IK di sheet Kab. Agam)
- `nad_to_aceh`: 208
- `phone_prepended_0`: 59
- `iya_to_ya`: 65
- `typo_lsitrik_fixed`: 1
- `typo_lokasl_fixed`: 3
- `split_volume_satuan`: 59
- `default_satuan_unit`: 23

## Tabel Rekonsiliasi 52 KUB
| No | Provinsi | Kab/Kota | Nama KUB di Form | Excel IK | Excel Mesin | IK | Mesin (Raw → Unik) | Total Volume |
|---:|---|---|---|---|---|---:|---:|---|
| 1 | Aceh | Aceh Singkil | KUB Surya Terali — Bengkel Las | Surya Terali | KUB SURYA TERALI - BENGKEL LAS | 10 | 7 → 7 | 40 Unit, 30 Buah |
| 2 | Aceh | Aceh Singkil | KUB Bakeri Taboh — Roti & Kue | Bakeri Taboh | KUB BAKERI TABOH - ROTI & KUE | 23 | 3 → 3 | 69 Unit |
| 3 | Aceh | Aceh Singkil | KUB Budidaya Madu Trigona — Olahan Madu | Budidaya Madu Trigona | KUB BUDIDAYA MADU TRIGONA - OLAHAN MADU | 16 | 3 → 3 | 96 Unit |
| 4 | Aceh | Aceh Singkil | KUB Taylor Mende — Konveksi/Jahit Pakaian | Taylor Mende | KUB TAYLOR MENDE - KONVEKSI/JAHIT PAKAIAN | 30 | 3 → 3 | 60 Set, 30 Unit |
| 5 | Aceh | Aceh Singkil | KUB Jajanan Pangan — Makanan Ringan | Jajanan Pangan | KUB JAJANAN PANGANAN - MAKANAN RINGAN | 30 | 5 → 5 | 150 Unit |
| 6 | Aceh | Kota Subulussalam | KUB Berkah Jaya Taylor — Konveksi/Jahit Pakaian | Berkah Jaya Taylor | KUB BERKAH JAYA TAYLOR - KONVEKSI/JAHIT PAKAIAN | 8 | 5 → 5 | 32 Set, 8 Buah |
| 7 | Aceh | Kota Subulussalam | KUB Suka Maju Bersama — Bengkel Sepeda Motor | Suka Maju Bersama | KUB SUKA MAJU BERSAMA - BENGKEL SEPEDA MOTOR | 7 | 4 → 4 | 21 Set, 7 Unit |
| 8 | Aceh | Kota Subulussalam | KUB Karya Otomotif Muara Batu-Batu — Bengkel Sepeda Motor | Karya Otomotif Muara Batu-Batu | KUB KARYA OTOMOTIF MUARA BATU-BATU - BENGKEL SEPEDA MOTOR | 4 | 4 → 4 | 12 Set, 4 Unit |
| 9 | Aceh | Kota Subulussalam | KUB Rizky Bongki Mandiri — Pembuatan Kapal/Perahu | Rizky Bongki Mandiri | KUB RIZKI BONGKI - PEMBUATAN KAPAL/PERAHU | 5 | 4 → 4 | 20 Unit |
| 10 | Aceh | Aceh Selatan | KUB Giat Bersama | GIAT BERSAMA | Giat Bersama | 10 | 10 → 10 | 64 Unit |
| 11 | Aceh | Aceh Selatan | KUB Maju Bersama | MAJU BERSAMA | Maju Bersama | 20 | 13 → 13 | 71 Unit |
| 12 | Aceh | Aceh Selatan | KUB Sawang Sepakat | SAWANG SEPAKAT | Sawang Sepakat | 8 | 13 → 13 | 61 Unit |
| 13 | Aceh | Aceh Selatan | KUB Bungoeng Canden Leuser | BUNGOENG CANDEN LEUSER | Bungoeng Canden Leuser | 26 | 12 → 12 | 13 Unit |
| 14 | Aceh | Aceh Selatan | KUB Pesona Bidari | PESONA BIDARI | Pesona Bidari | 25 | 12 → 12 | 13 Unit |
| 15 | Aceh | Aceh Selatan | KUB Seuneubok Bestari | SEUNEUBOK BESTARI | Seuneubok Bestari | 24 | 7 → 7 | 11 Unit |
| 16 | Aceh | Aceh Selatan | KUB Tangga Seribu Berkarya | TANGGA SERIBU BERKARYA | Tangga Seribu Berkarya | 26 | 11 → 11 | 32 Unit |
| 17 | Aceh | Aceh Selatan | KUB Bungong Pusaka | BUNGONG PUSAKA | Bungong Pusaka | 28 | 8 → 8 | 16 Unit |
| 18 | Aceh | Aceh Selatan | KUB Jasa Kawan | JASA KAWAN | Jasa Kawan | 16 | 15 → 15 | 100 Unit |
| 19 | Aceh | Aceh Selatan | KUB Bayu Srikandi Kreatif | BAYU SRIKANDI KREATIF | Bayu Srikandi Kreatif | 25 | 13 → 13 | 24 Unit |
| 20 | Aceh | Nagan Raya | KUB Bangkit Bersama | KUB Bangkit Bersama | KUB Bangkit Bersama | 9 | 26 → 26 | Belum tercantum di Excel (verifikasi jumlah fisik saat kunjungan) |
| 21 | Aceh | Nagan Raya | KUB Jaya Makmur | KUB Jaya Makmur | KUB Jaya Makmur | 6 | 22 → 22 | Belum tercantum di Excel (verifikasi jumlah fisik saat kunjungan) |
| 22 | Aceh | Aceh Barat | KUB Teuku Umar Furnitur — Furnitur Kayu | KUB Teuku Umar Furnitur | KUB TEUKU UMAR FURNITUR - FURNITUR KAYU | 5 | 15 → 15 | 23 Unit |
| 23 | Aceh | Aceh Barat | KUB Pangan Mandiri — Penggilingan Padi | KUB Pangan Mandiri | KUB PANGAN MANDIRI - PENGGILINGAN PADI | 5 | 7 → 7 | 13 Unit, 4 Buah, 2 Set |
| 24 | Aceh | Aceh Barat | KUB Kue Tradisi Seuramoe — Roti dan Kue | KUB Kue Tradisi Seuramoe | KUB KUE TRADISI SEURAMOE - ROTI DAN KUE | 5 | 11 → 11 | 12 Buah, 8 Unit, 2 Set |
| 25 | Aceh | Aceh Barat | KUB Sentra Tahu Tempe Aceh Barat — Tahu dan Tempe | KUB Sentra Tahu Tempe Aceh Barat | KUB SENTRA TAHU TEMPE - TAHU DAN TEMPE | 4 | 8 → 8 | 13 Buah, 6 Set, 1 Unit |
| 26 | Aceh | Aceh Barat | KUB Seuramoe Kopi Aceh Barat — Pengolahan Kopi | KUB Seuramoe Kopi Aceh Barat | KUB SEURAMOE KOPI - PENGOLAHAN KOPI | 3 | 6 → 6 | 3 Set, 3 Unit, 1 Buah |
| 27 | Aceh | Aceh Barat | KUB Meulaboh Bata Jaya — Batu Bata | KUB Meulaboh Bata Jaya | KUB MEULABOH BATA JAYA - BATU BATA | 4 | 5 → 5 | 22 Buah, 7 Unit |
| 28 | Aceh | Aceh Barat | KUB Rencong Logam Aceh Barat — Pandai Besi | KUB Rencong Logam Aceh Barat | KUB RENCONG LOGAM - PANDAI BESI (ALAT POTONG DAN PERKAKAS TANGAN) | 4 | 13 → 13 | 15 Unit, 4 Set |
| 29 | Aceh | Aceh Barat | KUB Usaha Bengkel Bersama — Reparasi Mobil/Motor/Alat RT | KUB Usaha Bengkel Bersama | KUB USAHA BENGKEL BERSAMA - REPARASI MOBIL, MOTOR, DAN ALAT RUMAH TANGGA | 5 | 15 → 15 | 20 Unit, 4 Set |
| 30 | Sumatera Utara | Batu Bara | KUB Gula Merah Rayhan | KUB Gula Merah Rayhan | Gula Merah Rayhan | 1 | 7 → 7 | 7 Unit |
| 31 | Sumatera Utara | Batu Bara | KUB Tenun Padang Genting | KUB Tenun Padang Genting | Tenun Padang Genting | 3 | 12 → 4 | 12 Unit |
| 32 | Sumatera Utara | Batu Bara | KUB Maguro (Budidaya Perikanan) | KUB Maguro (Budidaya Perikanan) | KUB Maguro (Budidaya Perikanan) | 1 | 4 → 4 | 4 Unit |
| 33 | Sumatera Utara | Deli Serdang | KUB Paya Geli Berkah Mandiri | KUB Paya Geli Berkah Mandiri | Paya Geli Berkah Mandiri | 4 | 17 → 15 | 17 Unit |
| 34 | Sumatera Utara | Deli Serdang | KUB Tanjung Morawa A | KUB Tanjung Morawa A | Tanjung Morawa A | 4 | 16 → 9 | 17 Unit |
| 35 | Sumatera Utara | Deli Serdang | KUB Srikandi Mandiri | KUB Srikandi Mandiri | Srikandi Mandiri | 4 | 9 → 8 | 10 Unit |
| 36 | Sumatera Utara | Deli Serdang | KUB Dalu Sepuluh B Maju Berkah | KUB Dalu Sepuluh B Maju Berkah | Dalu Sepuluh B Maju Berkah | 4 | 19 → 13 | 25 Unit |
| 37 | Sumatera Utara | Deli Serdang | KUB Kriya Deli | KUB Kriya Deli | Kriya Deli | 4 | 7 → 7 | 9 Unit |
| 38 | Sumatera Utara | Deli Serdang | KUB Maju Bersama | KUB Maju Bersama | Maju Bersama | 3 | 13 → 12 | 15 Unit |
| 39 | Sumatera Barat | Kabupaten Agam | KUB Ekvo Cake & Bakery (Evco Cake - PFBB) | Ekvo cake and bakery | KUB Evco Cake - PFBB | 1 | 8 → 8 | 13 Unit |
| 40 | Sumatera Barat | Kabupaten Agam | KUB RH Teknik | RH Teknik | KUB RH Teknik | 1 | 16 → 16 | 21 Unit, 2 Set |
| 41 | Sumatera Barat | Kabupaten Agam | KUB Penjahit Maju Jaya | Penjahit Maju Jaya | KUB Maju Jaya | 4 | 3 → 3 | 12 Unit |
| 42 | Sumatera Barat | Kabupaten Agam | KUB Kampuang Malayu Bersatu | Kampuang Malayu Bersatu | KUB Kampuang Malayu B | 9 | 3 → 3 | 15 Unit |
| 43 | Sumatera Barat | Kabupaten Agam | KUB Penjahit Nak Tareh | Penjahit Nak Tareh | KUB Nak Tareh | 3 | 3 → 3 | 6 Unit |
| 44 | Sumatera Barat | Kabupaten Agam | KUB Ummi Berkarya | Ummi Berkarya | KUB Umi Berkarya | 3 | 5 → 5 | 9 Unit |
| 45 | Sumatera Barat | Kabupaten Agam | KUB Cahaya Collection | Cahaya Collection | KUB Cahaya Collection | 5 | 5 → 5 | 8 Unit |
| 46 | Sumatera Barat | Kabupaten Agam | KUB Belok Ikan Bersahaja | Belok Ikan Bersahaja | KUB Belok Ikan Bersahaja | 11 | 3 → 3 | 18 Unit |
| 47 | Sumatera Barat | Kabupaten Agam | KUB Batu Asahan Sepakat | Batu Asahan Sepakat | KUB Batu Asahan Sepakat | 12 | 2 → 2 | 22 Unit |
| 48 | Sumatera Barat | Kabupaten Agam | KUB Kampung Lalang Saiyo | Kampung Lalang Saiyo | KUB Kampung Lalang Saiyo | 11 | 2 → 2 | 21 Unit |
| 49 | Sumatera Barat | Kabupaten Agam | KUB Kampung Jampita Indah | Kampung Jampita Indah | KUB Kampung Jampita | 11 | 2 → 2 | 19 Unit |
| 50 | Sumatera Barat | Kabupaten Agam | KUB Jembatan Subarang Saiyo | Jembatan Subarang Saiyo | KUB Jembatan Subarang | 14 | 2 → 2 | 27 Unit |
| 51 | Sumatera Barat | Kabupaten Agam | KUB Lereng Maju Bersama | Lereng Maju Bersama | KUB Lereng Maju Bersama | 10 | 2 → 2 | 18 Unit |
| 52 | Sumatera Barat | Kabupaten Agam | KUB Ngalau Indah Sejahtera | Ngalau Indah Sejahtera | KUB Ngalau Indah Sejahtera | 9 | 3 → 3 | 15 Unit |
