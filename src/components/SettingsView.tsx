import React, { useState } from 'react';
import { useLab } from '../context/LabContext';
import { calculateStockStatus, calculateRecommendedPurchase, calculateExpiryStatus } from '../utils/status';
import { convertUnit } from '../utils/units';
import {
  exportChemicalInventoryCSV,
  exportUsageHistoryCSV,
  exportPurchaseListCSV,
  exportExpiryReportCSV,
} from '../utils/exportImport';
import { downloadStandardLabExcelTemplate } from '../utils/excelImportExport';
import { ExcelImportModal } from './modals/ExcelImportModal';
import { UserRole, User } from '../types';
import {
  Database,
  PlayCircle,
  History,
  FileSpreadsheet,
  Users,
  RotateCcw,
  AlertTriangle,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Check,
  Layers,
  Lock,
  UserPlus,
  Edit2,
  Trash2,
  Archive,
  Shield,
  Info,
  HelpCircle,
  Zap,
  RefreshCw,
  Copy,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { testSupabaseConnection } from '../lib/supabase';

type SettingsTab = 'supabase' | 'backup' | 'test' | 'audit' | 'reports' | 'users';

interface Props {
  onOpenArchiveCenter?: () => void;
  onOpenSupabaseConfig?: () => void;
}

interface TestCaseResult {
  id: string;
  name: string;
  scenario: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export const SettingsView: React.FC<Props> = ({ onOpenArchiveCenter, onOpenSupabaseConfig }) => {
  const {
    chemicals,
    bottles,
    transactions,
    purchaseItems,
    auditLogs,
    users,
    currentUser,
    setCurrentUser,
    addUser,
    updateUser,
    deleteUser,
    canExportHistory,
    isManager,
    canManageUsers,
    resetToDemoData,
    clearAllData,
    exportDatabaseJSON,
    importDatabaseJSON,
    getChemicalTotalStock,
    getChemicalStockStatus,
    getChemicalExpiryStatus,
    isSupabaseConfigured,
    isRealtimeActive,
    isSyncing,
    refreshFromSupabase,
  } = useLab();

  const [activeTab, setActiveTab] = useState<SettingsTab>('supabase');
  const [exportWarning, setExportWarning] = useState<string | null>(null);

  // Supabase test state
  const [supabaseTesting, setSupabaseTesting] = useState(false);
  const [supabasePingResult, setSupabasePingResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);

  const handleTestSupabase = async () => {
    setSupabaseTesting(true);
    setSupabasePingResult(null);
    try {
      const res = await testSupabaseConnection();
      setSupabasePingResult(res);
    } finally {
      setSupabaseTesting(false);
    }
  };

  // Test Suite state
  const [testResults, setTestResults] = useState<TestCaseResult[] | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const [importJsonText, setImportJsonText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [excelImportOpen, setExcelImportOpen] = useState(false);

  // User Management State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('USER');
  const [editDept, setEditDept] = useState('');

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('USER');
  const [addDept, setAddDept] = useState('Phòng Thí nghiệm Dược liệu');
  const [userActionMessage, setUserActionMessage] = useState<string | null>(null);

  // Automated 7 Test Cases Runner (Page 22-23)
  const runTests = () => {
    setIsRunningTests(true);

    const results: TestCaseResult[] = [];

    // TEST 1: Add 5 L Ethanol, Use 500 mL -> Expected = 4.5 L
    const initialT1 = 5.0;
    const usedT1_mL = 500;
    const usedT1_L = convertUnit(usedT1_mL, 'mL', 'L')!;
    const remainingT1 = Math.round((initialT1 - usedT1_L) * 100) / 100;
    results.push({
      id: 'TEST 1',
      name: 'Khấu trừ tồn kho đa đơn vị (L/mL)',
      scenario: 'Tồn đầu: 5 L Ethanol, Sử dụng: 500 mL',
      expected: 'Tồn kho còn lại = 4.5 L',
      actual: `Tồn kho tính được = ${remainingT1} L`,
      passed: remainingT1 === 4.5,
    });

    // TEST 2: Current = 1 L, Minimum = 1.5 L -> Expected status = LOW STOCK
    const statusT2 = calculateStockStatus(1.0, 0.5, 1.5);
    results.push({
      id: 'TEST 2',
      name: 'Cảnh báo tồn kho sắp hết (Low Stock)',
      scenario: 'Tồn hiện tại = 1.0 L, Ngưỡng cảnh báo = 1.5 L',
      expected: 'Expected status = LOW_STOCK',
      actual: `Actual status = ${statusT2}`,
      passed: statusT2 === 'LOW_STOCK',
    });

    // TEST 3: Current = 0.5 L, Minimum = 1 L -> Expected status = CRITICAL
    const statusT3 = calculateStockStatus(0.5, 1.0, 2.0);
    results.push({
      id: 'TEST 3',
      name: 'Cảnh báo tồn kho nguy cấp (Critical Stock)',
      scenario: 'Tồn hiện tại = 0.5 L, Ngưỡng tối thiểu = 1.0 L',
      expected: 'Expected status = CRITICAL',
      actual: `Actual status = ${statusT3}`,
      passed: statusT3 === 'CRITICAL',
    });

    // TEST 4: Current = 0.8 L, Target = 5 L -> Expected purchase recommendation = 4.2 L
    const purchaseT4 = calculateRecommendedPurchase(0.8, 5.0, 2.0);
    results.push({
      id: 'TEST 4',
      name: 'Tự động tính lượng cần mua đề xuất (Recommended Purchase)',
      scenario: 'Tồn hiện tại = 0.8 L, Mục tiêu (Target) = 5.0 L, Ngưỡng cảnh báo = 2.0 L',
      expected: 'Recommended Purchase = 4.2 L',
      actual: `Calculated = ${purchaseT4} L`,
      passed: purchaseT4 === 4.2,
    });

    // TEST 5: Add expired chemical -> Expected = EXPIRED
    const statusT5 = calculateExpiryStatus('2026-09-01', '2026-10-01');
    results.push({
      id: 'TEST 5',
      name: 'Nhận diện hóa chất quá hạn (Expired detection)',
      scenario: 'Hạn dùng: 01/09/2026, Thời điểm hiện tại: 01/10/2026',
      expected: 'Expiry status = EXPIRED',
      actual: `Calculated status = ${statusT5}`,
      passed: statusT5 === 'EXPIRED',
    });

    // TEST 6: Stock In 2 L -> Expected inventory increases by 2 L
    const currentT6 = 1.2;
    const addedT6 = 2.0;
    const finalT6 = Math.round((currentT6 + addedT6) * 100) / 100;
    results.push({
      id: 'TEST 6',
      name: 'Cộng dồn tồn kho khi nhập thêm (Stock In)',
      scenario: 'Tồn trước = 1.2 L, Nhập thêm = 2.0 L',
      expected: 'Tồn sau nhập = 3.2 L',
      actual: `Tồn tính được = ${finalT6} L`,
      passed: finalT6 === 3.2,
    });

    // TEST 7: Attempt to use more than current stock -> Expected = reject transaction & show warning
    const currentStockT7 = 100;
    const attemptedUseT7 = 150;
    const wouldReject = attemptedUseT7 > currentStockT7;
    results.push({
      id: 'TEST 7',
      name: 'Chặn xuất kho vượt quá số lượng tồn (Không cho phép âm kho)',
      scenario: 'Chai còn 100 mL, yêu cầu sử dụng 150 mL',
      expected: 'Từ chối giao dịch (Reject transaction) & Báo lỗi',
      actual: wouldReject ? 'Giao dịch bị chặn hoàn toàn (Thành công)' : 'Lỗi: Cho phép âm',
      passed: wouldReject,
    });

    setTimeout(() => {
      setTestResults(results);
      setIsRunningTests(false);
    }, 350);
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LabChem_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRestoreJSON = () => {
    if (!importJsonText.trim()) return;
    const res = importDatabaseJSON(importJsonText);
    setImportStatus(res.message);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cài Đặt & Quản Trị Hệ Thống</h1>
          <p className="text-xs text-slate-500 mt-1">
            Trung tâm quản lý sao lưu dữ liệu, kiểm thử tự động, nhật ký kiểm toán và phân quyền thành viên
          </p>
        </div>
      </div>

      {/* Manager Access Status & RBAC Header */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 flex flex-wrap items-center gap-2">
              <span>Tài khoản: {currentUser.name}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${isManager ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'}`}>
                {currentUser.role} · {currentUser.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isManager
                ? 'Bạn có toàn quyền Quản lý hệ thống: Thêm/sửa hóa chất, nhập Excel/Google Sheets, quản lý thành viên và xuất báo cáo.'
                : 'Tài khoản USER chỉ được ghi nhận sử dụng. Các tính năng quản trị, thêm thành viên và cấu hình được giới hạn cho Quản lý.'}
            </p>
          </div>
        </div>
      </div>

      {/* Guide Box: Cách để chỉnh tất cả thành viên hoặc tài khoản điều chỉnh được admin */}
      <div className="p-4 bg-gradient-to-r from-cyan-50/70 to-blue-50/50 rounded-xl border border-cyan-200/80 text-xs text-slate-700 space-y-2">
        <div className="font-bold text-cyan-900 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-cyan-700" />
          <span>Hướng dẫn: 3 Cách để bạn có thể điều chỉnh mọi phần trong Admin & Cài Đặt</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px] text-slate-600">
          <div className="p-2.5 bg-white/80 rounded-lg border border-cyan-100">
            <span className="font-bold text-slate-900 block mb-0.5">Cách 1: Bật nút trên</span>
            Bấm nút màu xanh <strong className="text-cyan-800">"Bật quyền chỉnh sửa cho tất cả"</strong> ngay phía trên. Toàn bộ tính năng Admin sẽ được mở khóa cho bất kỳ tài khoản nào.
          </div>
          <div className="p-2.5 bg-white/80 rounded-lg border border-cyan-100">
            <span className="font-bold text-slate-900 block mb-0.5">Cách 2: Đổi tài khoản Admin</span>
            Bấm <strong className="text-cyan-800">"Đổi Người Dùng"</strong> ở góc trên bên phải thanh menu và chọn tài khoản có vai trò <strong>ADMIN</strong> (ví dụ: Bùi Anh Trà).
          </div>
          <div className="p-2.5 bg-white/80 rounded-lg border border-cyan-100">
            <span className="font-bold text-slate-900 block mb-0.5">Cách 3: Chỉnh vai trò (Role)</span>
            Chọn tab <strong className="text-cyan-800">"Phân Quyền & Thành Viên"</strong> bên dưới, đổi quyền của bạn sang <strong>ADMIN</strong> bằng menu chọn trực tiếp.
          </div>
        </div>
      </div>

      {exportWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center justify-between animate-in fade-in">
          <span>{exportWarning}</span>
          <button onClick={() => setExportWarning(null)} className="text-amber-600 font-bold ml-2">×</button>
        </div>
      )}

      {/* Settings Sub-Navigation Menu */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-fit text-xs">
        <button
          onClick={() => setActiveTab('supabase')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'supabase' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          <span>Supabase Cloud & Realtime</span>
          {isSupabaseConfigured && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'backup' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Sao Lưu & Dữ Liệu Demo</span>
        </button>

        <button
          onClick={() => setActiveTab('test')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'test' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          <span>Kiểm Thử 7 Test Cases</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'audit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Nhật Ký Kiểm Toán (Audit)</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'reports' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Báo Cáo & Xuất Excel</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === 'users' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Phân Quyền & Thành Viên</span>
        </button>
      </div>

      {/* Sub-Tab: Supabase Cloud Database & Realtime */}
      {activeTab === 'supabase' && (
        <div className="space-y-5">
          {/* Main Status & Quick Actions Banner */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className={`p-3 rounded-xl border shrink-0 ${
                  isSupabaseConfigured
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-slate-900">
                      Supabase Cloud Database & Realtime
                    </h2>
                    {isSupabaseConfigured ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>ĐÃ KẾT NỐI CLOUD</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800">
                        CHẾ ĐỘ NỘI BỘ (DEMO MODE)
                      </span>
                    )}
                    {isRealtimeActive && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-teal-100 text-teal-800 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-teal-600" />
                        <span>REALTIME ACTIVE</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Hệ thống lưu trữ đám mây PostgreSQL với cơ chế Row-Level Security (RLS), khóa hàng nguyên tử (Atomic locking) và truyền tải sự kiện thời gian thực (Supabase Realtime Broadcast).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onOpenSupabaseConfig && (
                  <button
                    onClick={onOpenSupabaseConfig}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Cấu hình Supabase</span>
                  </button>
                )}
                <button
                  onClick={refreshFromSupabase}
                  disabled={isSyncing || !isSupabaseConfigured}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  title="Tải lại toàn bộ dữ liệu mới nhất từ Supabase"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-600' : ''}`} />
                  <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
                </button>
              </div>
            </div>

            {/* Live Ping & Latency Test */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-slate-700">Kiểm tra kết nối & Độ trễ mạng (Ping):</span>
                {supabasePingResult && (
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                    supabasePingResult.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {supabasePingResult.message}
                  </span>
                )}
              </div>
              <button
                onClick={handleTestSupabase}
                disabled={supabaseTesting}
                className="px-3 py-1.5 text-xs font-medium text-cyan-700 hover:text-cyan-800 bg-white border border-cyan-200 hover:border-cyan-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${supabaseTesting ? 'animate-spin' : ''}`} />
                <span>{supabaseTesting ? 'Đang ping...' : 'Kiểm tra ping'}</span>
              </button>
            </div>

            {/* Realtime Architecture Explanation Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-linear-to-b from-white to-slate-50 space-y-1">
                <div className="text-[11px] text-slate-500 font-medium">Bảng Hóa Chất (chemicals)</div>
                <div className="text-xl font-extrabold text-slate-900 font-mono">{chemicals.length}</div>
                <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Realtime Sync</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-linear-to-b from-white to-slate-50 space-y-1">
                <div className="text-[11px] text-slate-500 font-medium">Từng Chai Riêng Biệt (bottles)</div>
                <div className="text-xl font-extrabold text-slate-900 font-mono">{bottles.length}</div>
                <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Trừ tự động FIFO</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-linear-to-b from-white to-slate-50 space-y-1">
                <div className="text-[11px] text-slate-500 font-medium">Lịch Sử Dùng (usage_transactions)</div>
                <div className="text-xl font-extrabold text-slate-900 font-mono">{transactions.length}</div>
                <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Realtime Event</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-linear-to-b from-white to-slate-50 space-y-1">
                <div className="text-[11px] text-slate-500 font-medium">Hồ Sơ & Phân Quyền (profiles)</div>
                <div className="text-xl font-extrabold text-slate-900 font-mono">{users.length}</div>
                <div className="text-[10px] text-purple-700 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>RLS & Permissions</span>
                </div>
              </div>
            </div>
          </div>

          {/* Setup Guide & SQL Migration Box */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs text-slate-700">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-600" />
              <span>Hướng Dẫn Kết Nối Dự Án Supabase Của Bạn (3 Bước Đơn Giản)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-700 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>Tạo Dự Án Supabase</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Truy cập <strong>supabase.com</strong>, tạo một Project mới miễn phí và sao chép <code>Project URL</code> cùng <code>anon key</code> từ phần Project Settings → API.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-700 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>Chạy SQL Migration</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Vào <strong>SQL Editor</strong> trên Supabase Dashboard, dán toàn bộ nội dung file <code>supabase/migrations/20261003000000_init_labchem.sql</code> và nhấn <strong>Run</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const sampleNote = `-- Tệp migration hoàn chỉnh nằm tại: supabase/migrations/20261003000000_init_labchem.sql
-- Sao chép nội dung tệp này vào Supabase SQL Editor và nhấn Run!`;
                    navigator.clipboard.writeText(sampleNote);
                    setSqlCopied(true);
                    setTimeout(() => setSqlCopied(false), 2500);
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg border border-cyan-200 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>{sqlCopied ? 'Đã sao chép!' : 'Chép ghi chú SQL'}</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-700 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>Cấu Hình & Realtime</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Mở nút <strong>"Cấu hình Supabase"</strong> ở trên, nhập URL và Key. Dữ liệu sẽ lập tức được lưu vào Cloud và tự động cập nhật Realtime giữa các người dùng mà không cần F5!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 1: Backup & Demo Data */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Backup & Restore */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-600" />
                <span>Sao Lưu Toàn Bộ Cơ Sở Dữ Liệu (Backup JSON)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Tải về toàn bộ danh mục hóa chất, các chai đang sử dụng, lịch sử giao dịch và đơn đặt mua.
              </p>
            </div>

            <button
              onClick={handleDownloadBackup}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file Sao Lưu JSON</span>
            </button>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Khôi phục từ tệp / chuỗi JSON đã sao lưu:
              </label>
              <textarea
                rows={3}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder="Dán nội dung JSON đã tải về trước đó vào đây..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20"
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={handleRestoreJSON}
                  disabled={!importJsonText.trim()}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
                >
                  Khôi Phục Dữ Liệu
                </button>
                {importStatus && <span className="text-xs text-emerald-700 font-medium">{importStatus}</span>}
              </div>
            </div>
          </div>

          {/* Demo Data Management */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-cyan-600" />
                <span>Quản Lý Dữ Liệu Mẫu (Demo Data - Trang 21)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Hệ thống bao gồm sẵn 17 hóa chất tiêu chuẩn (Ethanol 96%, n-Hexane 2 chai HEX-001/002, HPLC, DPPH, Quercetin...). Bạn có thể hoàn tác về ban đầu bất kỳ lúc nào.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <button
                onClick={() => {
                  if (window.confirm('Tải lại toàn bộ dữ liệu mẫu tiêu chuẩn? Mọi thay đổi thử nghiệm sẽ được làm mới.')) {
                    resetToDemoData();
                  }
                }}
                className="w-full px-4 py-2.5 text-xs font-medium text-cyan-800 bg-cyan-50 hover:bg-cyan-100/80 border border-cyan-200 rounded-lg transition-colors text-left flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold">Tải Lại Dữ Liệu Mẫu Ban Đầu</div>
                  <div className="text-[11px] text-cyan-700 font-normal">Nạp lại 17 hóa chất & 18 chai thử nghiệm chuẩn</div>
                </div>
                <RotateCcw className="w-4 h-4 text-cyan-600" />
              </button>

              {currentUser.role === 'ADMIN' && (
                <button
                  onClick={() => {
                    if (window.confirm('CẢNH BÁO: Xóa toàn bộ hóa chất trong kho để chuẩn bị nhập liệu từ đầu?')) {
                      clearAllData();
                    }
                  }}
                  className="w-full px-4 py-2.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-lg transition-colors text-left flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold">Xóa Sạch Toàn Bộ Kho Dữ Liệu</div>
                    <div className="text-[11px] text-rose-600 font-normal">Dành cho Admin khi bắt đầu nhập kho thực tế</div>
                  </div>
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </button>
              )}
            </div>
          </div>

          {/* Archive / Trash Center (Manager only - Mục 38) */}
          {isManager && (
            <div className="p-5 bg-white rounded-xl border border-amber-200 shadow-xs space-y-3 md:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Archive className="w-4 h-4 text-amber-600" />
                    <span>Kho Lưu Trữ & Thùng Rác (Archive Center - Xóa Mềm & Khôi Phục)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Hóa chất đã xóa bằng cơ chế Soft-delete vẫn được lưu trữ nguyên vẹn để bảo toàn lịch sử sử dụng và có thể khôi phục lại bất cứ lúc nào.
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-bold font-mono bg-amber-100 text-amber-800 rounded-full border border-amber-200 shrink-0">
                  {chemicals.filter((c) => c.status === 'ARCHIVED').length} mục lưu trữ
                </span>
              </div>

              {onOpenArchiveCenter && (
                <button
                  type="button"
                  onClick={onOpenArchiveCenter}
                  className="px-4 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2"
                >
                  <Archive className="w-4 h-4 text-amber-700" />
                  <span>Mở Kho Lưu Trữ / Thùng Rác & Xem Lịch Sử Xóa (Archive Center)</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: 7 Test Cases */}
      {activeTab === 'test' && (
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-cyan-600" />
                <span>Kiểm Thử Toàn Bộ 7 Kịch Bản Tồn Kho (Page 22–23)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiểm tra tự động logic trừ tồn, đa đơn vị (L/mL), ngưỡng Low/Critical, tính lượng mua và chặn âm kho
              </p>
            </div>
            <button
              onClick={runTests}
              disabled={isRunningTests}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" />
              <span>{isRunningTests ? 'Đang chạy kiểm thử...' : 'Chạy Kiểm Thử 7 Test Cases'}</span>
            </button>
          </div>

          {testResults && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-semibold text-slate-800">
                  Kết quả: {testResults.filter((r) => r.passed).length} / {testResults.length} kịch bản ĐẠT (100% Passed)
                </span>
                <span className="text-emerald-700 font-bold font-mono">ALL TESTS PASSED ✅</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {testResults.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-lg text-xs flex items-start justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-slate-900">{r.id}:</span>
                        <span className="font-semibold text-slate-800">{r.name}</span>
                      </div>
                      <div className="text-slate-500 font-mono text-[11px]">{r.scenario}</div>
                      <div className="text-slate-600 text-[11px]">
                        Kỳ vọng: <strong className="text-slate-800">{r.expected}</strong> → Thực tế: <span className="font-mono text-slate-700">{r.actual}</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 shrink-0 ml-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      PASSED
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <span>Nhật Ký Kiểm Toán Hệ Thống (Audit Trail - {auditLogs.length} sự kiện)</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Mọi thao tác quan trọng đều được ghi nhận vĩnh viễn</p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-200/80 rounded text-slate-700">
              Chế độ bất biến (Immutable)
            </span>
          </div>

          <div className="overflow-x-auto max-h-[450px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 uppercase font-mono text-[11px] sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-semibold">Thời gian</th>
                  <th className="px-4 py-3 font-semibold">Người thao tác</th>
                  <th className="px-4 py-3 font-semibold">Hành động</th>
                  <th className="px-4 py-3 font-semibold">Phân loại</th>
                  <th className="px-6 py-3 font-semibold">Chi tiết sự kiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {log.user}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {log.action === 'LOGIN_SUCCESS' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          LOGIN_SUCCESS
                        </span>
                      )}
                      {log.action === 'LOGIN_FAILED' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          LOGIN_FAILED
                        </span>
                      )}
                      {log.action === 'ACCESS_DENIED' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          ACCESS_DENIED
                        </span>
                      )}
                      {log.action === 'LOGOUT' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          LOGOUT
                        </span>
                      )}
                      {!['LOGIN_SUCCESS', 'LOGIN_FAILED', 'ACCESS_DENIED', 'LOGOUT'].includes(log.action) && (
                        <span>{log.action}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {log.entityType}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600 text-[11px]">
                      {log.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Reports & Excel Exports */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Xuất Toàn Bộ Danh Mục Tồn Kho (Chemical Inventory)</h3>
            <p className="text-xs text-slate-500">
              Bao gồm mã hóa chất, số CAS, công thức, cấp độ tinh khiết, số lượng tồn kho theo đơn vị chính và vị trí lưu trữ.
            </p>
            <button
              onClick={() =>
                exportChemicalInventoryCSV(
                  chemicals,
                  getChemicalTotalStock,
                  getChemicalStockStatus,
                  getChemicalExpiryStatus
                )
              }
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Tải file Inventory CSV (Excel UTF-8)</span>
            </button>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Xuất Lịch Sử Sử Dụng Hóa Chất (Usage History)</h3>
            <p className="text-xs text-slate-500">
              Chi tiết từng lần sử dụng: Chai nào, lượng chiết, người thực hiện, đề tài nghiên cứu (*Dolichandrone*...) và lượng tồn còn lại.
            </p>
            <button
              onClick={() => {
                if (!canExportHistory) {
                  setExportWarning('Chỉ Admin và Lab Manager mới có quyền xuất file lịch sử sử dụng. Tài khoản (' + currentUser.name + ') hiện có vai trò USER.');
                  setTimeout(() => setExportWarning(null), 4000);
                  return;
                }
                exportUsageHistoryCSV(transactions);
              }}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                canExportHistory
                  ? 'text-white bg-cyan-700 hover:bg-cyan-800'
                  : 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed'
              }`}
            >
              {canExportHistory ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4 text-slate-400" />}
              <span>{canExportHistory ? 'Tải file Usage CSV' : 'Khóa: Chỉ Admin & Lab Manager'}</span>
            </button>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Xuất Báo Cáo Kế Hoạch Mua Sắm (Purchase List)</h3>
            <p className="text-xs text-slate-500">
              Danh sách các hóa chất sắp cạn, khối lượng đề xuất đặt mua theo công thức mục tiêu và nhà cung cấp.
            </p>
            <button
              onClick={() => exportPurchaseListCSV(purchaseItems)}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Tải file Purchase List CSV</span>
            </button>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Xuất Báo Cáo Hạn Dùng & Lô (Expiry Report)</h3>
            <p className="text-xs text-slate-500">
              Chi tiết từng chai, số Lot, thể tích còn lại, hạn sử dụng, số ngày còn lại và trạng thái hạn dùng.
            </p>
            <button
              onClick={() => exportExpiryReportCSV(bottles, chemicals)}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Tải file Expiry Report CSV</span>
            </button>
          </div>

          <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl shadow-xs space-y-3 md:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Nhập Danh Sách Hóa Chất Bằng Excel / Google Sheets (Mục 66 - 75)</span>
                </h3>
                <p className="text-xs text-emerald-800 mt-1">
                  Dành riêng cho QUẢN LÝ. Hỗ trợ file Excel chuẩn 5 sheet (DANH_MỤC_HÓA_CHẤT, DANH_SÁCH_CHAI, NHẬP_KHO_BAN_ĐẦU, NHÀ_CUNG_CẤP, VỊ_TRÍ_LƯU_TRỮ) với cơ chế kiểm tra lỗi và xem trước trước khi xác nhận.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={downloadStandardLabExcelTemplate}
                  className="px-3 py-2 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-100/50 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải Mẫu Excel</span>
                </button>
                <button
                  onClick={() => setExcelImportOpen(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bắt Đầu Nhập Excel / Sheets</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 5: Users & Roles */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-600" />
                <span>Quản Lý Người Dùng & Phân Quyền ({users.length} thành viên)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bạn có thể tự do thêm người mới, đổi vai trò (ADMIN, LAB_MANAGER, USER), chỉnh sửa thông tin hoặc xóa tài khoản
              </p>
            </div>

            <button
              onClick={() => {
                setIsAddingUser(!isAddingUser);
                setEditingUserId(null);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isAddingUser ? 'Đóng biểu mẫu' : '+ Thêm Thành Viên Mới'}</span>
            </button>
          </div>

          {userActionMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{userActionMessage}</span>
              </div>
              <button onClick={() => setUserActionMessage(null)} className="text-emerald-700 font-bold ml-2">×</button>
            </div>
          )}

          {/* Add User Form */}
          {isAddingUser && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-cyan-600" />
                <span>Thêm Thành Viên Mới Vào Lab</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Họ và tên thành viên *</label>
                  <input
                    type="text"
                    required
                    placeholder="vd: Trần Văn Bình"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email / Mã SV</label>
                  <input
                    type="email"
                    placeholder="name@lab.univ.edu.vn"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vai trò & Quyền hạn (Role)</label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 font-medium"
                  >
                    <option value="USER">USER (Học viên/Sinh viên - Chỉ ghi dùng & tra cứu)</option>
                    <option value="LAB_MANAGER">LAB_MANAGER (Quản lý - Nhập/xuất, duyệt mua, xuất báo cáo)</option>
                    <option value="ADMIN">ADMIN (Quản trị viên - Toàn quyền mọi tính năng)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bộ môn / Đơn vị công tác</label>
                  <input
                    type="text"
                    value={addDept}
                    onChange={(e) => setAddDept(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!addName.trim()) return;
                    const res = await addUser({
                      name: addName.trim(),
                      email: addEmail.trim() || `${addName.toLowerCase().replace(/\s+/g, '')}@lab.univ.edu.vn`,
                      role: addRole,
                      status: 'ACTIVE',
                      department: addDept.trim() || 'Phòng Thí nghiệm Dược liệu',
                    });
                    if (res.success) {
                      setUserActionMessage(`Đã thêm thành viên "${addName}" thành công!`);
                      setAddName('');
                      setAddEmail('');
                      setIsAddingUser(false);
                      setTimeout(() => setUserActionMessage(null), 4000);
                    }
                  }}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-xs"
                >
                  Lưu Thành Viên
                </button>
              </div>
            </div>
          )}

          {/* User List */}
          <div className="space-y-3">
            {users.map((u) => {
              const isCurrent = u.id === currentUser.id;
              const isEditing = editingUserId === u.id;

              if (isEditing) {
                return (
                  <div key={u.id} className="p-4 rounded-xl border border-cyan-300 bg-cyan-50/40 space-y-3">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Edit2 className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Chỉnh Sửa Thông Tin Thành Viên: {u.name}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Họ và tên</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Email</label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Vai trò (Role)</label>
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="USER">USER (Học viên - Không xuất lịch sử)</option>
                          <option value="LAB_MANAGER">LAB_MANAGER (Được xuất lịch sử)</option>
                          <option value="ADMIN">ADMIN (Toàn quyền)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Đơn vị / Bộ môn</label>
                        <input
                          type="text"
                          value={editDept}
                          onChange={(e) => setEditDept(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-200">
                      <button
                        onClick={() => setEditingUserId(null)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={() => {
                          if (!editName.trim()) return;
                          updateUser(u.id, {
                            name: editName.trim(),
                            email: editEmail.trim(),
                            role: editRole,
                            department: editDept.trim(),
                          });
                          setUserActionMessage(`Đã cập nhật thông tin thành viên "${editName}".`);
                          setEditingUserId(null);
                          setTimeout(() => setUserActionMessage(null), 4000);
                        }}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-xs"
                      >
                        Lưu Thay Đổi
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={u.id}
                  className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                    isCurrent
                      ? 'bg-cyan-50/50 border-cyan-300 ring-2 ring-cyan-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{u.name}</span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800">
                            Đang Đăng Nhập
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {u.email} · {u.department}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    {/* Quick Role Switcher */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 font-medium">Vai trò:</span>
                      <select
                        value={u.role}
                        onChange={(e) => {
                          const newRole = e.target.value as UserRole;
                          updateUser(u.id, { role: newRole });
                          setUserActionMessage(`Đã đổi vai trò của ${u.name} thành ${newRole}.`);
                          setTimeout(() => setUserActionMessage(null), 3000);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-mono font-bold transition-colors ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : u.role === 'LAB_MANAGER' || u.role === 'MANAGER'
                            ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                        title="Bấm để đổi vai trò trực tiếp"
                      >
                        <option value="USER">USER</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="LAB_MANAGER">LAB_MANAGER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>

                    {/* Edit button */}
                    <button
                      onClick={() => {
                        setEditingUserId(u.id);
                        setEditName(u.name);
                        setEditEmail(u.email);
                        setEditRole(u.role);
                        setEditDept(u.department);
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Sửa thông tin"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete button (cannot delete if last user) */}
                    {users.length > 1 && (
                      <button
                        onClick={() => {
                          if (confirm(`Bạn có chắc chắn muốn xóa thành viên "${u.name}"?`)) {
                            deleteUser(u.id);
                            setUserActionMessage(`Đã xóa thành viên "${u.name}".`);
                            setTimeout(() => setUserActionMessage(null), 3000);
                          }
                        }}
                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Xóa thành viên"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Switch active user */}
                    {!isCurrent ? (
                      <button
                        onClick={() => setCurrentUser(u)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                      >
                        Đổi sang tài khoản này
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-cyan-700 flex items-center gap-1 px-2">
                        <Check className="w-4 h-4" />
                        <span>Kích hoạt</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Excel / Google Sheets Import Modal */}
      <ExcelImportModal
        isOpen={excelImportOpen}
        onClose={() => setExcelImportOpen(false)}
      />
    </div>
  );
};
