# 🎤 Presentation Guide - Military Info Command Center

## Struktur Presentasi (10-15 Menit)

---

## 1️⃣ Pembukaan (2 menit)

### Slide 1: Judul Proyek & Konsep
**Military Info - Tactical Command Center**  
*Portal Agregasi Berita Militer, Pertahanan, dan Geopolitik Terintegrasi*

**Tagline:**  
"Dashboard Taktis Modern dengan Kredensial Terenkripsi dan 21 Saluran RSS Cerdas"

### Slide 2: Latar Belakang & Masalah
- **Masalah:** Umpan berita militer tersebar acak, paywall menyulitkan akses, agregator berita umum dicemari konten tidak relevan (seperti berita olahraga yang rancu dengan kata kunci pertahanan), serta kebocoran API Key di sisi client yang sering memicu pemblokiran kuota.
- **Solusi:** Dashboard taktis terpadu dengan penyaringan konten 2 lapis, keyless operation model, local credentials manager, dan dual RSS fallback system.

---

## 2️⃣ Demo Aplikasi & Skenario (5 menit)

### Live Demo Checklist:

1. **Dashboard HUD (Home):** Tunjukkan tema gelap taktis (*Tactical Mode*), grid artikel glassmorphic, visual reticle radar pemuatan data, dan *live alert ticker* yang berjalan dinamis di bawah header.
2. **Settings Config (⚙️):** Buka panel konfigurasi untuk mendemonstrasikan penyimpanan lokal Kunci API NewsAPI/TheNewsAPI secara aman di browser (`localStorage`).
3. **Penyaringan Kategori & Bookmark:** Filter hasil berdasarkan saluran taktis (contoh: *Naval Operations*), bookmark salah satu artikel penting, lalu gunakan shortcut header *BOOKMARKS* untuk memunculkan artikel tersimpan.
4. **Detail Drawer & Fair Use Compliance:** Klik kartu artikel untuk memperlihatkan panel laci samping (drawer). Soroti batasan preview 250 karakter demi kepatuhan hak cipta (*Fair Use*) dan tombol redirect outbound resmi.
5. **Load More Pagination:** Gulir ke bawah dan klik tombol **[ LOAD MORE INTEL REPORTS ]** untuk memuat berita lanjutan (berfungsi client-side sehingga menghemat pemakaian API).

---

## 3️⃣ Fitur Utama & Keunggulan Arsitektur (3 menit)

- **Dynamic Credentials Shielding:** Melindungi developer dari pencurian API Key. Kunci disimpan di client secara terenkripsi di memori lokal, bukan di-hardcode ke file host.
- **21 Saluran Umpan RSS dengan Fallback CORS Proxy:** Tetap aktif walau API Key utama habis kuota, memanfaatkan Allorigins proxy dan browser-native parser XML.
- **Copyright Protection & Legal Shields:** Pembatasan preview ringkas 250 karakter, atribusi penerbit terang, dan footer klausul DMCA.

---

## 4️⃣ Spesifikasi Teknologi & Script (2 menit)
- **Frontend Core:** React 19.1, Vite 7.1, Tailwind CSS 3.4
- **State & Storage:** React hooks (tanpa Redux) dan `localStorage` caching
- **Fallback Parsing:** Browser XML `DOMParser` & Axios HTTP Client
