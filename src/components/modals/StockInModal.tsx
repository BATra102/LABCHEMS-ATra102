import React, { useState, useEffect } from 'react';
import { useLab } from '../../context/LabContext';
import { ChemicalUnit } from '../../types';
import { COMMON_UNITS } from '../../utils/units';
import { X, Check, AlertCircle, ShieldAlert, Layers, Settings2, PlusCircle, Building2, DoorClosed } from 'lucide-react';
import { CabinetManagementModal } from './CabinetManagementModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preselectedChemicalId?: string;
  preselectedBottleCode?: string;
}

export const StockInModal: React.FC<Props> = ({
  isOpen,
  onClose,
  preselectedChemicalId,
  preselectedBottleCode,
}) => {
  const {
    chemicals,
    stockIn,
    currentUser,
    isManager,
    storageCabinets,
    addStorageCabinet,
    purchaseItems,
    updatePurchaseStatus,
  } = useLab();

  // Filter only active chemicals (Section 40)
  const activeChemicals = chemicals.filter((c) => c.status !== 'ARCHIVED');

  const [chemicalId, setChemicalId] = useState<string>(preselectedChemicalId || '');
  const [bottleCode, setBottleCode] = useState<string>(preselectedBottleCode || '');
  const [lotNumber, setLotNumber] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('500');
  const [unit, setUnit] = useState<ChemicalUnit>('mL');
  const [supplier, setSupplier] = useState<string>('Merck KGaA');
  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>('2026-10-01');
  const [expiryDate, setExpiryDate] = useState<string>('2028-10-01');
  const [building, setBuilding] = useState<string>('Building A');
  const [room, setRoom] = useState<string>('Room 302');
  const [cabinet, setCabinet] = useState<string>('Cabinet C2');
  const [shelf, setShelf] = useState<string>('Shelf 3');
  const [notes, setNotes] = useState<string>('Lô hóa chất mới nhập kho');

  const [isCabinetModalOpen, setIsCabinetModalOpen] = useState(false);
  const [isQuickAddCabinet, setIsQuickAddCabinet] = useState(false);
  const [quickNewCabinetName, setQuickNewCabinetName] = useState('');
  const [isCustomShelf, setIsCustomShelf] = useState(false);
  const [customShelfValue, setCustomShelfValue] = useState('');

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Permission & Limits check
  const canStockIn = isManager || currentUser.permissions?.createStockIn;
  const parsedQty = parseFloat(quantity) || 0;
  const maxStockIn = currentUser.limits?.maxStockInQuantity;
  const exceedsStockInLimit = !isManager && maxStockIn !== null && maxStockIn !== undefined && parsedQty > maxStockIn;

  // Active cabinet data
  const activeCabinetObj = storageCabinets.find(
    (c) => c.name.toLowerCase() === cabinet.toLowerCase() || c.id === cabinet
  );
  const availableShelves = activeCabinetObj?.shelves || ['Shelf 1', 'Shelf 2', 'Shelf 3', 'Shelf 4'];

  const handleSelectCabinet = (selectedName: string) => {
    if (selectedName === '__ADD_NEW__') {
      setIsQuickAddCabinet(true);
      return;
    }
    setIsQuickAddCabinet(false);
    setCabinet(selectedName);
    const found = storageCabinets.find((c) => c.name === selectedName);
    if (found) {
      setBuilding(found.building);
      setRoom(found.room);
      if (found.shelves && found.shelves.length > 0) {
        setShelf(found.shelves[0]);
        setIsCustomShelf(false);
      }
    }
  };

  const handleSaveQuickNewCabinet = () => {
    if (!quickNewCabinetName.trim()) return;
    const cabName = quickNewCabinetName.trim();
    addStorageCabinet({
      name: cabName,
      displayName: `${cabName} (${room}, ${building})`,
      building,
      room,
      shelves: ['Shelf 1', 'Shelf 2', 'Shelf 3'],
      hazardType: 'GENERAL',
    });
    setCabinet(cabName);
    setShelf('Shelf 1');
    setIsQuickAddCabinet(false);
    setQuickNewCabinetName('');
  };

  useEffect(() => {
    if (preselectedChemicalId) {
      setChemicalId(preselectedChemicalId);
      const c = chemicals.find((x) => x.id === preselectedChemicalId);
      if (c) {
        setUnit(c.primaryUnit);
        setSupplier(c.manufacturer);
        setBuilding(c.storageLocation.building);
        setRoom(c.storageLocation.room);
        setCabinet(c.storageLocation.cabinet);
        setShelf(c.storageLocation.shelf);
      }
    } else if (chemicals.length > 0 && !chemicalId) {
      setChemicalId(chemicals[0].id);
      setUnit(chemicals[0].primaryUnit);
    }
  }, [preselectedChemicalId, chemicals]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!canStockIn) {
      setErrorMsg('Tài khoản của bạn không có quyền nhập kho hóa chất.');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Vui lòng nhập số lượng hợp lệ (> 0).');
      return;
    }

    if (exceedsStockInLimit) {
      setErrorMsg(`Vượt giới hạn nhập kho: Tài khoản của bạn được phép nhập tối đa ${maxStockIn} đơn vị/lần.`);
      return;
    }

    const res = stockIn({
      chemicalId,
      bottleCode: bottleCode.trim() || undefined,
      lotNumber: lotNumber.trim() || `LOT-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`,
      quantity: qty,
      unit,
      supplier,
      purchaseDate,
      expiryDate,
      storageLocation: {
        building,
        room,
        cabinet,
        shelf,
      },
      notes,
    });

    if (res.success) {
      setSuccessMsg(res.message);
      setErrorMsg(null);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-900">+ Nhập Hóa Chất Vào Kho (Stock In)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Tạo lô chai mới, cập nhật hạn dùng và vị trí cất giữ</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Lỗi thao tác: </span>
                {errorMsg}
              </div>
            </div>
          )}

          {!canStockIn && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Tài khoản của bạn ({currentUser.name}) chưa được cấp quyền <strong>Nhập kho hóa chất</strong>. Vui lòng liên hệ Quản lý.</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700 text-xs">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Hóa chất <span className="text-rose-500">*</span>
            </label>
            <select
              value={chemicalId}
              onChange={(e) => {
                setChemicalId(e.target.value);
                const c = chemicals.find((x) => x.id === e.target.value);
                if (c) {
                  setUnit(c.primaryUnit);
                  setSupplier(c.manufacturer);
                }
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
            >
              {activeChemicals.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.casNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mã chai (Bottle ID)
              </label>
              <input
                type="text"
                value={bottleCode}
                onChange={(e) => setBottleCode(e.target.value)}
                placeholder="Để trống sẽ tự tạo (vd: HEX-003)"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Số Lô (Lot/Batch number) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="vd: LOT-2026-X1"
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Số lượng nhập <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
              />
              {!isManager && maxStockIn !== null && maxStockIn !== undefined && (
                <div className="text-[11px] text-slate-500 font-mono mt-1">
                  Định mức cho phép: <span className="font-bold text-slate-800">Tối đa {maxStockIn} đơn vị/lần</span>
                </div>
              )}
              {exceedsStockInLimit && (
                <p className="text-[11px] text-rose-600 font-semibold mt-1">
                  ⚠️ Vượt định mức nhập ({parsedQty} &gt; {maxStockIn} đơn vị).
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Đơn vị tính <span className="text-rose-500">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as ChemicalUnit)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Nhà cung cấp / Hãng sản xuất
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Merck, Sigma, Xilong..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Ngày nhập hàng
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Hạn sử dụng (Expiry date) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
              />
            </div>
          </div>

          {/* Storage Location & Cabinet Catalog Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Layers className="w-4 h-4 text-cyan-700" />
                <span>Vị trí lưu trữ & Tủ hóa chất</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCabinetModalOpen(true)}
                className="px-2.5 py-1 text-[11px] font-semibold text-cyan-800 bg-cyan-100/70 hover:bg-cyan-200/80 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-cyan-300"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Quản lý / Thay đổi danh mục tủ</span>
              </button>
            </div>

            {/* Cabinet Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Tủ lưu trữ (Cabinet) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={isQuickAddCabinet ? '__ADD_NEW__' : cabinet}
                  onChange={(e) => handleSelectCabinet(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
                >
                  <optgroup label="Danh mục tủ hiện có trong phòng lab">
                    {storageCabinets.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} {c.displayName && c.displayName !== c.name ? `— ${c.displayName}` : ''} ({c.room})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Tùy chọn khác">
                    <option value="__ADD_NEW__">➕ Thêm tủ mới nhanh vào danh mục...</option>
                  </optgroup>
                </select>

                <button
                  type="button"
                  onClick={() => setIsCabinetModalOpen(true)}
                  title="Mở toàn bộ danh mục tủ"
                  className="px-2.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Danh mục
                </button>
              </div>

              {/* Quick Add Inline Input */}
              {isQuickAddCabinet && (
                <div className="p-3 bg-white border border-cyan-300 rounded-xl shadow-2xs space-y-2 mt-2 animate-in fade-in">
                  <div className="text-[11px] font-bold text-cyan-900">Nhập tên tủ mới:</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={quickNewCabinetName}
                      onChange={(e) => setQuickNewCabinetName(e.target.value)}
                      placeholder="vd: Tủ Flammable 2, Tủ Axit A2..."
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleSaveQuickNewCabinet}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg cursor-pointer"
                    >
                      Lưu tủ
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsQuickAddCabinet(false)}
                      className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Shelves & Location Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Tầng / Kệ (Shelf)
                </label>
                {!isCustomShelf ? (
                  <select
                    value={shelf}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        setIsCustomShelf(true);
                      } else {
                        setShelf(e.target.value);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 font-mono"
                  >
                    {availableShelves.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value="__CUSTOM__">Khác... (Nhập tự do)</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={shelf}
                      onChange={(e) => setShelf(e.target.value)}
                      placeholder="vd: Kệ 5, Ngăn đá..."
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomShelf(false)}
                      className="px-2 text-[10px] text-slate-500 underline cursor-pointer"
                    >
                      DS
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phòng (Room)</label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tòa nhà (Building)</label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Ghi chú nhập hàng
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!canStockIn || exceedsStockInLimit}
              className={`px-5 py-2 text-xs font-semibold rounded-lg transition-colors shadow-xs ${
                !canStockIn || exceedsStockInLimit
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
              }`}
            >
              {!canStockIn
                ? 'Không có quyền'
                : exceedsStockInLimit
                ? 'Vượt hạn mức nhập'
                : 'Xác Nhận Nhập Kho (Stock In)'}
            </button>
          </div>
        </form>

        {/* Storage Cabinet Management Modal */}
        <CabinetManagementModal
          isOpen={isCabinetModalOpen}
          onClose={() => setIsCabinetModalOpen(false)}
          onSelectCabinet={(cab, defaultShelf) => {
            setCabinet(cab.name);
            setBuilding(cab.building);
            setRoom(cab.room);
            if (defaultShelf) {
              setShelf(defaultShelf);
              setIsCustomShelf(false);
            }
          }}
          selectedCabinetId={cabinet}
        />
      </div>
    </div>
  );
};
