import React, { useState } from 'react';
import { useLab } from '../context/LabContext';
import { User, UserRole, UserStatus } from '../types';
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
} from 'lucide-react';
import { UserLimitsModal } from './modals/UserLimitsModal';
import { DeleteManagerModal } from './modals/DeleteManagerModal';

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
    deleteDeactivatedManager,
    restoreUser,
  } = useLab();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');

  // Form states
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('USER');
  const [newDept, setNewDept] = useState('Bộ môn Dược liệu & Chiết xuất');

  // Editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('USER');
  const [editDept, setEditDept] = useState('');

  // Limits & Permissions Modal
  const [selectedUserForLimits, setSelectedUserForLimits] = useState<User | null>(null);
  // Delete Manager Confirmation Modal (Mục 1, 2, 3, 4)
  const [selectedUserForDeletion, setSelectedUserForDeletion] = useState<User | null>(null);

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
          Trang <strong>Quản Lý Người Dùng & Phân Quyền (User Management)</strong> chỉ dành riêng cho tài khoản có vai trò <strong>MANAGER</strong>.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Tài khoản hiện tại của bạn: <strong>{currentUser.name}</strong> ({currentUser.role}). Bạn không có thẩm quyền truy cập trang này.
        </p>
      </div>
    );
  }

  const isDeletedTab = statusFilter === 'DELETED';
  const pendingUsers = users.filter((u) => u.status === 'PENDING');
  const deletedUsers = users.filter((u) => u.status === 'DELETED');

  const filteredUsers = users.filter((u) => {
    // 14. FILTER: Tài khoản DELETED mặc định KHÔNG xuất hiện trong danh sách User chính. Chỉ xuất hiện trong Lịch sử xóa.
    if (!isDeletedTab && u.status === 'DELETED') {
      return false;
    }
    if (isDeletedTab && u.status !== 'DELETED') {
      return false;
    }

    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (statusFilter !== 'ALL' && statusFilter !== 'DELETED' && u.status !== statusFilter) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        (u.deleted_by_name && u.deleted_by_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      showMsg('Vui lòng điền họ tên và email.', 'error');
      return;
    }
    const res = addUser({
      name: newName.trim(),
      email: newEmail.trim(),
      role: newRole,
      department: newDept.trim(),
      status: 'ACTIVE',
    });
    if (res.success) {
      showMsg(`Đã tạo thành viên "${newName}" thành công!`);
      setNewName('');
      setNewEmail('');
      setIsAddingUser(false);
    } else {
      showMsg(res.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Quản Lý Người Dùng & Phân Quyền</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Duyệt thành viên Google OAuth, cấp quyền vai trò (MANAGER / USER), kích hoạt hoặc khóa tài khoản
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAddingUser(!isAddingUser)}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{isAddingUser ? 'Đóng biểu mẫu' : '+ Thêm Thành Viên Mới'}</span>
        </button>
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

      {/* Add User Modal / Form */}
      {isAddingUser && (
        <form onSubmit={handleAddSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 animate-in fade-in">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <UserPlus className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Thêm Thành Viên Mới Vào Lab</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Họ và tên *</label>
              <input
                type="text"
                required
                placeholder="vd: Trần Văn Bình"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Google Email *</label>
              <input
                type="email"
                required
                placeholder="user@gmail.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vai trò cấp quyền (Role)</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
              >
                <option value="USER">USER (Thành viên - Chỉ ghi sử dụng)</option>
                <option value="MANAGER">MANAGER (Quản lý - Toàn quyền quản trị)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bộ môn / Đơn vị</label>
              <input
                type="text"
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingUser(false)}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-xs cursor-pointer"
            >
              Lưu & Kích Hoạt Thành Viên
            </button>
          </div>
        </form>
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
                <option value="ALL">Tất cả role</option>
                <option value="MANAGER">MANAGER</option>
                <option value="USER">USER</option>
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
                  <th className="py-3 px-4">Thành viên (Name)</th>
                  <th className="py-3 px-4">Email Google</th>
                  <th className="py-3 px-4">Vai trò (Role)</th>
                  <th className="py-3 px-4">Định mức & Hạn chế</th>
                  <th className="py-3 px-4">Trạng thái (Status)</th>
                  <th className="py-3 px-4">Lần đăng nhập cuối</th>
                  <th className="py-3 px-4 text-right">Thao tác (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Không tìm thấy thành viên nào phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isCurrent = u.id === currentUser.id;

                    return (
                      <tr key={u.id} className={`hover:bg-slate-50/70 transition-colors ${isCurrent ? 'bg-purple-50/20' : ''}`}>
                        {/* Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded text-[9px] font-bold">
                                    Bạn
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">{u.department}</div>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3 px-4 font-mono text-slate-700 text-[11px]">
                          {u.email}
                        </td>

                        {/* Role Dropdown */}
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            onChange={(e) => {
                              const newR = e.target.value as UserRole;
                              const res = changeUserRole(u.id, newR);
                              if (res.success) showMsg(res.message);
                              else showMsg(res.message, 'error');
                            }}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-mono font-bold cursor-pointer transition-colors ${
                              u.role === 'MANAGER' || u.role === 'ADMIN'
                                ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <option value="USER">USER</option>
                            <option value="MANAGER">MANAGER</option>
                          </select>
                        </td>

                        {/* Limits & Quotas summary column */}
                        <td className="py-3 px-4">
                          {u.role === 'MANAGER' || u.role === 'ADMIN' ? (
                            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                              Toàn quyền (Không giới hạn)
                            </span>
                          ) : (
                            <div className="space-y-0.5 text-[10px] font-mono">
                              <div className="flex items-center gap-1 text-slate-700">
                                <span className="text-slate-400">Dùng:</span>
                                <span className="font-bold text-slate-900">{u.limits?.maxUsagePerTransaction != null ? `${u.limits.maxUsagePerTransaction} mL` : '∞'}</span>
                                <span className="text-slate-300">/lần</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-400">Ngày:</span>
                                <span className="font-bold text-purple-700">{u.limits?.dailyUsageLimit != null ? `${u.limits.dailyUsageLimit} mL` : '∞'}</span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-500">
                                <span>Số lần: {u.limits?.dailyTransactionCount != null ? `${u.limits.dailyTransactionCount} lần` : '∞'}</span>
                                <span className="text-slate-300">•</span>
                                <span>Nhập: {u.limits?.maxStockInQuantity != null ? `${u.limits.maxStockInQuantity} chai` : '∞'}</span>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
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

                        {/* Last Login */}
                        <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('vi-VN') : 'Chưa đăng nhập'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Limit & Permission Config Button */}
                            <button
                              onClick={() => setSelectedUserForLimits(u)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 cursor-pointer flex items-center gap-1 transition-colors"
                              title="Thiết lập giới hạn định mức & phân quyền"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              <span>Hạn mức</span>
                            </button>

                            {u.status === 'PENDING' && (
                              <button
                                onClick={() => {
                                  const res = approveUser(u.id);
                                  if (res.success) showMsg(res.message);
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-300 cursor-pointer"
                              >
                                Duyệt
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
                                className="px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                                title="Vô hiệu hóa (Deactivate)"
                              >
                                Khóa
                              </button>
                            )}

                            {u.status === 'DEACTIVATED' && (
                              <>
                                <button
                                  onClick={() => {
                                    const res = activateUser(u.id);
                                    if (res.success) showMsg(res.message);
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50 rounded-lg border border-cyan-300 cursor-pointer"
                                  title="Mở khóa tài khoản"
                                >
                                  Mở khóa
                                </button>

                                {/* 1, 2: NÚT XÓA CHỈ HIỂN THỊ ĐỐI VỚI MANAGER ĐÃ DEACTIVATED: [ Hạn mức ] [ Mở khóa ] [ 🗑 Xóa ] */}
                                {(u.role === 'MANAGER' || u.role === 'ADMIN' || u.role === 'LAB_MANAGER') && (
                                  <button
                                    onClick={() => setSelectedUserForDeletion(u)}
                                    className="px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer flex items-center gap-1 transition-colors"
                                    title="Xóa tài khoản Manager đã Deactivated (Đưa vào Lịch sử xóa)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Xóa</span>
                                  </button>
                                )}
                              </>
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

      {/* Delete Manager Confirmation Modal (Mục 3 & 4) */}
      <DeleteManagerModal
        isOpen={!!selectedUserForDeletion}
        user={selectedUserForDeletion}
        onClose={() => setSelectedUserForDeletion(null)}
        onSuccess={(msg) => {
          showMsg(`✓ Đã xóa tài khoản: ${msg}`);
        }}
      />
    </div>
  );
};
