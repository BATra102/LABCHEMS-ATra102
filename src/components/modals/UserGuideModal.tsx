import React, { useState } from 'react';
import {
  X,
  BookOpen,
  QrCode,
  Layers,
  FlaskConical,
  ClipboardList,
  FileSpreadsheet,
  ShieldCheck,
  Search,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Printer,
  Sparkles,
  HelpCircle,
  FolderKanban,
  UserCheck,
  HardDriveDownload,
  Info
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: GuideSectionId;
}

export type GuideSectionId = 
  | 'quickstart'
  | 'qrcode'
  | 'cabinets'
  | 'stockin'
  | 'usage'
  | 'audit'
  | 'reports'
  | 'roles';

interface GuideSection {
  id: GuideSectionId;
  title: string;
  shortDesc: string;
  icon: React.ElementType;
  badge?: string;
}

const SECTIONS: GuideSection[] = [
  {
    id: 'quickstart',
    title: 'Khởi Đầu Nhanh',
    shortDesc: 'Quy trình 3 bước cốt lõi vận hành phòng thí nghiệm',
    icon: Sparkles,
    badge: 'Cơ bản',
  },
  {
    id: 'qrcode',
    title: 'Quét Tem QR Camera',
    shortDesc: 'Nhận diện chai và tra cứu tức thì bằng camera thiết bị',
    icon: QrCode,
    badge: 'Mới',
  },
  {
    id: 'cabinets',
    title: 'Danh Mục Tủ & Vị Trí',
    shortDesc: 'Quản lý tòa nhà, phòng lab, tủ hóa chất và tầng kệ',
    icon: Layers,
    badge: 'Nâng cao',
  },
  {
    id: 'stockin',
    title: 'Nhập Kho & Quản Lý Chai',
    shortDesc: 'Theo dõi từng chai (Lot, thể tích thực, hạn dùng, in tem)',
    icon: FlaskConical,
  },
  {
    id: 'usage',
    title: 'Ghi Nhận Tiêu Hao',
    shortDesc: 'Trừ tồn kho theo chai, gán vào Đề tài / Dự án nghiên cứu',
    icon: ClipboardList,
  },
  {
    id: 'audit',
    title: 'Kiểm Kê & Đối Soát',
    shortDesc: 'Tạo đợt kiểm kê, đối soát thừa/thiếu và lập biên bản',
    icon: ShieldCheck,
  },
  {
    id: 'reports',
    title: 'Báo Cáo & Sổ Kho',
    shortDesc: 'Xuất báo cáo Nhập-Xuất-Tồn, chi phí đề tài sang Excel/CSV',
    icon: FileSpreadsheet,
  },
  {
    id: 'roles',
    title: 'Phân Quyền & Google Login',
    shortDesc: 'Quyền Quản lý lab vs Nghiên cứu viên, định mức sử dụng',
    icon: UserCheck,
  },
];

export const UserGuideModal: React.FC<Props> = ({ isOpen, onClose, defaultTab = 'quickstart' }) => {
  const [activeSection, setActiveSection] = useState<GuideSectionId>(defaultTab);
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  const filteredSections = SECTIONS.filter(s => 
    s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    s.shortDesc.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[92vh] border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-linear-to-r from-slate-900 via-cyan-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Hướng Dẫn Sử Dụng LabChem Inventory
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full">
                  Cẩm Nang Lab
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Tài liệu tra cứu quy trình quản lý hóa chất, theo dõi chai, tủ lưu trữ và đối soát tồn kho
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Đóng hướng dẫn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Body Container */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          
          {/* Left Navigation Sidebar */}
          <div className="w-full md:w-72 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
            {/* Search */}
            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Tìm chủ đề hướng dẫn..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-cyan-600 rounded-lg text-slate-900 focus:outline-hidden transition-all"
                />
              </div>
            </div>

            {/* Nav list */}
            <div className="p-2 space-y-1 overflow-y-auto flex-1">
              {filteredSections.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSection(sec.id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer ${
                      isActive
                        ? 'bg-cyan-700 text-white font-semibold shadow-xs'
                        : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold truncate">{sec.title}</span>
                        {sec.badge && (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                            isActive
                              ? 'bg-white/25 text-white'
                              : 'bg-cyan-100 text-cyan-800'
                          }`}>
                            {sec.badge}
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 ${
                        isActive ? 'text-cyan-100' : 'text-slate-500'
                      }`}>
                        {sec.shortDesc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Contact Footer */}
            <div className="p-3 border-t border-slate-200 bg-white/70 text-[11px] text-slate-500 flex items-center justify-between">
              <span className="font-medium">Phiên bản: LabChem 2.4</span>
              <span className="text-cyan-700 font-semibold font-mono">Inventory</span>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-white space-y-6">
            
            {/* 1. QUICKSTART */}
            {activeSection === 'quickstart' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="bg-linear-to-br from-cyan-50 to-teal-50/60 p-4 rounded-2xl border border-cyan-200">
                  <div className="flex items-center gap-2 text-cyan-900 font-bold text-base mb-1">
                    <Sparkles className="w-5 h-5 text-cyan-600" />
                    <span>Chào mừng bạn đến với Hệ thống Quản lý Hóa chất LabChem</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Hệ thống được thiết kế theo tiêu chuẩn quản lý hóa chất phòng thí nghiệm hiện đại: 
                    theo dõi chính xác đến <strong>từng chai cụ thể (Bottle-level tracking)</strong>, 
                    gán tem mã QR, kiểm soát hạn mở nắp, kiểm soát định mức và tự động lập sổ kho Nhập - Xuất - Tồn.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-700 text-white flex items-center justify-center text-xs">1</span>
                    Quy Trình 3 Bước Cốt Lõi Khi Thao Tác
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        BƯỚC 1
                      </div>
                      <div className="font-bold text-slate-900 text-xs">Nhập Kho & Dán Tem QR</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Hóa chất mới mua về được tạo hồ sơ hoặc nhập thêm chai mới với số Lot, hạn dùng, tủ & kệ lưu trữ. Hệ thống tự tạo mã QR độc nhất cho từng chai.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                        BƯỚC 2
                      </div>
                      <div className="font-bold text-slate-900 text-xs">Lấy Hóa Chất & Quét Mã</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Khi làm thí nghiệm, mở tính năng <strong>Quét QR</strong> bằng camera hoặc tra cứu tên chai để kiểm tra hạn dùng, nồng độ và lượng tồn thực tế còn lại.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                        BƯỚC 3
                      </div>
                      <div className="font-bold text-slate-900 text-xs">Ghi Sử Dụng Theo Đề Tài</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Nhập lượng tiêu hao, chọn Đề tài/Dự án nghiên cứu để tự động trừ kho, tính chi phí đề tài và ghi nhật ký nhật trình không thể sửa xóa.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold mb-0.5">Lưu ý an toàn phòng lab (GLP / OSHA)</div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Tuyệt đối không lưu trữ chung các nhóm hóa chất xung khắc (như Axit mạnh cạnh Bazơ mạnh, hoặc Chất oxy hóa cạnh Dung môi hữu cơ dễ cháy). Hãy khai báo chính xác phân loại tủ lưu trữ trong hệ thống.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 2. QR CODE SCANNER */}
            {activeSection === 'qrcode' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-cyan-600" />
                    <span>Hướng Dẫn Quét Mã QR Chai Bằng Camera Thiết Bị</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Tra cứu thông tin chai tức thì trong 0.5 giây mà không cần gõ bàn phím
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="w-6 h-6 rounded-full bg-cyan-700 text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Mở tính năng Quét QR</div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Nhấp nút <strong>"Quét QR"</strong> trên thanh điều hướng đầu trang (Header) hoặc trong tab "Kho Hóa Chất".
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="w-6 h-6 rounded-full bg-cyan-700 text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Cấp quyền Camera cho trình duyệt</div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Khi trình duyệt hiển thị thông báo yêu cầu truy cập máy ảnh (camera), hãy chọn <strong>"Cho phép" (Allow)</strong>. Có thể chọn đổi giữa camera trước/sau trên điện thoại.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="w-6 h-6 rounded-full bg-cyan-700 text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Quét mã vạch (Barcode) / Mã hàng in sẵn trên chai HOẶC tem mã chai
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        <strong>Cách 1 (Nhanh gọn - Khuyên dùng):</strong> Bạn có thể dùng trực tiếp <strong>mã hàng (Catalog Number)</strong> hoặc <strong>mã vạch (Barcode)</strong> in sẵn của nhà sản xuất trên vỏ chai. <strong>Không bắt buộc phải in dán nhãn riêng cho từng chai!</strong> Hệ thống sẽ tự động nhận diện loại hóa chất, hiển thị còn mấy chai và tổng tồn bao nhiêu. Khi sử dụng, chỉ cần chọn <strong>"⚡ Dùng hết 1 chai"</strong> mà không cần nhập số mL, hệ thống sẽ tự động chuyển trạng thái chai thành <strong>EMPTY</strong> (0 mL) hoặc chuyển thẳng vào <strong>Kho Lưu Trữ (Archive)</strong> theo lựa chọn của bạn.
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        <strong>Cách 2 (Quản lý chi tiết):</strong> Dán tem nhãn QR riêng cho từng chai (ví dụ: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">B-HEX-001</code>) nếu phòng lab muốn quản lý số mL lẻ chi tiết của từng chai.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="w-6 h-6 rounded-full bg-cyan-700 text-white flex items-center justify-center text-xs font-bold shrink-0">4</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Xem tồn kho và Ghi sử dụng tức thì</div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Hệ thống hiển thị ngay: còn hóa chất loại đó không, còn mấy chai và tổng tồn bao nhiêu. Có sẵn nút <strong>"⚡ Dùng hết 1 chai"</strong> (1 chạm, tự động trừ 1 chai mà không cần nhập số mL) hoặc nút <strong>"Nhập số mL dùng"</strong> nếu muốn đong đo lẻ.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-200 flex items-center gap-3">
                  <Printer className="w-5 h-5 text-cyan-700 shrink-0" />
                  <div className="text-xs text-cyan-950">
                    <span className="font-bold">Mẹo in tem nhãn:</span> Vào tab <strong>Kho Hóa Chất</strong> &rarr; chọn hóa chất &rarr; nhấn <strong>"In tem nhãn chai"</strong> để in hàng loạt tem QR kích thước chuẩn dán lên chai lọ thí nghiệm.
                  </div>
                </div>
              </div>
            )}

            {/* 3. CABINETS & LOCATIONS */}
            {activeSection === 'cabinets' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-cyan-600" />
                    <span>Quản Lý Danh Mục Tủ & Vị Trí Lưu Trữ Hóa Chất</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cấu hình và tùy biến vị trí tủ hóa chất ngay tại thời điểm nhập hàng hoặc trong danh mục hệ thống
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Cách 1: Thêm hoặc đổi tủ trực tiếp từ form Nhập Kho (Mới)</span>
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Khi mở form <strong>"Nhập Kho"</strong> hoặc <strong>"Thêm Hóa Chất Mới"</strong>:
                    </p>
                    <ul className="text-xs text-slate-600 space-y-1 pl-5 list-disc">
                      <li>Tại phần <em>Vị trí lưu trữ chi tiết</em>, bạn có thể chọn ngay một tủ từ danh mục thả xuống.</li>
                      <li>Để thêm nhanh tủ mới chưa có trong danh mục: chọn <strong>"➕ Thêm tủ mới nhanh vào danh mục..."</strong> và gõ tên tủ &rarr; nhấn Lưu. Hệ thống sẽ tự động đăng ký tủ mới vào danh mục toàn phòng lab.</li>
                      <li>Nhấn nút <strong>"Quản lý danh mục tủ"</strong> ngay cạnh để mở giao diện quản trị đầy đủ.</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Cách 2: Quản lý chi tiết qua Cửa Sổ Danh Mục Tủ Lưu Trữ</span>
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Cho phép người phụ trách lab cấu hình thông số kỹ thuật từng tủ:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700 pt-1">
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-900">Phân loại an toàn tủ:</span>
                        <div className="text-[11px] text-slate-500 mt-0.5">Tủ Dung môi dễ cháy, Tủ Axit ăn mòn, Tủ Bazơ, Tủ Độc, Tủ lạnh 4°C, Tủ âm sâu -20°C, Bình hút ẩm khô.</div>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-900">Quản lý số tầng kệ:</span>
                        <div className="text-[11px] text-slate-500 mt-0.5">Tự do thêm/bớt danh sách tầng kệ (ví dụ: Tầng 1, Tầng 2, Khay A, Khay B).</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50 text-blue-900 rounded-xl border border-blue-200 text-xs">
                  <strong>Khuyến nghị an toàn:</strong> Mỗi hóa chất khi nhập kho nên được chỉ định rõ ràng cả <strong>Tên Tủ</strong> và <strong>Số Tầng Kệ</strong> để người làm thí nghiệm tìm kiếm nhanh chóng và nhân viên an toàn dễ dàng kiểm tra định kỳ.
                </div>
              </div>
            )}

            {/* 4. STOCK IN */}
            {activeSection === 'stockin' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FlaskConical className="w-5 h-5 text-cyan-600" />
                    <span>Hướng Dẫn Nhập Kho & Quản Lý Chai Hóa Chất</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Theo dõi vòng đời chai hóa chất từ lúc mua về đến khi dùng hết hoặc thanh lý
                  </p>
                </div>

                <div className="space-y-3.5 text-xs text-slate-700">
                  <div className="p-3.5 border border-slate-200 rounded-xl space-y-1">
                    <div className="font-bold text-slate-900">1. Nhập thêm chai cho hóa chất đã có trong danh mục</div>
                    <p className="text-slate-600">
                      Nhấn nút <strong>"Nhập Kho"</strong> trên thanh điều hướng &rarr; Chọn tên hóa chất &rarr; Nhập số lượng chai, dung tích mỗi chai, số lô Lot Number và Hạn sử dụng (Expiry Date).
                    </p>
                  </div>

                  <div className="p-3.5 border border-slate-200 rounded-xl space-y-1">
                    <div className="font-bold text-slate-900">2. Tạo mới hoàn toàn một loại hóa chất chưa từng có</div>
                    <p className="text-slate-600">
                      Vào tab <strong>"Kho Hóa Chất"</strong> &rarr; Nhấn <strong>"+ Thêm Hóa Chất Mới"</strong>. Điền tên tiếng Việt, tên tiếng Anh (IUPAC), số CAS, công thức hóa học, nồng độ/độ tinh khiết (AR, HPLC, ACS) và ký hiệu an toàn GHS.
                    </p>
                  </div>

                  <div className="p-3.5 border border-slate-200 rounded-xl space-y-1">
                    <div className="font-bold text-slate-900">3. Nhập hàng loạt từ file Excel</div>
                    <p className="text-slate-600">
                      Vào tab <strong>"Kho Hóa Chất"</strong> &rarr; Nhấn <strong>"Nhập từ Excel"</strong>. Tải mẫu template Excel chuẩn, điền dữ liệu và kéo thả vào hệ thống để nhập hàng trăm hóa chất chỉ trong vài giây.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. USAGE */}
            {activeSection === 'usage' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-cyan-600" />
                    <span>Hướng Dẫn Ghi Nhận Sử Dụng Hóa Chất</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Ghi chép minh bạch lượng tiêu hao, gắn với Đề tài nghiên cứu và mục đích thí nghiệm
                  </p>
                </div>

                <div className="space-y-3.5 text-xs text-slate-700">
                  <div className="p-3.5 border border-slate-200 rounded-xl space-y-2">
                    <div className="font-bold text-slate-900">Quy trình thực hiện:</div>
                    <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                      <li>Nhấn nút màu xanh <strong>"+ Ghi Sử Dụng"</strong> trên Header (hoặc quét mã QR chai).</li>
                      <li>Chọn hóa chất và chai cụ thể mà bạn đang mở sử dụng.</li>
                      <li>Nhập khối lượng hoặc thể tích tiêu hao (ví dụ: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">50 mL</code>).</li>
                      <li>Chọn <strong>Đề tài / Dự án nghiên cứu</strong> tương ứng để hệ thống tự phân bổ chi phí ngân sách đề tài.</li>
                      <li>Ghi chú vắn tắt mục đích thí nghiệm (ví dụ: <em>"Chạy sắc ký HPLC mẫu lô 04"</em>) &rarr; Nhấn Xác nhận.</li>
                    </ol>
                  </div>

                  <div className="p-3 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-200">
                    <strong>Tự động hóa số dư:</strong> Hệ thống tự động trừ lượng tồn của chai đó, đồng thời cập nhật tổng tồn kho của hóa chất. Nếu lượng tồn chạm mức cảnh báo tối thiểu, hệ thống sẽ tự động kích hoạt đề xuất mua sắm bổ sung.
                  </div>
                </div>
              </div>
            )}

            {/* 6. AUDIT */}
            {activeSection === 'audit' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-cyan-600" />
                    <span>Quy Trình Kiểm Kê & Đối Soát Chênh Lệch Kho</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Đối chiếu thực tế so với sổ sách, phát hiện chai thất lạc hoặc hao hụt
                  </p>
                </div>

                <div className="space-y-3 text-xs text-slate-700">
                  <p className="text-slate-600 leading-relaxed">
                    Vào tab <strong>"Kiểm Kê Kho"</strong>:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-slate-600">
                    <li><strong>Tạo đợt kiểm kê mới:</strong> Đặt tên đợt kiểm kê (ví dụ: <em>Kiểm kê Quý 4/2026 - Tủ Dung Môi C1</em>).</li>
                    <li><strong>Quét đối chiếu:</strong> Dùng máy quét mã vạch hoặc camera quét từng chai trên kệ. Hệ thống tự đánh dấu chai "Đã kiểm đếm".</li>
                    <li><strong>Xem báo cáo chênh lệch:</strong> Hệ thống tự động lọc ra các chai chưa được quét (nguy cơ thất lạc) hoặc chai có lượng tồn thực tế sai lệch so với hệ thống.</li>
                    <li><strong>Xuất biên bản kiểm kê:</strong> Tải biên bản đối soát định dạng CSV/Excel có chữ ký xác nhận của Thủ kho và Trưởng phòng lab.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* 7. REPORTS */}
            {activeSection === 'reports' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-cyan-600" />
                    <span>Hệ Thống Báo Cáo & Xuất Dữ Liệu Excel / CSV</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cung cấp đầy đủ 7 mẫu báo cáo chuẩn phục vụ thanh tra, kiểm toán và nghiệm thu đề tài
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="font-bold text-slate-900 mb-1">1. Sổ Kho Nhập - Xuất - Tồn</div>
                    <p className="text-slate-500 text-[11px]">Báo cáo chi tiết tồn đầu kỳ, tổng nhập, tổng xuất tiêu hao và tồn cuối kỳ trong khoảng thời gian tùy chọn.</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="font-bold text-slate-900 mb-1">2. Báo Cáo Chi Phí Theo Đề Tài</div>
                    <p className="text-slate-500 text-[11px]">Tổng hợp kinh phí hóa chất đã sử dụng cho từng đề tài nghiên cứu (Project Expense Report).</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="font-bold text-slate-900 mb-1">3. Báo Cáo Cảnh Báo Hạn Dùng</div>
                    <p className="text-slate-500 text-[11px]">Danh sách các chai sắp hết hạn trong 30, 60, 90 ngày hoặc đã quá hạn cần thanh lý xử lý rác thải hóa hại.</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="font-bold text-slate-900 mb-1">4. Biên Bản Kiểm Kê Chênh Lệch</div>
                    <p className="text-slate-500 text-[11px]">Bảng đối soát tỷ lệ hao hụt thực tế, phục vụ báo cáo giải trình với hội đồng khoa học.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-xl text-xs text-slate-700">
                  <HardDriveDownload className="w-4 h-4 text-cyan-700 shrink-0" />
                  <span>Mọi bảng báo cáo đều hỗ trợ xuất file <strong>Excel (.CSV)</strong> tương thích hoàn toàn với Microsoft Excel, Google Sheets và Numbers.</span>
                </div>
              </div>
            )}

            {/* 8. ROLES & LOGIN */}
            {activeSection === 'roles' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-cyan-600" />
                    <span>Phân Quyền Người Dùng & Đăng Nhập Tài Khoản Google</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cơ chế bảo mật và phân quyền linh hoạt cho từng thành viên trong lab
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl">
                      <div className="font-bold text-purple-950 text-xs mb-1">Vai trò Quản Lý Lab (Manager / Admin)</div>
                      <ul className="text-slate-600 text-[11px] space-y-1 list-disc pl-4">
                        <li>Toàn quyền Thêm, Sửa, Xóa hóa chất và danh mục tủ.</li>
                        <li>Duyệt danh sách đề xuất mua sắm hóa chất.</li>
                        <li>Quản lý người dùng, phân quyền và thiết lập định mức sử dụng tối đa.</li>
                        <li>Xem và xuất tất cả báo cáo kinh phí và sổ kho.</li>
                      </ul>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="font-bold text-slate-900 text-xs mb-1">Vai trò Nghiên Cứu Viên (Member / User)</div>
                      <ul className="text-slate-600 text-[11px] space-y-1 list-disc pl-4">
                        <li>Tra cứu vị trí tủ, hạn dùng và nồng độ hóa chất.</li>
                        <li>Quét mã QR và ghi nhận tiêu hao cho đề tài nghiên cứu.</li>
                        <li>Gửi đề xuất yêu cầu mua sắm hóa chất mới lên quản lý.</li>
                        <li>Xem lịch sử sử dụng cá nhân.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" />
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Để kết nối tài khoản Google cá nhân, nhấp vào menu tài khoản ở góc trên bên phải &rarr; chọn <strong>"Đăng nhập bằng Google"</strong>. Hệ thống sẽ tự động đồng bộ tên và ảnh đại diện của bạn.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <HelpCircle className="w-4 h-4 text-cyan-700" />
            <span>Cần trợ giúp thêm? Liên hệ Quản trị viên phòng thí nghiệm.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Đã hiểu, đóng hướng dẫn
          </button>
        </div>

      </div>
    </div>
  );
};
