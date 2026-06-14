# 🎖️ Military Info - Tactical Command Center & News Aggregator

**Military Info** adalah portal agregator berita militer, pertahanan, dan geopolitik modern. Aplikasi ini dirancang sebagai dashboard taktis (Tactical HUD) dengan performa tinggi yang menggabungkan umpan dari API berita dan puluhan saluran RSS internasional secara aman, responsif, dan legal.

[![React](https://img.shields.io/badge/React-19.1-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7.1-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📋 Daftar Isi
- [Fitur Utama](#-fitur-utama)
- [Teknologi yang Digunakan](#-teknologi-yang-digunakan)
- [Instalasi dan Setup](#-instalasi-dan-setup)
- [Konfigurasi Kredensial](#-konfigurasi-kredensial)
- [Struktur Proyek](#-struktur-proyek)
- [Hak Cipta & Kebijakan Fair Use](#-hak-cipta--kebijakan-fair-use)
- [Lisensi](#-lisensi)

---

## ✨ Fitur Utama

### 1. **Tactical Glassmorphic HUD**
Antarmuka premium bertema gelap (*tactical dark mode*) yang dilengkapi dengan efek glassmorphism, visual scanner radar animatif, dan tipografi modern dari Google Fonts (`Outfit` & `JetBrains Mono`).

### 2. **21 Saluran Umpan RSS Taktis**
Agregasi umpan real-time dari 21 sumber berita militer dan pertahanan global terkemuka (termasuk Defense News, Military Times, Breaking Defense, US Dept of Defense, US Navy, US Air Force, US Army Combat, UK MoD News, dan portal teknologi pertahanan lainnya).

### 3. **Penyaringan Konten Berlapis (Intelligent Filtering)**
Sistem pemfilteran otomatis dengan pencocokan kata kunci militer positif (40+ istilah) dan pengecualian kata kunci non-militer negatif (60+ istilah olahraga, gaya hidup, dll.) untuk menjamin kemurnian konten pertahanan.

### 4. **Keyless Operation & Credential Shielding**
Kunci API NewsAPI dan TheNewsAPI dikonfigurasi secara lokal melalui antarmuka **⚙️ System Config** di browser (disimpan di `localStorage`). Pengguna dapat menjalankan portal tanpa mengisi kredensial apa pun (menggunakan umpan RSS publik) untuk mencegah kebocoran kunci di server hosting publik (Vercel/Netlify).

### 5. **Resilience & Offline Database Fallback**
Jika koneksi internet gagal atau API dibatasi kuota, sistem akan otomatis melakukan peralihan bertahap:
- Mengambil cached data (caching 15 menit).
- Mengambil umpan RSS via CORS proxy (`allorigins`).
- Memuat **Local Offline Archive** berisi artikel-artikel militer berkualitas tinggi yang terintegrasi di dalam aplikasi.

### 6. **Article Inspection Drawer & Bookmarks**
Klik pada kartu artikel untuk membuka panel laci samping (drawer) yang menampilkan preview ringkas, kategorisasi taktis (Naval, Aerospace, Ground, Cyber, Geopolitics), dan opsi bookmarking lokal.

### 7. **Load More Pagination**
Memungkinkan pengguna memuat berita secara bertahap (12 artikel per klik) untuk performa memori browser yang optimal dan mengurangi pemborosan transfer data.

---

## 🛠️ Teknologi yang Digunakan

| Teknologi | Versi | Deskripsi |
|-----------|-------|-----------|
| **React.js** | 19.1 | Pembangunan antarmuka UI komponen |
| **Vite** | 7.1 | Build tool ultra cepat dengan support Vitest |
| **Tailwind CSS** | 3.4 | Utilitas styling visual dengan animasi kustom |
| **Axios** | 1.12 | HTTP Client penanganan request API |
| **DOMParser** | Native | XML Parser bawaan browser untuk fallback RSS |

---

## 📦 Instalasi dan Setup

1. **Clone repositori:**
   ```bash
   git clone https://github.com/notsalter/military-info.git
   cd military-info
   ```
2. **Install dependensi:**
   ```bash
   npm install
   ```
3. **Jalankan server pengembangan:**
   ```bash
   npm run dev
   ```
   Buka alamat local yang disediakan di terminal: **http://localhost:5173**

---

## 🔑 Konfigurasi Kredensial
Untuk menambahkan API Key NewsAPI/TheNewsAPI:
1. Buka aplikasi di browser.
2. Klik tombol **⚙️ SYSTEM CONFIG** di header.
3. Masukkan kunci Anda dan klik **Apply Changes**. Kunci disimpan secara aman di browser Anda.

---

## 📁 Struktur Proyek
```
MilitaryInfo/
├── public/                 # Aset statis
├── src/
│   ├── components/         # Komponen UI
│   │   ├── ArticleCard.jsx      # Kartu artikel taktis
│   │   ├── ArticleGrid.jsx      # Grid rendering & empty state
│   │   ├── SearchBar.jsx        # Bar pencarian & query reset
│   │   ├── SettingsModal.jsx    # Modal input kunci API
│   │   ├── ArticleDrawer.jsx    # Laci preview artikel & disclaimer
│   │   ├── Loading.jsx          # Animasi scanner reticle
│   │   └── ErrorMessage.jsx     # Alert HUD merah
│   ├── services/           # Logika data
│   │   ├── newsApi.js           # Query aggregator, caching, filter, mock DB
│   │   └── rssService.js        # Parser 21 RSS feeds & fallback CORS proxy
│   ├── App.jsx             # Main dashboard controller
│   ├── main.jsx             # React entry point
│   └── index.css            # Custom fonts & keyframes CSS
├── package.json            # Dependensi npm & script
└── README.md               # Dokumentasi utama ini
```

---

## 🛡️ Hak Cipta & Kebijakan Fair Use
Aplikasi ini mematuhi peraturan perlindungan hak cipta digital:
1. **Batas Karakter Preview:** Teks deskripsi dibatasi maksimal 250 karakter untuk mematuhi kaidah *Fair Use* non-komersial untuk riset/studi pertahanan.
2. **Attribution Terang:** Menampilkan nama penerbit secara eksplisit pada setiap kartu dan panel preview.
3. **Outbound Redirects:** Tombol baca selengkapnya merujuk langsung ke URL situs penerbit resmi dengan tag keamanan `target="_blank" rel="noopener noreferrer"`.
4. **Takedown Policy:** Pemilik konten dapat mengajukan permohonan pengecualian/penghapusan umpan berita dengan menghubungi kontak DMCA yang tertera di kaki aplikasi (*footer*).

---

## 📄 Lisensi
Tersedia di bawah lisensi [MIT License](LICENSE).
