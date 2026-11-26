# Panduan Pemasangan Rekap Vertikal Otomatis Jawaban Google Form (1 Menit)

Skrip **[RekapJawaban.gs](file:///c:/Users/Wira%20Sukma%20Saputra/Downloads/amell/rekap-jawaban/RekapJawaban.gs)** dipasang di **Spreadsheet Jawaban** *(bukan di Apps Script pembuat Form)* sehingga:
- **100% aman:** Tidak menyentuh, mereset, atau mengubah Google Form salinan yang sudah diedit Amel.
- **Tab `Form Responses 1` tetap utuh:** Tidak dihapus atau diubah.
- **Otomatis menyusun ulang ke bawah:** Setiap kali petugas klik *Kirim*, otomatis terbentuk/terisi 2 tab rapi:
  1. **`Rekap_Kunjungan`** — 1 baris per kunjungan KUB (20 kolom rapi: Petugas, Tanggal, Provinsi, Kab/Kota, Nama KUB, Anggota Hadir, Jumlah Mesin Dicek, Catatan, Perwakilan, Dokumentasi, Info Tambahan).
  2. **`Rekap_Verifikasi_Mesin`** — 1 baris per unit/jenis mesin yang dicek (12 kolom rapi: Petugas, Tanggal, Provinsi, Kab/Kota, Nama KUB, No Mesin, Nama Mesin & Spek, Status Penerimaan & Spek, Status Instalasi & Training, Catatan).

---

## Cara Pasang (4 Langkah Mudah)

1. **Buka Spreadsheet Jawaban Anda**
   (`Formulir Monitoring & Verifikasi Bantuan Mesin/Peralatan PRRP Sumatera TA 2026 (Dit. LMEA) (Jawaban)`).
2. Klik menu **Ekstensi (*Extensions*) → Apps Script**.
3. Hapus isi bawaan di file `Kode.gs` pada editor yang baru terbuka, lalu **copy-paste seluruh isi** [RekapJawaban.gs](file:///c:/Users/Wira%20Sukma%20Saputra/Downloads/amell/rekap-jawaban/RekapJawaban.gs) → tekan **`Ctrl + S`** (Simpan).
4. Di toolbar atas, pilih fungsi **`aktifkanRekapOtomatis`** di sebelah tombol *Debug* → klik **Jalankan / Run** (setujui izin *Review Permissions → Allow* saat diminta).

### Selesai!
- Jawaban lama yang sudah masuk (seperti baris `wira`) langsung otomatis terekap ke tab **`Rekap_Kunjungan`** dan **`Rekap_Verifikasi_Mesin`**.
- Setiap ada petugas baru mengirim Google Form, kedua tab tersebut otomatis bertambah ke bawah tanpa duplikat.
- Jika di Spreadsheet Anda juga muncul menu baru **`Rekap PRRP`** (setelah *refresh*), Anda bisa klik **`Rekap PRRP → Rekap Semua Jawaban Sekarang`** kapan pun diperlukan.

> **Catatan Penting:** Jangan jalankan lagi skrip generator form (`FormBuilder` / `buildFormFromEmbedded`) ke Google Form salinan yang sudah diedit Amel agar perubahan manual tetap aman. Jika ingin menambah/mengubah pertanyaan, edit langsung dari Google Form salinan tersebut — skrip `RekapJawaban.gs` tetap otomatis membaca kolom baru/yang diubah.
