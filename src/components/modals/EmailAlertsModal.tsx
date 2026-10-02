import React, { useState } from 'react';
import { useLab } from '../../context/LabContext';
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
  } = useLab();

  const [activeTab, setActiveTab] = useState<'logs' | 'settings'>('logs');
  const [managerEmailInput, setManagerEmailInput] = useState(emailSettings.managerEmail);
  const [autoEmail, setAutoEmail] = useState(emailSettings.autoEmailOnLowStock);
  const [criticalOnly, setCriticalOnly] = useState(emailSettings.notifyCriticalOnly);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateEmailSettings({
      managerEmail: managerEmailInput.trim(),
      autoEmailOnLowStock: autoEmail,
      notifyCriticalOnly: criticalOnly,
    });
    setTestResult('Đã cập nhật cấu hình email cảnh báo tự động thành công!');
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleSendTest = () => {
    const res = sendManualTestEmailAlert();
    setTestResult(res.message);
    setTimeout(() => setTestResult(null), 4000);
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
                  {emailAlertLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                log.triggerType === 'CRITICAL_STOCK'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {log.triggerType === 'CRITICAL_STOCK' ? 'BÁO ĐỘNG ĐỎ' : 'CẢNH BÁO THẤP'}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{log.subject}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                            <span>Người nhận: <strong className="font-mono text-slate-700">{log.toEmail}</strong></span>
                            <span>•</span>
                            <span>Hóa chất: <strong>{log.chemicalName}</strong></span>
                            <span>•</span>
                            <span>Tồn: <strong>{log.currentStock} {log.unit}</strong></span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3" />
                            <span>SENT</span>
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
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Tab Settings */
            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-2.5">
                <Bell className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Quy chuẩn cảnh báo tồn kho:</strong> Khi một giao dịch làm tồn kho giảm xuống dưới ngưỡng Cảnh Báo (Warning Stock) hoặc Mức Tối Thiểu (Minimum Stock), hệ thống tự động khởi tạo email cảnh báo gửi thẳng tới email Quản lý phòng lab.
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Địa chỉ Email Quản lý nhận thông báo *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={managerEmailInput}
                    onChange={(e) => setManagerEmailInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white font-mono text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Mặc định: buianhtra2021@gmail.com (Email của Lab Manager)
                </p>
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

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-slate-600 hover:text-slate-800"
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
