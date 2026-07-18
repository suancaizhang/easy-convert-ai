import type { TranslationKeys } from "./types";

const fil: TranslationKeys = {
  // nav
  "nav.startConvert": "Simulang mag-convert",
  "nav.history": "Kasaysayan",
  "nav.logout": "Mag-logout",
  "nav.login": "Mag-login",
  "nav.register": "Mag-sign up",
  "nav.backHome": "← Bumalik sa home",

  // home
  "home.hero": "AI-Powered na Conversion ng Dokumento",
  "home.subtitle": "Mag-convert sa pagitan ng PDF, Word, Excel, PPT, at mga larawan. I-extract ang text mula sa mga larawan (OCR). Mabilis at mataas ang kalidad.",
  "home.cta": "Simulang mag-convert",
  "home.freeTrialNote": "Hindi kailangan mag-sign up. 3 libreng conversion bawat araw.",
  "home.pdfToWord": "PDF → Word",
  "home.wordToPdf": "Word → PDF",
  "home.imagesToPdf": "Mga Larawan → PDF",
  "home.mergeImages": "Pagsamahin ang mga larawan sa PDF",
  "home.ocrToWord": "Larawan sa text",
  "home.excelToPdf": "Excel → PDF",
  "home.pptToPdf": "PPT → PDF",
  "home.pdfToImage": "PDF → Larawan",
  // home group titles
  "home.groupConvert": "Conversion ng Format", // TODO: native speaker review
  "home.groupPdfTools": "PDF Toolkit", // TODO: native speaker review
  // home card descriptions
  "home.pdfToWord.desc": "I-convert ang PDF sa nae-edit na Word document", // TODO: native speaker review
  "home.wordToPdf.desc": "I-convert ang Word document sa PDF", // TODO: native speaker review
  "home.excelToPdf.desc": "I-convert ang Excel spreadsheet sa PDF", // TODO: native speaker review
  "home.pptToPdf.desc": "I-convert ang PowerPoint presentation sa PDF", // TODO: native speaker review
  "home.pdfToImage.desc": "I-convert ang bawat pahina ng PDF sa larawan", // TODO: native speaker review
  "home.imagesToPdf.desc": "Pagsamahin ang mga larawan sa isang PDF", // TODO: native speaker review
  "home.ocrToWord.desc": "I-extract ang text mula sa mga larawan o PDF", // TODO: native speaker review
  "home.mergePdf": "I-merge ang PDF", // TODO: native speaker review
  "home.mergePdf.desc": "Pagsamahin ang maraming PDF sa isang file", // TODO: native speaker review
  "home.splitPdf": "I-split ang PDF", // TODO: native speaker review
  "home.splitPdf.desc": "I-split ang PDF ayon sa saklaw ng pahina", // TODO: native speaker review
  "home.compressPdf": "I-compress ang PDF", // TODO: native speaker review
  "home.compressPdf.desc": "Bawasan ang laki ng PDF file", // TODO: native speaker review
  "home.rotatePdf": "I-rotate ang PDF", // TODO: native speaker review
  "home.rotatePdf.desc": "I-rotate ang oryentasyon ng pahina ng PDF", // TODO: native speaker review
  "home.watermarkPdf": "Magdagdag ng Watermark", // TODO: native speaker review
  "home.watermarkPdf.desc": "Magdagdag ng text watermark sa PDF", // TODO: native speaker review

  // convert
  "convert.title": "Conversion ng Dokumento",
  "convert.dropzone": "I-drop ang file dito, o mag-click para pumili",
  "convert.dropzoneHint": "Suportado: PDF, Word, Excel, PPT, PNG, JPG, WebP (max 20 MB)",
  "convert.dropzoneHintPreset": "Suportado: {formats} format (max 20 MB)",
  "convert.selectType": "Pumili ng uri ng conversion",
  "convert.conversionType": "Uri ng conversion: ",
  "convert.startConvert": "Simulang mag-convert",
  "convert.uploading": "Nag-a-upload {progress}%",
  "convert.converting": "Nagko-convert, maghintay...",
  "convert.status": "Status: {status}",
  "convert.done": "Tapos na ang conversion!",
  "convert.previewFile": "I-preview ang file",
  "convert.previewImage": "I-preview ang larawan",
  "convert.previewPdf": "I-preview ang PDF",
  "convert.download": "I-download ang file",
  "convert.continue": "Mag-convert pa",
  "convert.deleteFile": "I-delete ang file",
  "convert.deleteConfirm": "Sigurado ka bang gusto mong i-delete ang file na ito? Hindi na maibabalik.",
  "convert.deleteFailed": "Nabigo ang pag-delete, subukang muli",
  "convert.retry": "Subukang muli",
  "convert.removeFile": "Alisin ang file",
  "convert.unsupportedFormat": "Hindi suportado ang format ng file",
  "convert.fileTooLarge": "Lumampas ang file sa 20 MB limit",
  "convert.formatMismatch": "Ang mode na ito ay sumusuporta lamang sa {formats} files",
  "convert.operationFailed": "Nabigo ang operasyon, subukang muli",
  "convert.convertFailed": "Nabigo ang conversion",
  "convert.timeout": "Nag-timeout ang conversion. Tingnan ang kasaysayan mamaya.",
  "convert.connectionTimeout": "Nag-timeout ang koneksyon, subukang muli mamaya",
  "convert.previewFailed": "Nabigo ang preview",
  "convert.downloadFailed": "Nabigo ang download, subukang muli",
  "convert.guestNote": "Ang mga bisita ay may 3 libreng conversion bawat araw. ",
  "convert.guestRegister": "Mag-sign up",
  "convert.guestSuffix": " para sa higit pa.",

  // task type labels
  "taskType.pdfToWord": "PDF sa Word",
  "taskType.pdfToImage": "PDF sa Larawan",
  "taskType.wordToPdf": "Word sa PDF",
  "taskType.excelToPdf": "Excel sa PDF",
  "taskType.pptToPdf": "PPT sa PDF",
  "taskType.imagesToPdf": "Mga Larawan sa PDF",
  "taskType.ocrToWord": "Larawan sa text (OCR) → Word",

  // task status labels
  "taskStatus.success": "Tapos na",
  "taskStatus.failed": "Nabigo",
  "taskStatus.processing": "Pinoproseso",
  "taskStatus.waiting": "Naghihintay",

  // merge-images
  "merge.title": "Pagsamahin ang mga Larawan sa PDF",
  "merge.subtitle": "Hanggang 20 PNG/JPG/WebP na larawan. I-drag para ayusin.",
  "merge.dropzone": "Mag-click o mag-drop ng mga larawan dito",
  "merge.dropzoneHint": "PNG, JPG, WebP — max 20 MB bawat isa",
  "merge.startMerge": "Simulang pagsamahin ({count} larawan)",
  "merge.merging": "Pinagsasama, maghintay...",
  "merge.status": "Status: {status}",
  "merge.done": "Tapos na ang pagsasama!",
  "merge.previewPdf": "I-preview ang PDF",
  "merge.downloadPdf": "I-download ang PDF",
  "merge.continue": "Magsama pa",
  "merge.retry": "Subukang muli",
  "merge.maxImages": "Maximum {max} larawan",
  "merge.maxExceeded": "Maximum {max} larawan — ang labis ay hindi isinama",
  "merge.unsupportedFormat": "PNG, JPG, at WebP lang ang suportado",
  "merge.fileTooLarge": "Lumampas ang {name} sa 20 MB limit",
  "merge.uploadFailed": "Nabigo ang upload",
  "merge.uploadFailedBatch": "{count} larawan ang nabigong ma-upload. Subukang muli.",
  "merge.needAtLeast2": "Kailangan ng hindi bababa sa 2 larawan",
  "merge.mergeFailed": "Nabigo ang pagsasama",
  "merge.timeout": "Nag-timeout. Tingnan ang kasaysayan mamaya.",
  "merge.connectionTimeout": "Nag-timeout ang koneksyon, subukang muli mamaya",
  "merge.previewFailed": "Nabigo ang preview",
  "merge.downloadFailed": "Nabigo ang download, subukang muli",
  "merge.guestNote": "Ang mga bisita ay may 3 libreng pagsasama bawat araw. ",
  "merge.guestRegister": "Mag-sign up",
  "merge.guestSuffix": " para sa higit pa.",

  // history
  "history.title": "Kasaysayan ng Conversion",
  "history.newConvert": "Bagong conversion",
  "history.loading": "Naglo-load...",
  "history.empty": "Wala pang kasaysayan ng conversion",
  "history.startFirst": "Simulan ang unang conversion",
  "history.expired": "Expired na",
  "history.deleteConfirm": "Sigurado ka bang gusto mong i-delete ang record na ito? Hindi na maibabalik.",
  "history.deleteFailed": "Nabigo ang pag-delete, subukang muli",
  "history.previewFailed": "Nabigo ang preview",
  "history.delete": "I-delete",
  "history.preview": "I-preview",
  "history.previewImage": "I-preview ang larawan",
  "history.previewPdf": "I-preview ang PDF",
  "history.prevPage": "Nakaraan",
  "history.nextPage": "Susunod",
  "history.pageInfo": "{current} / {total}",

  // login
  "login.title": "Mag-login",
  "login.subtitle": "Mag-sign in sa Easy Convert AI",
  "login.email": "Email",
  "login.password": "Password",
  "login.passwordPlaceholder": "Hindi bababa sa 6 na character",
  "login.submit": "Mag-login",
  "login.submitting": "Nagsa-sign in...",
  "login.failed": "Nabigo ang pag-login, subukang muli",
  "login.noAccount": "Wala pang account? ",
  "login.register": "Mag-sign up",

  // register
  "register.title": "Mag-sign up",
  "register.subtitle": "Gumawa ng Easy Convert AI account",
  "register.email": "Email",
  "register.password": "Password",
  "register.passwordPlaceholder": "Hindi bababa sa 6 na character",
  "register.confirm": "I-confirm ang password",
  "register.confirmPlaceholder": "I-type muli ang password",
  "register.submit": "Mag-sign up",
  "register.submitting": "Nagsa-sign up...",
  "register.mismatch": "Hindi magkatugma ang mga password",
  "register.failed": "Nabigo ang pagpaparehistro, subukang muli",
  "register.hasAccount": "May account na? ",
  "register.login": "Mag-login",

  // api errors
  "api.requestFailed": "Nabigo ang request",
  "api.uploadFailed": "Nabigo ang upload",
  "api.networkError": "Error sa network",

  // ocr page
  "ocr.title": "OCR ng Larawan / PDF",
  "ocr.subtitle": "Sinusuportahan ang mga larawan at PDF. I-export bilang Word, plain text, o searchable PDF.",
  "ocr.dropzone": "I-drag ang file dito, o i-click para pumili",
  "ocr.dropzoneHint": "PDF, PNG, JPG, WebP (max 20 MB)",
  "ocr.outputFormat": "Format ng output",
  "ocr.formatDocx": "Word document (.docx)",
  "ocr.formatTxt": "Plain text (.txt)",
  "ocr.formatSearchablePdf": "Searchable PDF",
  "ocr.startConvert": "Simulan ang OCR",
  "ocr.converting": "Kinikilala, pakihintay...",
  "ocr.done": "Tapos na ang pagkilala!",
  "ocr.download": "I-download ang file",
  "ocr.continue": "Mag-convert pa",
  "ocr.retry": "Subukan ulit",
  "ocr.loginRequired": "Kailangan ng account para sa OCR. ",
  "ocr.loginLink": "Mag-sign in",
  "ocr.uploading": "Ina-upload {progress}%",
  "ocr.status": "Status: {status}",
  "ocr.preview": "I-preview ang Dokumento",

  // preview
  "preview.title": "Preview ng File",
  "preview.close": "Isara",
  "preview.page": "Pahina {current} / {total}",
  "preview.zoomIn": "Palakihin",
  "preview.zoomOut": "Paliitin",
  "preview.loading": "Naglo-load...",
  "preview.loadFailed": "Hindi na-load, pakisubukan muli",

  // convert docx preview
  "convert.previewDocx": "I-preview ang Dokumento",

  // images-to-pdf
  "imagesToPdf.title": "Pagsamahin ang mga Larawan sa PDF",
  "imagesToPdf.subtitle": "Pumili ng 2-20 larawan, i-drag para ayusin, pagkatapos pagsamahin sa isang PDF",
  "imagesToPdf.dropzone": "I-click o i-drag ang mga larawan dito",
  "imagesToPdf.dropzoneHint": "PNG, JPG, WebP, max 20MB bawat isa, hanggang 20 larawan",
  "imagesToPdf.selected": "{count} napili (i-drag para ayusin)",
  "imagesToPdf.startMerge": "Simulan ang Pagsama ({count} larawan)",
  "imagesToPdf.merging": "Pinagsasama, mangyaring maghintay...",
  "imagesToPdf.done": "Tapos na ang pagsasama!",
  "imagesToPdf.previewPdf": "I-preview ang PDF",
  "imagesToPdf.downloadPdf": "I-download ang PDF",
  "imagesToPdf.continue": "Magpatuloy",
  "imagesToPdf.retry": "Subukan muli",
  "imagesToPdf.needAtLeast2": "Kailangan ng hindi bababa sa 2 larawan",
  "imagesToPdf.maxExceeded": "Maximum {max} larawan, hindi kasama ang sobra",
  "imagesToPdf.unsupportedFormat": "PNG, JPG, WebP lang ang sinusuportahan",
  "imagesToPdf.fileTooLarge": "Lumampas ang {name} sa 20MB na limitasyon",

  // common
  "common.fileSizeMB": "{size} MB",
};

export default fil;
