import React, { useState, useRef } from 'react';
import { useLab } from '../../context/LabContext';
import {
  downloadStandardLabExcelTemplate,
  parseAndValidateExcel,
  ValidationSummary,
  ParsedImportRow,
} from '../../utils/excelImportExport';
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  Layers,
  Database,
  Building,
  MapPin,
  Sparkles,
  FileText,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ExcelImportModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { chemicals, bottles, isManager, importExcelChemicals, currentUser } = useLab();

  const [step, setStep] = useState<'UPLOAD' | 'VALIDATE' | 'SUCCESS'>('UPLOAD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<'SKIP' | 'UPDATE'>('UPDATE');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ERROR' | 'WARNING' | 'VALID'>('ALL');
  const [importResult, setImportResult] = useState<{ count: number; message: string } | null>(null);

  // Google Sheets input state
  const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [googleSheetError, setGoogleSheetError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Section 66: Reserved strictly for Managers
  if (!isManager) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl border border-rose-200">
          <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">TRUY CẬP BỊ TỪ CHỐI</h2>
          <p className="text-xs text-slate-600 mt-2">
            Chức năng <strong>Nhập Hóa Chất bằng Excel / Google Sheets</strong> (Mục 66) chỉ dành riêng cho tài khoản có vai trò <strong>MANAGER</strong>.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Tài khoản hiện tại của bạn: <strong>{currentUser.name}</strong> ({currentUser.role}).
          </p>
          <button
            onClick={onClose}
            className="mt-6 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  // Handle file select
  const handleFileProcess = async (file: File) => {
    setSelectedFile(file);
    setIsLoading(true);
    try {
      const summary = await parseAndValidateExcel(file, chemicals, bottles);
      setValidationSummary(summary);
      setStep('VALIDATE');
    } catch (err: any) {
      alert(`Không thể đọc file: ${err.message || 'File không đúng định dạng Excel/CSV'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    downloadStandardLabExcelTemplate();
  };

  const handleLoadSampleData = async () => {
    setIsLoading(true);
    try {
      // Create a blob representing standard template and parse it
      const response = await fetch('/MAU_NHAP_HOA_CHAT_PHONG_LAB.xlsx').catch(() => null);
      if (response && response.ok) {
        const blob = await response.blob();
        const file = new File([blob], 'MAU_NHAP_HOA_CHAT_PHONG_LAB.xlsx', { type: blob.type });
        handleFileProcess(file);
      } else {
        // Fallback: generate blob directly in memory
        downloadStandardLabExcelTemplate();
        alert('File mẫu chuẩn MẪU_NHẬP_HÓA_CHẤT_PHÒNG_LAB.xlsx đã được tải về máy của bạn. Hãy chọn tệp vừa tải để xem trước và kiểm tra.');
      }
    } catch (e) {
      downloadStandardLabExcelTemplate();
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sheets integration helper
  const handleGoogleSheetsImport = async () => {
    if (!googleSheetUrl.trim()) {
      setGoogleSheetError('Vui lòng dán link Google Sheets hoặc link CSV đã xuất bản.');
      return;
    }
    setGoogleSheetError(null);
    setIsLoading(true);

    try {
      // Support published CSV URLs or Google Sheets link conversion
      let fetchUrl = googleSheetUrl.trim();
      if (fetchUrl.includes('docs.google.com/spreadsheets/d/')) {
        const matches = fetchUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (matches && matches[1]) {
          const sheetId = matches[1];
          fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        }
      }

      const res = await fetch(fetchUrl);
      if (!res.ok) {
        throw new Error('Không thể kết nối đến Google Sheets. Hãy đảm bảo trang tính đã được chia sẻ công khai ("Bất kỳ ai có đường liên kết").');
      }
      const blob = await res.blob();
      const file = new File([blob], 'google_sheets_data.csv', { type: 'text/csv' });
      await handleFileProcess(file);
      setIsGoogleSheetsOpen(false);
    } catch (err: any) {
      setGoogleSheetError(`Lỗi kết nối Google Sheets: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm import
  const handleConfirmImport = () => {
    if (!validationSummary) return;
    if (validationSummary.errorRows > 0) {
      alert('Không thể xác nhận nhập kho vì vẫn còn lỗi nghiêm trọng. Vui lòng khắc phục lỗi trong file trước.');
      return;
    }

    const res = importExcelChemicals(validationSummary.rows, duplicateHandling);
    if (res.success) {
      setImportResult({ count: res.importedCount, message: res.message });
      setStep('SUCCESS');
      if (onSuccess) onSuccess();
    } else {
      alert(res.message);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setValidationSummary(null);
    setStep('UPLOAD');
    setImportResult(null);
  };

  // Filter rows in preview
  const previewRows = validationSummary
    ? validationSummary.rows.filter((r) => {
        if (statusFilter === 'ERROR') return r.status === 'ERROR';
        if (statusFilter === 'WARNING') return r.status === 'WARNING';
        if (statusFilter === 'VALID') return r.status === 'VALID';
        return true;
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150 my-auto">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Nhập Hóa Chất Bằng Excel / Google Sheets
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  Manager Only
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Quy trình: Tải mẫu → Điền dữ liệu → Tải lên → Kiểm tra → Xem trước → Xác nhận
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Progress Steps */}
        <div className="px-6 py-2.5 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-6">
            <div
              className={`flex items-center gap-2 ${
                step === 'UPLOAD' ? 'text-cyan-700 font-bold' : 'text-slate-500'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 'UPLOAD' ? 'bg-cyan-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                1
              </span>
              <span>1. Tải mẫu & Tải lên file</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
            <div
              className={`flex items-center gap-2 ${
                step === 'VALIDATE' ? 'text-cyan-700 font-bold' : 'text-slate-500'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 'VALIDATE' ? 'bg-cyan-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                2
              </span>
              <span>2. Kiểm tra dữ liệu & Xem trước</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
            <div
              className={`flex items-center gap-2 ${
                step === 'SUCCESS' ? 'text-emerald-700 font-bold' : 'text-slate-500'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 'SUCCESS' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                3
              </span>
              <span>3. Xác nhận nhập kho</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* STEP 1: UPLOAD */}
          {step === 'UPLOAD' && (
            <div className="space-y-6">
              {/* Template download & Google Sheets links */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span>Mẫu Excel Chuẩn Phòng Lab (5 Sheets)</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    File mẫu gồm: <strong>DANH_MỤC_HÓA_CHẤT</strong>, <strong>DANH_SÁCH_CHAI</strong>, <strong>NHẬP_KHO_BAN_ĐẦU</strong>, <strong>NHÀ_CUNG_CẤP</strong>, <strong>VỊ_TRÍ_LƯU_TRỮ</strong>.
                  </p>
                  <button
                    onClick={handleDownloadTemplate}
                    className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải Mẫu Excel Chuẩn (.xlsx)</span>
                  </button>
                </div>

                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                    <ExternalLink className="w-4 h-4 text-blue-700" />
                    <span>Mẫu Google Sheets Trực Tuyến</span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Mở biểu mẫu trực tuyến trên Google Sheets hoặc nhập link trang tính công khai để nạp dữ liệu trực tiếp.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsGoogleSheetsOpen(true)}
                      className="flex-1 py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Nhập link Google Sheets</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Google Sheets input box if toggled */}
              {isGoogleSheetsOpen && (
                <div className="p-4 bg-white border border-blue-200 rounded-xl shadow-xs space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <ExternalLink className="w-4 h-4 text-blue-600" />
                      Dán liên kết Google Sheets hoặc CSV URL
                    </span>
                    <button
                      onClick={() => setIsGoogleSheetsOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className="space-y-1">
                    <input
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit hoặc link CSV công khai"
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="text-[11px] text-slate-500">
                      * Lưu ý: Chia sẻ Google Sheet ở chế độ <em>"Bất kỳ ai có đường liên kết đều có thể xem"</em>.
                    </p>
                  </div>
                  {googleSheetError && (
                    <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                      {googleSheetError}
                    </div>
                  )}
                  <button
                    onClick={handleGoogleSheetsImport}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Đang đọc trang tính...' : 'Nạp dữ liệu từ Google Sheets'}
                  </button>
                </div>
              )}

              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-cyan-500 bg-slate-50/50 hover:bg-cyan-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-12 h-12 mx-auto rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Kéo & thả file Excel (.xlsx) hoặc CSV vào đây
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Hoặc bấm vào vùng này để duyệt file từ máy tính của bạn
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Hỗ trợ định dạng Excel (.xlsx, .xls) và CSV UTF-8
                </div>
              </div>

              {/* Guide details of 5 sheets */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-700">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-cyan-700" />
                  <span>Quy chuẩn 5 Trang trong Biểu Mẫu Chuẩn (Mục 67 - 72)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block mb-0.5">1. DANH_MỤC_HÓA_CHẤT</span>
                    Mã hóa chất, Tên, Số CAS, Công thức, Cấp độ tinh khiết (AR), Đơn vị (mL/g), Ngưỡng Min/Warning.
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block mb-0.5">2. DANH_SÁCH_CHAI</span>
                    Mỗi chai là một dòng: Mã chai (HEX-001), Mã hóa chất, Số lượng ban đầu, Số lô, Hạn dùng, Vị trí.
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block mb-0.5">3. NHẬP_KHO_BAN_ĐẦU</span>
                    Mã phiếu, Mã chai, Số lượng nhập, Ngày nhập, Nhà cung cấp, Người nhận, Ghi chú.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: VALIDATE & PREVIEW (Section 73, 74, 75) */}
          {step === 'VALIDATE' && validationSummary && (
            <div className="space-y-5">
              {/* Summary Metrics Bar (Section 73) */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                  KIỂM TRA DỮ LIỆU FILE: {selectedFile?.name || 'File đã chọn'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] text-slate-500 font-medium">Tổng số dòng</div>
                    <div className="text-lg font-bold font-mono text-slate-900">
                      {validationSummary.totalRows}
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="text-[11px] text-emerald-800 font-medium">Dòng hợp lệ</div>
                    <div className="text-lg font-bold font-mono text-emerald-700">
                      {validationSummary.validRows}
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="text-[11px] text-amber-800 font-medium">Cảnh báo</div>
                    <div className="text-lg font-bold font-mono text-amber-700">
                      {validationSummary.warningRows}
                    </div>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <div className="text-[11px] text-rose-800 font-medium">Lỗi nghiêm trọng</div>
                    <div className="text-lg font-bold font-mono text-rose-700">
                      {validationSummary.errorRows}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Warning Banner if errors exist (Section 73 & 74) */}
              {validationSummary.errorRows > 0 ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">
                      Phát hiện {validationSummary.errorRows} dòng có lỗi nghiêm trọng!
                    </strong>
                    <span className="text-[11px] text-rose-800 mt-0.5 block">
                      Hệ thống tuân thủ quy tắc <strong>Mục 73</strong>: <em>Nếu còn lỗi nghiêm trọng thì không cho phép nhập vào hệ thống</em>. Vui lòng kiểm tra các dòng màu đỏ bên dưới, sửa đổi trong file và bấm <strong>[Kiểm tra lại]</strong>.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Dữ liệu đã sẵn sàng! Không có lỗi nghiêm trọng nào. Bạn có thể xem trước chi tiết bên dưới trước khi bấm <strong>Xác nhận nhập</strong>.
                  </span>
                </div>
              )}

              {/* Section 75: Duplicate Chemical Handling Rule */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-cyan-700" />
                  <span>Quy tắc xử lý hóa chất trùng lặp (Mục 75 - Khớp theo CAS hoặc Mã hóa chất):</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-cyan-500">
                    <input
                      type="radio"
                      name="duplicateHandling"
                      checked={duplicateHandling === 'UPDATE'}
                      onChange={() => setDuplicateHandling('UPDATE')}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-900 block">Gộp chai vào hóa chất đã có & Cập nhật thông tin (Khuyên dùng)</span>
                      <span className="text-[10px] text-slate-500 block">Không tạo thêm hóa chất trùng CAS/Mã, tự động liên kết các chai mới vào hóa chất gốc.</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-cyan-500">
                    <input
                      type="radio"
                      name="duplicateHandling"
                      checked={duplicateHandling === 'SKIP'}
                      onChange={() => setDuplicateHandling('SKIP')}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-900 block">Bỏ qua mã chai hoặc hóa chất đã có</span>
                      <span className="text-[10px] text-slate-500 block">Nếu mã chai đã tồn tại trong kho thì bỏ qua không nhập trùng.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Table Preview Filter & Content */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs space-y-0">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Xem Trước Dữ Liệu Chi Tiết ({previewRows.length} dòng)
                  </span>

                  {/* Filter buttons */}
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-2.5 py-1 rounded font-medium ${
                        statusFilter === 'ALL'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Tất cả ({validationSummary.totalRows})
                    </button>
                    {validationSummary.errorRows > 0 && (
                      <button
                        onClick={() => setStatusFilter('ERROR')}
                        className={`px-2.5 py-1 rounded font-medium ${
                          statusFilter === 'ERROR'
                            ? 'bg-rose-600 text-white'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        Chỉ lỗi ({validationSummary.errorRows})
                      </button>
                    )}
                    {validationSummary.warningRows > 0 && (
                      <button
                        onClick={() => setStatusFilter('WARNING')}
                        className={`px-2.5 py-1 rounded font-medium ${
                          statusFilter === 'WARNING'
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        Cảnh báo ({validationSummary.warningRows})
                      </button>
                    )}
                    <button
                      onClick={() => setStatusFilter('VALID')}
                      className={`px-2.5 py-1 rounded font-medium ${
                        statusFilter === 'VALID'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      Hợp lệ ({validationSummary.validRows})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-mono text-[10px] uppercase border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Dòng</th>
                        <th className="px-3 py-2">Trạng thái</th>
                        <th className="px-3 py-2">Hóa chất</th>
                        <th className="px-3 py-2">Mã chai</th>
                        <th className="px-3 py-2">Lượng ban đầu</th>
                        <th className="px-3 py-2">Số CAS</th>
                        <th className="px-3 py-2">Số Lô</th>
                        <th className="px-3 py-2">Hạn dùng</th>
                        <th className="px-3 py-2">Vị trí</th>
                        <th className="px-4 py-2">Lỗi & Cảnh báo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={`${
                            row.status === 'ERROR'
                              ? 'bg-rose-50/50 hover:bg-rose-50'
                              : row.status === 'WARNING'
                              ? 'bg-amber-50/40 hover:bg-amber-50/70'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-3 py-2 font-mono text-slate-400 text-[11px]">
                            #{row.rowNumber}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.status === 'VALID' && (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Hợp lệ
                              </span>
                            )}
                            {row.status === 'WARNING' && (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-[11px]">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Cảnh báo
                              </span>
                            )}
                            {row.status === 'ERROR' && (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-semibold text-[11px]">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                LỖI
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-900">{row.chemicalName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {row.chemicalCode} {row.isExistingChem ? '· (Đã có trong kho)' : '· (Tạo mới)'}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono font-semibold text-slate-800">
                            {row.bottleCode}
                          </td>
                          <td className="px-3 py-2 font-mono whitespace-nowrap">
                            <strong className="text-slate-900">{row.quantity}</strong> {row.unit}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">
                            {row.casNumber || <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">
                            {row.lotNumber}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                            {row.expiryDate}
                          </td>
                          <td className="px-3 py-2 text-slate-600 text-[11px] truncate max-w-[140px]" title={row.locationStr}>
                            {row.locationStr}
                          </td>
                          <td className="px-4 py-2 text-[11px]">
                            {row.issues.length > 0 ? (
                              <ul className="list-disc list-inside space-y-0.5">
                                {row.issues.map((iss, i) => (
                                  <li
                                    key={i}
                                    className={
                                      iss.startsWith('LỖI')
                                        ? 'text-rose-700 font-medium'
                                        : 'text-amber-700'
                                    }
                                  >
                                    {iss}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-slate-400">Đạt chuẩn</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS (Section 70) */}
          {step === 'SUCCESS' && importResult && (
            <div className="text-center py-8 space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Nhập Kho Thành Công!
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {importResult.message}
                </p>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 text-left space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Hệ thống đã tự động:
                </div>
                <ul className="list-disc list-inside text-[11px] text-emerald-800 space-y-1">
                  <li>Tạo các chai hóa chất mới theo đúng mã và số lượng ban đầu</li>
                  <li>Tạo các phiếu nhập kho (Stock In) kèm ngày nhập và người nhận</li>
                  <li>Cập nhật tổng dung lượng tồn kho cho các hóa chất liên quan</li>
                  <li>Ghi nhận nhật ký kiểm toán vĩnh viễn (Audit Log)</li>
                </ul>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  Xem Kho Hóa Chất
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-xl transition-colors"
                >
                  Nhập file khác
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls (Section 73) */}
        {step === 'VALIDATE' && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Hủy / Chọn file khác
              </button>
              <button
                onClick={() => selectedFile && handleFileProcess(selectedFile)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kiểm tra lại</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {validationSummary && validationSummary.errorRows > 0 && (
                <span className="text-xs text-rose-600 font-medium">
                  Cần sửa {validationSummary.errorRows} lỗi trước khi nhập
                </span>
              )}
              <button
                onClick={handleConfirmImport}
                disabled={!validationSummary || validationSummary.errorRows > 0}
                className={`px-5 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 shadow-xs cursor-pointer ${
                  validationSummary && validationSummary.errorRows === 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Xác Nhận Nhập Kho ({validationSummary?.validRows || 0} dòng hợp lệ)</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
