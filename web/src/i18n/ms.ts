import type { TranslationKeys } from "./types";

const ms: TranslationKeys = {
  // nav
  "nav.startConvert": "Mula tukar",
  "nav.history": "Sejarah",
  "nav.logout": "Log keluar",
  "nav.login": "Log masuk",
  "nav.register": "Daftar",
  "nav.backHome": "← Kembali ke laman utama",

  // home
  "home.hero": "Penukaran Dokumen Berkuasa AI",
  "home.subtitle": "Tukar antara PDF, Word, Excel, PPT dan imej. Ekstrak teks daripada imej (OCR). Pantas dan berkualiti tinggi.",
  "home.cta": "Mula tukar",
  "home.freeTrialNote": "Tidak perlu daftar. 3 penukaran percuma setiap hari.",
  "home.pdfToWord": "PDF → Word",
  "home.wordToPdf": "Word → PDF",
  "home.imagesToPdf": "Imej → PDF",
  "home.mergeImages": "Gabung imej ke PDF",
  "home.ocrToWord": "Imej ke teks",
  "home.excelToPdf": "Excel → PDF",
  "home.pptToPdf": "PPT → PDF",
  "home.pdfToImage": "PDF → Imej",
  // home group titles
  "home.groupConvert": "Penukaran Format", // TODO: native speaker review
  "home.groupPdfTools": "Kotak Alat PDF", // TODO: native speaker review
  // home card descriptions
  "home.pdfToWord.desc": "Tukar PDF kepada dokumen Word yang boleh diedit", // TODO: native speaker review
  "home.wordToPdf.desc": "Tukar dokumen Word kepada PDF", // TODO: native speaker review
  "home.excelToPdf.desc": "Tukar hamparan Excel kepada PDF", // TODO: native speaker review
  "home.pptToPdf.desc": "Tukar pembentangan PowerPoint kepada PDF", // TODO: native speaker review
  "home.pdfToImage.desc": "Tukar setiap halaman PDF kepada imej", // TODO: native speaker review
  "home.imagesToPdf.desc": "Gabungkan imej ke dalam fail PDF", // TODO: native speaker review
  "home.ocrToWord.desc": "Ekstrak teks daripada imej atau PDF", // TODO: native speaker review
  "home.mergePdf": "Gabung PDF", // TODO: native speaker review
  "home.mergePdf.desc": "Gabungkan beberapa PDF menjadi satu fail", // TODO: native speaker review
  "home.splitPdf": "Pisah PDF", // TODO: native speaker review
  "home.splitPdf.desc": "Pisah PDF mengikut julat halaman", // TODO: native speaker review
  "home.compressPdf": "Mampat PDF", // TODO: native speaker review
  "home.compressPdf.desc": "Kurangkan saiz fail PDF", // TODO: native speaker review
  "home.rotatePdf": "Putar PDF", // TODO: native speaker review
  "home.rotatePdf.desc": "Putar orientasi halaman PDF", // TODO: native speaker review
  "home.watermarkPdf": "Tambah Tera Air", // TODO: native speaker review
  "home.watermarkPdf.desc": "Tambah tera air teks pada PDF", // TODO: native speaker review

  // convert
  "convert.title": "Penukaran Dokumen",
  "convert.dropzone": "Seret fail ke sini, atau klik untuk memilih",
  "convert.dropzoneHint": "Menyokong PDF, Word, Excel, PPT, PNG, JPG, WebP (maks 20 MB)",
  "convert.dropzoneHintPreset": "Menyokong format {formats} (maks 20 MB)",
  "convert.selectType": "Pilih jenis penukaran",
  "convert.conversionType": "Jenis penukaran: ",
  "convert.startConvert": "Mula tukar",
  "convert.uploading": "Memuat naik {progress}%",
  "convert.converting": "Sedang menukar, sila tunggu...",
  "convert.status": "Status: {status}",
  "convert.done": "Penukaran selesai!",
  "convert.previewFile": "Pratonton fail",
  "convert.previewImage": "Pratonton imej",
  "convert.previewPdf": "Pratonton PDF",
  "convert.download": "Muat turun fail",
  "convert.continue": "Tukar lagi",
  "convert.deleteFile": "Padam fail",
  "convert.deleteConfirm": "Adakah anda pasti mahu memadam fail ini? Tindakan ini tidak boleh dibatalkan.",
  "convert.deleteFailed": "Gagal memadam, sila cuba lagi",
  "convert.retry": "Cuba lagi",
  "convert.removeFile": "Buang fail",
  "convert.unsupportedFormat": "Format fail tidak disokong",
  "convert.fileTooLarge": "Saiz fail melebihi had 20 MB",
  "convert.formatMismatch": "Mod ini hanya menyokong fail {formats}",
  "convert.operationFailed": "Operasi gagal, sila cuba lagi",
  "convert.convertFailed": "Penukaran gagal",
  "convert.timeout": "Penukaran tamat masa. Sila semak sejarah kemudian.",
  "convert.connectionTimeout": "Sambungan tamat masa, sila cuba lagi kemudian",
  "convert.previewFailed": "Pratonton gagal",
  "convert.downloadFailed": "Muat turun gagal, sila cuba lagi",
  "convert.guestNote": "Tetamu mendapat 3 penukaran percuma setiap hari. ",
  "convert.guestRegister": "Daftar",
  "convert.guestSuffix": " untuk lebih banyak.",

  // task type labels
  "taskType.pdfToWord": "PDF ke Word",
  "taskType.pdfToImage": "PDF ke Imej",
  "taskType.wordToPdf": "Word ke PDF",
  "taskType.excelToPdf": "Excel ke PDF",
  "taskType.pptToPdf": "PPT ke PDF",
  "taskType.imagesToPdf": "Imej ke PDF",
  "taskType.ocrToWord": "Imej ke teks (OCR) → Word",

  // task status labels
  "taskStatus.success": "Selesai",
  "taskStatus.failed": "Gagal",
  "taskStatus.processing": "Sedang diproses",
  "taskStatus.waiting": "Menunggu",

  // merge-images
  "merge.title": "Gabung Imej ke PDF",
  "merge.subtitle": "Sehingga 20 imej PNG/JPG/WebP. Seret untuk menyusun.",
  "merge.dropzone": "Klik atau seret imej ke sini",
  "merge.dropzoneHint": "PNG, JPG, WebP — maks 20 MB setiap satu",
  "merge.startMerge": "Mula gabung ({count} imej)",
  "merge.merging": "Sedang menggabung, sila tunggu...",
  "merge.status": "Status: {status}",
  "merge.done": "Penggabungan selesai!",
  "merge.previewPdf": "Pratonton PDF",
  "merge.downloadPdf": "Muat turun PDF",
  "merge.continue": "Gabung lagi",
  "merge.retry": "Cuba lagi",
  "merge.maxImages": "Maksimum {max} imej",
  "merge.maxExceeded": "Maksimum {max} imej — lebihan diabaikan",
  "merge.unsupportedFormat": "Hanya PNG, JPG dan WebP disokong",
  "merge.fileTooLarge": "{name} melebihi had 20 MB",
  "merge.uploadFailed": "Muat naik gagal",
  "merge.uploadFailedBatch": "{count} imej gagal dimuat naik. Sila cuba lagi.",
  "merge.needAtLeast2": "Sekurang-kurangnya 2 imej diperlukan",
  "merge.mergeFailed": "Penggabungan gagal",
  "merge.timeout": "Tamat masa. Sila semak sejarah kemudian.",
  "merge.connectionTimeout": "Sambungan tamat masa, sila cuba lagi kemudian",
  "merge.previewFailed": "Pratonton gagal",
  "merge.downloadFailed": "Muat turun gagal, sila cuba lagi",
  "merge.guestNote": "Tetamu mendapat 3 penggabungan percuma setiap hari. ",
  "merge.guestRegister": "Daftar",
  "merge.guestSuffix": " untuk lebih banyak.",

  // history
  "history.title": "Sejarah Penukaran",
  "history.newConvert": "Penukaran baru",
  "history.loading": "Memuatkan...",
  "history.empty": "Tiada sejarah penukaran",
  "history.startFirst": "Mulakan penukaran pertama anda",
  "history.expired": "Tamat tempoh",
  "history.deleteConfirm": "Adakah anda pasti mahu memadam rekod ini? Tindakan ini tidak boleh dibatalkan.",
  "history.deleteFailed": "Gagal memadam, sila cuba lagi",
  "history.previewFailed": "Pratonton gagal",
  "history.delete": "Padam",
  "history.preview": "Pratonton",
  "history.previewImage": "Pratonton imej",
  "history.previewPdf": "Pratonton PDF",
  "history.prevPage": "Sebelumnya",
  "history.nextPage": "Seterusnya",
  "history.pageInfo": "{current} / {total}",

  // login
  "login.title": "Log masuk",
  "login.subtitle": "Log masuk ke Easy Convert AI",
  "login.email": "E-mel",
  "login.password": "Kata laluan",
  "login.passwordPlaceholder": "Sekurang-kurangnya 6 aksara",
  "login.submit": "Log masuk",
  "login.submitting": "Sedang log masuk...",
  "login.failed": "Log masuk gagal, sila cuba lagi",
  "login.noAccount": "Belum ada akaun? ",
  "login.register": "Daftar",

  // register
  "register.title": "Daftar",
  "register.subtitle": "Cipta akaun Easy Convert AI",
  "register.email": "E-mel",
  "register.password": "Kata laluan",
  "register.passwordPlaceholder": "Sekurang-kurangnya 6 aksara",
  "register.confirm": "Sahkan kata laluan",
  "register.confirmPlaceholder": "Masukkan kata laluan sekali lagi",
  "register.submit": "Daftar",
  "register.submitting": "Sedang mendaftar...",
  "register.mismatch": "Kata laluan tidak sepadan",
  "register.failed": "Pendaftaran gagal, sila cuba lagi",
  "register.hasAccount": "Sudah ada akaun? ",
  "register.login": "Log masuk",

  // api errors
  "api.requestFailed": "Permintaan gagal",
  "api.uploadFailed": "Muat naik gagal",
  "api.networkError": "Ralat rangkaian",

  // ocr page
  "ocr.title": "OCR Imej / PDF",
  "ocr.subtitle": "Menyokong imej dan PDF. Output sebagai Word, teks biasa atau PDF boleh cari.",
  "ocr.dropzone": "Seret fail ke sini, atau klik untuk pilih",
  "ocr.dropzoneHint": "PDF, PNG, JPG, WebP (maks 20 MB)",
  "ocr.outputFormat": "Format output",
  "ocr.formatDocx": "Dokumen Word (.docx)",
  "ocr.formatTxt": "Teks biasa (.txt)",
  "ocr.formatSearchablePdf": "PDF boleh cari",
  "ocr.startConvert": "Mula OCR",
  "ocr.converting": "Mengenal pasti, sila tunggu...",
  "ocr.done": "Pengenalan selesai!",
  "ocr.download": "Muat turun fail",
  "ocr.continue": "Tukar lain",
  "ocr.retry": "Cuba semula",
  "ocr.loginRequired": "OCR memerlukan akaun. ",
  "ocr.loginLink": "Log masuk",
  "ocr.uploading": "Memuat naik {progress}%",
  "ocr.status": "Status: {status}",
  "ocr.preview": "Pratonton Dokumen",

  // preview
  "preview.title": "Pratonton Fail",
  "preview.close": "Tutup",
  "preview.page": "Halaman {current} / {total}",
  "preview.zoomIn": "Zum masuk",
  "preview.zoomOut": "Zum keluar",
  "preview.loading": "Memuatkan...",
  "preview.loadFailed": "Gagal memuat, sila cuba lagi",

  // convert docx preview
  "convert.previewDocx": "Pratonton Dokumen",

  // images-to-pdf
  "imagesToPdf.title": "Gabung Imej ke PDF",
  "imagesToPdf.subtitle": "Pilih 2-20 imej, seret untuk susun, kemudian gabung menjadi PDF",
  "imagesToPdf.dropzone": "Klik atau seret imej ke sini",
  "imagesToPdf.dropzoneHint": "PNG, JPG, WebP, maks 20MB setiap satu, sehingga 20 imej",
  "imagesToPdf.selected": "{count} dipilih (seret untuk susun)",
  "imagesToPdf.startMerge": "Mula Gabung ({count} imej)",
  "imagesToPdf.merging": "Sedang menggabung, sila tunggu...",
  "imagesToPdf.done": "Penggabungan selesai!",
  "imagesToPdf.previewPdf": "Pratonton PDF",
  "imagesToPdf.downloadPdf": "Muat turun PDF",
  "imagesToPdf.continue": "Teruskan",
  "imagesToPdf.retry": "Cuba lagi",
  "imagesToPdf.needAtLeast2": "Sekurang-kurangnya 2 imej diperlukan",
  "imagesToPdf.maxExceeded": "Maksimum {max} imej, lebihan diabaikan",
  "imagesToPdf.unsupportedFormat": "Hanya menyokong PNG, JPG, WebP",
  "imagesToPdf.fileTooLarge": "{name} melebihi had 20MB",

  // common
  "common.fileSizeMB": "{size} MB",
};

export default ms;
