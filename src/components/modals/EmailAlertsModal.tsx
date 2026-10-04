import React, { useState } from 'react';
import { useLab } from '../../context/LabContext';
import { PRIMARY_SENIOR_MANAGER_EMAIL } from '../../utils/roleUtils';
import {
  X,
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Settings,
  Bell,
  Check,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailAlertsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    emailAlertLogs,
    emailSettings,
    updateEmailSettings,
    sendManualTestEmailAlert,
    isManager,
    isSupabaseConfigured,
  } = useLab();

  const [activeTab, setActiveTab] = useState<'logs' | 'settings'>('logs');
  const [managerEmailInput, setManagerEmailInput] = useState(
    emailSettings.managerEmail || PRIMARY_SENIOR_MANAGER_EMAIL
  );
  const [autoEmail, setAutoEmail] = useState(emailSettings.autoEmailOnLowStock);
  const [criticalOnly, setCriticalOnly] = useState(emailSettings.notifyCriticalOnly);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  if (!isOpen) return null;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateEmailSettings({
      managerEmail: managerEmailInput.trim() || PRIMARY_SENIOR_MANAGER_EMAIL,
      autoEmailOnLowStock: autoEmail,
      notifyCriticalOnly: criticalOnly,
    });
    setTestResult('Đã cập nhật cấu hình email cảnh báo tự động thành công!');
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const res = sendManualTestEmailAlert();
      setTestResult(res.message);
      setTimeout(() => setTestResult(null), 5000);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Hệ Thống Thông Báo Email Tự Động Tới Manager
              </h2>
              <p className="text-xs text-slate-500">
                Tự động gửi email cảnh báo khi hóa chất chạm ngưỡng cảnh báo hoặc mức tối thiểu
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 p-1.5 text-xs gap-1">
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-1.5 font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Lịch Sử Email Đã Gửi ({emailAlertLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-1.5 font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Cấu Hình Hộp Thư & Ngưỡng Gửi</span>
          </button>
        </div>

        {testResult && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{testResult}</span>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'logs' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Email cảnh báo được kích hoạt ngay khi số dư kho ≤ mức cảnh báo tồn kho:
                </div>
                <button
                  onClick={handleSendTest}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>Gửi Thử Email Cảnh Báo</span>
                </button>
              </div>

              {emailAlertLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Chưa có email cảnh báo nào được gửi. Khi hóa chất đạt mức cảnh báo, hệ thống sẽ tự động ghi nhận tại đây.
                </div>
              ) : (
                <div className="space-y-3">
                  {emailAlertLogs.map((log) => {
                    const isCrit = log.triggerType === 'CRITICAL_STOCK';
                    const bottleMatch = log.contentSnippet?.match(/Mã chai:\s*([^\n\r]+)/i);
                    const bottleCode = bottleMatch ? bottleMatch[1].trim() : 'HEX-001';

                    return (
                      <div
                        key={log.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  isCrit
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {isCrit ? 'Nguy cấp' : 'Sắp hết'}
                              </span>
                              <span className="text-xs font-bold text-slate-900">{log.chemicalName}</span>
                              <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {bottleCode}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1.5 flex flex-wrap items-center gap-2">
                              <span>Tồn kho: <strong className="font-mono text-slate-800">{log.currentStock} {log.unit}</strong> / <span className="text-slate-600">{log.threshold} {log.unit}</span></span>
                              <span>•</span>
                              <span>Người nhận: <strong className="font-mono text-slate-700">{log.toEmail}</strong></span>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.status === 'SENT'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              <span>{log.status === 'SENT' ? 'Email đã gửi' : 'Thất bại'}</span>
                            </span>
                            <div className="text-[10px] text-slate-400 mt-1">
                              {new Date(log.timestamp).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>

                        {/* Content Snippet */}
                        <div className="p-3 bg-slate-50 rounded-lg text-[11px] text-slate-700 font-sans whitespace-pre-line border border-slate-100">
                          {log.contentSnippet}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Tab Settings */
            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-2.5">
                <Bell className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Quy chuẩn cảnh báo tồn kho tự động:</strong> Khi giao dịch làm tồn kho giảm xuống mức Sắp hết (current_quantity ≤ minimum_stock) hoặc Nguy cấp (current_quantity ≤ critical_stock), hệ thống sẽ gửi email cảnh báo tự động qua Supabase Edge Function và Resend API mà không spam lặp lại.
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Địa chỉ Email nhận cảnh báo *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={managerEmailInput}
                    onChange={(e) => setManagerEmailInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white font-mono text-slate-900 focus:outline-hidden focus:border-rose-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  Mặc định: <strong>{PRIMARY_SENIOR_MANAGER_EMAIL}</strong>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5 text-[11px]">
                    Mức cảnh báo Sắp hết (LOW) mặc định
                  </label>
                  <div className="text-slate-600 font-mono text-xs">
                    current_quantity ≤ minimum_stock (vd: 600 mL)
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-rose-700 mb-0.5 text-[11px]">
                    Mức cảnh báo Nguy cấp (CRITICAL) mặc định
                  </label>
                  <div className="text-rose-600 font-mono text-xs">
                    current_quantity ≤ critical_stock (vd: 200 mL)
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoEmail}
                    onChange={(e) => setAutoEmail(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Bật tự động gửi email ngay khi hóa chất chạm ngưỡng cảnh báo tồn kho
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={criticalOnly}
                    onChange={(e) => setCriticalOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-slate-600">
                    Chỉ gửi email khi tồn kho đạt mức báo động đỏ (Critical Stock)
                  </span>
                </label>
              </div>

              <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-cyan-900 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-cyan-800">
                  <ShieldCheck className="w-4 h-4 text-cyan-600" />
                  <span>Cơ chế bảo mật Backend & Edge Function</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Email được gửi bảo mật qua Supabase Edge Function <code>send-low-stock-alert</code>. Toàn bộ API Key của nhà cung cấp dịch vụ email (Resend API) được lưu trữ an toàn trong Supabase Secrets, tuyệt đối không lưu trong trình duyệt hay biến môi trường client.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer"
                >
                  Lưu Cấu Hình Email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
