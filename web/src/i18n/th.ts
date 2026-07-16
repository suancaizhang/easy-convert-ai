import type { TranslationKeys } from "./types";

const th: TranslationKeys = {
  // nav
  "nav.startConvert": "เริ่มแปลง",
  "nav.history": "ประวัติ",
  "nav.logout": "ออกจากระบบ",
  "nav.login": "เข้าสู่ระบบ",
  "nav.register": "สมัครสมาชิก",
  "nav.backHome": "← กลับหน้าหลัก",

  // home
  "home.hero": "แปลงเอกสารด้วย AI",
  "home.subtitle": "แปลงระหว่าง PDF, Word, Excel, PPT และรูปภาพ สกัดข้อความจากรูป (OCR) รวดเร็วและคุณภาพสูง",
  "home.cta": "เริ่มแปลง",
  "home.freeTrialNote": "ไม่ต้องสมัคร แปลงฟรี 3 ครั้งต่อวัน",
  "home.pdfToWord": "PDF → Word",
  "home.wordToPdf": "Word → PDF",
  "home.imagesToPdf": "รูปภาพ → PDF",
  "home.mergeImages": "รวมรูปเป็น PDF",
  "home.ocrToWord": "รูปเป็นข้อความ",
  "home.excelToPdf": "Excel → PDF",
  "home.pptToPdf": "PPT → PDF",
  "home.pdfToImage": "PDF → รูปภาพ",
  // home group titles
  "home.groupConvert": "แปลงรูปแบบ", // TODO: native speaker review
  "home.groupPdfTools": "เครื่องมือ PDF", // TODO: native speaker review
  // home card descriptions
  "home.pdfToWord.desc": "แปลง PDF เป็นเอกสาร Word ที่แก้ไขได้", // TODO: native speaker review
  "home.wordToPdf.desc": "แปลงเอกสาร Word เป็น PDF", // TODO: native speaker review
  "home.excelToPdf.desc": "แปลงสเปรดชีต Excel เป็น PDF", // TODO: native speaker review
  "home.pptToPdf.desc": "แปลงงานนำเสนอ PowerPoint เป็น PDF", // TODO: native speaker review
  "home.pdfToImage.desc": "แปลงแต่ละหน้า PDF เป็นรูปภาพ", // TODO: native speaker review
  "home.imagesToPdf.desc": "รวมรูปภาพเป็นไฟล์ PDF", // TODO: native speaker review
  "home.ocrToWord.desc": "ดึงข้อความจากรูปภาพหรือ PDF", // TODO: native speaker review
  "home.mergePdf": "รวม PDF", // TODO: native speaker review
  "home.mergePdf.desc": "รวม PDF หลายไฟล์เป็นไฟล์เดียว", // TODO: native speaker review
  "home.splitPdf": "แยก PDF", // TODO: native speaker review
  "home.splitPdf.desc": "แยก PDF ตามช่วงหน้า", // TODO: native speaker review
  "home.compressPdf": "บีบอัด PDF", // TODO: native speaker review
  "home.compressPdf.desc": "ลดขนาดไฟล์ PDF", // TODO: native speaker review
  "home.rotatePdf": "หมุน PDF", // TODO: native speaker review
  "home.rotatePdf.desc": "หมุนทิศทางหน้า PDF", // TODO: native speaker review
  "home.watermarkPdf": "เพิ่มลายน้ำ", // TODO: native speaker review
  "home.watermarkPdf.desc": "เพิ่มลายน้ำข้อความใน PDF", // TODO: native speaker review

  // convert
  "convert.title": "แปลงเอกสาร",
  "convert.dropzone": "ลากไฟล์มาที่นี่ หรือคลิกเพื่อเลือก",
  "convert.dropzoneHint": "รองรับ PDF, Word, Excel, PPT, PNG, JPG, WebP (สูงสุด 20 MB)",
  "convert.dropzoneHintPreset": "รองรับไฟล์ {formats} (สูงสุด 20 MB)",
  "convert.selectType": "เลือกประเภทการแปลง",
  "convert.conversionType": "ประเภทการแปลง: ",
  "convert.startConvert": "เริ่มแปลง",
  "convert.uploading": "กำลังอัปโหลด {progress}%",
  "convert.converting": "กำลังแปลง กรุณารอ...",
  "convert.status": "สถานะ: {status}",
  "convert.done": "แปลงเสร็จสิ้น!",
  "convert.previewFile": "ดูตัวอย่างไฟล์",
  "convert.previewImage": "ดูตัวอย่างรูปภาพ",
  "convert.previewPdf": "ดูตัวอย่าง PDF",
  "convert.download": "ดาวน์โหลดไฟล์",
  "convert.continue": "แปลงต่อ",
  "convert.deleteFile": "ลบไฟล์",
  "convert.deleteConfirm": "คุณแน่ใจหรือไม่ว่าต้องการลบไฟล์นี้? ไม่สามารถย้อนกลับได้",
  "convert.deleteFailed": "ลบไม่สำเร็จ กรุณาลองอีกครั้ง",
  "convert.retry": "ลองอีกครั้ง",
  "convert.removeFile": "นำไฟล์ออก",
  "convert.unsupportedFormat": "ไม่รองรับรูปแบบไฟล์นี้",
  "convert.fileTooLarge": "ขนาดไฟล์เกินขีดจำกัด 20 MB",
  "convert.formatMismatch": "โหมดนี้รองรับเฉพาะไฟล์ {formats}",
  "convert.operationFailed": "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง",
  "convert.convertFailed": "แปลงไม่สำเร็จ",
  "convert.timeout": "การแปลงหมดเวลา กรุณาตรวจสอบประวัติภายหลัง",
  "convert.connectionTimeout": "การเชื่อมต่อหมดเวลา กรุณาลองอีกครั้งภายหลัง",
  "convert.previewFailed": "ดูตัวอย่างไม่สำเร็จ",
  "convert.downloadFailed": "ดาวน์โหลดไม่สำเร็จ กรุณาลองอีกครั้ง",
  "convert.guestNote": "ผู้เยี่ยมชมแปลงฟรี 3 ครั้งต่อวัน ",
  "convert.guestRegister": "สมัครสมาชิก",
  "convert.guestSuffix": "เพื่อรับเพิ่ม",

  // task type labels
  "taskType.pdfToWord": "PDF เป็น Word",
  "taskType.pdfToImage": "PDF เป็นรูปภาพ",
  "taskType.wordToPdf": "Word เป็น PDF",
  "taskType.excelToPdf": "Excel เป็น PDF",
  "taskType.pptToPdf": "PPT เป็น PDF",
  "taskType.imagesToPdf": "รูปภาพเป็น PDF",
  "taskType.ocrToWord": "รูปเป็นข้อความ (OCR) → Word",

  // task status labels
  "taskStatus.success": "เสร็จสิ้น",
  "taskStatus.failed": "ล้มเหลว",
  "taskStatus.processing": "กำลังดำเนินการ",
  "taskStatus.waiting": "รอดำเนินการ",

  // merge-images
  "merge.title": "รวมรูปเป็น PDF",
  "merge.subtitle": "สูงสุด 20 รูป PNG/JPG/WebP ลากเพื่อจัดลำดับ",
  "merge.dropzone": "คลิกหรือลากรูปมาที่นี่",
  "merge.dropzoneHint": "PNG, JPG, WebP — สูงสุด 20 MB ต่อรูป",
  "merge.startMerge": "เริ่มรวม ({count} รูป)",
  "merge.merging": "กำลังรวม กรุณารอ...",
  "merge.status": "สถานะ: {status}",
  "merge.done": "รวมเสร็จสิ้น!",
  "merge.previewPdf": "ดูตัวอย่าง PDF",
  "merge.downloadPdf": "ดาวน์โหลด PDF",
  "merge.continue": "รวมต่อ",
  "merge.retry": "ลองอีกครั้ง",
  "merge.maxImages": "สูงสุด {max} รูป",
  "merge.maxExceeded": "สูงสุด {max} รูป — ส่วนเกินถูกข้าม",
  "merge.unsupportedFormat": "รองรับเฉพาะ PNG, JPG และ WebP",
  "merge.fileTooLarge": "{name} เกินขีดจำกัด 20 MB",
  "merge.uploadFailed": "อัปโหลดไม่สำเร็จ",
  "merge.uploadFailedBatch": "{count} รูปอัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง",
  "merge.needAtLeast2": "ต้องมีอย่างน้อย 2 รูป",
  "merge.mergeFailed": "รวมไม่สำเร็จ",
  "merge.timeout": "หมดเวลา กรุณาตรวจสอบประวัติภายหลัง",
  "merge.connectionTimeout": "การเชื่อมต่อหมดเวลา กรุณาลองอีกครั้งภายหลัง",
  "merge.previewFailed": "ดูตัวอย่างไม่สำเร็จ",
  "merge.downloadFailed": "ดาวน์โหลดไม่สำเร็จ กรุณาลองอีกครั้ง",
  "merge.guestNote": "ผู้เยี่ยมชมรวมฟรี 3 ครั้งต่อวัน ",
  "merge.guestRegister": "สมัครสมาชิก",
  "merge.guestSuffix": "เพื่อรับเพิ่ม",

  // history
  "history.title": "ประวัติการแปลง",
  "history.newConvert": "แปลงใหม่",
  "history.loading": "กำลังโหลด...",
  "history.empty": "ยังไม่มีประวัติการแปลง",
  "history.startFirst": "เริ่มการแปลงครั้งแรก",
  "history.expired": "หมดอายุ",
  "history.deleteConfirm": "คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? ไม่สามารถย้อนกลับได้",
  "history.deleteFailed": "ลบไม่สำเร็จ กรุณาลองอีกครั้ง",
  "history.previewFailed": "ดูตัวอย่างไม่สำเร็จ",
  "history.delete": "ลบ",
  "history.preview": "ดูตัวอย่าง",
  "history.previewImage": "ดูตัวอย่างรูปภาพ",
  "history.previewPdf": "ดูตัวอย่าง PDF",
  "history.prevPage": "ก่อนหน้า",
  "history.nextPage": "ถัดไป",
  "history.pageInfo": "{current} / {total}",

  // login
  "login.title": "เข้าสู่ระบบ",
  "login.subtitle": "เข้าสู่ระบบ Easy Convert AI",
  "login.email": "อีเมล",
  "login.password": "รหัสผ่าน",
  "login.passwordPlaceholder": "อย่างน้อย 6 ตัวอักษร",
  "login.submit": "เข้าสู่ระบบ",
  "login.submitting": "กำลังเข้าสู่ระบบ...",
  "login.failed": "เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง",
  "login.noAccount": "ยังไม่มีบัญชี? ",
  "login.register": "สมัครสมาชิก",

  // register
  "register.title": "สมัครสมาชิก",
  "register.subtitle": "สร้างบัญชี Easy Convert AI",
  "register.email": "อีเมล",
  "register.password": "รหัสผ่าน",
  "register.passwordPlaceholder": "อย่างน้อย 6 ตัวอักษร",
  "register.confirm": "ยืนยันรหัสผ่าน",
  "register.confirmPlaceholder": "กรอกรหัสผ่านอีกครั้ง",
  "register.submit": "สมัครสมาชิก",
  "register.submitting": "กำลังสมัคร...",
  "register.mismatch": "รหัสผ่านไม่ตรงกัน",
  "register.failed": "สมัครไม่สำเร็จ กรุณาลองอีกครั้ง",
  "register.hasAccount": "มีบัญชีแล้ว? ",
  "register.login": "เข้าสู่ระบบ",

  // api errors
  "api.requestFailed": "คำขอล้มเหลว",
  "api.uploadFailed": "อัปโหลดไม่สำเร็จ",
  "api.networkError": "ข้อผิดพลาดเครือข่าย",

  // ocr page
  "ocr.title": "OCR รูปภาพ / PDF",
  "ocr.subtitle": "รองรับรูปภาพและ PDF ส่งออกเป็น Word ข้อความธรรมดา หรือ PDF ที่ค้นหาได้",
  "ocr.dropzone": "วางไฟล์ที่นี่ หรือคลิกเพื่อเลือก",
  "ocr.dropzoneHint": "PDF, PNG, JPG, WebP (สูงสุด 20 MB)",
  "ocr.outputFormat": "รูปแบบผลลัพธ์",
  "ocr.formatDocx": "เอกสาร Word (.docx)",
  "ocr.formatTxt": "ข้อความธรรมดา (.txt)",
  "ocr.formatSearchablePdf": "PDF ที่ค้นหาได้",
  "ocr.startConvert": "เริ่ม OCR",
  "ocr.converting": "กำลังรู้จำ กรุณารอ...",
  "ocr.done": "รู้จำเสร็จแล้ว!",
  "ocr.download": "ดาวน์โหลดไฟล์",
  "ocr.continue": "แปลงต่อ",
  "ocr.retry": "ลองใหม่",
  "ocr.loginRequired": "OCR ต้องเข้าสู่ระบบ ",
  "ocr.loginLink": "เข้าสู่ระบบ",
  "ocr.uploading": "กำลังอัปโหลด {progress}%",
  "ocr.status": "สถานะ: {status}",

  // common
  "common.fileSizeMB": "{size} MB",
};

export default th;
