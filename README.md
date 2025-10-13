# 🎖️ Military Info - Portal Berita Militer dan Pertahanan

**Military Info** adalah aplikasi web agregator berita modern yang secara khusus menampilkan artikel-artikel terbaru seputar dunia militer, pertahanan, dan geopolitik dari berbagai sumber berita global.

[![React](https://img.shields.io/badge/React-19.1-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7.1-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![NewsAPI](https://img.shields.io/badge/NewsAPI-Integrated-FF6600)](https://newsapi.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

![Military Info Screenshot](https://via.placeholder.com/800x400/1e3a8a/ffffff?text=Military+Info+Screenshot)

## 📋 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Teknologi yang Digunakan](#-teknologi-yang-digunakan)
- [Peran AI dalam Pengembangan](#-peran-ai-dalam-pengembangan)
- [Instalasi dan Setup](#-instalasi-dan-setup)
- [Konfigurasi API Key](#-konfigurasi-api-key)
- [Menjalankan Aplikasi](#-menjalankan-aplikasi)
- [Struktur Proyek](#-struktur-proyek)
- [Deployment](#-deployment)
- [Lisensi](#-lisensi)

## ✨ Fitur Utama

### 1. **Feed Berita Utama**
- Menampilkan daftar artikel berita terbaru tentang militer, pertahanan, dan angkatan bersenjata
- Setiap kartu berita menampilkan:
  - Gambar utama artikel
  - Judul artikel
  - Deskripsi singkat
  - Sumber berita (Reuters, BBC News, dll.)
  - Tanggal publikasi

### 2. **Multi-Source News Integration** 🌐
- **Primary**: [NewsAPI.org](https://newsapi.org) - Real-time general news with filtering
- **Secondary**: [TheNewsAPI.com](https://thenewsapi.com) - Fallback general news API
- **Tertiary**: **8 RSS Feeds** from dedicated military sources:
  - Defense News, Military Times, Breaking Defense
  - The Aviationist, Naval News, Defense One
  - Jane's Defence Weekly, Military.com
- **Smart Caching**: localStorage dengan durasi 15 menit
- **4-tier fallback**: NewsAPI → TheNewsAPI → RSS → Cache
- Lihat [DUAL_API_SYSTEM.md](DUAL_API_SYSTEM.md) dan [RSS_INTEGRATION.md](RSS_INTEGRATION.md)

### 3. **Advanced Content Filtering** 🎯
- **Two-layer filtering system** untuk menjamin konten militer murni
- **Positive filtering**: Harus mengandung kata kunci militer
- **Negative filtering**: Menolak 60+ kata kunci non-militer
- **Domain exclusion**: Memblokir situs agregator (biztoc, fark)
- Lihat [CONTENT_FILTERING.md](CONTENT_FILTERING.md) untuk detail teknis

### 4. **Fungsi Pencarian**
- Search bar yang fungsional untuk pencarian kata kunci spesifik
- Contoh pencarian: "kapal selam", "jet tempur", "konflik siber"
- Hasil pencarian real-time dengan filtering otomatis

### 5. **Tautan ke Sumber Asli**
- Klik pada kartu berita untuk membuka artikel lengkap
- Artikel dibuka di tab baru
- Fungsi inti agregator berita

### 6. **Indikator Loading & Error Handling**
- Animasi loading yang menarik saat mengambil data
- Pesan error informatif untuk berbagai skenario:
  - API Key tidak valid
  - Koneksi internet bermasalah
  - Terlalu banyak permintaan
  - Hasil pencarian tidak ditemukan

## 🛠️ Teknologi yang Digunakan

| Teknologi | Versi | Deskripsi |
|-----------|-------|-----------|
| **React.js** | 18.3.1 | Library JavaScript untuk membangun UI |
| **Vite** | 6.0.11 | Build tool yang cepat untuk modern web |
| **Tailwind CSS** | 3.4.17 | Framework CSS utility-first |
| **Axios** | 1.7.9 | HTTP client untuk request API |
| **RSS Parser** | 3.13.0 | Parser untuk RSS/Atom feeds |
| **NewsAPI.org** | v2 | Primary news API |
| **TheNewsAPI.com** | v1 | Secondary news API |
| **RSS Feeds** | - | 8 dedicated military news sources |

### Development Tools
- **ESLint** - Linting JavaScript/React
- **PostCSS** - Pemrosesan CSS dengan Tailwind
- **Autoprefixer** - Menambahkan vendor prefixes otomatis

## 🤖 Peran AI dalam Pengembangan

Aplikasi ini dikembangkan dengan bantuan **AI (IBM Granite)** untuk mempercepat proses pengembangan. Berikut adalah area-area di mana AI memberikan kontribusi signifikan:

### 1. **Interaksi API**
AI membantu dalam:
- Membuat fungsi JavaScript/React untuk mengambil data dari News API
- Mengimplementasikan cara aman menyertakan API Key menggunakan environment variables
- Menangani berbagai response status dari API

**Contoh Kode yang Dibantu AI:**
```javascript
// src/services/newsApi.js
export const fetchNews = async (query = 'militer', pageSize = 20) => {
  try {
    const response = await apiClient.get('/everything', {
      params: {
        q: query,
        language: 'id,en',
        sortBy: 'publishedAt',
        pageSize: pageSize,
      },
    });
    // ... error handling
  } catch (error) {
    // AI-suggested comprehensive error handling
  }
};
```

### 2. **Manajemen State**
AI membantu mengimplementasikan state management yang efisien:
- State untuk menyimpan daftar artikel
- Status loading
- Pesan error
- Query pencarian saat ini

**Contoh State Management:**
```javascript
const [articles, setArticles] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [currentQuery, setCurrentQuery] = useState('militer');
```

### 3. **Pembuatan Komponen UI**
AI menghasilkan boilerplate code untuk komponen React:
- `ArticleCard` - Kartu berita individual
- `SearchBar` - Form pencarian
- `ArticleGrid` - Grid layout untuk artikel
- `Loading` - Indikator loading
- `ErrorMessage` - Tampilan error

### 4. **Logika Pencarian**
AI membantu implementasi:
- Fungsi pencarian yang mengirim request ke API berdasarkan input user
- Handling form submission
- Clear/reset search functionality

### 5. **Error Handling**
AI memberikan contoh comprehensive error handling untuk:
- HTTP status codes (401, 429, 426, dll.)
- Network errors
- Invalid API responses
- User-friendly error messages dalam Bahasa Indonesia

## 📦 Instalasi dan Setup

### Prasyarat
- **Node.js** (versi 18 atau lebih baru)
- **npm** atau **yarn**
- **API Key dari NewsAPI.org** (gratis untuk developer)

### Langkah-langkah Instalasi

1. **Clone atau Download Repository**
   ```bash
   git clone <repository-url>
   cd MilitaryInfo
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment Variables**
   
   Salin file `.env.example` menjadi `.env`:
   ```bash
   copy .env.example .env
   ```
   
   Atau di Linux/Mac:
   ```bash
   cp .env.example .env
   ```

4. **Dapatkan API Key dari NewsAPI**
   - Kunjungi [https://newsapi.org/register](https://newsapi.org/register)
   - Daftar akun gratis
   - Salin API Key yang diberikan

5. **Tambahkan API Key ke File .env**
   
   Edit file `.env` dan tambahkan API Key:
   ```env
   VITE_NEWS_API_KEY=your_actual_api_key_here
   ```

## 🔑 Konfigurasi API Key

### Mendapatkan API Key

1. Buka [NewsAPI.org](https://newsapi.org/register)
2. Isi form registrasi dengan informasi Anda
3. Verifikasi email Anda
4. API Key akan dikirim via email atau tersedia di dashboard

### Batasan API Gratis

- **Requests**: 100 requests per hari
- **Articles**: Maksimal 100 artikel per request
- **Update**: Data diupdate setiap 15 menit
- **Historical Data**: 1 bulan ke belakang

### Upgrade Plan (Opsional)

Untuk penggunaan production dengan traffic tinggi, pertimbangkan upgrade ke:
- **Developer Plan**: $449/bulan - 250,000 requests
- **Business Plan**: Custom pricing

## 🚀 Menjalankan Aplikasi

### Development Mode

Jalankan aplikasi dalam mode development:
```bash
npm run dev
```

Aplikasi akan berjalan di:
```
http://localhost:5173
```

### Build untuk Production

Build aplikasi yang teroptimasi:
```bash
npm run build
```

File hasil build akan tersimpan di folder `dist/`.

### Preview Production Build

Preview hasil build sebelum deploy:
```bash
npm run preview
```

## 📁 Struktur Proyek

```
MilitaryInfo/
├── public/                 # Static assets
├── src/
│   ├── components/        # React components
│   │   ├── ArticleCard.jsx     # Komponen kartu artikel
│   │   ├── ArticleGrid.jsx     # Layout grid artikel
│   │   ├── SearchBar.jsx       # Form pencarian
│   │   ├── Loading.jsx         # Indikator loading
│   │   └── ErrorMessage.jsx    # Tampilan error
│   ├── services/          # API services
│   │   └── newsApi.js          # News API integration
│   ├── App.jsx            # Main app component
│   ├── main.jsx           # App entry point
│   └── index.css          # Tailwind CSS imports
├── .env                   # Environment variables (TIDAK di-commit)
├── .env.example           # Template environment variables
├── .gitignore            # Git ignore rules
├── index.html            # HTML template
├── package.json          # Dependencies & scripts
├── postcss.config.js     # PostCSS configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── vite.config.js        # Vite configuration
└── README.md             # Dokumentasi ini
```

## 🌐 Deployment

### Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login ke Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```

4. **Set Environment Variables**
   - Buka project di [Vercel Dashboard](https://vercel.com/dashboard)
   - Pergi ke Settings → Environment Variables
   - Tambahkan `VITE_NEWS_API_KEY` dengan API key Anda

5. **Redeploy**
   ```bash
   vercel --prod
   ```

### Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Build Project**
   ```bash
   npm run build
   ```

3. **Deploy**
   ```bash
   netlify deploy --prod --dir=dist
   ```

4. **Set Environment Variables**
   - Buka [Netlify Dashboard](https://app.netlify.com)
   - Pilih site Anda
   - Pergi ke Site settings → Environment variables
   - Tambahkan `VITE_NEWS_API_KEY`

## 🔧 Troubleshooting

### Issue: API Key Error (401)

**Solusi:**
- Pastikan API Key sudah ditambahkan di file `.env`
- Format harus: `VITE_NEWS_API_KEY=your_key_here` (tanpa spasi)
- Restart development server setelah mengubah .env
- Verifikasi API key di [NewsAPI Dashboard](https://newsapi.org/account)

### Issue: Tidak Ada Artikel yang Muncul

**Solusi:**
- Periksa koneksi internet
- Cek console browser untuk error messages
- Verifikasi quota API (100 requests/hari untuk free tier)
- Coba kata kunci pencarian yang berbeda

### Issue: CORS Error

**Solusi:**
- Gunakan development server (`npm run dev`)
- Jangan buka file `index.html` langsung di browser
- Untuk production, deploy ke hosting yang proper

## 📚 Referensi

### Dokumentasi Lengkap
- **[📖 Documentation Index](docs/INDEX.md)** - Daftar lengkap semua dokumentasi
- **[🔧 Technical Docs](docs/TECHNICAL_DOCS.md)** - API, caching, filtering, architecture
- **[🎤 Presentation Guide](docs/PRESENTATION_GUIDE.md)** - Panduan demo dan presentasi
- **[🚀 Quick Start](QUICK_START.md)** - Setup dalam 5 menit
- **[⚙️ Setup Instructions](SETUP_INSTRUCTIONS.md)** - Panduan setup detail
- **[🚢 Deployment Guide](DEPLOYMENT.md)** - Deploy ke Vercel/Netlify
- **[📤 GitHub Upload](GITHUB_UPLOAD.md)** - Upload ke GitHub
- **[🤝 Contributing](CONTRIBUTING.md)** - Panduan kontribusi

### External Resources
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vite.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [NewsAPI Documentation](https://newsapi.org/docs)
- [TheNewsAPI Documentation](https://thenewsapi.com/documentation)
- [RSS2JSON Documentation](https://rss2json.com/docs)

## 📄 Lisensi

Proyek ini adalah open source dan tersedia di bawah [MIT License](LICENSE).

## 👨‍💻 Developer

Dikembangkan dengan ❤️ menggunakan:
- React.js
- Vite
- Tailwind CSS
- AI Assistant (IBM Granite)

---

**Military Info** - Stay Informed on Defense & Military News
🎖️ 2025 All Rights Reserved
