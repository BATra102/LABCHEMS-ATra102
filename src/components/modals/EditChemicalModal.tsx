import React, { useState } from 'react';
import { useLab } from '../../context/LabContext';
import { Chemical, ChemicalCategory, ChemicalGrade, PhysicalForm, ChemicalUnit } from '../../types';
import { COMMON_UNITS } from '../../utils/units';
import {
  X,
  Check,
  AlertTriangle,
  Layers,
  Edit2,
  Package,
  Building2,
  ShieldCheck,
  ArrowRight,
  Info
} from 'lucide-react';

interface Props {
  chemical: Chemical | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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

interface FieldChange {
  label: string;
  field: string;
  oldVal: string;
  newVal: string;
}

export const EditChemicalModal: React.FC<Props> = ({
  chemical,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { updateChemical, isManager, storageCabinets, currentUser } = useLab();

  if (!isOpen || !chemical) return null;

  // Form states initialized with current chemical data
  const [name, setName] = useState(chemical.name);
  const [englishName, setEnglishName] = useState(chemical.englishName || '');
  const [casNumber, setCasNumber] = useState(chemical.casNumber);
  const [chemicalFormula, setChemicalFormula] = useState(chemical.chemicalFormula || '');
  const [molecularWeight, setMolecularWeight] = useState(chemical.molecularWeight ? String(chemical.molecularWeight) : '');
  const [grade, setGrade] = useState<ChemicalGrade>(chemical.grade);
  const [category, setCategory] = useState<ChemicalCategory>(chemical.category);
  const [physicalForm, setPhysicalForm] = useState<PhysicalForm>(chemical.physicalForm);
  const [primaryUnit, setPrimaryUnit] = useState<ChemicalUnit>(chemical.primaryUnit);
  const [manufacturer, setManufacturer] = useState(chemical.manufacturer || '');
  const [catalogNumber, setCatalogNumber] = useState(chemical.catalogNumber || '');
  const [unitPrice, setUnitPrice] = useState(chemical.unitPrice ? String(chemical.unitPrice) : '');

  // Inventory Thresholds (Notice: NO current stock input, Point 15!)
  const [minimumStock, setMinimumStock] = useState(String(chemical.minimumStock));
  const [warningStock, setWarningStock] = useState(String(chemical.warningStock));
  const [targetStock, setTargetStock] = useState(String(chemical.targetStock || ''));

  // Storage Location
  const [building, setBuilding] = useState(chemical.storageLocation.building);
  const [room, setRoom] = useState(chemical.storageLocation.room);
  const [cabinet, setCabinet] = useState(chemical.storageLocation.cabinet);
  const [shelf, setShelf] = useState(chemical.storageLocation.shelf);
  const [storageConditions, setStorageConditions] = useState(chemical.storageConditions || '');

  // SDS & Notes
  const [sdsUrl, setSdsUrl] = useState(chemical.safetyInfo?.sdsUrl || '');
  const [notes, setNotes] = useState(chemical.safetyInfo?.incompatibilities || '');

  // Preview Confirmation Stage (Section 18)
  const [showPreview, setShowPreview] = useState(false);
  const [detectedChanges, setDetectedChanges] = useState<FieldChange[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If non-manager tries to edit, deny access (Section 13, 20)
  if (!isManager) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-xl border border-rose-200">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">403 FORBIDDEN - TRUY CẬP BỊ TỪ CHỐI</h3>
            <p className="text-xs text-slate-600 mt-1">
              Bạn không có quyền chỉnh sửa hồ sơ hóa chất. Chỉ người có vai trò <strong>Quản lý phòng lab (Manager)</strong> mới được thực hiện thao tác này.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // Handle cabinet selection change
  const handleCabinetChange = (cabName: string) => {
    setCabinet(cabName);
    const found = storageCabinets.find((c) => c.name === cabName);
    if (found) {
      setBuilding(found.building);
      setRoom(found.room);
      if (found.shelves.length > 0 && !found.shelves.includes(shelf)) {
        setShelf(found.shelves[0]);
      }
    }
  };

  const selectedCabObj = storageCabinets.find((c) => c.name === cabinet);
  const availableShelves = selectedCabObj?.shelves || ['Shelf 1', 'Shelf 2', 'Shelf 3', 'Shelf 4'];

  // Handle Review / Preview Changes
  const handleReviewChanges = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên hóa chất.');
      return;
    }
    if (!casNumber.trim()) {
      setErrorMsg('Vui lòng nhập số CAS.');
      return;
    }

    const minNum = parseFloat(minimumStock) || 0;
    const warnNum = parseFloat(warningStock) || 0;
    const targetNum = parseFloat(targetStock) || 0;

    if (minNum < 0 || warnNum < 0) {
      setErrorMsg('Mức tồn kho không được là số âm.');
      return;
    }
    if (warnNum < minNum) {
      setErrorMsg('Mức cảnh báo (Warning Stock) phải lớn hơn hoặc bằng Mức tối thiểu (Minimum Stock).');
      return;
    }

    // Compute diff for Preview (Section 18)
    const changes: FieldChange[] = [];
    if (name.trim() !== chemical.name) {
      changes.push({ label: 'Tên hóa chất', field: 'name', oldVal: chemical.name, newVal: name.trim() });
    }
    if ((englishName.trim() || '') !== (chemical.englishName || '')) {
      changes.push({ label: 'Tên tiếng Anh', field: 'englishName', oldVal: chemical.englishName || '(trống)', newVal: englishName.trim() || '(trống)' });
    }
    if (casNumber.trim() !== chemical.casNumber) {
      changes.push({ label: 'Số CAS', field: 'casNumber', oldVal: chemical.casNumber, newVal: casNumber.trim() });
    }
    if ((chemicalFormula.trim() || '') !== (chemical.chemicalFormula || '')) {
      changes.push({ label: 'Công thức hóa học', field: 'chemicalFormula', oldVal: chemical.chemicalFormula || '(trống)', newVal: chemicalFormula.trim() || '(trống)' });
    }
    if (category !== chemical.category) {
      changes.push({ label: 'Phân loại nhóm', field: 'category', oldVal: chemical.category, newVal: category });
    }
    if (grade !== chemical.grade) {
      changes.push({ label: 'Cấp tinh khiết (Grade)', field: 'grade', oldVal: chemical.grade, newVal: grade });
    }
    if (minNum !== chemical.minimumStock) {
      changes.push({ label: 'Mức tối thiểu (Minimum)', field: 'minimumStock', oldVal: `${chemical.minimumStock} ${chemical.primaryUnit}`, newVal: `${minNum} ${primaryUnit}` });
    }
    if (warnNum !== chemical.warningStock) {
      changes.push({ label: 'Mức cảnh báo (Warning)', field: 'warningStock', oldVal: `${chemical.warningStock} ${chemical.primaryUnit}`, newVal: `${warnNum} ${primaryUnit}` });
    }
    if (targetNum !== (chemical.targetStock || 0)) {
      changes.push({ label: 'Mức mục tiêu (Target)', field: 'targetStock', oldVal: `${chemical.targetStock || 0} ${chemical.primaryUnit}`, newVal: `${targetNum} ${primaryUnit}` });
    }
    if (cabinet !== chemical.storageLocation.cabinet || shelf !== chemical.storageLocation.shelf) {
      changes.push({
        label: 'Vị trí tủ lưu trữ',
        field: 'storageLocation',
        oldVal: `${chemical.storageLocation.cabinet} - ${chemical.storageLocation.shelf}`,
        newVal: `${cabinet} - ${shelf}`
      });
    }

    if (changes.length === 0) {
      setErrorMsg('Bạn chưa thay đổi thông tin nào.');
      return;
    }

    setDetectedChanges(changes);
    setShowPreview(true);
  };

  // Commit Save
  const handleConfirmSave = () => {
    const minNum = parseFloat(minimumStock) || 0;
    const warnNum = parseFloat(warningStock) || 0;
    const targetNum = parseFloat(targetStock) || warnNum * 2;
    const mwNum = parseFloat(molecularWeight) || undefined;
    const priceNum = parseFloat(unitPrice) || undefined;

    const result = updateChemical(chemical.id, {
      name: name.trim(),
      englishName: englishName.trim() || undefined,
      casNumber: casNumber.trim(),
      chemicalFormula: chemicalFormula.trim() || undefined,
      molecularWeight: mwNum,
      grade,
      category,
      physicalForm,
      primaryUnit,
      manufacturer: manufacturer.trim() || undefined,
      catalogNumber: catalogNumber.trim() || undefined,
      unitPrice: priceNum,
      minimumStock: minNum,
      warningStock: warnNum,
      targetStock: targetNum,
      storageLocation: {
        building,
        room,
        cabinet,
        shelf,
      },
      storageConditions: storageConditions.trim() || undefined,
      safetyInfo: {
        ...chemical.safetyInfo,
        sdsUrl: sdsUrl.trim() || undefined,
        incompatibilities: notes.trim() || chemical.safetyInfo?.incompatibilities || '',
      },
    });

    if (result.success) {
      setShowPreview(false);
      onClose();
      if (onSuccess) onSuccess();
    } else {
      setErrorMsg(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[92vh] border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-linear-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Chỉnh Sửa Hồ Sơ Hóa Chất</h2>
              <p className="text-xs text-slate-300 font-mono">
                {chemical.code} · {chemical.name} (CAS: {chemical.casNumber})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        {!showPreview ? (
          <form onSubmit={handleReviewChanges} className="flex-1 overflow-y-auto p-6 space-y-6">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Notice regarding Point 15 */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Quy chuẩn dữ liệu phòng lab:</span> Bạn được phép cập nhật tên, số CAS, nhà sản xuất, hạn mức tối thiểu/cảnh báo và vị trí lưu trữ. <strong>Tồn kho thực tế không được chỉnh sửa tại đây</strong> mà phải qua giao dịch Nhập kho, Ghi sử dụng hoặc Điều chỉnh kiểm kê để bảo toàn tính toàn vẹn dữ liệu.
              </div>
            </div>

            {/* Section 1: Basic Information */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Thông Tin Định Danh Hóa Chất
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên hóa chất (Tiếng Việt) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:border-cyan-600 font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên tiếng Anh (IUPAC / Synonym)
                  </label>
                  <input
                    type="text"
                    value={englishName}
                    onChange={(e) => setEnglishName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:border-cyan-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số đăng ký CAS <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={casNumber}
                    onChange={(e) => setCasNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:border-cyan-600 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Công thức phân tử (Formula)
                  </label>
                  <input
                    type="text"
                    value={chemicalFormula}
                    onChange={(e) => setChemicalFormula(e.target.value)}
                    placeholder="vd: C6H14, CH3OH..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:border-cyan-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phân loại nhóm (Category)
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ChemicalCategory)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cấp tinh khiết (Grade)
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value as ChemicalGrade)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Inventory Thresholds */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4 text-cyan-700" />
                <span>2. Thiết Lập Định Mức Tồn Kho (Thresholds)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mức tối thiểu (Minimum Stock) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="any"
                      value={minimumStock}
                      onChange={(e) => setMinimumStock(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono font-bold text-rose-600"
                      required
                    />
                    <span className="text-xs text-slate-500 font-mono font-semibold">{primaryUnit}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Dưới mức này: Báo động nguy cấp</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mức cảnh báo (Warning Stock) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="any"
                      value={warningStock}
                      onChange={(e) => setWarningStock(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono font-bold text-amber-600"
                      required
                    />
                    <span className="text-xs text-slate-500 font-mono font-semibold">{primaryUnit}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Dưới mức này: Gợi ý đặt mua</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mức mục tiêu (Target Stock)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="any"
                      value={targetStock}
                      onChange={(e) => setTargetStock(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono font-bold text-emerald-600"
                    />
                    <span className="text-xs text-slate-500 font-mono font-semibold">{primaryUnit}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Mức tồn tối ưu cần duy trì</span>
                </div>
              </div>
            </div>

            {/* Section 3: Storage Location */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-cyan-700" />
                <span>3. Vị Trí Lưu Trữ Mặc Định</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chọn tủ lưu trữ (Cabinet)
                  </label>
                  <select
                    value={cabinet}
                    onChange={(e) => handleCabinetChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
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
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                  >
                    {availableShelves.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                Phòng: <strong className="text-slate-800">{room}</strong> · Tòa nhà: <strong className="text-slate-800">{building}</strong>
              </div>
            </div>

            {/* Section 4: Manufacturer & Technical */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                4. Nhà Sản Xuất & Tài Liệu Kỹ Thuật
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hãng sản xuất
                  </label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="Merck, Sigma-Aldrich, Xilong..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã Catalog Number
                  </label>
                  <input
                    type="text"
                    value={catalogNumber}
                    onChange={(e) => setCatalogNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Link SDS (Safety Data Sheet URL)
                  </label>
                  <input
                    type="url"
                    value={sdsUrl}
                    onChange={(e) => setSdsUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Form Actions */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <span>Xem lại thay đổi →</span>
              </button>
            </div>
          </form>
        ) : (
          /* PREVIEW STAGE (Section 18) */
          <div className="flex-1 overflow-y-auto p-6 space-y-5 animate-in fade-in duration-150">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Xác Nhận Thay Đổi Thông Tin Hóa Chất
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Vui lòng kiểm tra kỹ danh sách các trường dữ liệu sắp được cập nhật. Hành động này sẽ được ghi vào nhật ký kiểm toán hệ thống.
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono text-[11px] uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Trường Dữ Liệu</th>
                    <th className="px-4 py-2.5 font-semibold text-rose-700">Giá Trị Cũ</th>
                    <th className="px-4 py-2.5 font-semibold text-emerald-700">Giá Trị Mới</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detectedChanges.map((c) => (
                    <tr key={c.field} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-800">{c.label}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono line-through">{c.oldVal}</td>
                      <td className="px-4 py-3 text-emerald-700 font-mono font-bold flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{c.newVal}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Người thực hiện: <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.role})</span>
              <span className="font-mono text-[11px]">{new Date().toLocaleString('vi-VN')}</span>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
              >
                ← Quay lại sửa tiếp
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Xác nhận & Lưu thay đổi</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
