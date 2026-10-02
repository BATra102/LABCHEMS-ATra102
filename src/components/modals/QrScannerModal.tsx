import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { useLab } from '../../context/LabContext';
import { Bottle, Chemical, ChemicalUnit } from '../../types';
import { parseScannedQrDetails, getBottleQrId, getChemicalQrId } from '../../utils/qrCode';
import { getBottleStatusLabel, getDaysRemaining, calculateBottleStatus } from '../../utils/status';
import { convertUnit } from '../../utils/units';
import {
  X,
  Camera,
  QrCode,
  Flashlight,
  RefreshCw,
  Upload,
  AlertCircle,
  CheckCircle2,
  Search,
  Sparkles,
  ArrowRight,
  FlaskConical,
  PackagePlus,
  Layers,
  MapPin,
  Calendar,
  AlertTriangle,
  History,
  ShieldAlert,
  Info,
  ChevronRight,
  Archive,
  CornerDownRight,
  Plus,
  AlertOctagon,
  Check,
  Eye,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBottleIdentified: (bottle: Bottle) => void;
  onOpenRecordUsage?: (chemicalId: string, bottleId?: string) => void;
  onOpenStockIn?: (chemicalId?: string, preselectedBottleCode?: string) => void;
  onOpenAddChemical?: () => void;
}

export const QrScannerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onBottleIdentified,
  onOpenRecordUsage,
  onOpenStockIn,
  onOpenAddChemical,
}) => {
  const {
    bottles,
    chemicals,
    currentUser,
    isManager,
    recordUsage,
    restoreChemical,
    logQrScan,
    referenceDate,
    transactions,
    purchaseItems,
    createApprovalRequest,
  } = useLab();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);

  // Recognition States
  type GatewayView = 'SCANNING' | 'BOTTLE_GATEWAY' | 'CHEMICAL_GATEWAY' | 'NEW_BOTTLE_GATEWAY' | 'ARCHIVED_GATEWAY';
  const [currentView, setCurrentView] = useState<GatewayView>('SCANNING');
  const [rawScannedText, setRawScannedText] = useState<string>('');

  const [matchedBottle, setMatchedBottle] = useState<Bottle | null>(null);
  const [matchedChemical, setMatchedChemical] = useState<Chemical | null>(null);
  const [unrecognizedCode, setUnrecognizedCode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');

  // Inline Quick Usage Form States
  const [showQuickUsageForm, setShowQuickUsageForm] = useState<boolean>(false);
  const [useQuantity, setUseQuantity] = useState<string>('100');
  const [usePurpose, setUsePurpose] = useState<string>('Chiết xuất mẫu thí nghiệm');
  const [useProject, setUseProject] = useState<string>('IRP-2026');
  const [useNotes, setUseNotes] = useState<string>('');
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageSuccess, setUsageSuccess] = useState<string | null>(null);

  // History Tab in Modal
  const [showBottleHistory, setShowBottleHistory] = useState<boolean>(false);

  // Sound feedback
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Ignore audio failure
    }

    try {
      if ('vibrate' in navigator) navigator.vibrate(80);
    } catch {
      // Ignore
    }
  };

  // Reset state when closing/opening
  useEffect(() => {
    if (isOpen) {
      setCurrentView('SCANNING');
      setMatchedBottle(null);
      setMatchedChemical(null);
      setUnrecognizedCode(null);
      setRawScannedText('');
      setShowQuickUsageForm(false);
      setUsageError(null);
      setUsageSuccess(null);
      setShowBottleHistory(false);
    }
  }, [isOpen]);

  // Main Detection Dispatcher
  const processScannedCode = useCallback(
    (codeText: string) => {
      const trimmed = codeText.trim();
      if (!trimmed) return;
      setRawScannedText(trimmed);

      const parsed = parseScannedQrDetails(trimmed);
      const targetIdent = parsed.identifier.toLowerCase();

      // 1. First priority: Check exact bottle match (by bottleCode, bottle id, or qrId)
      const foundBottle = bottles.find(
        (b) =>
          b.bottleCode.toLowerCase() === targetIdent ||
          b.id.toLowerCase() === targetIdent ||
          (b.qrId && b.qrId.toLowerCase() === targetIdent) ||
          getBottleQrId(b.bottleCode).toLowerCase() === targetIdent
      );

      if (foundBottle) {
        playBeep();
        const parentChem = chemicals.find((c) => c.id === foundBottle.chemicalId) || null;
        setMatchedBottle(foundBottle);
        setMatchedChemical(parentChem);

        logQrScan({
          qrId: foundBottle.qrId || getBottleQrId(foundBottle.bottleCode),
          bottleId: foundBottle.id,
          bottleCode: foundBottle.bottleCode,
          chemicalId: foundBottle.chemicalId,
          chemicalName: parentChem?.name || 'Hóa chất',
          actionTaken: 'VIEW',
        });

        if (foundBottle.status === 'ARCHIVED' || parentChem?.status === 'ARCHIVED') {
          setCurrentView('ARCHIVED_GATEWAY');
        } else {
          setCurrentView('BOTTLE_GATEWAY');
        }
        return;
      }

      // 2. Second priority: Check exact Chemical match (by code, id, or CAS)
      const foundChem = chemicals.find(
        (c) =>
          c.id.toLowerCase() === targetIdent ||
          c.code.toLowerCase() === targetIdent ||
          c.casNumber.toLowerCase() === targetIdent ||
          c.name.toLowerCase() === targetIdent ||
          getChemicalQrId(c.code || c.id).toLowerCase() === targetIdent
      );

      if (foundChem) {
        playBeep();
        setMatchedChemical(foundChem);
        setMatchedBottle(null);

        logQrScan({
          qrId: getChemicalQrId(foundChem.code || foundChem.id),
          chemicalId: foundChem.id,
          chemicalName: foundChem.name,
          actionTaken: 'VIEW',
        });

        if (foundChem.status === 'ARCHIVED') {
          setCurrentView('ARCHIVED_GATEWAY');
        } else {
          setCurrentView('CHEMICAL_GATEWAY');
        }
        return;
      }

      // 3. Third priority: Unrecognized / New Bottle QR (Requirement 12: "Chai mới - chưa nhập kho")
      playBeep();
      setUnrecognizedCode(parsed.identifier);
      setMatchedBottle(null);

      // Guess if it belongs to an existing chemical by code prefix (e.g. HEX-003 -> chem-hexane)
      const prefix = parsed.identifier.split('-')[0].toUpperCase();
      const possibleChem = chemicals.find(
        (c) => (c.code && c.code.toUpperCase().startsWith(prefix)) || c.id.toUpperCase().includes(prefix)
      );
      setMatchedChemical(possibleChem || null);

      setCurrentView('NEW_BOTTLE_GATEWAY');
    },
    [bottles, chemicals, logQrScan]
  );

  // Camera Management
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraActive(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Trình duyệt không hỗ trợ truy cập camera qua MediaDevices API.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);

        const track = stream.getVideoTracks()[0];
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        setHasTorch(!!capabilities.torch);
      }
    } catch (err: any) {
      let errorMsg = 'Không thể truy cập camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Bạn đã từ chối quyền camera. Vui lòng cho phép trong trình duyệt hoặc nhập mã/chọn mã mẫu.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'Không tìm thấy thiết bị camera trên máy này. Bạn có thể nhập mã hoặc chọn mã mẫu bên dưới.';
      }
      setCameraError(errorMsg);
      setCameraActive(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const newTorchState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: newTorchState }],
      });
      setTorchOn(newTorchState);
    } catch (err) {
      console.warn('Torch toggle error:', err);
    }
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Camera start / stop effect
  useEffect(() => {
    if (!isOpen || currentView !== 'SCANNING') {
      stopCamera();
    } else {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, currentView, startCamera, stopCamera]);

  // Frame scanner animation loop
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !canvasRef.current || currentView !== 'SCANNING') return;

    let isActive = true;

    const scanFrame = () => {
      if (!isActive) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (code && code.data) {
            processScannedCode(code.data);
            return;
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isActive = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraActive, currentView, processScannedCode]);

  // File upload fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          processScannedCode(code.data);
        } else {
          setCameraError(`Không tìm thấy mã QR trong tệp "${file.name}".`);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Manual submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processScannedCode(manualCode.trim());
  };

  // Quick Usage Execution (Requirement 6, 7, 8, 9, 10, 11)
  const handleExecuteQuickUsage = () => {
    if (!matchedBottle || !matchedChemical) return;
    setUsageError(null);
    setUsageSuccess(null);

    const qty = parseFloat(useQuantity);
    if (isNaN(qty) || qty <= 0) {
      setUsageError('Số lượng sử dụng phải lớn hơn 0.');
      return;
    }

    // Permission check
    const canUse = isManager || currentUser.permissions?.recordUsage !== false;
    if (!canUse) {
      setUsageError('ACCESS DENIED: Tài khoản của bạn không được cấp quyền ghi nhận sử dụng (Record Usage).');
      return;
    }

    // Requirement 8: Check insufficient stock (NO NEGATIVE STOCK)
    const neededInBottleUnit = convertUnit(qty, matchedBottle.unit, matchedBottle.unit) || qty;
    if (neededInBottleUnit > matchedBottle.currentVolume + 0.0001) {
      setUsageError(
        `Không đủ tồn kho. Chai ${matchedBottle.bottleCode} chỉ còn ${matchedBottle.currentVolume} ${matchedBottle.unit}.`
      );
      return;
    }

    // Requirement 11: Limits check
    if (!isManager && currentUser.limits?.maxUsagePerTransaction !== null && currentUser.limits?.maxUsagePerTransaction !== undefined) {
      const qtyInMl = convertUnit(qty, matchedBottle.unit, 'mL') ?? qty;
      if (qtyInMl > currentUser.limits.maxUsagePerTransaction) {
        setUsageError(
          `VƯỢT GIỚI HẠN: Bạn chỉ được phép sử dụng tối đa ${currentUser.limits.maxUsagePerTransaction} mL/lần (yêu cầu: ${qtyInMl} mL). Đang tạo yêu cầu Quản lý phê duyệt...`
        );
        createApprovalRequest({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          type: 'USAGE_LIMIT_EXCEEDED',
          chemicalId: matchedChemical.id,
          chemicalName: matchedChemical.name,
          bottleId: matchedBottle.id,
          bottleCode: matchedBottle.bottleCode,
          requestedQuantity: qty,
          unit: matchedBottle.unit,
          limitValue: currentUser.limits.maxUsagePerTransaction,
          reason: usePurpose || 'Sử dụng qua QR Scanner',
        });
        return;
      }
    }

    // Execute atomic usage
    const res = recordUsage({
      chemicalId: matchedChemical.id,
      bottleId: matchedBottle.id,
      autoSelectBottle: false,
      quantity: qty,
      unit: matchedBottle.unit,
      date: new Date().toISOString().split('T')[0],
      purpose: usePurpose || 'Sử dụng qua cổng quét QR',
      project: useProject || 'Nghiên cứu Lab',
      notes: useNotes || `Trừ trực tiếp từ chai ${matchedBottle.bottleCode} qua QR gateway`,
    });

    if (res.success) {
      setUsageSuccess(res.message);
      logQrScan({
        qrId: matchedBottle.qrId || getBottleQrId(matchedBottle.bottleCode),
        bottleId: matchedBottle.id,
        bottleCode: matchedBottle.bottleCode,
        chemicalId: matchedChemical.id,
        chemicalName: matchedChemical.name,
        actionTaken: 'RECORD_USAGE',
      });

      // Update local bottle object
      const updatedVol = Math.max(0, Math.round((matchedBottle.currentVolume - qty) * 10000) / 10000);
      setMatchedBottle({
        ...matchedBottle,
        currentVolume: updatedVol,
        status: updatedVol === 0 ? 'EMPTY' : calculateBottleStatus(updatedVol, matchedBottle.initialVolume, matchedBottle.expiryDate, referenceDate),
      });

      setTimeout(() => {
        setShowQuickUsageForm(false);
        setUsageSuccess(null);
      }, 1800);
    } else {
      setUsageError(res.message);
    }
  };

  // Restore archived chemical from QR
  const handleRestoreFromQr = () => {
    if (!matchedChemical) return;
    const res = restoreChemical(matchedChemical.id, 'Khôi phục trực tiếp qua mã QR');
    if (res.success) {
      logQrScan({
        qrId: getChemicalQrId(matchedChemical.code || matchedChemical.id),
        chemicalId: matchedChemical.id,
        chemicalName: matchedChemical.name,
        actionTaken: 'RESTORE',
      });
      // Re-trigger detection with updated active status
      setTimeout(() => {
        processScannedCode(rawScannedText);
      }, 500);
    }
  };

  if (!isOpen) return null;

  // Active bottles of recognized chemical
  const chemicalBottles = matchedChemical
    ? bottles.filter((b) => b.chemicalId === matchedChemical.id && b.status !== 'ARCHIVED')
    : [];

  const isExpired = matchedBottle ? calculateBottleStatus(matchedBottle.currentVolume, matchedBottle.initialVolume, matchedBottle.expiryDate, referenceDate) === 'EXPIRED' : false;
  const isDisposed = matchedBottle?.status === 'DISPOSED';
  const isEmpty = matchedBottle ? matchedBottle.currentVolume <= 0 || matchedBottle.status === 'EMPTY' : false;

  // Bottle transactions
  const bottleTransactions = matchedBottle
    ? transactions.filter((t) => t.bottleId === matchedBottle.id || t.bottleCode === matchedBottle.bottleCode)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-6 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Cổng Thao Tác Nhanh Bằng QR</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300">
                  SMART QR GATEWAY
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Quét mã nhận diện chai / hóa chất → Tự động trừ kho hoặc nhập kho
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {currentView !== 'SCANNING' && (
              <button
                type="button"
                onClick={() => setCurrentView('SCANNING')}
                className="px-2.5 py-1 text-xs font-semibold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/60 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Quét mã khác</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View 1: Live Camera Scanner */}
        {currentView === 'SCANNING' && (
          <div className="flex flex-col flex-1 overflow-y-auto">
            {/* Viewfinder Video Area */}
            <div className="relative aspect-4/3 sm:aspect-16/10 bg-black overflow-hidden flex items-center justify-center shrink-0">
              <canvas ref={canvasRef} className="hidden" />

              <video
                ref={videoRef}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />

              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 z-10">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
                    <Camera className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    {cameraError ? 'Không thể mở máy ảnh' : 'Đang khởi động camera...'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                    {cameraError || 'Vui lòng cho phép quyền máy ảnh trong trình duyệt để quét trực tiếp.'}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Thử lại</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 text-xs font-semibold text-cyan-300 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải ảnh QR từ máy</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Viewfinder Reticle Overlay */}
              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl border-2 border-cyan-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex items-center justify-center overflow-hidden">
                    <span className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                    <span className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                    <span className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                    <span className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-[scan_2s_ease-in-out_infinite]" />
                    <div className="text-[10px] font-mono text-cyan-300/80 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-xs">
                      Căn mã QR chai/hóa chất vào khung
                    </div>
                  </div>
                </div>
              )}

              {cameraActive && (
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between z-20 pointer-events-auto">
                  <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-700/60">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-slate-300">Camera sẵn sàng</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700/60">
                    {hasTorch && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          torchOn ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'
                        }`}
                        title="Bật/Tắt đèn Flash"
                      >
                        <Flashlight className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={toggleCameraFacing}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Đổi camera trước / sau"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Tải ảnh QR từ file"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Manual input & Test Buttons */}
            <div className="p-5 space-y-4 bg-slate-900">
              <form onSubmit={handleManualSubmit} className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Hoặc nhập thủ công mã QR / Chai / CAS
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="vd: LABCHEM:BOTTLE:HEX-001, HEX-001, 110-54-3..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    Kiểm tra mã
                  </button>
                </div>
              </form>

              {/* Quick Demo Test Buttons */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mã thử nghiệm nhanh trong phòng lab (Nhấp để quét ngay):</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => processScannedCode('LABCHEM:BOTTLE:HEX-001')}
                    className="p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl text-left transition-colors cursor-pointer group"
                  >
                    <div className="text-[11px] font-mono font-bold text-cyan-300 group-hover:text-cyan-200">
                      HEX-001 (n-Hexane)
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">320/500 mL · Đang dùng</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => processScannedCode('LABCHEM:BOTTLE:HEX-002')}
                    className="p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl text-left transition-colors cursor-pointer group"
                  >
                    <div className="text-[11px] font-mono font-bold text-cyan-300 group-hover:text-cyan-200">
                      HEX-002 (Mới)
                    </div>
                    <div className="text-[10px] text-cyan-400 mt-0.5">500 mL · Nguyên seal</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => processScannedCode('LABCHEM:BOTTLE:DEX-001')}
                    className="p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-rose-900/60 rounded-xl text-left transition-colors cursor-pointer group"
                  >
                    <div className="text-[11px] font-mono font-bold text-rose-300 group-hover:text-rose-200">
                      DEX-001 (Demo Hết Hạn)
                    </div>
                    <div className="text-[10px] text-rose-400 mt-0.5">⚠ Đã hết hạn dùng</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => processScannedCode('LABCHEM:BOTTLE:HX-NEW-001')}
                    className="p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-amber-900/60 rounded-xl text-left transition-colors cursor-pointer group"
                  >
                    <div className="text-[11px] font-mono font-bold text-amber-300 group-hover:text-amber-200">
                      HX-NEW-001 (Chai Mới)
                    </div>
                    <div className="text-[10px] text-amber-400 mt-0.5">📥 Chưa nhập kho</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View 2: BOTTLE GATEWAY ("ĐÃ NHẬN DIỆN CHAI HÓA CHẤT") */}
        {currentView === 'BOTTLE_GATEWAY' && matchedBottle && matchedChemical && (
          <div className="p-6 space-y-5 flex-1 overflow-y-auto bg-slate-900 text-slate-100">
            {/* Top Recognized Banner */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                    ĐÃ NHẬN DIỆN CHAI HÓA CHẤT
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">{matchedChemical.name}</h3>
                  <div className="text-xs text-slate-300 font-mono">
                    Chai: <strong className="text-emerald-300">{matchedBottle.bottleCode}</strong> · QR ID: {matchedBottle.qrId || getBottleQrId(matchedBottle.bottleCode)}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  {matchedBottle.status}
                </span>
              </div>
            </div>

            {/* Bottle Status Warnings (Requirements 21 & 22) */}
            {isExpired && (
              <div className="p-4 bg-rose-500/20 border border-rose-500/40 rounded-2xl flex items-start gap-3 text-xs text-rose-200 animate-in fade-in">
                <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-300 text-sm">⚠ CHAI ĐÃ HẾT HẠN SỬ DỤNG!</div>
                  <p className="mt-0.5 text-rose-200/90 leading-relaxed">
                    Chai {matchedBottle.bottleCode} đã hết hạn vào ngày <strong>{matchedBottle.expiryDate}</strong>. Quy tắc an toàn phòng thí nghiệm nghiêm cấm sử dụng chai này. Vui lòng liên hệ Quản lý để làm thủ tục thanh lý.
                  </p>
                </div>
              </div>
            )}

            {isDisposed && (
              <div className="p-4 bg-slate-800 border border-slate-700 rounded-2xl flex items-start gap-3 text-xs text-slate-300">
                <Archive className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-200">CHAI ĐÃ ĐƯỢC THANH LÝ (DISPOSED)</div>
                  <p className="mt-0.5 text-slate-400 leading-relaxed">
                    Chai này đã được thanh lý ra khỏi phòng thí nghiệm. Không thể ghi dùng hoặc nhập kho lại.
                  </p>
                </div>
              </div>
            )}

            {/* Core Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <div className="text-[10px] text-slate-400 font-medium">Hiện có trong chai</div>
                <div className="text-base font-bold font-mono text-cyan-300 mt-1">
                  {matchedBottle.currentVolume} / {matchedBottle.initialVolume} {matchedBottle.unit}
                </div>
                {/* Volume Progress Bar */}
                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (matchedBottle.currentVolume / matchedBottle.initialVolume) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <div className="text-[10px] text-slate-400 font-medium">Vị trí lưu trữ</div>
                <div className="text-xs font-bold text-white mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{matchedBottle.location.cabinet}</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {matchedBottle.location.shelf} · {matchedBottle.location.room}
                </div>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <div className="text-[10px] text-slate-400 font-medium">Hạn sử dụng</div>
                <div className="text-xs font-bold font-mono mt-1 text-white flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>{matchedBottle.expiryDate}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {getDaysRemaining(matchedBottle.expiryDate, referenceDate) > 0
                    ? `Còn ${getDaysRemaining(matchedBottle.expiryDate, referenceDate)} ngày`
                    : 'Đã quá hạn'}
                </div>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <div className="text-[10px] text-slate-400 font-medium">Mã lô / CAS</div>
                <div className="text-xs font-mono font-bold text-white mt-1 truncate">
                  {matchedBottle.lotNumber}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  CAS: {matchedChemical.casNumber}
                </div>
              </div>
            </div>

            {/* Quick Usage Form Accordion (Requirements 6, 7, 8, 9) */}
            {showQuickUsageForm && !isExpired && !isDisposed && (
              <div className="p-4 bg-slate-800/90 border border-cyan-500/40 rounded-2xl space-y-3.5 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wide">
                      Ghi Sử Dụng Nhanh Từ Chai {matchedBottle.bottleCode}
                    </span>
                  </div>
                  <span className="text-[11px] text-cyan-300 font-mono">
                    Người thực hiện: <strong>{currentUser.name}</strong> ({currentUser.role})
                  </span>
                </div>

                {usageSuccess && (
                  <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{usageSuccess}</span>
                  </div>
                )}

                {usageError && (
                  <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{usageError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Số lượng cần dùng ({matchedBottle.unit}) <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={matchedBottle.currentVolume}
                        value={useQuantity}
                        onChange={(e) => setUseQuantity(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-cyan-400 outline-hidden"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                        {matchedBottle.unit}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Tồn hiện tại: <strong className="text-white">{matchedBottle.currentVolume} {matchedBottle.unit}</strong> (không cho âm tồn)
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Mục đích sử dụng
                    </label>
                    <input
                      type="text"
                      value={usePurpose}
                      onChange={(e) => setUsePurpose(e.target.value)}
                      placeholder="Chiết xuất mẫu, phân tích TLC..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-cyan-400 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Đề tài / Dự án
                    </label>
                    <input
                      type="text"
                      value={useProject}
                      onChange={(e) => setUseProject(e.target.value)}
                      placeholder="Dự án nghiên cứu..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-cyan-400 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Ghi chú thêm
                    </label>
                    <input
                      type="text"
                      value={useNotes}
                      onChange={(e) => setUseNotes(e.target.value)}
                      placeholder="Ghi chú thao tác..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-cyan-400 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowQuickUsageForm(false)}
                    className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Đóng form
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteQuickUsage}
                    className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Xác nhận trừ kho đúng chai</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottle Usage History Accordion (Requirement 20) */}
            {showBottleHistory && (
              <div className="p-4 bg-slate-800/90 border border-slate-700 rounded-2xl space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <History className="w-4 h-4 text-cyan-400" />
                    <span>Lịch sử chiết dùng của riêng chai {matchedBottle.bottleCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBottleHistory(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    Đóng
                  </button>
                </div>

                {bottleTransactions.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-xs">
                    Chai mới nguyên, chưa phát sinh lượt chiết dùng nào.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {bottleTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            -{tx.quantity} {tx.unit} · {tx.purpose || 'Thí nghiệm'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Bởi: <strong>{tx.user}</strong> · {tx.date} ({tx.project || 'Lab'})
                          </div>
                        </div>
                        <div className="text-right font-mono text-[11px] text-slate-400">
                          {tx.previousStock} → {tx.newStock} {tx.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Action Hub Buttons (Requirement 20) */}
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBottleHistory(!showBottleHistory)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Lịch sử chai</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onBottleIdentified(matchedBottle);
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Chi tiết hồ sơ</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!isExpired && !isDisposed && !isEmpty && (
                  <button
                    type="button"
                    onClick={() => setShowQuickUsageForm(!showQuickUsageForm)}
                    className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <FlaskConical className="w-4 h-4" />
                    <span>Dùng hóa chất (Trừ đúng chai)</span>
                  </button>
                )}

                {isExpired && isManager && (
                  <button
                    type="button"
                    onClick={() => {
                      onBottleIdentified(matchedBottle);
                      onClose();
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Lập thủ tục thanh lý chai</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* View 3: CHEMICAL GATEWAY ("ĐÃ NHẬN DIỆN HÓA CHẤT - CHỌN CHAI") */}
        {currentView === 'CHEMICAL_GATEWAY' && matchedChemical && (
          <div className="p-6 space-y-5 flex-1 overflow-y-auto bg-slate-900 text-slate-100">
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 font-mono">
                    ĐÃ NHẬN DIỆN HỒ SƠ HÓA CHẤT
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">{matchedChemical.name}</h3>
                  <div className="text-xs text-slate-300 font-mono">
                    CAS: {matchedChemical.casNumber} · Mã: {matchedChemical.code || 'N/A'} · Loại: {matchedChemical.category}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs text-slate-400">Tổng tồn active:</span>
                <div className="text-sm font-bold font-mono text-cyan-300">
                  {chemicalBottles.reduce((s, b) => s + b.currentVolume, 0)} {matchedChemical.primaryUnit}
                </div>
              </div>
            </div>

            {/* List of Bottles for this Chemical (Requirement 3B) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Danh sách các chai hiện có trong kho ({chemicalBottles.length} chai):</span>
                </div>
                <span className="text-[11px] text-slate-400">Chọn chai để thao tác:</span>
              </div>

              {chemicalBottles.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700 text-xs">
                  Chưa có chai nào trong kho cho hóa chất này. Bạn có thể bấm Nhập kho bên dưới.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {chemicalBottles.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-slate-800 rounded-2xl border border-slate-700/80 hover:border-cyan-500/50 transition-colors flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                          <span>{b.bottleCode}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-normal bg-slate-700 text-slate-300">
                            {b.status}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-cyan-300 mt-1">
                          {b.currentVolume} / {b.initialVolume} {b.unit}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {b.location.cabinet} · {b.location.shelf}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMatchedBottle(b);
                          setCurrentView('BOTTLE_GATEWAY');
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-colors cursor-pointer shrink-0"
                      >
                        Chọn chai
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Action Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentView('SCANNING')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Quét mã khác
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenStockIn) onOpenStockIn(matchedChemical.id);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-600 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nhập kho thêm chai mới cho hóa chất này</span>
              </button>
            </div>
          </div>
        )}

        {/* View 4: NEW BOTTLE GATEWAY ("CHAI MỚI - CHƯA NHẬP KHO") */}
        {currentView === 'NEW_BOTTLE_GATEWAY' && (
          <div className="p-6 space-y-5 flex-1 overflow-y-auto bg-slate-900 text-slate-100">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400">
                  <PackagePlus className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                    CHAI MỚI – CHƯA NHẬP KHO
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    Mã chai: <span className="font-mono text-amber-300">{unrecognizedCode}</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Chai này chưa có trong cơ sở dữ liệu kho LabChem. Bạn có thể tiến hành nhập kho ngay.
                  </p>
                </div>
              </div>
            </div>

            {/* Chemical Match Assessment (Requirement 14 & 15) */}
            {matchedChemical ? (
              <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Khớp với hóa chất đã có trong kho:
                </span>
                <div className="text-sm font-bold text-white">{matchedChemical.name}</div>
                <div className="text-xs text-slate-400 font-mono">
                  CAS: {matchedChemical.casNumber} · Mã: {matchedChemical.code} · Nhà SX: {matchedChemical.manufacturer}
                </div>
                <div className="text-xs text-emerald-400 pt-1">
                  ✓ Hệ thống sẽ tạo chai mới và liên kết trực tiếp với hồ sơ {matchedChemical.name} (không tạo trùng lặp hóa chất).
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Trạng thái hồ sơ hóa chất:
                </span>
                <div className="text-xs text-slate-300 leading-relaxed">
                  Chưa tìm thấy hồ sơ hóa chất khớp với mã này. Khi nhập kho, bạn có thể chọn hóa chất có sẵn hoặc tạo hồ sơ hóa chất mới nếu có quyền.
                </div>
              </div>
            )}

            {/* Action Buttons (Requirement 13) */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentView('SCANNING')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Quét mã khác
              </button>

              <div className="flex items-center gap-2">
                {!matchedChemical && isManager && onOpenAddChemical && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAddChemical();
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    + Tạo hồ sơ hóa chất mới
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenStockIn) {
                      onOpenStockIn(matchedChemical?.id, unrecognizedCode || undefined);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>Tiến hành Nhập Kho Ngay</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View 5: ARCHIVED GATEWAY ("HÓA CHẤT ĐÃ ĐƯỢC LƯU TRỮ") (Requirement 41) */}
        {currentView === 'ARCHIVED_GATEWAY' && matchedChemical && (
          <div className="p-6 space-y-5 flex-1 overflow-y-auto bg-slate-900 text-slate-100">
            <div className="p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400">
                  <Archive className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                    HÓA CHẤT ĐÃ ĐƯỢC LƯU TRỮ (ARCHIVED / DELETED)
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">{matchedChemical.name}</h3>
                  <div className="text-xs text-slate-300 font-mono">
                    {matchedBottle ? `Chai: ${matchedBottle.bottleCode} · ` : ''}Trạng thái: ARCHIVED
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700 space-y-2 text-xs text-slate-300 leading-relaxed">
              <p>
                Hóa chất này đã được đưa vào <strong>Kho lưu trữ / Thùng rác</strong> bởi Quản lý phòng lab ({matchedChemical.deletedBy || 'Quản lý'}).
              </p>
              <p className="text-slate-400">
                Lý do xóa: <em>"{matchedChemical.deletionReason || matchedChemical.archivedReason || 'Ngừng sử dụng'}"</em>
              </p>
              {!isManager && (
                <p className="text-amber-400 font-semibold pt-1">
                  Tài khoản thành viên không thể sử dụng hóa chất đã lưu trữ. Vui lòng liên hệ Quản lý phòng lab để khôi phục.
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentView('SCANNING')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Quét mã khác
              </button>

              {isManager && (
                <button
                  type="button"
                  onClick={handleRestoreFromQr}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Khôi phục hóa chất ngay tại đây</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
