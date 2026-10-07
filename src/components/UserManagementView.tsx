import React, { useState, useEffect } from 'react';
import { useLab } from '../context/LabContext';
import { User, UserRole, UserStatus } from '../types';
import { supabase } from '../lib/supabase';
import { rowToUser } from '../services/authService';
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserPlus,
  Edit3,
  Search,
  Check,
  Lock,
  Mail,
  ShieldCheck,
  Sliders,
  Gauge,
  Trash2,
  RotateCcw,
  History,
  Edit,
  Building,
  KeyRound,
} from 'lucide-react';
import { UserLimitsModal } from './modals/UserLimitsModal';
import { DeleteManagerModal } from './modals/DeleteManagerModal';
import { EditUserModal, PRESET_DEPARTMENTS } from './modals/EditUserModal';
import { CreateAccountModal } from './modals/CreateAccountModal';
import { ResetPasswordModal } from './modals/ResetPasswordModal';
import { getRoleDisplayName, isSeniorManagerUser, isSeniorManagerEmail } from '../utils/roleUtils';

export const UserManagementView: React.FC = () => {
  const {
    users,
    currentUser,
    isManager,
    approveUser,
    rejectUser,
    deactivateUser,
    activateUser,
    changeUserRole,
    addUser,
    updateUser,
    changeUserDepartment,
    canManageTargetUser,
    deleteUser,
    deleteDeactivatedManager,
    restoreUser,
    refreshFromSupabase,
    refreshUsers: contextRefreshUsers,
    setUsers,
  } = useLab();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<'ALL' | string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Tải lại danh sách Users mới nhất trực tiếp từ bảng profiles trong Supabase
   */
  const refreshUsers = async (): Promise<User[]> => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Users] Refresh failed:', error);
        const fallbackUsers = await contextRefreshUsers();
        return fallbackUsers;
      }

      if (data && data.length > 0) {
        const formatted = data.map(rowToUser);
        setUsers(formatted);
        return formatted;
      } else {
        const fallbackUsers = await contextRefreshUsers();
        return fallbackUsers;
      }
    } catch (err) {
      console.error('[Users] Refresh failed:', err);
      const fallbackUsers = await contextRefreshUsers();
      return fallbackUsers;
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Tự động tải lại profiles mới nhất khi mở trang Quản lý người dùng
    refreshUsers();
  }, []);

  // Cấp tài khoản mới (Chỉ Người quản lý cao cấp)
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [selectedUserForResetPassword, setSelectedUserForResetPassword] = useState<User | null>(null);

  // Editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('USER');
  const [editDept, setEditDept] = useState('');

  // Modals state
  const [selectedUserForLimits, setSelectedUserForLimits] = useState<User | null>(null);
  const [selectedUserForDeletion, setSelectedUserForDeletion] = useState<User | null>(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);

  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setNotificationMsg({ type, text });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Section 65 Test I: If User tries to access User Management -> ACCESS DENIED
  if (!isManager) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-xl mx-auto shadow-xs">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">TRUY CẬP BỊ TỪ CHỐI (ACCESS DENIED)</h2>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          Trang <strong>Quản Lý Người Dùng & Phân Quyền (User Management)</strong> chỉ dành riêng cho tài khoản có vai trò <strong>Người quản lý</strong>.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Tài khoản hiện tại của bạn: <strong>{currentUser.name}</strong> ({getRoleDisplayName(currentUser.role, currentUser.email)}). Bạn không có thẩm quyền truy cập trang này.
        </p>
      </div>
    );
  }

  const isDeletedTab = statusFilter === 'DELETED';
  const isCurrentUserSenior = isSeniorManagerUser(currentUser);
  const pendingUsers = users.filter((u) => u.status === 'PENDING' && (isCurrentUserSenior || !isSeniorManagerUser(u)));
  const deletedUsers = users.filter((u) => u.status === 'DELETED' && (isCurrentUserSenior || !isSeniorManagerUser(u)));

  const filteredUsers = users.filter((u) => {
    // Ẩn Người quản lý cao cấp đối với các tài khoản khác
    if (!isCurrentUserSenior && isSeniorManagerUser(u)) {
      return false;
    }

    // 14. FILTER: Tài khoản DELETED mặc định KHÔNG xuất hiện trong danh sách User chính. Chỉ xuất hiện trong Lịch sử xóa.
    if (!isDeletedTab && u.status === 'DELETED') {
      return false;
    }
    if (isDeletedTab && u.status !== 'DELETED') {
      return false;
    }

    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (statusFilter !== 'ALL' && statusFilter !== 'DELETED' && u.status !== statusFilter) return false;
    if (departmentFilter !== 'ALL' && u.department !== departmentFilter) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        (u.manager_name && u.manager_name.toLowerCase().includes(q)) ||
        (u.deleted_by_name && u.deleted_by_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">QUẢN LÝ NGƯỜI DÙNG</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Cấp tài khoản thành viên, đặt vai trò, phân quyền hạn mức, kích hoạt hoặc khóa tài khoản phòng Lab
              </p>
            </div>
          </div>
        </div>

        {isManager && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshUsers()}
              disabled={isRefreshing}
              className="px-3 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="Tải lại danh sách người dùng mới nhất từ Supabase"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-700' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
            <button
              type="button"
              onClick={() => setIsProvisionModalOpen(true)}
              className="px-4 py-2.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Cấp tài khoản</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards: Tổng tài khoản, ACTIVE, LOCKED */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng tài khoản</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {users.filter((u) => u.status !== 'DELETED').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">ACTIVE</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">
              {users.filter((u) => u.status === 'ACTIVE').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">LOCKED</p>
            <p className="text-2xl font-black text-rose-700 mt-1">
              {users.filter((u) => u.status === 'LOCKED' || u.status === 'DEACTIVATED' || u.status === 'SUSPENDED').length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {notificationMsg && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
            notificationMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notificationMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{notificationMsg.text}</span>
        </div>
      )}

      {/* PENDING APPROVALS QUEUE (Section 39 & 57) */}
      {pendingUsers.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700" />
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Yêu Cầu Chờ Phê Duyệt ({pendingUsers.length} tài khoản mới)
              </h3>
            </div>
            <span className="text-[11px] text-amber-800 font-medium">
              Chỉ Quản lý mới có quyền phê duyệt để cấp quyền sử dụng
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{u.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800">
                      PENDING
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">{u.email}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Đăng nhập lần đầu: {u.lastLogin ? new Date(u.lastLogin).toLocaleTimeString('vi-VN') : 'Mới'}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      const res = approveUser(u.id);
                      if (res.success) showMsg(res.message);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Duyệt (Approve)</span>
                  </button>
                  <button
                    onClick={() => {
                      const res = rejectUser(u.id);
                      if (res.success) showMsg(res.message);
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 cursor-pointer transition-colors"
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table: User Management Matrix (Section 41) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Status Tabs Navigation (Mục 7 & 14) */}
        <div className="flex items-center gap-1.5 p-3 border-b border-slate-200 bg-slate-50/70 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <span>Tất cả</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
              {users.filter((u) => u.status !== 'DELETED').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              statusFilter === 'ACTIVE'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-emerald-700 hover:bg-white/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Active</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-50 text-emerald-700 font-mono">
              {users.filter((u) => u.status === 'ACTIVE').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('DEACTIVATED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              statusFilter === 'DEACTIVATED'
                ? 'bg-white text-rose-800 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-rose-700 hover:bg-white/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Deactivated</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-50 text-rose-700 font-mono">
              {users.filter((u) => u.status === 'DEACTIVATED').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              statusFilter === 'PENDING'
                ? 'bg-white text-amber-800 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-amber-700 hover:bg-white/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Pending</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-50 text-amber-700 font-mono">
              {users.filter((u) => u.status === 'PENDING').length}
            </span>
          </button>

          <div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />

          {/* Lịch sử xóa Tab (Mục 7: Lịch sử xóa) */}
          <button
            type="button"
            onClick={() => setStatusFilter('DELETED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              statusFilter === 'DELETED'
                ? 'bg-rose-50 text-rose-900 shadow-xs border border-rose-300 font-bold ring-2 ring-rose-200/50'
                : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/50'
            }`}
          >
            <History className="w-3.5 h-3.5 text-rose-600" />
            <span>Lịch sử xóa</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-mono font-bold">
              {deletedUsers.length}
            </span>
          </button>
        </div>

        {/* Filters & Search */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder={isDeletedTab ? "Tìm trong lịch sử xóa..." : "Tìm theo tên, email hoặc bộ môn..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-purple-600"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-slate-500">Vai trò:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="MANAGER">Người quản lý</option>
                <option value="STAFF">Nhân viên</option>
                <option value="VIEWER">Người xem</option>
                <option value="USER">Thành viên</option>
              </select>
            </div>

            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-slate-500">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white font-medium"
              >
                <option value="ALL">Tất cả (Chưa xóa)</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="DEACTIVATED">DEACTIVATED</option>
                <option value="DELETED">DELETED (Lịch sử xóa)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {isDeletedTab ? (
            /* 7. TRANG LỊCH SỬ XÓA TABLE */
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-rose-200 bg-rose-50/50 text-[11px] font-bold text-rose-900 uppercase tracking-wider">
                  <th className="py-3 px-4">Tên thành viên</th>
                  <th className="py-3 px-4">Email Google</th>
                  <th className="py-3 px-4">Vai trò (Role)</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Người thực hiện xóa</th>
                  <th className="py-3 px-4">Thời gian xóa</th>
                  <th className="py-3 px-4 text-right">Thao tác (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <History className="w-6 h-6" />
                        </div>
                        <div className="font-semibold text-slate-600 text-sm">Chưa có tài khoản nào trong Lịch sử xóa</div>
                        <p className="text-slate-400 text-xs max-w-sm">
                          Khi một Quản lý (MANAGER) đã vô hiệu hóa bị xóa, tài khoản sẽ được lưu trữ an toàn tại đây và vẫn bảo toàn toàn bộ dữ liệu giao dịch.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{u.name}</div>
                            <div className="text-[11px] text-slate-500">{u.department}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700 text-[11px]">
                        {u.email}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-100 text-rose-800 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                          <span>ĐÃ XÓA</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs">
                        <div className="font-semibold text-slate-800">{u.deleted_by_name || 'Quản lý'}</div>
                        {u.deletion_reason && (
                          <div className="text-[10px] text-slate-500 italic truncate max-w-[200px]" title={u.deletion_reason}>
                            Lý do: {u.deletion_reason}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                        {u.deleted_at ? new Date(u.deleted_at).toLocaleString('vi-VN') : '—'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {/* 8. KHÔI PHỤC BUTTON (DELETED -> DEACTIVATED) */}
                        <button
                          onClick={() => {
                            const res = restoreUser(u.id);
                            if (res.success) {
                              showMsg(`✓ ${res.message}`);
                            } else {
                              showMsg(res.message, 'error');
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:text-cyan-800 bg-cyan-50 hover:bg-cyan-100 rounded-lg border border-cyan-300 cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                          title="Khôi phục tài khoản về trạng thái DEACTIVATED"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Khôi phục</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* NORMAL ACTIVE / PENDING / DEACTIVATED TABLE */
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">THÀNH VIÊN</th>
                  <th className="py-3 px-4">TÊN ĐĂNG NHẬP / EMAIL</th>
                  <th className="py-3 px-4">VAI TRÒ</th>
                  <th className="py-3 px-4">BỘ MÔN</th>
                  <th className="py-3 px-4">ĐỊNH MỨC & HẠN CHẾ</th>
                  <th className="py-3 px-4">TRẠNG THÁI</th>
                  <th className="py-3 px-4">NGÀY TẠO / ĐĂNG NHẬP</th>
                  <th className="py-3 px-4 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Không tìm thấy thành viên nào phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isCurrent = u.id === currentUser.id;
                    const isTargetSenior = isSeniorManagerUser(u);
                    const isTargetManager = isTargetSenior || u.role === 'MANAGER' || u.role === 'ADMIN' || u.role === 'LAB_MANAGER';
                    const perm = canManageTargetUser(u);
                    const canResetTargetPassword = isManager && !isCurrent && (!isTargetSenior || isCurrentUserSenior);
                    const canEditUser = !isTargetSenior && (currentUser.role === 'ADMIN' || isCurrent || (!isTargetManager && perm.allowed));
                    const canManageLimits = !isTargetSenior && !isTargetManager && perm.allowed;
                    const canLockUser = !isTargetSenior && (currentUser.role === 'ADMIN' || (!isTargetManager && perm.allowed));
                    const canDeleteUser =
                      !isCurrent &&
                      !isTargetSenior &&
                      u.role !== 'ADMIN' &&
                      (isTargetManager ? u.status === 'DEACTIVATED' : perm.allowed);

                    return (
                      <tr key={u.id} className={`hover:bg-slate-50/70 transition-colors ${isCurrent ? 'bg-purple-50/20' : ''}`}>
                        {/* THÀNH VIÊN */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                <span>{u.name}</span>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded text-[9px] font-bold">
                                    Bạn
                                  </span>
                                )}
                              </div>
                              {u.manager_name && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <span>QL:</span>
                                  <span className={u.manager_id === currentUser.id ? "font-semibold text-purple-700" : "text-slate-600"}>
                                    {u.manager_name}
                                  </span>
                                  {u.manager_id === currentUser.id && (
                                    <span className="text-[9px] bg-purple-50 text-purple-700 px-1 rounded font-medium">
                                      Thuộc quyền
                                    </span>
                                  )}
                                </div>
                              )}
                              {u.position && (
                                <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]">{u.position}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* TÊN ĐĂNG NHẬP / EMAIL */}
                        <td className="py-3 px-4 font-mono text-slate-700 text-[11px] whitespace-nowrap">
                          {u.username ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-purple-700">@{u.username}</span>
                              {u.email && !u.email.endsWith('@labchem.local') && (
                                <span className="text-[10px] text-slate-400 font-sans">{u.email}</span>
                              )}
                            </div>
                          ) : (
                            <span>{u.email}</span>
                          )}
                        </td>

                        {/* VAI TRÒ */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                              u.role === 'SENIOR_MANAGER'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : u.role === 'MANAGER' || u.role === 'ADMIN'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : u.role === 'STAFF'
                                ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                : u.role === 'VIEWER'
                                ? 'bg-slate-50 text-slate-600 border-slate-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {getRoleDisplayName(u.role, u.email)}
                          </span>
                        </td>

                        {/* BỘ MÔN */}
                        <td className="py-3 px-4 text-xs">
                          <div className="font-medium text-slate-800 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[170px]" title={u.department}>
                              {u.department}
                            </span>
                          </div>
                        </td>

                        {/* ĐỊNH MỨC & HẠN CHẾ */}
                        <td className="py-3 px-4">
                          {u.role === 'MANAGER' || u.role === 'ADMIN' ? (
                            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 whitespace-nowrap">
                              Toàn quyền (Không giới hạn)
                            </span>
                          ) : (
                            <div className="space-y-0.5 text-[10px] font-mono whitespace-nowrap">
                              <div className="flex items-center gap-1 text-slate-700">
                                <span className="text-slate-400">Dùng:</span>
                                <span className="font-bold text-slate-900">{u.limits?.maxUsagePerTransaction != null ? `${u.limits.maxUsagePerTransaction} mL` : '∞'}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-400">Ngày:</span>
                                <span className="font-bold text-purple-700">{u.limits?.dailyUsageLimit != null ? `${u.limits.dailyUsageLimit} mL` : '∞'}</span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-500">
                                <span>{u.limits?.dailyTransactionCount != null ? `${u.limits.dailyTransactionCount} lần/ngày` : '∞ lần'}</span>
                                <span className="text-slate-300">•</span>
                                <span>Nhập: {u.limits?.maxStockInQuantity != null ? `${u.limits.maxStockInQuantity} chai` : '∞'}</span>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* TRẠNG THÁI */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : u.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : u.status === 'SUSPENDED'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.status === 'ACTIVE'
                                  ? 'bg-emerald-600'
                                  : u.status === 'PENDING'
                                  ? 'bg-amber-600'
                                  : u.status === 'SUSPENDED'
                                  ? 'bg-orange-600'
                                  : 'bg-rose-600'
                              }`}
                            />
                            <span>{u.status}</span>
                          </span>
                        </td>

                        {/* LẦN ĐĂNG NHẬP */}
                        <td className="py-3 px-4 text-slate-500 text-[11px] font-mono whitespace-nowrap">
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('vi-VN') : 'Chưa đăng nhập'}
                        </td>

                        {/* THAO TÁC */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* [ Cấp lại mật khẩu ] */}
                            {canResetTargetPassword && (
                              <button
                                onClick={() => setSelectedUserForResetPassword(u)}
                                className="px-2 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 cursor-pointer inline-flex items-center gap-1 shadow-2xs transition-colors"
                                title="Cấp lại mật khẩu cho thành viên"
                              >
                                <KeyRound className="w-3 h-3 text-purple-700" />
                                <span>Cấp lại mật khẩu</span>
                              </button>
                            )}

                            {/* [ Chỉnh sửa ] */}
                            <button
                              onClick={() => setSelectedUserForEdit(u)}
                              disabled={!canEditUser}
                              className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors inline-flex items-center gap-1 ${
                                canEditUser
                                  ? 'text-slate-700 bg-white hover:bg-slate-100 hover:text-slate-900 border-slate-200 cursor-pointer shadow-2xs'
                                  : 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed opacity-50'
                              }`}
                              title={canEditUser ? 'Chỉnh sửa thông tin & chuyển bộ môn' : 'Không có quyền chỉnh sửa tài khoản này'}
                            >
                              <Edit className="w-3 h-3 text-slate-500" />
                              <span>Chỉnh sửa</span>
                            </button>

                            {/* [ Hạn mức ] */}
                            <button
                              onClick={() => setSelectedUserForLimits(u)}
                              disabled={!canManageLimits}
                              className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors inline-flex items-center gap-1 ${
                                canManageLimits
                                  ? 'text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200 cursor-pointer shadow-2xs'
                                  : 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed opacity-50'
                              }`}
                              title={
                                u.role === 'MANAGER' || u.role === 'ADMIN'
                                  ? 'Tài khoản Quản trị toàn quyền (không giới hạn)'
                                  : canManageLimits
                                  ? 'Thiết lập định mức & phân quyền'
                                  : 'Không có quyền sửa hạn mức'
                              }
                            >
                              <Sliders className="w-3 h-3" />
                              <span>Hạn mức</span>
                            </button>

                            {/* [ Khóa ] / [ Mở khóa ] / [ Duyệt ] */}
                            {u.status === 'PENDING' && (
                              <button
                                onClick={() => {
                                  const res = approveUser(u.id);
                                  if (res.success) showMsg(res.message);
                                  else showMsg(res.message, 'error');
                                }}
                                className="px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-300 cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                title="Phê duyệt tài khoản"
                              >
                                <Check className="w-3 h-3" />
                                <span>Duyệt</span>
                              </button>
                            )}

                            {u.status === 'ACTIVE' && (
                              <button
                                onClick={() => {
                                  if (confirm(`Bạn có chắc muốn vô hiệu hóa tài khoản "${u.name}"? Người dùng này sẽ không thể ghi nhận thêm giao dịch, nhưng lịch sử vẫn được giữ nguyên.`)) {
                                    const res = deactivateUser(u.id);
                                    if (res.success) showMsg(res.message);
                                    else showMsg(res.message, 'error');
                                  }
                                }}
                                disabled={!canLockUser || isCurrent}
                                className={`px-2 py-1 text-[11px] font-medium rounded-lg border transition-colors inline-flex items-center gap-1 ${
                                  canLockUser && !isCurrent
                                    ? 'text-rose-600 hover:bg-rose-50 border-rose-200 cursor-pointer'
                                    : 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed opacity-50'
                                }`}
                                title={isCurrent ? 'Không thể tự khóa tài khoản của chính mình' : canLockUser ? 'Khóa tài khoản' : 'Không có quyền khóa tài khoản này'}
                              >
                                <Lock className="w-3 h-3" />
                                <span>Khóa</span>
                              </button>
                            )}

                            {(u.status === 'DEACTIVATED' || u.status === 'LOCKED' || u.status === 'SUSPENDED') && (
                              <button
                                onClick={() => {
                                  const res = activateUser(u.id);
                                  if (res.success) showMsg(res.message);
                                  else showMsg(res.message, 'error');
                                }}
                                disabled={!canLockUser}
                                className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors inline-flex items-center gap-1 ${
                                  canLockUser
                                    ? 'text-cyan-700 hover:bg-cyan-50 border-cyan-300 cursor-pointer'
                                    : 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed opacity-50'
                                }`}
                                title={canLockUser ? 'Mở khóa tài khoản' : 'Không có quyền mở khóa tài khoản này'}
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Mở khóa</span>
                              </button>
                            )}

                            {/* [ Xóa ] */}
                            {canDeleteUser && (
                              <button
                                onClick={() => setSelectedUserForDeletion(u)}
                                className="px-2 py-1 text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer inline-flex items-center gap-1 transition-colors shadow-2xs"
                                title="Xóa tài khoản thuộc phạm vi quản lý (Chuyển vào Lịch sử xóa & bảo toàn dữ liệu)"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Xóa</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Permission Matrix Reference Card (Section 43) */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Bảng Phân Quyền Hệ Thống (Permission Matrix)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Tra Cứu & Xem Kho</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Cả <strong>MANAGER</strong> và <strong>USER</strong> đều được xem danh mục hóa chất, số CAS, vị trí tủ, hạn dùng và lịch sử sử dụng.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              <span>Ghi Nhận Sử Dụng (Record Usage)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              USER chỉ được ghi thể tích đã dùng. Hệ thống tự động trừ chai và kiểm tra tồn kho. <strong>USER không được sửa trực tiếp số lượng tồn kho.</strong>
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Độc Quyền Quản Lý (Manager Only)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Chỉ <strong>MANAGER</strong> mới được: Thêm hóa chất, Nhập kho (Stock In), Phê duyệt tài khoản, Điều chỉnh tồn kho (Adjustment), Hoàn tác giao dịch và xem Audit Log.
            </p>
          </div>
        </div>
      </div>

      {/* User Limits & Permissions Editor Modal */}
      <UserLimitsModal
        isOpen={!!selectedUserForLimits}
        user={selectedUserForLimits}
        onClose={() => setSelectedUserForLimits(null)}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={!!selectedUserForEdit}
        user={selectedUserForEdit}
        onClose={() => setSelectedUserForEdit(null)}
        onSaved={(msg) => {
          showMsg(`✓ ${msg}`);
        }}
      />

      {/* Delete Manager Confirmation Modal (Mục 3 & 4) */}
      <DeleteManagerModal
        isOpen={!!selectedUserForDeletion}
        user={selectedUserForDeletion}
        onClose={() => setSelectedUserForDeletion(null)}
        onSuccess={(msg) => {
          showMsg(`✓ Đã xóa tài khoản: ${msg}`);
        }}
      />

      {/* Create Account Modal (Cấp tài khoản mới) */}
      <CreateAccountModal
        isOpen={isProvisionModalOpen}
        onClose={() => setIsProvisionModalOpen(false)}
        refreshUsers={refreshUsers}
        onSuccess={async (newUser) => {
          showMsg(
            `✓ Cấp tài khoản thành công cho "${newUser.name}" (Tên đăng nhập: ${newUser.username || newUser.email})!`
          );
        }}
      />

      {/* Reset Password Modal (Đặt lại mật khẩu) */}
      <ResetPasswordModal
        isOpen={!!selectedUserForResetPassword}
        user={selectedUserForResetPassword}
        onClose={() => setSelectedUserForResetPassword(null)}
        onSuccess={async () => {
          showMsg('✓ Đã đặt lại mật khẩu cho thành viên thành công!');
          await refreshFromSupabase();
        }}
      />
    </div>
  );
};
