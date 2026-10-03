import React, { useState, useEffect } from 'react';
import {
  isSupabaseConfigured,
  getSupabaseConfig,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  testSupabaseConnection,
} from '../../lib/supabase';
import { LABCHEM_MIGRATION_SQL } from '../../data/migrationSql';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Zap,
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
  const [config, setConfig] = useState(getSupabaseConfig());
  const [url, setUrl] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setConfig(cfg);
      setUrl(cfg.url);
      setPublishableKey(cfg.publishableKey || cfg.anonKey || '');
      setTestResult(null);

      if (cfg.isConfigured) {
        runTest();
      }
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !publishableKey.trim()) return;

    saveCustomSupabaseConfig(url.trim(), publishableKey.trim());
    setConfig(getSupabaseConfig());
    if (onConfigChanged) onConfigChanged();
    await runTest();
  };

  const handleClear = () => {
    clearCustomSupabaseConfig();
    setUrl('');
    setPublishableKey('');
    setConfig(getSupabaseConfig());
    setTestResult(null);
    if (onConfigChanged) onConfigChanged();
  };

  const handleCopyMigrationSql = () => {
    navigator.clipboard.writeText(LABCHEM_MIGRATION_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Cấu Hình Supabase Cloud Database</span>
                {config.isConfigured ? (
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    ĐÃ KẾT NỐI
                  </span>
                ) : (
                  <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                    CHƯA CẤU HÌNH
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý kết nối PostgreSQL, Realtime sync và kiểm tra độ trễ phản hồi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Card */}
        <div className="mt-4 p-3.5 rounded-xl border bg-slate-50 border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>Trạng thái kết nối Supabase Realtime:</span>
            </span>
            <button
              onClick={runTest}
              disabled={testing}
              className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
              <span>Kiểm tra</span>
            </button>
          </div>

          {testResult ? (
            <div
              className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="font-semibold">{testResult.message}</div>
                {testResult.latencyMs !== undefined && (
                  <div className="text-[10px] text-slate-500 font-mono">
                    Ping RTT: {testResult.latencyMs} ms
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-[11px]">
              {config.isConfigured
                ? 'Nhấn "Kiểm tra" để gửi ping test tới Supabase.'
                : 'Chưa có thông số kết nối. Bạn có thể nhập VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY bên dưới.'}
            </div>
          )}
        </div>

        {/* Form Configuration */}
        <form onSubmit={handleSave} className="mt-4 space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Project URL (VITE_SUPABASE_URL)</span>
              <span className="text-[10px] text-slate-400 font-mono">VD: https://xyz.supabase.co</span>
            </label>
            <input
              type="url"
              required
              placeholder="https://your-project.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-mono focus:outline-hidden focus:border-cyan-600 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Publishable Key (VITE_SUPABASE_PUBLISHABLE_KEY)</span>
              <span className="text-[10px] text-slate-400 font-mono">Safe for client-side</span>
            </label>
            <input
              type="password"
              required
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 font-mono focus:outline-hidden focus:border-cyan-600 text-xs"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Lưu & Kết Nối
              </button>
              {config.isConfigured && !config.isFromEnv && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition cursor-pointer"
                >
                  Xóa cấu hình
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleCopyMigrationSql}
              className="text-[11px] text-cyan-700 hover:text-cyan-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              {copiedSql ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Đã chép SQL!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy SQL Migration</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Realtime checklist info */}
        <div className="mt-5 p-3.5 bg-cyan-50/70 border border-cyan-200 rounded-xl text-[11px] text-slate-700 space-y-1.5">
          <div className="font-bold text-cyan-900 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-700" />
            <span>Realtime Synchronized Tables:</span>
          </div>
          <div className="grid grid-cols-2 gap-1 font-mono text-[10px] text-cyan-800">
            <div>✓ chemicals (Tồn & cảnh báo)</div>
            <div>✓ bottles (Từng chai & số lượng)</div>
            <div>✓ usage_transactions (Lịch sử)</div>
            <div>✓ profiles (Quyền & trạng thái)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
