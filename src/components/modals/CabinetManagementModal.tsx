import React, { useState } from 'react';
import { useLab } from '../../context/LabContext';
import { StorageCabinet, StorageHazardType } from '../../types';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Building2,
  DoorClosed,
  Layers,
  ShieldAlert,
  Flame,
  Snowflake,
  Droplets,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface CabinetManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCabinet?: (cabinet: StorageCabinet, defaultShelf?: string) => void;
  selectedCabinetId?: string;
}

const HAZARD_TYPE_CONFIG: Record<
  StorageHazardType,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  GENERAL: {
    label: 'Chung (General)',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    icon: <Layers className="w-3.5 h-3.5 text-slate-500" />,
  },
  FLAMMABLE: {
    label: 'Chống cháy (Flammable)',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    icon: <Flame className="w-3.5 h-3.5 text-amber-600" />,
  },
  ACID: {
    label: 'Axit ăn mòn (Acid)',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-300',
    icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />,
  },
  BASE: {
    label: 'Kiềm / Bazơ (Base)',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-300',
    icon: <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />,
  },
  TOXIC: {
    label: 'Độc hại (Toxic)',
    bg: 'bg-red-50',
    text: 'text-red-900',
    border: 'border-red-300',
    icon: <ShieldAlert className="w-3.5 h-3.5 text-red-700" />,
  },
  COLD: {
    label: 'Lạnh / Âm sâu (Cold 2-8°C / -20°C)',
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-300',
    icon: <Snowflake className="w-3.5 h-3.5 text-sky-600" />,
  },
  DRY: {
    label: 'Hút ẩm (Desiccator)',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    icon: <Droplets className="w-3.5 h-3.5 text-emerald-600" />,
  },
};

export const CabinetManagementModal: React.FC<CabinetManagementModalProps> = ({
  isOpen,
  onClose,
  onSelectCabinet,
  selectedCabinetId,
}) => {
  const { storageCabinets, addStorageCabinet, updateStorageCabinet, deleteStorageCabinet, isManager } = useLab();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterHazard, setFilterHazard] = useState<string>('ALL');

  // Add / Edit form mode
  const [isEditing, setIsEditing] = useState(false);
  const [editingCabinetId, setEditingCabinetId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [building, setBuilding] = useState('Building A');
  const [room, setRoom] = useState('Room 302');
  const [shelvesInput, setShelvesInput] = useState('Shelf 1, Shelf 2, Shelf 3');
  const [hazardType, setHazardType] = useState<StorageHazardType>('GENERAL');
  const [notes, setNotes] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  const handleStartAdd = () => {
    setIsEditing(true);
    setEditingCabinetId(null);
    setName('');
    setDisplayName('');
    setBuilding('Building A');
    setRoom('Room 302');
    setShelvesInput('Shelf 1, Shelf 2, Shelf 3, Shelf 4');
    setHazardType('GENERAL');
    setNotes('');
  };

  const handleStartEdit = (cab: StorageCabinet) => {
    setIsEditing(true);
    setEditingCabinetId(cab.id);
    setName(cab.name);
    setDisplayName(cab.displayName || '');
    setBuilding(cab.building);
    setRoom(cab.room);
    setShelvesInput(cab.shelves.join(', '));
    setHazardType(cab.hazardType || 'GENERAL');
    setNotes(cab.notes || '');
  };

  const handleCancelForm = () => {
    setIsEditing(false);
    setEditingCabinetId(null);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showMsg('Vui lòng nhập tên tủ (Cabinet Name)', 'error');
      return;
    }

    const parsedShelves = shelvesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const finalShelves = parsedShelves.length > 0 ? parsedShelves : ['Shelf 1', 'Shelf 2'];

    if (editingCabinetId) {
      const res = updateStorageCabinet(editingCabinetId, {
        name: name.trim(),
        displayName: displayName.trim() || `${name.trim()} (${room.trim()}, ${building.trim()})`,
        building: building.trim(),
        room: room.trim(),
        shelves: finalShelves,
        hazardType,
        notes: notes.trim(),
      });
      if (res.success) {
        showMsg(res.message, 'success');
        setIsEditing(false);
        setEditingCabinetId(null);
      } else {
        showMsg(res.message, 'error');
      }
    } else {
      const res = addStorageCabinet({
        name: name.trim(),
        displayName: displayName.trim() || `${name.trim()} (${room.trim()}, ${building.trim()})`,
        building: building.trim(),
        room: room.trim(),
        shelves: finalShelves,
        hazardType,
        notes: notes.trim(),
      });
      if (res.success) {
        showMsg(res.message, 'success');
        setIsEditing(false);
        if (onSelectCabinet && res.cabinet) {
          onSelectCabinet(res.cabinet, res.cabinet.shelves[0]);
          onClose();
        }
      } else {
        showMsg(res.message, 'error');
      }
    }
  };

  const handleDelete = (id: string, cabName: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa tủ "${cabName}" khỏi danh mục không?`)) {
      const res = deleteStorageCabinet(id);
      if (res.success) {
        showMsg(res.message, 'success');
      } else {
        showMsg(res.message, 'error');
      }
    }
  };

  const filteredCabinets = storageCabinets.filter((c) => {
    if (filterHazard !== 'ALL' && c.hazardType !== filterHazard) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.displayName && c.displayName.toLowerCase().includes(q)) ||
        c.room.toLowerCase().includes(q) ||
        c.building.toLowerCase().includes(q) ||
        c.shelves.some((s) => s.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-100 text-cyan-800 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Danh Mục Vị Trí Tủ & Ngăn Kệ Lưu Trữ
              </h2>
              <p className="text-xs text-slate-500">
                Quản lý hệ thống tủ hóa chất, phân loại an toàn và tầng kệ (Shelves) phòng thí nghiệm
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message banner */}
        {message && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center gap-2 border-b ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{message.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Add / Edit Form Drawer */}
          {isEditing ? (
            <div className="bg-cyan-50/50 border border-cyan-200 rounded-2xl p-5 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-cyan-200">
                <h3 className="text-sm font-bold text-cyan-950 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-cyan-700" />
                  <span>
                    {editingCabinetId ? 'Chỉnh Sửa Thông Tin Tủ' : 'Thêm Tủ Mới Vào Danh Mục'}
                  </span>
                </h3>
                <span className="text-[11px] text-cyan-800">
                  Vị trí sẽ được lưu vào hệ sinh thái phòng lab và hiển thị ngay khi nhập hóa chất.
                </span>
              </div>

              <form onSubmit={handleSaveForm} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Tên định danh tủ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="vd: Cabinet C5, Tủ Flammable 2, Tủ Axit A2..."
                      required
                      className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Tên mô tả đầy đủ (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="vd: Tủ C5 - Dung môi chiết xuất cao cấp"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Tòa nhà (Building)
                    </label>
                    <input
                      type="text"
                      value={building}
                      onChange={(e) => setBuilding(e.target.value)}
                      placeholder="Building A, Nhà B..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Phòng (Room)
                    </label>
                    <input
                      type="text"
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      placeholder="Room 302, Lab 101..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Phân loại an toàn
                    </label>
                    <select
                      value={hazardType}
                      onChange={(e) => setHazardType(e.target.value as StorageHazardType)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden"
                    >
                      <option value="GENERAL">Chung (General)</option>
                      <option value="FLAMMABLE">Chống cháy (Flammable)</option>
                      <option value="ACID">Axit ăn mòn (Acid)</option>
                      <option value="BASE">Kiềm / Bazơ (Base)</option>
                      <option value="TOXIC">Độc hại (Toxic)</option>
                      <option value="COLD">Lạnh / Tủ mát (Cold)</option>
                      <option value="DRY">Hút ẩm (Desiccator)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Danh sách các tầng / kệ (Shelves, phân tách bằng dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={shelvesInput}
                    onChange={(e) => setShelvesInput(e.target.value)}
                    placeholder="Shelf 1, Shelf 2, Shelf 3, Ngăn trên, Ngăn dưới..."
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ví dụ: <code>Shelf 1, Shelf 2, Shelf 3, Shelf 4</code> hoặc{' '}
                    <code>Ngăn 1, Ngăn 2, Ngăn dưới</code>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Ghi chú an toàn & Hướng dẫn bảo quản
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="vd: Tủ khóa điện tử, chỉ mở khi thí nghiệm, không để chung axit nitric với cồn..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingCabinetId ? 'Lưu Thay Đổi' : 'Thêm Vào Danh Mục Tủ'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo tên tủ, phòng, kệ..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
                  />
                </div>

                <select
                  value={filterHazard}
                  onChange={(e) => setFilterHazard(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-hidden"
                >
                  <option value="ALL">Tất cả phân loại an toàn</option>
                  <option value="GENERAL">Chung (General)</option>
                  <option value="FLAMMABLE">Chống cháy (Flammable)</option>
                  <option value="ACID">Axit ăn mòn</option>
                  <option value="BASE">Kiềm / Bazơ</option>
                  <option value="COLD">Tủ mát / Lạnh sâu</option>
                  <option value="DRY">Bình hút ẩm</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleStartAdd}
                className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Tủ Mới</span>
              </button>
            </div>
          )}

          {/* Cabinets Grid List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredCabinets.length === 0 ? (
              <div className="col-span-2 py-10 text-center text-slate-400 text-xs">
                Không tìm thấy tủ lưu trữ nào phù hợp với điều kiện lọc.
              </div>
            ) : (
              filteredCabinets.map((cab) => {
                const hz = HAZARD_TYPE_CONFIG[cab.hazardType || 'GENERAL'];
                const isSelected = selectedCabinetId === cab.name || selectedCabinetId === cab.id;

                return (
                  <div
                    key={cab.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-50/40 ring-2 ring-cyan-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                    }`}
                  >
                    <div>
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{cab.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border ${hz.bg} ${hz.text} ${hz.border}`}
                            >
                              {hz.icon}
                              <span>{hz.label.split(' ')[0]}</span>
                            </span>
                          </div>
                          {cab.displayName && cab.displayName !== cab.name && (
                            <p className="text-xs text-slate-600 mt-0.5 font-medium">{cab.displayName}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleStartEdit(cab)}
                            title="Sửa thông tin tủ"
                            className="p-1.5 text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(cab.id, cab.name)}
                            title="Xóa tủ"
                            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Location badges */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-2.5">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cab.building}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <DoorClosed className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-700">{cab.room}</span>
                        </span>
                      </div>

                      {/* Shelves list */}
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>Các tầng kệ ({cab.shelves.length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {cab.shelves.map((shelf, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-[11px] font-mono bg-slate-100 text-slate-700 rounded-md border border-slate-200"
                            >
                              {shelf}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      {cab.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-2.5 bg-slate-50 p-2 rounded-lg border border-slate-150">
                          {cab.notes}
                        </p>
                      )}
                    </div>

                    {/* Bottom select button */}
                    {onSelectCabinet && (
                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCabinet(cab, cab.shelves[0]);
                            onClose();
                          }}
                          className={`w-full py-2 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-700 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-cyan-600 hover:text-white text-slate-800'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSelected ? 'Đang chọn tủ này' : 'Chọn vị trí tủ này cho hóa chất'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Tổng cộng: <strong className="text-slate-800">{storageCabinets.length}</strong> tủ & vị trí lưu trữ
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Đóng lại
          </button>
        </div>
      </div>
    </div>
  );
};
