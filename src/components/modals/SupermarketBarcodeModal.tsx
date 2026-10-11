import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { MultiFormatReader } from '@zxing/library';
import { useLab } from '../../context/LabContext';
import { Chemical, Bottle, StorageLocation, ChemicalUnit } from '../../types';
import { parseScannedQrDetails, getBottleQrId } from '../../utils/qrCode';
import { convertUnit } from '../../utils/units';
import { playBarcodeBeep, playDoubleBeep, playErrorBeep, playSuccessChime } from '../../utils/barcodeAudio';
import {
  X,
  Camera,
  Barcode,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  PackagePlus,
  PackageMinus,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Calendar,
  Building2,
  FolderPlus,
  RotateCcw,
  Volume2,
  Loader2,
  Search,
  Scale,
  FlaskConical,
  QrCode,
  Tag,
  AlertTriangle,
} from 'lucide-react';

export interface BarcodeCartItem {
  id: string; // unique item id in this session
  chemicalId: string;
  chemicalName: string;
  chemicalCode: string;
  casNumber: string;
  barcode: string;
  bottleId?: string; // Nếu nhận diện đúng 1 chai vật lý cụ thể từ QR
  bottleCode?: string;
  bottleCount: number; // số chai quét được
  volumePerBottle: number; // ml / g mỗi chai
  unit: ChemicalUnit;
  lotNumber: string;
  expiryDate: string;
  storageLocation: StorageLocation;
  supplier?: string;
  notes?: string;
  currentWarehouseBottles: number; // tồn kho chai hiện tại
  availableVolumeInWarehouse: number; // tổng lượng còn lại trong kho
  lastScannedAt: number; // timestamp để tạo hiệu ứng chớp sáng khi quét lặp
  // Chế độ xuất kho: Lấy nguyên chai hay lấy một phần (g hoặc mL)
  isPartial?: boolean;
  partialQuantity?: number;
  // Metadata xuất kho
  project?: string;
  purpose?: string;
  recipient?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'STOCK_IN' | 'STOCK_OUT';
  onCompleted?: () => void;
  onSwitchToManual?: () => void;
  onOpenAddChemicalWithBarcode?: (barcode: string) => void;
}

export const SupermarketBarcodeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialMode = 'STOCK_IN',
  onCompleted,
  onSwitchToManual,
  onOpenAddChemicalWithBarcode,
}) => {
  const {
    chemicals,
    bottles,
    currentUser,
    isManager,
    storageCabinets,
    batchStockInByBarcode,
    batchStockOutByBarcode,
  } = useLab();

  // Mode: Nhập kho (STOCK_IN) hoặc Sử dụng hóa chất / Xuất kho (STOCK_OUT)
  const [mode, setMode] = useState<'STOCK_IN' | 'STOCK_OUT'>(initialMode);

  // Cart / session list
  const [cartItems, setCartItems] = useState<BarcodeCartItem[]>([]);
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);

  // Hardware barcode gun input / manual input
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Unknown barcode banner state
  const [unknownCode, setUnknownCode] = useState<string | null>(null);

  // Camera scanner states
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);

  // Debouncing to prevent repeated continuous scan of the exact same code in 1.2s
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  // Manual chemical search dropdown state
  const [showManualSearch, setShowManualSearch] = useState<boolean>(false);
  const [manualSearchQuery, setManualSearchQuery] = useState<string>('');

  // Submission state (Double-submission prevention)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync mode with prop when opened
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setCartItems([]);
      setBarcodeInput('');
      setUnknownCode(null);
      setFeedbackMsg(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      stopCamera();
    }
  }, [isOpen, initialMode]);

  // Init barcode detector and ZXing if available
  useEffect(() => {
    try {
      zxingReaderRef.current = new MultiFormatReader();
    } catch (_) {}

    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: [
            'qr_code',
            'code_128',
            'code_39',
            'code_93',
            'ean_13',
            'ean_8',
            'upc_a',
            'upc_e',
            'itf',
            'data_matrix',
          ],
        });
      } catch (_) {}
    }
  }, []);

  const activeChemicals = chemicals.filter((c) => c.status !== 'ARCHIVED');

  /**
   * Helper: Tra cứu thông minh nhận diện mã trên chai
   * - Hỗ trợ cả 1D Barcode (nhà sản xuất) và 2D QR Code (định danh chai hoặc sản phẩm)
   * - Nếu QR chứa thông tin định danh riêng của chai, trả về đúng chai đó
   * - Không mặc định mọi QR code đều là mã sản phẩm
   */
  const resolveScannedCode = useCallback(
    (scannedRaw: string): { chemical: Chemical; bottle?: Bottle } | null => {
      const clean = scannedRaw.trim();
      if (!clean) return null;
      const cleanLower = clean.toLowerCase();

      // Bước 1: Thử phân tích cú pháp sâu (QR code chứa JSON, URL hoặc cấu trúc tem dán)
      const parsedDetails = parseScannedQrDetails(clean);

      // Bước 2: Kiểm tra xem có trùng với định danh riêng của CHAI VẬT LÝ nào không
      const matchedBottle = bottles.find((b) => {
        if (b.status === 'ARCHIVED' || b.status === 'DISPOSED') return false;
        if (b.id.toLowerCase() === cleanLower) return true;
        if (b.bottleCode.toLowerCase() === cleanLower) return true;
        if (b.barcode && b.barcode.toLowerCase() === cleanLower) return true;
        if (b.qrId && b.qrId.toLowerCase() === cleanLower) return true;
        if (getBottleQrId(b.bottleCode).toLowerCase() === cleanLower) return true;
        if (parsedDetails.type === 'BOTTLE' && parsedDetails.identifier && (
          b.id.toLowerCase() === parsedDetails.identifier.toLowerCase() ||
          b.bottleCode.toLowerCase() === parsedDetails.identifier.toLowerCase()
        )) return true;
        return false;
      });

      if (matchedBottle) {
        const parentChem = activeChemicals.find((c) => c.id === matchedBottle.chemicalId);
        if (parentChem) {
          return { chemical: parentChem, bottle: matchedBottle };
        }
      }

      // Bước 3: Kiểm tra xem có khớp với mã vạch / mã sản phẩm / CAS / Catalog number của HÓA CHẤT không
      const matchedChem = activeChemicals.find((c) => {
        if (c.barcode && c.barcode.toLowerCase() === cleanLower) return true;
        if (c.code.toLowerCase() === cleanLower) return true;
        if (c.casNumber.toLowerCase() === cleanLower) return true;
        if (c.catalogNumber && c.catalogNumber.toLowerCase() === cleanLower) return true;
        if (c.id.toLowerCase() === cleanLower) return true;
        if (parsedDetails.type === 'CHEMICAL' && parsedDetails.identifier && (
          c.id.toLowerCase() === parsedDetails.identifier.toLowerCase() ||
          c.code.toLowerCase() === parsedDetails.identifier.toLowerCase()
        )) return true;
        return false;
      });

      if (matchedChem) {
        return { chemical: matchedChem };
      }

      // Bước 4: Kiểm tra tiền tố mã sản phẩm (ví dụ HEX-001 -> tiền tố HEX)
      const prefixMatch = activeChemicals.find((c) => {
        const p = c.code ? c.code.split('-')[0].toLowerCase() : '';
        return p && cleanLower.startsWith(p);
      });

      if (prefixMatch) {
        return { chemical: prefixMatch };
      }

      return null;
    },
    [activeChemicals, bottles]
  );

  /**
   * Helper: Tính tồn kho chai và tổng dung tích hiện có của hóa chất
   */
  const getWarehouseStockInfo = useCallback(
    (chemicalId: string) => {
      const activeBts = bottles.filter(
        (b) => b.chemicalId === chemicalId && b.currentVolume > 0 && b.status !== 'ARCHIVED' && b.status !== 'DISPOSED'
      );
      const bottleCount = activeBts.length;
      const chem = chemicals.find((c) => c.id === chemicalId);
      let totalVolume = 0;
      for (const b of activeBts) {
        const conv = convertUnit(b.currentVolume, b.unit, chem?.primaryUnit || 'mL');
        if (conv !== null) totalVolume += conv;
      }
      return {
        bottleCount,
        totalVolume: Math.round(totalVolume * 100) / 100,
        activeBottles: activeBts,
      };
    },
    [bottles, chemicals]
  );

  /**
   * XỬ LÝ QUÉT MÃ (Nhận diện mã vạch 1D hoặc 2D QR Code)
   */
  const handleProcessBarcode = useCallback(
    (scannedRaw: string) => {
      const clean = scannedRaw.trim();
      if (!clean) return;

      const resolved = resolveScannedCode(clean);

      // Nếu mã chưa có trong hệ thống: Thông báo rõ ràng và cho phép đăng ký mới
      if (!resolved) {
        playErrorBeep();
        setUnknownCode(clean);
        setFeedbackMsg({
          type: 'error',
          text: `Mã "${clean}" chưa có trong cơ sở dữ liệu. Bạn có thể bấm Đăng ký mới bên dưới hoặc chọn từ danh mục.`,
        });
        return;
      }

      setUnknownCode(null);
      const { chemical: chem, bottle } = resolved;
      const stockInfo = getWarehouseStockInfo(chem.id);

      setCartItems((prevItems) => {
        // Kiểm tra xem đã có sản phẩm này trong danh sách quét chưa
        const existingIdx = prevItems.findIndex(
          (it) => it.chemicalId === chem.id && (!bottle || it.bottleId === bottle.id)
        );

        // QUÉT LẶP CÙNG MÃ: TỰ ĐỘNG TĂNG SỐ LƯỢNG THÊM 1 CHAI
        if (existingIdx >= 0) {
          const currentItem = prevItems[existingIdx];
          const newCount = currentItem.bottleCount + 1;

          // Kiểm tra tồn kho nếu ở chế độ xuất nguyên chai
          if (mode === 'STOCK_OUT' && !currentItem.isPartial && newCount > stockInfo.bottleCount) {
            playErrorBeep();
            setFeedbackMsg({
              type: 'error',
              text: `Không thể xuất thêm: Kho hiện chỉ có ${stockInfo.bottleCount} chai "${chem.name}".`,
            });
            return prevItems;
          }

          playDoubleBeep();
          setFeedbackMsg({
            type: 'success',
            text: `+1 chai "${chem.name}" (Tổng quét: ${newCount} chai)`,
          });

          const updated = [...prevItems];
          updated[existingIdx] = {
            ...currentItem,
            bottleCount: newCount,
            lastScannedAt: Date.now(),
          };

          setHighlightItemId(currentItem.id);
          setTimeout(() => setHighlightItemId(null), 800);
          return updated;
        }

        // LẦN ĐẦU QUÉT: THÊM VÀO DANH SÁCH VỚI SỐ LƯỢNG MẶC ĐỊNH LÀ 1 CHAI
        if (mode === 'STOCK_OUT' && stockInfo.bottleCount <= 0) {
          playErrorBeep();
          setFeedbackMsg({
            type: 'error',
            text: `Hóa chất "${chem.name}" đã hết hàng trong kho (0 chai). Không thể xuất kho.`,
          });
          return prevItems;
        }

        playBarcodeBeep();
        setFeedbackMsg({
          type: 'success',
          text: bottle
            ? `Đã nhận diện chai ${bottle.bottleCode} (${chem.name})`
            : `Đã thêm "${chem.name}" vào danh sách (1 chai)`,
        });

        const defaultVol =
          bottle?.currentVolume ||
          (chem.primaryUnit === 'bottle' || chem.primaryUnit === 'vial' || chem.primaryUnit === 'tube' ? 1 : 500);

        const newItemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const defaultLot = bottle?.lotNumber || `LOT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
        const defaultExpiry = bottle?.expiryDate || new Date(Date.now() + 730 * 86400000).toISOString().split('T')[0];

        const newItem: BarcodeCartItem = {
          id: newItemId,
          chemicalId: chem.id,
          chemicalName: chem.name,
          chemicalCode: chem.code,
          casNumber: chem.casNumber,
          barcode: bottle?.barcode || chem.barcode || clean,
          bottleId: bottle?.id,
          bottleCode: bottle?.bottleCode,
          bottleCount: 1,
          volumePerBottle: defaultVol,
          unit: bottle?.unit || chem.primaryUnit,
          lotNumber: defaultLot,
          expiryDate: defaultExpiry,
          storageLocation: bottle?.location || chem.storageLocation,
          supplier: chem.manufacturer,
          currentWarehouseBottles: stockInfo.bottleCount,
          availableVolumeInWarehouse: stockInfo.totalVolume,
          lastScannedAt: Date.now(),
          isPartial: false,
          partialQuantity: Math.min(50, defaultVol),
          project: 'Phòng Thí Nghiệm & Chiết Xuất',
          purpose: mode === 'STOCK_IN' ? 'Nhập kho lô hàng mới' : 'Sử dụng kiểm nghiệm / nghiên cứu',
        };

        setHighlightItemId(newItemId);
        setTimeout(() => setHighlightItemId(null), 800);

        return [newItem, ...prevItems];
      });

      // Clear input and keep cursor active for continuous USB barcode scanner
      setBarcodeInput('');
      inputRef.current?.focus();
    },
    [resolveScannedCode, getWarehouseStockInfo, mode]
  );

  /**
   * Xử lý gửi mã khi người dùng quét bằng đầu đọc mã vạch USB (nhấn Enter)
   */
  const handleBarcodeInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    handleProcessBarcode(barcodeInput);
  };

  /**
   * Camera Barcode & QR Scanner
   */
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Trình duyệt không hỗ trợ truy cập camera.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        requestAnimationFrame(scanVideoFrame);
      }
    } catch (err: any) {
      console.warn('Lỗi mở camera:', err);
      setCameraError('Không thể mở camera. Bạn có thể sử dụng đầu đọc mã vạch USB hoặc nhập mã bên trên.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const scanVideoFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    let detectedCode: string | null = null;

    // 1. BarcodeDetector phần cứng (1D Barcode & 2D QR Code)
    if (barcodeDetectorRef.current) {
      try {
        const barcodes = await barcodeDetectorRef.current.detect(video);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          detectedCode = barcodes[0].rawValue;
        }
      } catch (_) {}
    }

    // 2. Fallback jsQR
    if (!detectedCode) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qrRes = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
      if (qrRes && qrRes.data) {
        detectedCode = qrRes.data;
      }
    }

    if (detectedCode) {
      const now = Date.now();
      const isSameCode = lastScannedCodeRef.current === detectedCode;
      const elapsed = now - lastScannedTimeRef.current;

      // Cooldown 1.2s cho cùng một mã vạch để tránh quét dồn liên tục ngoài ý muốn
      if (!isSameCode || elapsed > 1200) {
        lastScannedCodeRef.current = detectedCode;
        lastScannedTimeRef.current = now;
        handleProcessBarcode(detectedCode);
      }
    }

    animFrameRef.current = requestAnimationFrame(scanVideoFrame);
  };

  /**
   * Cập nhật số lượng chai trực tiếp
   */
  const handleUpdateItemQuantity = (itemId: string, newCount: number) => {
    const count = Math.max(1, Math.floor(newCount));
    setCartItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        if (mode === 'STOCK_OUT' && !it.isPartial && count > it.currentWarehouseBottles) {
          playErrorBeep();
          setFeedbackMsg({
            type: 'error',
            text: `Số lượng xuất không được vượt quá số chai hiện có (${it.currentWarehouseBottles} chai).`,
          });
          return it;
        }
        return { ...it, bottleCount: count };
      })
    );
  };

  const handleUpdateItemField = (itemId: string, field: keyof BarcodeCartItem, value: any) => {
    setCartItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, [field]: value } : it))
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((it) => it.id !== itemId));
    setFeedbackMsg(null);
  };

  const totalBottles = cartItems.reduce((acc, it) => acc + it.bottleCount, 0);
  const totalDistinctChemicals = cartItems.length;

  /**
   * XÁC NHẬN GIAO DỊCH (Có cơ chế ngăn chặn nhấn nhiều lần hoặc trùng lặp)
   */
  const handleConfirmTransaction = async () => {
    if (cartItems.length === 0) {
      setFeedbackMsg({ type: 'error', text: 'Chưa có hóa chất nào trong danh sách quét.' });
      return;
    }

    if (isSubmitting || isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setFeedbackMsg(null);

    const sessionId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `session-${Date.now()}`;

    try {
      if (mode === 'STOCK_IN') {
        const payload = cartItems.map((it) => ({
          chemicalId: it.chemicalId,
          barcode: it.barcode,
          bottleCount: it.bottleCount,
          volumePerBottle: it.volumePerBottle,
          unit: it.unit,
          lotNumber: it.lotNumber,
          expiryDate: it.expiryDate,
          storageLocation: it.storageLocation,
          supplier: it.supplier,
          notes: it.notes,
        }));

        const res = batchStockInByBarcode({ items: payload, sessionId });
        if (res.success) {
          playSuccessChime();
          setFeedbackMsg({ type: 'success', text: res.message });
          setCartItems([]);
          setTimeout(() => {
            onClose();
            if (onCompleted) onCompleted();
          }, 1400);
        } else {
          playErrorBeep();
          setFeedbackMsg({ type: 'error', text: res.message });
          setIsSubmitting(false);
          isSubmittingRef.current = false;
        }
      } else {
        // STOCK_OUT: Hỗ trợ cả lấy nguyên chai và lấy một phần theo g/mL
        const payload = cartItems.map((it) => ({
          chemicalId: it.chemicalId,
          bottleId: it.bottleId,
          barcode: it.barcode,
          bottleCount: it.bottleCount,
          isPartial: it.isPartial,
          partialQuantity: it.isPartial ? it.partialQuantity : undefined,
          unit: it.unit,
          project: it.project,
          purpose: it.purpose,
          recipient: it.recipient,
          notes: it.notes,
        }));

        const res = batchStockOutByBarcode({ items: payload, sessionId });
        if (res.success) {
          playSuccessChime();
          setFeedbackMsg({ type: 'success', text: res.message });
          setCartItems([]);
          setTimeout(() => {
            onClose();
            if (onCompleted) onCompleted();
          }, 1400);
        } else {
          playErrorBeep();
          setFeedbackMsg({ type: 'error', text: res.message });
          setIsSubmitting(false);
          isSubmittingRef.current = false;
        }
      }
    } catch (err: any) {
      playErrorBeep();
      setFeedbackMsg({ type: 'error', text: err.message || 'Lỗi khi cập nhật tồn kho.' });
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-xs ${
                mode === 'STOCK_IN'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-cyan-600 text-white'
              }`}
            >
              {mode === 'STOCK_IN' ? <PackagePlus className="w-5 h-5" /> : <PackageMinus className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {mode === 'STOCK_IN' ? 'Quét Mã Nhập Kho' : 'Quét Mã Sử Dụng Hóa Chất'}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-semibold">
                  Mã vạch & QR Code
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {mode === 'STOCK_IN'
                  ? 'Quét mã trên bao bì chai để nhập hàng. Quét lặp tự động cộng thêm 1 chai.'
                  : 'Quét mã để ghi nhận sử dụng. Hỗ trợ lấy nguyên chai hoặc lấy một phần (g, mL).'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Chuyển đổi giữa 2 chức năng */}
            <div className="bg-slate-200/70 p-0.5 rounded-xl flex items-center text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setMode('STOCK_IN');
                  setCartItems([]);
                  setFeedbackMsg(null);
                  setUnknownCode(null);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  mode === 'STOCK_IN'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>Quét mã nhập kho</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('STOCK_OUT');
                  setCartItems([]);
                  setFeedbackMsg(null);
                  setUnknownCode(null);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  mode === 'STOCK_OUT'
                    ? 'bg-white text-cyan-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PackageMinus className="w-3.5 h-3.5" />
                <span>Quét mã sử dụng hóa chất</span>
              </button>
            </div>

            {onSwitchToManual && mode === 'STOCK_IN' && (
              <button
                type="button"
                onClick={onSwitchToManual}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Chuyển sang form nhập chi tiết 1 chai"
              >
                <span>📝 Nhập thủ công 1 chai</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh công cụ quét mã vạch & QR */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white space-y-3">
          <form onSubmit={handleBarcodeInputSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3.5 top-3 text-slate-400">
                <Barcode className="w-5 h-5 text-emerald-600" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Quét mã vạch/QR bằng máy quét hoặc nhập mã rồi nhấn Enter (vd: 8938500123456, HEX-001)..."
                className="w-full pl-11 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono transition-all placeholder:text-slate-400 font-medium"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              Nhận diện mã
            </button>
            <button
              type="button"
              onClick={() => {
                if (cameraActive) {
                  stopCamera();
                } else {
                  startCamera();
                }
              }}
              className={`px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                cameraActive
                  ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{cameraActive ? 'Tắt Camera' : 'Camera Quét'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowManualSearch(!showManualSearch)}
              className="px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Chọn thủ công nếu chai không có mã vạch"
            >
              <Search className="w-4 h-4" />
              <span>Tìm trong kho</span>
            </button>
          </form>

          {/* Camera Viewfinder */}
          {cameraActive && (
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-16/9 max-h-64 mx-auto flex items-center justify-center animate-in fade-in">
              <video ref={videoRef} className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-36 border-2 border-emerald-400/80 rounded-xl relative overflow-hidden shadow-lg shadow-emerald-500/10">
                  <div className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-md shadow-emerald-400 animate-pulse top-1/2 -translate-y-1/2" />
                  <div className="absolute top-1 left-2 text-[10px] font-mono text-emerald-300 font-bold bg-slate-950/70 px-1 rounded flex items-center gap-1">
                    <QrCode className="w-3 h-3 text-emerald-400" />
                    <span>Đang tìm mã vạch & QR...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Thông báo mã chưa có trong hệ thống + Nút đăng ký hóa chất mới */}
          {unknownCode && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Mã <strong className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">{unknownCode}</strong> chưa có trong hệ thống.
                </span>
              </div>
              {onOpenAddChemicalWithBarcode && isManager && (
                <button
                  type="button"
                  onClick={() => {
                    const codeToRegister = unknownCode;
                    onClose();
                    onOpenAddChemicalWithBarcode(codeToRegister);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
                >
                  + Đăng ký hóa chất mới với mã này
                </button>
              )}
            </div>
          )}

          {/* Tìm kiếm thủ công */}
          {showManualSearch && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Chọn hóa chất từ danh mục kho:</span>
                <span className="text-[11px] text-slate-500">Mỗi lần chọn sẽ thêm 1 chai vào phiên</span>
              </div>
              <input
                type="text"
                value={manualSearchQuery}
                onChange={(e) => setManualSearchQuery(e.target.value)}
                placeholder="Tìm tên hóa chất, CAS, hoặc mã..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500"
              />
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg">
                {activeChemicals
                  .filter((c) =>
                    !manualSearchQuery.trim()
                      ? true
                      : c.name.toLowerCase().includes(manualSearchQuery.toLowerCase()) ||
                        c.code.toLowerCase().includes(manualSearchQuery.toLowerCase()) ||
                        c.casNumber.toLowerCase().includes(manualSearchQuery.toLowerCase())
                  )
                  .slice(0, 8)
                  .map((chem) => (
                    <button
                      key={chem.id}
                      type="button"
                      onClick={() => {
                        handleProcessBarcode(chem.barcode || chem.code || chem.id);
                        setShowManualSearch(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-emerald-50 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{chem.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Mã: {chem.code} | CAS: {chem.casNumber} | Barcode: {chem.barcode || chem.code}
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        + Thêm vào phiên
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Feedback Toast */}
          {feedbackMsg && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in font-medium ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
          )}
        </div>

        {/* Danh sách sản phẩm đã quét trong phiên */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {cartItems.length === 0 ? (
            <div className="py-14 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Barcode className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-sm font-bold text-slate-700">
                  {mode === 'STOCK_IN' ? 'Chưa quét hóa chất nhập kho' : 'Chưa quét hóa chất cần sử dụng'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Hướng máy quét hoặc camera vào mã vạch/QR trên chai. Mỗi lần quét sẽ tự động cộng thêm 1 chai vào danh sách.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 px-1">
                <span>Danh sách quét ({totalDistinctChemicals} mặt hàng • {totalBottles} chai):</span>
                <button
                  type="button"
                  onClick={() => setCartItems([])}
                  className="text-slate-400 hover:text-rose-600 transition-colors text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Xóa phiên</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                {cartItems.map((item, idx) => {
                  const isHighlighted = highlightItemId === item.id;
                  const futureStock =
                    mode === 'STOCK_IN'
                      ? item.currentWarehouseBottles + item.bottleCount
                      : Math.max(0, item.currentWarehouseBottles - item.bottleCount);

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 sm:p-4 transition-all ${
                        isHighlighted
                          ? 'bg-emerald-50/90 ring-2 ring-emerald-500'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Thông tin hóa chất */}
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-bold text-slate-900">{item.chemicalName}</span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                              Mã: {item.barcode}
                            </span>
                            {item.bottleCode && (
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                                Chai: {item.bottleCode}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                            <span>CAS: <strong className="font-mono text-slate-700">{item.casNumber}</strong></span>
                            <span>Mã HC: <strong className="font-mono text-slate-700">{item.chemicalCode}</strong></span>
                            <span>
                              Tồn kho hiện có: <strong className="font-mono text-slate-700">{item.currentWarehouseBottles} chai</strong>
                              {item.availableVolumeInWarehouse > 0 && ` (${item.availableVolumeInWarehouse} ${item.unit})`}
                            </span>
                          </div>
                        </div>

                        {/* Số lượng chai & chỉnh sửa */}
                        <div className="flex items-center gap-3">
                          {!item.isPartial && (
                            <>
                              <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQuantity(item.id, item.bottleCount - 1)}
                                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                                  title="Giảm 1 chai"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.bottleCount}
                                  onChange={(e) =>
                                    handleUpdateItemQuantity(item.id, parseInt(e.target.value, 10) || 1)
                                  }
                                  className="w-14 text-center font-bold font-mono text-sm py-1 focus:outline-hidden bg-transparent"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQuantity(item.id, item.bottleCount + 1)}
                                  className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                                  title="Tăng 1 chai"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <span className="text-xs font-semibold text-slate-600">chai</span>

                              {/* Dự báo tồn kho */}
                              <div className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 flex items-center gap-1 font-semibold whitespace-nowrap">
                                <span>{item.currentWarehouseBottles}</span>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span
                                  className={`font-bold ${
                                    mode === 'STOCK_IN' ? 'text-emerald-700' : 'text-cyan-700'
                                  }`}
                                >
                                  {futureStock} chai
                                </span>
                              </div>
                            </>
                          )}

                          {/* Xóa dòng */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Xóa khỏi danh sách"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Chi tiết theo chế độ Nhập kho vs Xuất kho */}
                      {mode === 'STOCK_IN' ? (
                        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Số Lô (Lot Number)
                            </label>
                            <input
                              type="text"
                              value={item.lotNumber}
                              onChange={(e) => handleUpdateItemField(item.id, 'lotNumber', e.target.value)}
                              className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg font-mono bg-white focus:outline-hidden focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Hạn Dùng (Expiry)
                            </label>
                            <input
                              type="date"
                              value={item.expiryDate}
                              onChange={(e) => handleUpdateItemField(item.id, 'expiryDate', e.target.value)}
                              className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg font-mono bg-white focus:outline-hidden focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Dung tích mỗi chai
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="1"
                                value={item.volumePerBottle}
                                onChange={(e) =>
                                  handleUpdateItemField(
                                    item.id,
                                    'volumePerBottle',
                                    parseFloat(e.target.value) || 1
                                  )
                                }
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg font-mono bg-white focus:outline-hidden focus:border-emerald-500 text-right"
                              />
                              <span className="text-[11px] font-semibold text-slate-500 font-mono">
                                {item.unit}
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Tủ cất giữ
                            </label>
                            <select
                              value={item.storageLocation?.cabinet || 'Cabinet C2'}
                              onChange={(e) =>
                                handleUpdateItemField(item.id, 'storageLocation', {
                                  ...item.storageLocation,
                                  cabinet: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-emerald-500"
                            >
                              {storageCabinets.map((cab) => (
                                <option key={cab.id} value={cab.name}>
                                  {cab.name} ({cab.room})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        /* CHẾ ĐỘ XUẤT KHO / SỬ DỤNG HÓA CHẤT */
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs">
                          {/* Toggle: Lấy nguyên chai vs Lấy một phần (g hoặc mL) */}
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemField(item.id, 'isPartial', false)}
                                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                  !item.isPartial ? 'bg-white text-cyan-800 shadow-2xs font-bold' : 'text-slate-600'
                                }`}
                              >
                                🧪 Lấy nguyên chai ({item.bottleCount} chai)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemField(item.id, 'isPartial', true)}
                                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                  item.isPartial ? 'bg-white text-cyan-800 shadow-2xs font-bold' : 'text-slate-600'
                                }`}
                              >
                                <Scale className="w-3 h-3 text-cyan-600" />
                                <span>⚖️ Lấy một phần (theo {item.unit})</span>
                              </button>
                            </div>

                            {item.isPartial && (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-slate-600">Lượng lấy thực tế:</span>
                                <div className="flex items-center gap-1 border border-slate-300 rounded-lg bg-white px-2 py-0.5 shadow-2xs">
                                  <input
                                    type="number"
                                    min="0.1"
                                    step="0.5"
                                    value={item.partialQuantity || 50}
                                    onChange={(e) =>
                                      handleUpdateItemField(
                                        item.id,
                                        'partialQuantity',
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="w-16 text-right font-mono font-bold text-xs focus:outline-hidden"
                                  />
                                  <span className="font-mono text-slate-500 font-semibold">{item.unit}</span>
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  (Không trừ cả chai, giữ lại lượng dư trong kho)
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Người nhận, đề tài, mục đích */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Đề tài / Dự án
                              </label>
                              <input
                                type="text"
                                value={item.project || ''}
                                onChange={(e) => handleUpdateItemField(item.id, 'project', e.target.value)}
                                placeholder="Dự án nghiên cứu..."
                                className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-cyan-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Mục đích sử dụng
                              </label>
                              <input
                                type="text"
                                value={item.purpose || ''}
                                onChange={(e) => handleUpdateItemField(item.id, 'purpose', e.target.value)}
                                placeholder="Thí nghiệm chiết xuất..."
                                className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-cyan-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Người sử dụng
                              </label>
                              <input
                                type="text"
                                value={item.recipient || currentUser.name}
                                onChange={(e) => handleUpdateItemField(item.id, 'recipient', e.target.value)}
                                className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-cyan-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Xác nhận giao dịch */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
              <span>Mặt hàng: <strong className="text-slate-900 font-mono">{totalDistinctChemicals}</strong></span>
              <span>•</span>
              <span>
                Tổng số chai: <strong className="text-emerald-700 font-mono text-sm">{totalBottles} chai</strong>
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Chỉ cập nhật tồn kho sau khi nhấn Xác nhận. Nếu đóng cửa sổ này, dữ liệu kho giữ nguyên.
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Hủy phiên
            </button>

            <button
              type="button"
              onClick={handleConfirmTransaction}
              disabled={isSubmitting || cartItems.length === 0}
              className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                isSubmitting || cartItems.length === 0
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : mode === 'STOCK_IN'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 active:scale-95'
                  : 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-500/20 active:scale-95'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang cập nhật tồn kho...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {mode === 'STOCK_IN'
                      ? `Xác nhận Nhập Kho (${totalBottles} chai)`
                      : `Xác nhận Sử Dụng (${cartItems.length} mặt hàng)`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
