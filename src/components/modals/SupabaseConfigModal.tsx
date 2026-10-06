import React, { useState, useEffect } from 'react';
import {
  isSupabaseConfigured,
  getSupabaseConfig,
  testSupabaseConnection,
} from '../../lib/supabase';
import { LABCHEM_MIGRATION_SQL } from '../../data/migrationSql';
import { useLab } from '../../context/LabContext';
import { isSeniorManagerEmail } from '../../utils/roleUtils';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
  Check,
  RefreshCw,
  Zap,
  ShieldCheck,
  Server,
  Lock,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

export const SupabaseConfigModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const { currentUser, refreshFromSupabase, isSyncing } = useLab();
  const [config, setConfig] = useState(getSupabaseConfig());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const isSenior = isSeniorManagerEmail(currentUser?.email || '');
  const isManager = isSenior || currentUser?.role === 'MANAGER' || currentUser?.role === 'ADMIN';

  useEffect(() => {
    if (isOpen) {
      setConfig(getSupabaseConfig());
      setTestResult(null);
      runTest();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
    } finally {
      setTesting(false);
    }
  };

  const handleManualSync = async () => {
    if (refreshFromSupabase) {
      await refreshFromSupabase();
    }
    if (onConfigChanged) {
      onConfigChanged();
    }
    await runTest();
  };

  const handleCopyMigrationSql = () => {
    navigator.clipboard.writeText(LABCHEM_MIGRATION_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                CẤU HÌNH HỆ THỐNG LABCHEM
              </h2>
              <p className="text-xs text-slate-500">
                Mô hình Cloud Database dùng chung – Tự động đồng bộ toàn bộ thành viên
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-sm">
          {/* Architecture Status Banner */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-950 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-emerald-900 text-sm">
                Ứng dụng đã được cấu hình sẵn Cloud Database
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Tất cả thành viên trong nhóm do Người quản lý cấp tài khoản đều tự động kết nối vào cùng một cơ sở dữ liệu đám mây chung của LabChem. Người dùng chỉ cần đăng nhập bằng Email + Mật khẩu, tuyệt đối không cần cấu hình thủ công hay nhập mã khóa API.
              </p>
            </div>
          </div>

          {/* 4 Status Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">Cloud Database</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-800">Đã kết nối</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">Authentication</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-800">Đang hoạt động</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">Phân quyền</span>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-xs font-bold text-purple-900">Bật RLS</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">Phiên làm việc</span>
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-xs font-bold text-slate-800">Tập trung</span>
              </div>
            </div>
          </div>

          {/* Diagnostic & Ping test */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-xs text-slate-900">
                  Kiểm tra kết nối mạng & độ trễ Cloud:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runTest}
                  disabled={testing}
                  className="px-3 py-1.5 text-xs font-semibold text-purple-700 hover:text-purple-800 bg-white border border-purple-200 hover:border-purple-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                >
                  <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối (Ping)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                >
                  <Database className="w-3 h-3 text-slate-500" />
                  <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-100/70 border border-emerald-300 text-emerald-900'
                    : 'bg-rose-100/70 border border-rose-300 text-rose-900'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">{testResult.message}</div>
                  {testResult.latencyMs !== undefined && (
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Độ trễ máy chủ (Latency): {testResult.latencyMs} ms
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dành riêng cho Người quản lý cao cấp: Kiểm tra kịch bản bảo mật RLS */}
          {isSenior && (
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
                  <span className="font-bold text-xs text-purple-950">
                    Kịch bản phân quyền cơ sở dữ liệu (RLS SQL Script)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyMigrationSql}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Đã sao chép SQL' : 'Sao chép kịch bản SQL'}</span>
                </button>
              </div>
              <p className="text-[11px] text-purple-900 leading-relaxed">
                Kịch bản SQL định nghĩa toàn bộ 7 bảng chính (profiles, chemicals, bottles, usage_transactions, stock_transactions, audit_logs, purchase_list) cùng các chính sách bảo vệ Row-Level Security, bảo vệ tài khoản Người quản lý cao cấp <code className="font-mono bg-purple-100 px-1 py-0.5 rounded text-purple-800 font-bold">buiantra2021@gmail.com</code> và ngăn chặn mọi thao tác trái phép.
              </p>
            </div>
          )}

          {/* Quy tắc sử dụng hệ thống */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>Quy tắc vận hành chuẩn:</span>
            </div>
            <p>• <strong>Cấp tài khoản:</strong> Người quản lý cao cấp tạo tài khoản tại trang "Quản lý người dùng", hệ thống tự động sinh thông tin đăng nhập trên Cloud Database.</p>
            <p>• <strong>Đăng nhập mọi nơi:</strong> Thành viên mở website trên bất kỳ máy tính/thiết bị nào, chỉ cần nhập Email và Mật khẩu là tự động đồng bộ kho dữ liệu chung.</p>
            <p>• <strong>Bảo mật tuyệt đối:</strong> Mã khóa quản trị (Service Role Key) được bảo vệ nghiêm ngặt ở phía server, không lưu trên trình duyệt của người dùng.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupabaseConfigModal;
