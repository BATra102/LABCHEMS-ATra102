import React, { useState } from 'react';
import { useLab } from '../../context/LabContext';
import { Chemical, ChemicalCategory, ChemicalGrade, PhysicalForm, ChemicalUnit, GHSPictogram } from '../../types';
import { COMMON_UNITS } from '../../utils/units';
import { X, Check, AlertTriangle, Layers, Settings2 } from 'lucide-react';
import { CabinetManagementModal } from './CabinetManagementModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: ChemicalCategory[] = [
  'Solvents',
  'Acids',
  'Bases',
  'Salts',
  'Buffers',
  'Standards',
  'Reagents',
  'Natural product reagents',
  'Biological reagents',
  'Chromatography solvents',
  'Other',
];

const GRADES: ChemicalGrade[] = [
  'AR',
  'ACS',
  'HPLC',
  'Analytical Grade',
  'Technical',
  'Ph. Eur',
  'USP',
  'Synthesis',
];

const GHS_OPTIONS: { id: GHSPictogram; label: string; icon: string }[] = [
  { id: 'flammable', label: 'Dễ cháy', icon: '🔥' },
  { id: 'corrosive', label: 'Ăn mòn', icon: '🧪' },
  { id: 'toxic', label: 'Độc cấp tính', icon: '☠️' },
  { id: 'health-hazard', label: 'Nguy hại sức khỏe', icon: '🫁' },
  { id: 'oxidizing', label: 'Oxy hóa', icon: '⚡' },
  { id: 'environmental', label: 'Nguy hại môi trường', icon: '🐟' },
  { id: 'irritant', label: 'Kích ứng / Có hại', icon: '⚠️' },
  { id: 'explosive', label: 'Chất nổ', icon: '💥' },
];

export const AddChemicalModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addChemical, stockIn, currentUser, storageCabinets } = useLab();

  const [name, setName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [code, setCode] = useState('');
  const [casNumber, setCasNumber] = useState('');
  const [chemicalFormula, setChemicalFormula] = useState('');
  const [molecularWeight, setMolecularWeight] = useState('');
  const [grade, setGrade] = useState<ChemicalGrade>('AR');
  const [category, setCategory] = useState<ChemicalCategory>('Solvents');
  const [physicalForm, setPhysicalForm] = useState<PhysicalForm>('liquid');
  const [primaryUnit, setPrimaryUnit] = useState<ChemicalUnit>('mL');
  const [manufacturer, setManufacturer] = useState('');
  const [catalogNumber, setCatalogNumber] = useState('');
  const [minimumStock, setMinimumStock] = useState('500');
  const [warningStock, setWarningStock] = useState('1000');
  const [targetStock, setTargetStock] = useState('2500');
  const [building, setBuilding] = useState('Building A');
  const [room, setRoom] = useState('Room 302');
  const [cabinet, setCabinet] = useState('Cabinet C2');
  const [shelf, setShelf] = useState('Shelf 1');
  const [isCabinetModalOpen, setIsCabinetModalOpen] = useState(false);
  const [storageConditions, setStorageConditions] = useState('15-25°C, Thoáng mát');
  const [selectedGHS, setSelectedGHS] = useState<GHSPictogram[]>([]);
  const [ppe, setPpe] = useState('Găng tay Nitrile, Kính bảo hộ');
  const [responsiblePerson, setResponsiblePerson] = useState(currentUser.name);
  const [notes, setNotes] = useState('');

  const activeCabinetObj = storageCabinets.find(
    (c) => c.name.toLowerCase() === cabinet.toLowerCase() || c.id === cabinet
  );
  const availableShelves = activeCabinetObj?.shelves || ['Shelf 1', 'Shelf 2', 'Shelf 3', 'Shelf 4'];

  const handleSelectCabinet = (selectedName: string) => {
    setCabinet(selectedName);
    const found = storageCabinets.find((c) => c.name === selectedName);
    if (found) {
      setBuilding(found.building);
      setRoom(found.room);
      if (found.shelves && found.shelves.length > 0) {
        setShelf(found.shelves[0]);
      }
    }
  };

  // Initial bottle creation
  const [createInitialBottle, setCreateInitialBottle] = useState(true);
  const [initialVolume, setInitialVolume] = useState('500');
  const [lotNumber, setLotNumber] = useState('LOT-2026-INIT');
  const [expiryDate, setExpiryDate] = useState('2028-10-01');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleGHS = (id: GHSPictogram) => {
    setSelectedGHS((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên hóa chất.');
      return;
    }

    const res = addChemical({
      code: code.trim() || name.substring(0, 3).toUpperCase(),
      name: name.trim(),
      englishName: englishName.trim() || name.trim(),
      casNumber: casNumber.trim() || 'N/A',
      chemicalFormula: chemicalFormula.trim(),
      molecularWeight: molecularWeight ? parseFloat(molecularWeight) : undefined,
      grade,
      category,
      physicalForm,
      primaryUnit,
      manufacturer: manufacturer.trim() || 'Standard Lab Supply',
      catalogNumber: catalogNumber.trim() || undefined,
      minimumStock: parseFloat(minimumStock) || 1,
      warningStock: parseFloat(warningStock) || 2,
      targetStock: parseFloat(targetStock) || 5,
      unitPrice: 0,
      storageLocation: {
        building,
        room,
        cabinet,
        shelf,
      },
      storageConditions,
      safetyInfo: {
        ghsPictograms: selectedGHS,
        hazardClass: selectedGHS.length > 0 ? selectedGHS.join(', ') : 'Chưa phân loại',
        ppe: ppe.split(',').map((s) => s.trim()).filter(Boolean),
        incompatibilities: 'Tránh nhiệt độ cao và độ ẩm',
      },
      responsiblePerson: responsiblePerson.trim() || currentUser.name,
      notes: notes.trim(),
      isDemo: false,
    });

    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }

    // Optionally create the initial bottle right away
    if (createInitialBottle && res.chemical) {
      stockIn({
        chemicalId: res.chemical.id,
        lotNumber: lotNumber.trim() || 'LOT-INIT',
        quantity: parseFloat(initialVolume) || 1,
        unit: primaryUnit,
        supplier: manufacturer || 'Ban đầu',
        expiryDate: expiryDate || '2028-10-01',
        storageLocation: { building, room, cabinet, shelf },
        notes: 'Chai ban đầu tạo cùng danh mục',
      });
    }

    setSuccessMsg('Đã tạo hóa chất thành công!');
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-900">+ Thêm Hóa Chất Mới (Master Chemical)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Khai báo danh mục, cấp độ tinh khiết, định mức tồn kho & an toàn</p>
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700 text-xs">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Basic names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tên hóa chất <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="vd: Ethanol 96%, n-Hexane..."
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tên tiếng Anh (English Name)
              </label>
              <input
                type="text"
                value={englishName}
                onChange={(e) => setEnglishName(e.target.value)}
                placeholder="vd: Ethanol 96% vol AR"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mã hóa chất (Code)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="vd: ETH-01, HEX-01"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Số CAS (CAS Number)
              </label>
              <input
                type="text"
                value={casNumber}
                onChange={(e) => setCasNumber(e.target.value)}
                placeholder="vd: 64-17-5"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Công thức hóa học
              </label>
              <input
                type="text"
                value={chemicalFormula}
                onChange={(e) => setChemicalFormula(e.target.value)}
                placeholder="vd: C2H5OH"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Khối lượng phân tử
              </label>
              <input
                type="number"
                step="any"
                value={molecularWeight}
                onChange={(e) => setMolecularWeight(e.target.value)}
                placeholder="g/mol"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Cấp độ (Grade)
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as ChemicalGrade)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-hidden"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Phân loại (Category)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ChemicalCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-hidden"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Đơn vị chính
              </label>
              <select
                value={primaryUnit}
                onChange={(e) => setPrimaryUnit(e.target.value as ChemicalUnit)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-hidden"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock Thresholds */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <span className="block text-xs font-semibold text-slate-800 mb-2">Định mức cảnh báo tồn kho (Thresholds):</span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-rose-700 font-medium mb-1">Tồn tối thiểu (Min / Critical)</label>
                <input
                  type="number"
                  step="any"
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-rose-200 rounded bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-amber-700 font-medium mb-1">Mức cảnh báo (Warning / Low)</label>
                <input
                  type="number"
                  step="any"
                  value={warningStock}
                  onChange={(e) => setWarningStock(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-emerald-700 font-medium mb-1">Mức mục tiêu (Target Stock)</label>
                <input
                  type="number"
                  step="any"
                  value={targetStock}
                  onChange={(e) => setTargetStock(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-emerald-200 rounded bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Storage & Safety */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nhà sản xuất (Manufacturer)
              </label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Merck, Sigma-Aldrich, Xilong..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Người phụ trách
              </label>
              <input
                type="text"
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Storage Cabinet & Shelf Location */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Layers className="w-4 h-4 text-cyan-700" />
                <span>Vị trí lưu trữ mặc định (Storage Cabinet)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCabinetModalOpen(true)}
                className="px-2.5 py-1 text-[11px] font-semibold text-cyan-800 bg-cyan-100/70 hover:bg-cyan-200/80 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-cyan-300"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Quản lý danh mục tủ</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn tủ lưu trữ
                </label>
                <select
                  value={cabinet}
                  onChange={(e) => handleSelectCabinet(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden"
                >
                  {storageCabinets.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} {c.displayName && c.displayName !== c.name ? `— ${c.displayName}` : ''} ({c.room})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tầng / Kệ (Shelf)
                </label>
                <select
                  value={shelf}
                  onChange={(e) => setShelf(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 font-mono focus:outline-hidden"
                >
                  {availableShelves.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 font-medium">
              <div>Phòng: <span className="font-semibold text-slate-800">{room}</span></div>
              <div>Tòa nhà: <span className="font-semibold text-slate-800">{building}</span></div>
            </div>
          </div>

          {/* GHS Pictograms selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Ký hiệu cảnh báo an toàn GHS
            </label>
            <div className="grid grid-cols-4 gap-2">
              {GHS_OPTIONS.map((g) => {
                const isSelected = selectedGHS.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGHS(g.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors text-left ${
                      isSelected
                        ? 'bg-rose-50 border-rose-300 text-rose-800 font-medium'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{g.icon}</span>
                    <span className="truncate">{g.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Initial Bottle Option */}
          <div className="border-t border-slate-200 pt-3">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={createInitialBottle}
                onChange={(e) => setCreateInitialBottle(e.target.checked)}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-xs font-semibold text-slate-800">
                Tự động tạo ngay chai đầu tiên (Initial Bottle) vào kho
              </span>
            </label>

            {createInitialBottle && (
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Số lượng / Dung tích</label>
                  <input
                    type="number"
                    value={initialVolume}
                    onChange={(e) => setInitialVolume(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Số Lot</label>
                  <input
                    type="text"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Hạn sử dụng</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
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
              className="px-5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
            >
              Tạo Hóa Chất Mới
            </button>
          </div>
        </form>

        <CabinetManagementModal
          isOpen={isCabinetModalOpen}
          onClose={() => setIsCabinetModalOpen(false)}
          onSelectCabinet={(cab, defaultShelf) => {
            setCabinet(cab.name);
            setBuilding(cab.building);
            setRoom(cab.room);
            if (defaultShelf) setShelf(defaultShelf);
          }}
          selectedCabinetId={cabinet}
        />
      </div>
    </div>
  );
};
