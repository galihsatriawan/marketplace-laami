# marketplace-laami

Toko online publik untuk usaha yang memakai **Modern POS**. Pembeli tidak perlu login:

1. Lihat katalog (foto/video, variasi, ukuran, stok). Harga = harga toko di POS; harga grosir (misal "Beli 3+ Rp24.000/pcs") otomatis dipakai dari **total pcs keranjang**, boleh campur model.
2. Masukkan keranjang (tersimpan di browser), isi nama, no. WhatsApp, diambil di toko / dikirim (alamat), catatan. Promo otomatis dari POS tampil di banner dan langsung terpotong di keranjang; pembeli juga bisa mengetik **kode promo/voucher**. Potongannya dihitung POS (`POST /api/public/stores/<slug>/quote`), satu promo per pesanan. Produk yang punya harga coret (diisi di POS) menampilkan harga coret, label −%, dan harga yang dibayar; promo/voucher memotong dari harga yang dibayar.
3. Tekan **Pesan lewat WhatsApp**: pesanan dikirim ke POS (dihitung ulang dan dicek stoknya di server), lalu WhatsApp terbuka dengan pesan pesanan yang sudah terisi ke nomor toko. Pesanan juga muncul di POS (Penjualan › Pesanan web) untuk diproses pemilik.

Semua data (produk, harga, stok, brand) diambil dari API publik POS; aplikasi ini tidak punya database.

## Jalan di komputer

Butuh Node.js 20+ dan Modern POS yang sedang jalan (misal di port 3000) dengan toko online sudah diaktifkan di **Atur › Toko online**.

```bash
npm install
POS_API_URL=http://localhost:3000 DEFAULT_STORE=satria-collection npm run dev -- -p 3300
```

Buka http://localhost:3300/satria-collection (atau http://localhost:3300 kalau `DEFAULT_STORE` diisi).

Di POS, izinkan origin toko ini mengirim pesanan:

```bash
STORE_ORIGINS=http://localhost:3300 STORE_URL=http://localhost:3300 npm run dev
```

## Env

| Env | Wajib | Isi |
| --- | --- | --- |
| `POS_API_URL` | ya | Alamat Modern POS, misal `https://pos.laami.id` (tanpa `/` di akhir) |
| `DEFAULT_STORE` | tidak | Slug toko yang tampil di halaman `/`. Kosong = `/` menampilkan "Toko tidak ditemukan" |

## Deploy ke Vercel

1. Push repo ini ke GitHub.
2. Vercel → **Add New → Project** → pilih repo ini (Next.js terdeteksi otomatis).
3. **Settings → Environment Variables**: isi `POS_API_URL` (dan `DEFAULT_STORE` kalau perlu). Deploy.
4. Di project Vercel **POS**, tambahkan env `STORE_ORIGINS` = alamat toko ini (misal `https://marketplace-laami.vercel.app`, pisahkan koma kalau ada domain lain) dan `STORE_URL` = alamat yang sama, lalu redeploy POS.
5. Di POS: **Atur › Toko online** → nyalakan, isi link toko (slug) dan nomor WhatsApp penerima pesanan → **Salin link** dan bagikan ke pembeli.

## Halaman

- `/` → toko `DEFAULT_STORE`
- `/<slug>` → toko dengan link itu; 404 ramah kalau toko tidak ada atau sedang dimatikan.
- `/p/<produk>` dan `/<slug>/p/<produk>` → halaman satu produk (detail langsung terbuka), dengan judul, foto dan harga untuk preview di WhatsApp/IG.
- `/r/<kode>` dan `/<slug>/r/<kode>` (juga `.../r/<kode>/p/<produk>`) → toko lewat link reseller. Kode diingat 30 hari di browser pembeli; pesanannya tercatat atas nama reseller itu di POS.

## Struktur

- `app/` halaman (server component mengambil katalog dari POS, judul halaman = nama toko).
- `components/Storefront.tsx` aplikasi toko di browser (React): header, katalog, keranjang, checkout; tampilan per bagian ada di `components/store/`.
- `lib/store.ts` harga grosir, format rupiah, simpanan keranjang/data pembeli di browser, warna brand (sama dengan POS).
- `app/globals.css` token warna dan komponen yang disalin dari POS supaya tampilannya sama.
