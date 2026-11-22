# Silsilah Keluarga (PWA) — Tahap 1

Vite + React + TypeScript + React Flow + Supabase. Deploy: GitHub → Vercel.

## Langkah awal
1. Buat proyek di supabase.com. Buka **SQL Editor**, jalankan isi `supabase/schema.sql`.
2. Di Supabase: **Project Settings → API**, salin *Project URL* dan *anon public key*.
3. Salin `.env.example` menjadi `.env`, isi kedua nilai tersebut.
4. `npm install` lalu `npm run dev`.
5. (Opsional) Authentication → Providers → Email: matikan "Confirm email" selama menguji sendiri.

## Deploy (Vercel)
1. Push ke repo GitHub.
2. vercel.com → Add New → Project → Import repo. Framework otomatis terdeteksi sebagai Vite (build `npm run build`, output `dist`). Sebelum klik Deploy, buka **Environment Variables** dan isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
3. Setelah jadi, salin alamat `*.vercel.app` ke Supabase → Authentication → URL Configuration (*Site URL*).
4. Setiap `git push` ke branch utama akan otomatis ter-deploy. Rewrite SPA sudah diatur di `vercel.json`.

## Cara pakai
Klik kartu orang, lalu pakai tombol di bawah: ↑ Orang tua, ↓ Anak, ↔ Pasangan, ⇆ Saudara, Ubah, Hapus.
Ekspor/Impor JSON ada di bagian atas.

## Pembaruan: formulir lengkap dan posisi "Saya" di tengah
Untuk database yang sudah berjalan, jalankan **sekali** `supabase/migrasi-02-form-lengkap.sql` di SQL Editor
(menambah kolom alamat, no. HP, foto, dan titik pusat). Instalasi baru cukup memakai `schema.sql`.
Lalu salin berkas baru ke proyek, `git add .`, `git commit`, `git push` agar Vercel memperbarui situs.

## Tahap 2: kolaborasi keluarga
Jalankan **sekali** `supabase/migrasi-03-tahap2.sql` di SQL Editor (instalasi baru: `schema.sql` dulu, lalu berkas ini).
Isinya: undangan, peran (Pemilik / Editor / Pembaca), kartu "Saya" per anggota, riwayat perubahan, pemulihan orang yang terhapus, dan pembaruan langsung.

Cara memakai:
1. Pemilik klik **Anggota**, pilih peran, klik **Buat tautan undangan**, lalu kirim lewat WhatsApp.
2. Penerima membuka tautan, daftar/masuk, lalu klik **Gabung**.
3. Penerima memilih kartunya sendiri, lalu klik **⭐ Jadikan pusat (Saya)**. Tampilan setiap anggota berpusat pada dirinya.
4. **Riwayat** menampilkan siapa mengubah apa dan kapan. Orang yang terhapus bisa dipulihkan (tanpa foto).
5. Di Supabase, matikan "Confirm email" selama batas pengiriman email bawaan masih kecil, atau atur SMTP sendiri sebelum banyak orang mendaftar.

## Cetak PDF
Klik **Cetak PDF** di bagian atas, pilih ukuran kertas (A4/A3/A2) dan arah, lalu **Cetak / Simpan sebagai PDF**.
Di jendela cetak pilih "Simpan sebagai PDF" dan matikan "Header dan footer". Hasilnya vektor (tajam, bisa diperbesar).
Pohon yang dicetak berpusat pada kartu "Saya" milik pengguna yang mencetak.
