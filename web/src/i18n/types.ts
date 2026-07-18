export interface TranslationKeys {
  // nav
  "nav.startConvert": string;
  "nav.history": string;
  "nav.logout": string;
  "nav.login": string;
  "nav.register": string;
  "nav.backHome": string;

  // home
  "home.hero": string;
  "home.subtitle": string;
  "home.cta": string;
  "home.freeTrialNote": string;
  "home.pdfToWord": string;
  "home.wordToPdf": string;
  "home.imagesToPdf": string;
  "home.mergeImages": string;
  "home.ocrToWord": string;
  "home.excelToPdf": string;
  "home.pptToPdf": string;
  "home.pdfToImage": string;
  // home group titles
  "home.groupConvert": string;
  "home.groupPdfTools": string;
  // home card descriptions
  "home.pdfToWord.desc": string;
  "home.wordToPdf.desc": string;
  "home.excelToPdf.desc": string;
  "home.pptToPdf.desc": string;
  "home.pdfToImage.desc": string;
  "home.imagesToPdf.desc": string;
  "home.ocrToWord.desc": string;
  "home.mergePdf": string;
  "home.mergePdf.desc": string;
  "home.splitPdf": string;
  "home.splitPdf.desc": string;
  "home.compressPdf": string;
  "home.compressPdf.desc": string;
  "home.rotatePdf": string;
  "home.rotatePdf.desc": string;
  "home.watermarkPdf": string;
  "home.watermarkPdf.desc": string;

  // convert
  "convert.title": string;
  "convert.dropzone": string;
  "convert.dropzoneHint": string;
  "convert.dropzoneHintPreset": string;
  "convert.selectType": string;
  "convert.conversionType": string;
  "convert.startConvert": string;
  "convert.uploading": string;
  "convert.converting": string;
  "convert.status": string;
  "convert.done": string;
  "convert.previewFile": string;
  "convert.previewImage": string;
  "convert.previewPdf": string;
  "convert.download": string;
  "convert.continue": string;
  "convert.deleteFile": string;
  "convert.deleteConfirm": string;
  "convert.deleteFailed": string;
  "convert.retry": string;
  "convert.removeFile": string;
  "convert.unsupportedFormat": string;
  "convert.fileTooLarge": string;
  "convert.formatMismatch": string;
  "convert.operationFailed": string;
  "convert.convertFailed": string;
  "convert.timeout": string;
  "convert.connectionTimeout": string;
  "convert.previewFailed": string;
  "convert.downloadFailed": string;
  "convert.guestNote": string;
  "convert.guestRegister": string;
  "convert.guestSuffix": string;

  // task type labels
  "taskType.pdfToWord": string;
  "taskType.pdfToImage": string;
  "taskType.wordToPdf": string;
  "taskType.excelToPdf": string;
  "taskType.pptToPdf": string;
  "taskType.imagesToPdf": string;
  "taskType.ocrToWord": string;

  // task status labels
  "taskStatus.success": string;
  "taskStatus.failed": string;
  "taskStatus.processing": string;
  "taskStatus.waiting": string;

  // merge-images
  "merge.title": string;
  "merge.subtitle": string;
  "merge.dropzone": string;
  "merge.dropzoneHint": string;
  "merge.startMerge": string;
  "merge.merging": string;
  "merge.status": string;
  "merge.done": string;
  "merge.previewPdf": string;
  "merge.downloadPdf": string;
  "merge.continue": string;
  "merge.retry": string;
  "merge.maxImages": string;
  "merge.maxExceeded": string;
  "merge.unsupportedFormat": string;
  "merge.fileTooLarge": string;
  "merge.uploadFailed": string;
  "merge.uploadFailedBatch": string;
  "merge.needAtLeast2": string;
  "merge.mergeFailed": string;
  "merge.timeout": string;
  "merge.connectionTimeout": string;
  "merge.previewFailed": string;
  "merge.downloadFailed": string;
  "merge.guestNote": string;
  "merge.guestRegister": string;
  "merge.guestSuffix": string;

  // history
  "history.title": string;
  "history.newConvert": string;
  "history.loading": string;
  "history.empty": string;
  "history.startFirst": string;
  "history.expired": string;
  "history.deleteConfirm": string;
  "history.deleteFailed": string;
  "history.previewFailed": string;
  "history.delete": string;
  "history.preview": string;
  "history.previewImage": string;
  "history.previewPdf": string;
  "history.prevPage": string;
  "history.nextPage": string;
  "history.pageInfo": string;

  // login
  "login.title": string;
  "login.subtitle": string;
  "login.email": string;
  "login.password": string;
  "login.passwordPlaceholder": string;
  "login.submit": string;
  "login.submitting": string;
  "login.failed": string;
  "login.noAccount": string;
  "login.register": string;

  // register
  "register.title": string;
  "register.subtitle": string;
  "register.email": string;
  "register.password": string;
  "register.passwordPlaceholder": string;
  "register.confirm": string;
  "register.confirmPlaceholder": string;
  "register.submit": string;
  "register.submitting": string;
  "register.mismatch": string;
  "register.failed": string;
  "register.hasAccount": string;
  "register.login": string;

  // api errors
  "api.requestFailed": string;
  "api.uploadFailed": string;
  "api.networkError": string;

  // ocr page
  "ocr.title": string;
  "ocr.subtitle": string;
  "ocr.dropzone": string;
  "ocr.dropzoneHint": string;
  "ocr.outputFormat": string;
  "ocr.formatDocx": string;
  "ocr.formatTxt": string;
  "ocr.formatSearchablePdf": string;
  "ocr.startConvert": string;
  "ocr.converting": string;
  "ocr.done": string;
  "ocr.download": string;
  "ocr.continue": string;
  "ocr.retry": string;
  "ocr.loginRequired": string;
  "ocr.loginLink": string;
  "ocr.uploading": string;
  "ocr.status": string;
  "ocr.preview": string;

  // preview
  "preview.title": string;
  "preview.close": string;
  "preview.page": string;
  "preview.zoomIn": string;
  "preview.zoomOut": string;
  "preview.loading": string;
  "preview.loadFailed": string;

  // convert docx preview
  "convert.previewDocx": string;

  // images-to-pdf
  "imagesToPdf.title": string;
  "imagesToPdf.subtitle": string;
  "imagesToPdf.dropzone": string;
  "imagesToPdf.dropzoneHint": string;
  "imagesToPdf.selected": string;
  "imagesToPdf.startMerge": string;
  "imagesToPdf.merging": string;
  "imagesToPdf.done": string;
  "imagesToPdf.previewPdf": string;
  "imagesToPdf.downloadPdf": string;
  "imagesToPdf.continue": string;
  "imagesToPdf.retry": string;
  "imagesToPdf.needAtLeast2": string;
  "imagesToPdf.maxExceeded": string;
  "imagesToPdf.unsupportedFormat": string;
  "imagesToPdf.fileTooLarge": string;

  // common
  "common.fileSizeMB": string;
}
