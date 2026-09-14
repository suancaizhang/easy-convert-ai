import type { TranslationKeys } from "./types";

const id: TranslationKeys = {
  // nav
  "nav.startConvert": "Mulai konversi",
  "nav.history": "Riwayat",
  "nav.logout": "Keluar",
  "nav.login": "Masuk",
  "nav.register": "Daftar",
  "nav.backHome": "← Kembali ke beranda",

  // home
  "home.hero": "Konversi Dokumen Berbasis AI",
  "home.subtitle": "Konversi antara PDF, Word, Excel, PPT, dan gambar. Ekstraksi teks dari gambar (OCR). Cepat dan berkualitas tinggi.",
  "home.cta": "Mulai konversi",
  "home.freeTrialNote": "Tanpa daftar. 3 konversi gratis per hari.",
  "home.pdfToWord": "PDF → Word",
  "home.wordToPdf": "Word → PDF",
  "home.imagesToPdf": "Gambar → PDF",
  "home.mergeImages": "Gabung gambar ke PDF",
  "home.ocrToWord": "Gambar ke teks",
  "home.excelToPdf": "Excel → PDF",
  "home.pptToPdf": "PPT → PDF",
  "home.pdfToImage": "PDF → Gambar",
  // home group titles
  "home.groupConvert": "Konversi Format", // TODO: native speaker review
  "home.groupPdfTools": "Alat PDF", // TODO: native speaker review
  // home card descriptions
  "home.pdfToWord.desc": "Konversi PDF ke dokumen Word yang dapat diedit", // TODO: native speaker review
  "home.wordToPdf.desc": "Konversi dokumen Word ke PDF", // TODO: native speaker review
  "home.excelToPdf.desc": "Konversi spreadsheet Excel ke PDF", // TODO: native speaker review
  "home.pptToPdf.desc": "Konversi presentasi PowerPoint ke PDF", // TODO: native speaker review
  "home.pdfToImage.desc": "Konversi setiap halaman PDF ke gambar", // TODO: native speaker review
  "home.imagesToPdf.desc": "Gabungkan gambar menjadi file PDF", // TODO: native speaker review
  "home.ocrToWord.desc": "Ekstrak teks dari gambar atau PDF", // TODO: native speaker review
  "home.mergePdf": "Gabung PDF", // TODO: native speaker review
  "home.mergePdf.desc": "Gabungkan beberapa PDF menjadi satu file", // TODO: native speaker review
  "home.splitPdf": "Pisah PDF", // TODO: native speaker review
  "home.splitPdf.desc": "Pisah PDF berdasarkan rentang halaman", // TODO: native speaker review
  "home.compressPdf": "Kompres PDF", // TODO: native speaker review
  "home.compressPdf.desc": "Kurangi ukuran file PDF", // TODO: native speaker review
  "home.rotatePdf": "Putar PDF", // TODO: native speaker review
  "home.rotatePdf.desc": "Putar orientasi halaman PDF", // TODO: native speaker review
  "home.watermarkPdf": "Tambah Tanda Air", // TODO: native speaker review
  "home.watermarkPdf.desc": "Tambahkan tanda air teks ke PDF", // TODO: native speaker review

  // convert
  "convert.title": "Konversi Dokumen",
  "convert.dropzone": "Seret file ke sini, atau klik untuk memilih",
  "convert.dropzoneHint": "Mendukung PDF, Word, Excel, PPT, PNG, JPG, WebP (maks 20 MB)",
  "convert.dropzoneHintPreset": "Mendukung format {formats} (maks 20 MB)",
  "convert.selectType": "Pilih jenis konversi",
  "convert.conversionType": "Jenis konversi: ",
  "convert.startConvert": "Mulai konversi",
  "convert.uploading": "Mengunggah {progress}%",
  "convert.converting": "Mengonversi, harap tunggu...",
  "convert.status": "Status: {status}",
  "convert.done": "Konversi selesai!",
  "convert.previewFile": "Pratinjau file",
  "convert.previewImage": "Pratinjau gambar",
  "convert.previewPdf": "Pratinjau PDF",
  "convert.download": "Unduh file",
  "convert.continue": "Konversi lagi",
  "convert.deleteFile": "Hapus file",
  "convert.deleteConfirm": "Yakin ingin menghapus file ini? Tidak dapat dibatalkan.",
  "convert.deleteFailed": "Gagal menghapus, silakan coba lagi",
  "convert.retry": "Coba lagi",
  "convert.removeFile": "Hapus file",
  "convert.unsupportedFormat": "Format file tidak didukung",
  "convert.fileTooLarge": "Ukuran file melebihi batas 20 MB",
  "convert.formatMismatch": "Mode ini hanya mendukung file {formats}",
  "convert.operationFailed": "Operasi gagal, silakan coba lagi",
  "convert.convertFailed": "Konversi gagal",
  "convert.timeout": "Konversi timeout. Silakan periksa riwayat nanti.",
  "convert.connectionTimeout": "Koneksi timeout, silakan coba lagi nanti",
  "convert.previewFailed": "Pratinjau gagal",
  "convert.downloadFailed": "Unduh gagal, silakan coba lagi",
  "convert.guestNote": "Tamu mendapat 3 konversi gratis per hari. ",
  "convert.guestRegister": "Daftar",
  "convert.guestSuffix": " untuk lebih banyak.",

  // task type labels
  "taskType.pdfToWord": "PDF ke Word",
  "taskType.pdfToImage": "PDF ke Gambar",
  "taskType.wordToPdf": "Word ke PDF",
  "taskType.excelToPdf": "Excel ke PDF",
  "taskType.pptToPdf": "PPT ke PDF",
  "taskType.imagesToPdf": "Gambar ke PDF",
  "taskType.ocrToWord": "Gambar ke teks (OCR) → Word",

  // task status labels
  "taskStatus.success": "Selesai",
  "taskStatus.failed": "Gagal",
  "taskStatus.processing": "Memproses",
  "taskStatus.waiting": "Menunggu",

  // merge-images
  "merge.title": "Gabung Gambar ke PDF",
  "merge.subtitle": "Hingga 20 gambar PNG/JPG/WebP. Seret untuk mengurutkan.",
  "merge.dropzone": "Klik atau seret gambar ke sini",
  "merge.dropzoneHint": "PNG, JPG, WebP — maks 20 MB per gambar",
  "merge.startMerge": "Mulai gabung ({count} gambar)",
  "merge.merging": "Menggabung, harap tunggu...",
  "merge.status": "Status: {status}",
  "merge.done": "Penggabungan selesai!",
  "merge.previewPdf": "Pratinjau PDF",
  "merge.downloadPdf": "Unduh PDF",
  "merge.continue": "Gabung lagi",
  "merge.retry": "Coba lagi",
  "merge.maxImages": "Maksimal {max} gambar",
  "merge.maxExceeded": "Maksimal {max} gambar — kelebihan diabaikan",
  "merge.unsupportedFormat": "Hanya PNG, JPG, dan WebP yang didukung",
  "merge.fileTooLarge": "{name} melebihi batas 20 MB",
  "merge.uploadFailed": "Gagal mengunggah",
  "merge.uploadFailedBatch": "{count} gambar gagal diunggah. Silakan coba lagi.",
  "merge.needAtLeast2": "Minimal 2 gambar diperlukan",
  "merge.mergeFailed": "Penggabungan gagal",
  "merge.timeout": "Timeout. Silakan periksa riwayat nanti.",
  "merge.connectionTimeout": "Koneksi timeout, silakan coba lagi nanti",
  "merge.previewFailed": "Pratinjau gagal",
  "merge.downloadFailed": "Unduh gagal, silakan coba lagi",
  "merge.guestNote": "Tamu mendapat 3 penggabungan gratis per hari. ",
  "merge.guestRegister": "Daftar",
  "merge.guestSuffix": " untuk lebih banyak.",

  // history
  "history.title": "Riwayat Konversi",
  "history.newConvert": "Konversi baru",
  "history.loading": "Memuat...",
  "history.empty": "Belum ada riwayat konversi",
  "history.startFirst": "Mulai konversi pertama Anda",
  "history.expired": "Kedaluwarsa",
  "history.deleteConfirm": "Yakin ingin menghapus catatan ini? Tidak dapat dibatalkan.",
  "history.deleteFailed": "Gagal menghapus, silakan coba lagi",
  "history.previewFailed": "Pratinjau gagal",
  "history.delete": "Hapus",
  "history.preview": "Pratinjau",
  "history.previewImage": "Pratinjau gambar",
  "history.previewPdf": "Pratinjau PDF",
  "history.prevPage": "Sebelumnya",
  "history.nextPage": "Berikutnya",
  "history.pageInfo": "{current} / {total}",

  // login
  "login.title": "Masuk",
  "login.subtitle": "Masuk ke Easy Convert AI",
  "login.email": "Email",
  "login.password": "Kata sandi",
  "login.passwordPlaceholder": "Minimal 6 karakter",
  "login.submit": "Masuk",
  "login.submitting": "Sedang masuk...",
  "login.failed": "Gagal masuk, silakan coba lagi",
  "login.noAccount": "Belum punya akun? ",
  "login.register": "Daftar",

  // register
  "register.title": "Daftar",
  "register.subtitle": "Buat akun Easy Convert AI",
  "register.email": "Email",
  "register.password": "Kata sandi",
  "register.passwordPlaceholder": "Minimal 6 karakter",
  "register.confirm": "Konfirmasi kata sandi",
  "register.confirmPlaceholder": "Masukkan kata sandi lagi",
  "register.submit": "Daftar",
  "register.submitting": "Mendaftar...",
  "register.mismatch": "Kata sandi tidak cocok",
  "register.failed": "Pendaftaran gagal, silakan coba lagi",
  "register.hasAccount": "Sudah punya akun? ",
  "register.login": "Masuk",

  // api errors
  "api.requestFailed": "Permintaan gagal",
  "api.uploadFailed": "Gagal mengunggah",
  "api.networkError": "Kesalahan jaringan",

  // ocr page
  "ocr.title": "OCR Gambar / PDF",
  "ocr.subtitle": "Mendukung gambar dan PDF. Ekspor ke Word, teks biasa, atau PDF yang dapat dicari.",
  "ocr.dropzone": "Seret file ke sini, atau klik untuk memilih",
  "ocr.dropzoneHint": "PDF, PNG, JPG, WebP (maks 20 MB)",
  "ocr.outputFormat": "Format keluaran",
  "ocr.formatDocx": "Dokumen Word (.docx)",
  "ocr.formatTxt": "Teks biasa (.txt)",
  "ocr.formatSearchablePdf": "PDF yang dapat dicari",
  "ocr.startConvert": "Mulai OCR",
  "ocr.converting": "Mengenali, mohon tunggu...",
  "ocr.done": "Pengenalan selesai!",
  "ocr.download": "Unduh file",
  "ocr.continue": "Konversi lain",
  "ocr.retry": "Coba lagi",
  "ocr.loginRequired": "OCR memerlukan akun. ",
  "ocr.loginLink": "Masuk",
  "ocr.uploading": "Mengunggah {progress}%",
  "ocr.status": "Status: {status}",
  "ocr.preview": "Pratinjau Dokumen",

  // preview
  "preview.title": "Pratinjau File",
  "preview.close": "Tutup",
  "preview.page": "Halaman {current} / {total}",
  "preview.zoomIn": "Perbesar",
  "preview.zoomOut": "Perkecil",
  "preview.loading": "Memuat...",
  "preview.loadFailed": "Gagal memuat, silakan coba lagi",

  // convert docx preview
  "convert.previewDocx": "Pratinjau Dokumen",

  // images-to-pdf
  "imagesToPdf.title": "Gabung Gambar ke PDF",
  "imagesToPdf.subtitle": "Pilih 2-20 gambar, seret untuk mengurutkan, lalu gabung menjadi PDF",
  "imagesToPdf.dropzone": "Klik atau seret gambar ke sini",
  "imagesToPdf.dropzoneHint": "PNG, JPG, WebP, maks 20MB per gambar, hingga 20 gambar",
  "imagesToPdf.selected": "{count} dipilih (seret untuk mengurutkan)",
  "imagesToPdf.startMerge": "Mulai Gabung ({count} gambar)",
  "imagesToPdf.merging": "Sedang menggabungkan, harap tunggu...",
  "imagesToPdf.done": "Penggabungan selesai!",
  "imagesToPdf.previewPdf": "Pratinjau PDF",
  "imagesToPdf.downloadPdf": "Unduh PDF",
  "imagesToPdf.continue": "Lanjutkan",
  "imagesToPdf.retry": "Coba lagi",
  "imagesToPdf.needAtLeast2": "Minimal 2 gambar diperlukan",
  "imagesToPdf.maxExceeded": "Maksimal {max} gambar, lebihan diabaikan",
  "imagesToPdf.unsupportedFormat": "Hanya mendukung PNG, JPG, WebP",
  "imagesToPdf.fileTooLarge": "{name} melebihi batas 20MB",

  // common
  "common.fileSizeMB": "{size} MB",

  // progress & cancel
  "progress.converting_pages": "Mengonversi halaman {current} dari {total}",
  "progress.converting_images": "Memproses gambar {current} dari {total}",
  "progress.converting_generic": "Memproses {current}/{total}",
  "cancel.button": "Batal",
  "cancel.cancelled": "Tugas dibatalkan",
  "cancel.cannotCancel": "Tugas sedang diproses, tidak dapat dibatalkan",
};

export default id;
