import type { TranslationKeys } from "./types";

const vi: TranslationKeys = {
  // nav
  "nav.startConvert": "Bắt đầu chuyển đổi",
  "nav.history": "Lịch sử",
  "nav.logout": "Đăng xuất",
  "nav.login": "Đăng nhập",
  "nav.register": "Đăng ký",
  "nav.backHome": "← Quay lại trang chủ",

  // home
  "home.hero": "Chuyển đổi tài liệu bằng AI",
  "home.subtitle": "Chuyển đổi giữa PDF, Word, Excel, PPT và hình ảnh. Trích xuất văn bản từ hình ảnh (OCR). Nhanh chóng và chất lượng cao.",
  "home.cta": "Bắt đầu chuyển đổi",
  "home.freeTrialNote": "Không cần đăng ký. 3 lần chuyển đổi miễn phí mỗi ngày.",
  "home.pdfToWord": "PDF → Word",
  "home.wordToPdf": "Word → PDF",
  "home.imagesToPdf": "Hình ảnh → PDF",
  "home.mergeImages": "Gộp ảnh thành PDF",
  "home.ocrToWord": "Ảnh thành văn bản",
  "home.excelToPdf": "Excel → PDF",
  "home.pptToPdf": "PPT → PDF",
  "home.pdfToImage": "PDF → Hình ảnh",
  // home group titles
  "home.groupConvert": "Chuyển đổi định dạng", // TODO: native speaker review
  "home.groupPdfTools": "Công cụ PDF", // TODO: native speaker review
  // home card descriptions
  "home.pdfToWord.desc": "Chuyển PDF thành tài liệu Word có thể chỉnh sửa", // TODO: native speaker review
  "home.wordToPdf.desc": "Chuyển tài liệu Word thành PDF", // TODO: native speaker review
  "home.excelToPdf.desc": "Chuyển bảng tính Excel thành PDF", // TODO: native speaker review
  "home.pptToPdf.desc": "Chuyển bản trình bày PowerPoint thành PDF", // TODO: native speaker review
  "home.pdfToImage.desc": "Chuyển từng trang PDF thành hình ảnh", // TODO: native speaker review
  "home.imagesToPdf.desc": "Kết hợp hình ảnh thành file PDF", // TODO: native speaker review
  "home.ocrToWord.desc": "Trích xuất văn bản từ hình ảnh hoặc PDF", // TODO: native speaker review
  "home.mergePdf": "Gộp PDF", // TODO: native speaker review
  "home.mergePdf.desc": "Kết hợp nhiều PDF thành một file", // TODO: native speaker review
  "home.splitPdf": "Tách PDF", // TODO: native speaker review
  "home.splitPdf.desc": "Tách PDF theo phạm vi trang", // TODO: native speaker review
  "home.compressPdf": "Nén PDF", // TODO: native speaker review
  "home.compressPdf.desc": "Giảm kích thước file PDF", // TODO: native speaker review
  "home.rotatePdf": "Xoay PDF", // TODO: native speaker review
  "home.rotatePdf.desc": "Xoay hướng trang PDF", // TODO: native speaker review
  "home.watermarkPdf": "Thêm hình mờ", // TODO: native speaker review
  "home.watermarkPdf.desc": "Thêm hình mờ văn bản vào PDF", // TODO: native speaker review

  // convert
  "convert.title": "Chuyển đổi tài liệu",
  "convert.dropzone": "Kéo thả file vào đây, hoặc nhấp để chọn",
  "convert.dropzoneHint": "Hỗ trợ PDF, Word, Excel, PPT, PNG, JPG, WebP (tối đa 20 MB)",
  "convert.dropzoneHintPreset": "Hỗ trợ định dạng {formats} (tối đa 20 MB)",
  "convert.selectType": "Chọn loại chuyển đổi",
  "convert.conversionType": "Loại chuyển đổi: ",
  "convert.startConvert": "Bắt đầu chuyển đổi",
  "convert.uploading": "Đang tải lên {progress}%",
  "convert.converting": "Đang chuyển đổi, vui lòng đợi...",
  "convert.status": "Trạng thái: {status}",
  "convert.done": "Chuyển đổi hoàn tất!",
  "convert.previewFile": "Xem trước file",
  "convert.previewImage": "Xem trước hình ảnh",
  "convert.previewPdf": "Xem trước PDF",
  "convert.download": "Tải xuống file",
  "convert.continue": "Chuyển đổi tiếp",
  "convert.deleteFile": "Xóa file",
  "convert.deleteConfirm": "Bạn có chắc muốn xóa file này? Không thể hoàn tác.",
  "convert.deleteFailed": "Xóa thất bại, vui lòng thử lại",
  "convert.retry": "Thử lại",
  "convert.removeFile": "Gỡ file",
  "convert.unsupportedFormat": "Định dạng file không được hỗ trợ",
  "convert.fileTooLarge": "Kích thước file vượt quá giới hạn 20 MB",
  "convert.formatMismatch": "Chế độ này chỉ hỗ trợ file {formats}",
  "convert.operationFailed": "Thao tác thất bại, vui lòng thử lại",
  "convert.convertFailed": "Chuyển đổi thất bại",
  "convert.timeout": "Hết thời gian chuyển đổi. Vui lòng kiểm tra lịch sử sau.",
  "convert.connectionTimeout": "Hết thời gian kết nối, vui lòng thử lại sau",
  "convert.previewFailed": "Xem trước thất bại",
  "convert.downloadFailed": "Tải xuống thất bại, vui lòng thử lại",
  "convert.guestNote": "Khách được 3 lần chuyển đổi miễn phí mỗi ngày. ",
  "convert.guestRegister": "Đăng ký",
  "convert.guestSuffix": " để có thêm.",

  // task type labels
  "taskType.pdfToWord": "PDF sang Word",
  "taskType.pdfToImage": "PDF sang Hình ảnh",
  "taskType.wordToPdf": "Word sang PDF",
  "taskType.excelToPdf": "Excel sang PDF",
  "taskType.pptToPdf": "PPT sang PDF",
  "taskType.imagesToPdf": "Hình ảnh sang PDF",
  "taskType.ocrToWord": "Ảnh sang văn bản (OCR) → Word",

  // task status labels
  "taskStatus.success": "Hoàn tất",
  "taskStatus.failed": "Thất bại",
  "taskStatus.processing": "Đang xử lý",
  "taskStatus.waiting": "Đang chờ",

  // merge-images
  "merge.title": "Gộp ảnh thành PDF",
  "merge.subtitle": "Tối đa 20 ảnh PNG/JPG/WebP. Kéo để sắp xếp.",
  "merge.dropzone": "Nhấp hoặc kéo ảnh vào đây",
  "merge.dropzoneHint": "PNG, JPG, WebP — tối đa 20 MB mỗi ảnh",
  "merge.startMerge": "Bắt đầu gộp ({count} ảnh)",
  "merge.merging": "Đang gộp, vui lòng đợi...",
  "merge.status": "Trạng thái: {status}",
  "merge.done": "Gộp hoàn tất!",
  "merge.previewPdf": "Xem trước PDF",
  "merge.downloadPdf": "Tải PDF",
  "merge.continue": "Gộp tiếp",
  "merge.retry": "Thử lại",
  "merge.maxImages": "Tối đa {max} ảnh",
  "merge.maxExceeded": "Tối đa {max} ảnh — phần thừa bị bỏ qua",
  "merge.unsupportedFormat": "Chỉ hỗ trợ PNG, JPG và WebP",
  "merge.fileTooLarge": "{name} vượt quá giới hạn 20 MB",
  "merge.uploadFailed": "Tải lên thất bại",
  "merge.uploadFailedBatch": "{count} ảnh tải lên thất bại. Vui lòng thử lại.",
  "merge.needAtLeast2": "Cần ít nhất 2 ảnh",
  "merge.mergeFailed": "Gộp thất bại",
  "merge.timeout": "Hết thời gian. Vui lòng kiểm tra lịch sử sau.",
  "merge.connectionTimeout": "Hết thời gian kết nối, vui lòng thử lại sau",
  "merge.previewFailed": "Xem trước thất bại",
  "merge.downloadFailed": "Tải xuống thất bại, vui lòng thử lại",
  "merge.guestNote": "Khách được 3 lần gộp miễn phí mỗi ngày. ",
  "merge.guestRegister": "Đăng ký",
  "merge.guestSuffix": " để có thêm.",

  // history
  "history.title": "Lịch sử chuyển đổi",
  "history.newConvert": "Chuyển đổi mới",
  "history.loading": "Đang tải...",
  "history.empty": "Chưa có lịch sử chuyển đổi",
  "history.startFirst": "Bắt đầu chuyển đổi đầu tiên",
  "history.expired": "Hết hạn",
  "history.deleteConfirm": "Bạn có chắc muốn xóa bản ghi này? Không thể hoàn tác.",
  "history.deleteFailed": "Xóa thất bại, vui lòng thử lại",
  "history.previewFailed": "Xem trước thất bại",
  "history.delete": "Xóa",
  "history.preview": "Xem trước",
  "history.previewImage": "Xem trước hình ảnh",
  "history.previewPdf": "Xem trước PDF",
  "history.prevPage": "Trước",
  "history.nextPage": "Sau",
  "history.pageInfo": "{current} / {total}",

  // login
  "login.title": "Đăng nhập",
  "login.subtitle": "Đăng nhập vào Easy Convert AI",
  "login.email": "Email",
  "login.password": "Mật khẩu",
  "login.passwordPlaceholder": "Ít nhất 6 ký tự",
  "login.submit": "Đăng nhập",
  "login.submitting": "Đang đăng nhập...",
  "login.failed": "Đăng nhập thất bại, vui lòng thử lại",
  "login.noAccount": "Chưa có tài khoản? ",
  "login.register": "Đăng ký",

  // register
  "register.title": "Đăng ký",
  "register.subtitle": "Tạo tài khoản Easy Convert AI",
  "register.email": "Email",
  "register.password": "Mật khẩu",
  "register.passwordPlaceholder": "Ít nhất 6 ký tự",
  "register.confirm": "Xác nhận mật khẩu",
  "register.confirmPlaceholder": "Nhập lại mật khẩu",
  "register.submit": "Đăng ký",
  "register.submitting": "Đang đăng ký...",
  "register.mismatch": "Mật khẩu không khớp",
  "register.failed": "Đăng ký thất bại, vui lòng thử lại",
  "register.hasAccount": "Đã có tài khoản? ",
  "register.login": "Đăng nhập",

  // api errors
  "api.requestFailed": "Yêu cầu thất bại",
  "api.uploadFailed": "Tải lên thất bại",
  "api.networkError": "Lỗi mạng",

  // ocr page
  "ocr.title": "OCR Hình ảnh / PDF",
  "ocr.subtitle": "Hỗ trợ hình ảnh và PDF. Xuất ra Word, văn bản thuần hoặc PDF tìm kiếm được.",
  "ocr.dropzone": "Kéo thả tệp vào đây, hoặc nhấp để chọn",
  "ocr.dropzoneHint": "PDF, PNG, JPG, WebP (tối đa 20 MB)",
  "ocr.outputFormat": "Định dạng đầu ra",
  "ocr.formatDocx": "Tài liệu Word (.docx)",
  "ocr.formatTxt": "Văn bản thuần (.txt)",
  "ocr.formatSearchablePdf": "PDF tìm kiếm được",
  "ocr.startConvert": "Bắt đầu OCR",
  "ocr.converting": "Đang nhận dạng, vui lòng chờ...",
  "ocr.done": "Nhận dạng hoàn tất!",
  "ocr.download": "Tải tệp",
  "ocr.continue": "Tiếp tục",
  "ocr.retry": "Thử lại",
  "ocr.loginRequired": "OCR yêu cầu đăng nhập. ",
  "ocr.loginLink": "Đăng nhập",
  "ocr.uploading": "Đang tải lên {progress}%",
  "ocr.status": "Trạng thái: {status}",
  "ocr.preview": "Xem trước tài liệu",

  // preview
  "preview.title": "Xem trước tệp",
  "preview.close": "Đóng",
  "preview.page": "Trang {current} / {total}",
  "preview.zoomIn": "Phóng to",
  "preview.zoomOut": "Thu nhỏ",
  "preview.loading": "Đang tải...",
  "preview.loadFailed": "Tải thất bại, vui lòng thử lại",

  // convert docx preview
  "convert.previewDocx": "Xem trước tài liệu",

  // images-to-pdf
  "imagesToPdf.title": "Ghép ảnh thành PDF",
  "imagesToPdf.subtitle": "Chọn 2-20 ảnh, kéo để sắp xếp, sau đó ghép thành PDF",
  "imagesToPdf.dropzone": "Nhấp hoặc kéo ảnh vào đây",
  "imagesToPdf.dropzoneHint": "PNG, JPG, WebP, tối đa 20MB mỗi ảnh, tối đa 20 ảnh",
  "imagesToPdf.selected": "Đã chọn {count} ảnh (kéo để sắp xếp)",
  "imagesToPdf.startMerge": "Bắt đầu ghép ({count} ảnh)",
  "imagesToPdf.merging": "Đang ghép, vui lòng đợi...",
  "imagesToPdf.done": "Ghép hoàn tất!",
  "imagesToPdf.previewPdf": "Xem trước PDF",
  "imagesToPdf.downloadPdf": "Tải PDF",
  "imagesToPdf.continue": "Tiếp tục",
  "imagesToPdf.retry": "Thử lại",
  "imagesToPdf.needAtLeast2": "Cần ít nhất 2 ảnh",
  "imagesToPdf.maxExceeded": "Tối đa {max} ảnh, phần thừa bị bỏ qua",
  "imagesToPdf.unsupportedFormat": "Chỉ hỗ trợ PNG, JPG, WebP",
  "imagesToPdf.fileTooLarge": "{name} vượt quá giới hạn 20MB",

  // common
  "common.fileSizeMB": "{size} MB",
};

export default vi;
