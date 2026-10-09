import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { useLab } from '../../context/LabContext';
import { ChemicalUnit, Bottle, Chemical } from '../../types';
import { COMMON_UNITS, areUnitsCompatible, convertUnit } from '../../utils/units';
import { parseScannedQrDetails, getBottleQrId } from '../../utils/qrCode';
import { calculateBottleStatus, getDaysRemaining } from '../../utils/status';
import {
  X,
  AlertCircle,
  Sparkles,
  Check,
  UserCheck,
  QrCode,
  Camera,
  Search,
  FlaskConical,
  MapPin,
  Calendar,
  AlertOctagon,
  ArrowRight,
  Upload,
  RefreshCw,
  Flashlight,
  ShieldAlert,
  Archive,
  Info,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preselectedChemicalId?: string;
  preselectedBottleId?: string;
  initialUseFullBottle?: boolean;
}

const PRESET_PURPOSES = [
  'Chiết xuất mẫu',
  'Sắc ký bản mỏng TLC',
  'Sắc ký lỏng HPLC',
  'Chuẩn bị mẫu phân tích',
  'Kiểm nghiệm dược liệu',
  'Nghiên cứu hoạt tính sinh học',
  'Khác',
];

export const RecordUsageModal: React.FC<Props> = ({
  isOpen,
  onClose,
  preselectedChemicalId,
  preselectedBottleId,
  initialUseFullBottle = false,
}) => {
  const {
    chemicals,
    bottles,
    currentUser,
    recordUsage,
    getChemicalTotalStock,
    transactions,
    createApprovalRequest,
    isManager,
    referenceDate,
    logQrScan,
  } = useLab();

  // Active chemicals only (Mục 39: Không chọn chemical đã archived)
  const activeChemicals = useMemo(() => {
    return chemicals.filter((c) => c.status !== 'ARCHIVED');
  }, [chemicals]);

  // Mode Selection: 'QR' | 'MANUAL'
  const [selectionMode, setSelectionMode] = useState<'QR' | 'MANUAL'>(
    preselectedBottleId ? 'MANUAL' : 'QR'
  );

  // Common Form Fields
  const [chemicalId, setChemicalId] = useState<string>(preselectedChemicalId || '');
  const [bottleId, setBottleId] = useState<string>(preselectedBottleId || '');
  const [autoSelectBottle, setAutoSelectBottle] = useState<boolean>(!preselectedBottleId);
  const [useFullBottle, setUseFullBottle] = useState<boolean>(initialUseFullBottle || false);
  const [emptyBottleAction, setEmptyBottleAction] = useState<'EMPTY' | 'ARCHIVE'>('EMPTY');
  const [quantity, setQuantity] = useState<string>('100');
  const [unit, setUnit] = useState<ChemicalUnit>('mL');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [project, setProject] = useState<string>('IRP-2026');
  const [selectedPurpose, setSelectedPurpose] = useState<string>(PRESET_PURPOSES[0]);
  const [customPurpose, setCustomPurpose] = useState<string>('');
  const [experiment, setExperiment] = useState<string>('Chiết phân đoạn');
  const [notes, setNotes] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [approvalSentMsg, setApprovalSentMsg] = useState<string | null>(null);

  // Camera & QR Scanner State
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
  const [isScanningActive, setIsScanningActive] = useState<boolean>(true);
  const [manualQrInput, setManualQrInput] = useState<string>('');

  // QR Recognition State
  const [scannedBottle, setScannedBottle] = useState<Bottle | null>(null);
  const [scannedChemical, setScannedChemical] = useState<Chemical | null>(null);
  const [qrScanError, setQrScanError] = useState<string | null>(null);

  // Selected Bottle resolution
  const activeBottle: Bottle | undefined = useMemo(() => {
    if (selectionMode === 'QR' && scannedBottle) {
      return scannedBottle;
    }
    if (bottleId) {
      return bottles.find((b) => b.id === bottleId && b.status !== 'ARCHIVED');
    }
    return undefined;
  }, [selectionMode, scannedBottle, bottleId, bottles]);

  // Selected Chemical resolution
  const activeChemical: Chemical | undefined = useMemo(() => {
    if (selectionMode === 'QR' && scannedChemical) {
      return scannedChemical;
    }
    if (activeBottle) {
      return chemicals.find((c) => c.id === activeBottle.chemicalId);
    }
    return chemicals.find((c) => c.id === chemicalId);
  }, [selectionMode, scannedChemical, activeBottle, chemicalId, chemicals]);

  // Bottles for dropdown in manual mode
  const availableBottlesForChem = useMemo(() => {
    if (!chemicalId) return [];
    return bottles.filter(
      (b) => b.chemicalId === chemicalId && b.status !== 'ARCHIVED' && b.status !== 'DISPOSED' && b.currentVolume > 0
    );
  }, [bottles, chemicalId]);

  // Real-time Stock and Limits evaluation
  const targetBottleVolume = activeBottle?.currentVolume ?? (availableBottlesForChem[0]?.currentVolume ?? 0);
  const parsedQty = useFullBottle ? targetBottleVolume : (parseFloat(quantity) || 0);
  const bottleUnit = activeBottle?.unit || unit;
  const currentBottleVol = activeBottle?.currentVolume ?? 0;
  const initialBottleVol = activeBottle?.initialVolume ?? 0;

  // Insufficient stock check (Requirement 9: No negative stock!)
  const isInsufficientStock = useFullBottle
    ? (availableBottlesForChem.length === 0 && (!activeBottle || activeBottle.currentVolume <= 0))
    : (activeBottle ? parsedQty > currentBottleVol + 0.0001 : false);

  const stockRemainingAfter = activeBottle
    ? Math.max(0, Math.round((currentBottleVol - parsedQty) * 10000) / 10000)
    : 0;

  // Status check (Requirement 22 & 23)
  const isBottleExpired = activeBottle
    ? calculateBottleStatus(activeBottle.currentVolume, activeBottle.initialVolume, activeBottle.expiryDate, referenceDate) === 'EXPIRED'
    : false;
  const isBottleArchived = activeBottle?.status === 'ARCHIVED';
  const isBottleDisposed = activeBottle?.status === 'DISPOSED';

  // Permission & Limits
  const canUseChemical = isManager || currentUser.permissions?.recordUsage !== false;
  const limits = currentUser.limits;
  const qtyInMl = convertUnit(parsedQty, bottleUnit, 'mL') ?? parsedQty;

  const exceedsTxLimit =
    !isManager &&
    limits?.maxUsagePerTransaction !== null &&
    limits?.maxUsagePerTransaction !== undefined &&
    qtyInMl > limits.maxUsagePerTransaction;

  const hasBlocker =
    !canUseChemical ||
    (useFullBottle ? targetBottleVolume <= 0 : parsedQty <= 0) ||
    isInsufficientStock ||
    isBottleExpired ||
    isBottleArchived ||
    isBottleDisposed ||
    exceedsTxLimit;

  // Audio beep
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
      // Ignore audio error
    }
  };

  // QR Recognition Handler (Requirements 3, 4, 5, 28, 29)
  const handleRecognizeQr = useCallback(
    (codeText: string) => {
      const raw = codeText.trim();
      if (!raw) return;
      setQrScanError(null);

      const parsed = parseScannedQrDetails(raw);
      const targetIdent = parsed.identifier.toLowerCase();

      // Check if multiple bottles are linked to this QR (Requirement 29)
      const matchingBottles = bottles.filter(
        (b) =>
          b.bottleCode.toLowerCase() === targetIdent ||
          b.id.toLowerCase() === targetIdent ||
          (b.qrId && b.qrId.toLowerCase() === targetIdent) ||
          (b.barcode && b.barcode.toLowerCase() === targetIdent) ||
          getBottleQrId(b.bottleCode).toLowerCase() === targetIdent
      );

      if (matchingBottles.length > 1) {
        setQrScanError('QR này đang được liên kết với nhiều chai. Vui lòng liên hệ Manager để kiểm tra.');
        return;
      }

      if (matchingBottles.length === 0) {
        // Also check if user scanned a chemical code / product code / catalog number / barcode (Cách 1)
        const chemMatch = chemicals.find(
          (c) =>
            c.id.toLowerCase() === targetIdent ||
            c.code.toLowerCase() === targetIdent ||
            c.casNumber.toLowerCase() === targetIdent ||
            (c.catalogNumber && c.catalogNumber.toLowerCase() === targetIdent) ||
            c.name.toLowerCase() === targetIdent ||
            c.englishName.toLowerCase() === targetIdent
        );

        if (chemMatch) {
          const chemBts = bottles.filter(
            (b) => b.chemicalId === chemMatch.id && b.status !== 'ARCHIVED' && b.status !== 'DISPOSED' && b.currentVolume > 0
          );
          playBeep();
          setScannedChemical(chemMatch);
          setChemicalId(chemMatch.id);
          if (chemBts.length > 0) {
            setScannedBottle(chemBts[0]);
            setBottleId(chemBts[0].id);
            setUnit(chemBts[0].unit);
          } else {
            setScannedBottle(null);
            setBottleId('');
            setUnit(chemMatch.primaryUnit);
          }
          setAutoSelectBottle(true);
          setIsScanningActive(false);
          return;
        }

        setQrScanError('Không tìm thấy chai hoặc hóa chất này trong hệ thống.');
        return;
      }

      // Exact bottle recognized
      const found = matchingBottles[0];
      handleSelectBottleDirect(found);
    },
    [bottles, chemicals]
  );

  const handleSelectBottleDirect = (bottleObj: Bottle) => {
    playBeep();
    setScannedBottle(bottleObj);
    const parentChem = chemicals.find((c) => c.id === bottleObj.chemicalId);
    setScannedChemical(parentChem || null);
    setChemicalId(bottleObj.chemicalId);
    setBottleId(bottleObj.id);
    setAutoSelectBottle(false);
    setUnit(bottleObj.unit);
    setIsScanningActive(false);

    logQrScan({
      qrId: bottleObj.qrId || getBottleQrId(bottleObj.bottleCode),
      bottleId: bottleObj.id,
      bottleCode: bottleObj.bottleCode,
      chemicalId: bottleObj.chemicalId,
      chemicalName: parentChem?.name || 'Hóa chất',
      actionTaken: 'VIEW',
    });
  };

  // Camera stream controls
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraActive(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Trình duyệt không hỗ trợ MediaDevices camera.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode,
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
      let errorMsg = 'Không thể mở camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Bạn chưa cấp quyền máy ảnh. Bạn có thể nhập mã chai hoặc chọn hóa chất thủ công.';
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'Không tìm thấy thiết bị camera trên máy này.';
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

  // Frame processing loop
  useEffect(() => {
    if (!isOpen || selectionMode !== 'QR' || !isScanningActive) {
      stopCamera();
    } else {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, selectionMode, isScanningActive, startCamera, stopCamera]);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !canvasRef.current || !isScanningActive) return;

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
            handleRecognizeQr(code.data);
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
  }, [cameraActive, isScanningActive, handleRecognizeQr]);

  // File upload
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
          handleRecognizeQr(code.data);
        } else {
          setQrScanError(`Không tìm thấy mã QR trong hình ảnh "${file.name}".`);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Preselected props effect
  useEffect(() => {
    if (preselectedChemicalId) {
      setChemicalId(preselectedChemicalId);
      const chem = chemicals.find((c) => c.id === preselectedChemicalId);
      if (chem) setUnit(chem.primaryUnit);
    } else if (activeChemicals.length > 0 && !chemicalId) {
      setChemicalId(activeChemicals[0].id);
      setUnit(activeChemicals[0].primaryUnit);
    }
  }, [preselectedChemicalId, activeChemicals, chemicalId, chemicals]);

  useEffect(() => {
    if (preselectedBottleId) {
      setBottleId(preselectedBottleId);
      setAutoSelectBottle(false);
      const b = bottles.find((x) => x.id === preselectedBottleId);
      if (b) {
        setScannedBottle(b);
        setChemicalId(b.chemicalId);
        setUnit(b.unit);
      }
    }
  }, [preselectedBottleId, bottles]);

  // Reset when dialog opens
  useEffect(() => {
    if (isOpen) {
      setUseFullBottle(Boolean(initialUseFullBottle));
      setEmptyBottleAction('EMPTY');
      setErrorMsg(null);
      setSuccessMsg(null);
      setApprovalSentMsg(null);
      setQrScanError(null);
      if (preselectedBottleId || preselectedChemicalId || initialUseFullBottle) {
        setSelectionMode('MANUAL');
        setIsScanningActive(false);
      } else {
        setSelectionMode('QR');
        setIsScanningActive(true);
        setScannedBottle(null);
      }
    }
  }, [isOpen, preselectedBottleId, preselectedChemicalId, initialUseFullBottle]);

  // Request Manager Approval if limit exceeded
  const handleSendApproval = () => {
    if (!activeChemical) return;
    const res = createApprovalRequest({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      type: 'USAGE_LIMIT_EXCEEDED',
      chemicalId: activeChemical.id,
      chemicalName: activeChemical.name,
      bottleId: activeBottle?.id,
      bottleCode: activeBottle?.bottleCode,
      requestedQuantity: parsedQty,
      unit: bottleUnit,
      limitValue: currentUser.limits?.maxUsagePerTransaction || 100,
      reason: selectedPurpose === 'Khác' ? customPurpose : selectedPurpose,
    });

    if (res.success) {
      setApprovalSentMsg('Đã gửi yêu cầu phê duyệt tới Quản lý phòng lab thành công!');
      setErrorMsg(null);
    }
  };

  // Submit Usage Transaction (Requirement 13)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (hasBlocker) {
      if (isInsufficientStock) {
        setErrorMsg('Không đủ hóa chất để thực hiện thao tác.');
      } else if (isBottleExpired) {
        setErrorMsg('Hóa chất đã hết hạn – không được phép sử dụng.');
      } else if (isBottleArchived || isBottleDisposed) {
        setErrorMsg('Chai đã bị lưu trữ hoặc thanh lý. Không thể ghi nhận sử dụng.');
      } else if (!canUseChemical) {
        setErrorMsg('Tài khoản của bạn không có quyền ghi sử dụng hóa chất. Vui lòng liên hệ Manager.');
      } else if (exceedsTxLimit) {
        setErrorMsg(`Vượt giới hạn ${limits?.maxUsagePerTransaction} mL/lần. Vui lòng bấm "Gửi yêu cầu Quản lý duyệt".`);
      } else {
        setErrorMsg('Vui lòng kiểm tra lại số lượng sử dụng hợp lệ (> 0).');
      }
      return;
    }

    const finalPurpose = selectedPurpose === 'Khác' ? customPurpose.trim() : selectedPurpose;

    const res = recordUsage({
      chemicalId: activeChemical?.id || chemicalId,
      bottleId: activeBottle?.id || (autoSelectBottle ? undefined : bottleId),
      autoSelectBottle: selectionMode === 'MANUAL' && autoSelectBottle,
      quantity: parsedQty,
      unit: bottleUnit,
      date,
      project: project || 'IRP-2026',
      experiment: experiment || 'Chiết xuất',
      purpose: finalPurpose || (useFullBottle ? 'Dùng hết 1 chai' : 'Thí nghiệm'),
      notes: notes || (useFullBottle ? 'Dùng hết 1 chai' : selectionMode === 'QR' ? `Quét mã QR chai ${activeBottle?.bottleCode}` : undefined),
      userId: currentUser.id,
      source: selectionMode === 'QR' ? 'QR_SCAN' : 'MANUAL',
      useFullBottle,
      emptyBottleAction: useFullBottle ? emptyBottleAction : undefined,
    });

    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      setSuccessMsg(res.message);
      if (selectionMode === 'QR' && activeBottle) {
        logQrScan({
          qrId: activeBottle.qrId || getBottleQrId(activeBottle.bottleCode),
          bottleId: activeBottle.id,
          bottleCode: activeBottle.bottleCode,
          chemicalId: activeChemical?.id || chemicalId,
          chemicalName: activeChemical?.name || 'Hóa chất',
          actionTaken: 'RECORD_USAGE',
        });
      }

      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-xs">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Ghi Sử Dụng Hóa Chất
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Quét mã QR nhận diện chai nhanh chóng hoặc chọn thủ công
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Toggle (Requirement 1 & 26) */}
        <div className="px-6 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200 shadow-2xs w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setSelectionMode('QR');
                setIsScanningActive(true);
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectionMode === 'QR'
                  ? 'bg-cyan-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>📷 Quét QR chai</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectionMode('MANUAL');
                setIsScanningActive(false);
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectionMode === 'MANUAL'
                  ? 'bg-cyan-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>🔎 Chọn thủ công</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
            <span>User:</span>
            <strong className="text-slate-800">{currentUser.name}</strong>
          </div>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5 flex-1 overflow-y-auto">
          {/* Notifications / Alerts */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Từ chối thao tác: </span>
                {errorMsg}
                {exceedsTxLimit && !approvalSentMsg && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={handleSendApproval}
                      className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
                    >
                      Gửi yêu cầu Quản lý phê duyệt vượt hạn mức
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {approvalSentMsg && (
            <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-2xl text-xs text-cyan-800 font-semibold flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-600 shrink-0" />
              <span>{approvalSentMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* MODE A: QR SCANNER WORKFLOW */}
          {/* ======================================================== */}
          {selectionMode === 'QR' && (
            <div className="space-y-4">
              {/* If scanning is active, show Camera Viewfinder */}
              {isScanningActive && (
                <div className="space-y-3">
                  <div className="relative aspect-16/10 bg-slate-950 rounded-2xl overflow-hidden border border-slate-300 flex items-center justify-center">
                    <canvas ref={canvasRef} className="hidden" />

                    <video
                      ref={videoRef}
                      className={`w-full h-full object-cover ${
                        cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}
                    />

                    {!cameraActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-900 text-white">
                        <Camera className="w-8 h-8 text-slate-400 mb-2" />
                        <span className="text-xs font-semibold">
                          {cameraError || 'Đang kết nối camera...'}
                        </span>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 cursor-pointer"
                          >
                            Thử lại
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1 text-xs bg-cyan-900 text-cyan-200 rounded-lg border border-cyan-800 cursor-pointer"
                          >
                            Tải ảnh QR
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reticle */}
                    {cameraActive && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="relative w-44 h-44 rounded-xl border-2 border-cyan-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex items-center justify-center">
                          <div className="text-[10px] font-mono text-cyan-300 bg-black/60 px-2 py-0.5 rounded-full">
                            Hướng về mã QR trên chai
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Camera Control overlay */}
                    {cameraActive && (
                      <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between text-white z-10">
                        <span className="text-[10px] font-mono bg-black/60 px-2 py-0.5 rounded-md">
                          Camera sẵn sàng
                        </span>
                        <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-lg">
                          {hasTorch && (
                            <button
                              type="button"
                              onClick={() => {
                                if (streamRef.current) {
                                  const track = streamRef.current.getVideoTracks()[0];
                                  track?.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
                                  setTorchOn(!torchOn);
                                }
                              }}
                              className="p-1 hover:text-cyan-300 cursor-pointer"
                              title="Flash"
                            >
                              <Flashlight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                            className="p-1 hover:text-cyan-300 cursor-pointer"
                            title="Đổi camera"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1 hover:text-cyan-300 cursor-pointer"
                            title="Tải ảnh"
                          >
                            <Upload className="w-3.5 h-3.5" />
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

                  {/* Manual QR input fallback */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={manualQrInput}
                      onChange={(e) => setManualQrInput(e.target.value)}
                      placeholder="Hoặc nhập mã chai (vd: HEX-001, LAB-HX-001)..."
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-xl font-mono text-slate-800 placeholder-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleRecognizeQr(manualQrInput)}
                      className="px-3.5 py-1.5 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      Nhận diện
                    </button>
                  </div>

                  {/* Quick Demo Test Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Mã mẫu:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRecognizeQr('HEX-001')}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 border border-slate-200 rounded-md font-mono font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      HEX-001 (n-Hexane)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRecognizeQr('HEX-002')}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 border border-slate-200 rounded-md font-mono font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      HEX-002 (Mới 500mL)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRecognizeQr('DEX-001')}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 rounded-md font-mono font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      DEX-001 (Hết hạn)
                    </button>
                  </div>

                  {qrScanError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{qrScanError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Once Scanned: Show Recognized Card (Requirement 5 & 6) */}
              {!isScanningActive && scannedChemical && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-2xs">
                          <Check className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-mono flex items-center gap-1.5">
                            <span>✓ ĐÃ NHẬN DIỆN {scannedBottle ? 'CHAI HÓA CHẤT' : 'MÃ HÀNG HÓA CHẤT'}</span>
                            <span className="px-1 py-0.2 rounded bg-emerald-200 text-emerald-900 text-[9px] font-bold">Cách 1</span>
                          </div>
                          <div className="text-sm font-bold text-slate-900 mt-0.5">
                            {scannedChemical.name}
                          </div>
                          <div className="text-[11px] text-slate-600 font-mono">
                            CAS: {scannedChemical.casNumber} · Mã: <strong className="text-slate-800">{scannedChemical.code}</strong>
                            {scannedChemical.catalogNumber && (
                              <span> · Mã hàng: <strong className="text-slate-800">{scannedChemical.catalogNumber}</strong></span>
                            )}
                            {scannedBottle && (
                              <span> · Chai: <strong className="text-emerald-900 font-bold">{scannedBottle.bottleCode}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsScanningActive(true)}
                        className="px-2.5 py-1 text-xs font-semibold text-cyan-800 bg-cyan-100 hover:bg-cyan-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Quét lại mã khác
                      </button>
                    </div>

                    {/* Cách 1: Tổng quan số chai và lượng tồn */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/60 text-xs">
                      <div className="p-2 bg-white rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-slate-500 font-medium">Số chai còn lại</span>
                        <div className="font-bold font-mono text-emerald-900 text-sm mt-0.5">
                          {availableBottlesForChem.length} chai
                        </div>
                      </div>

                      <div className="p-2 bg-white rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-slate-500 font-medium">
                          {scannedBottle ? 'Dung tích chai' : 'Tổng tồn kho'}
                        </span>
                        <div className="font-bold font-mono text-slate-700 text-sm mt-0.5">
                          {scannedBottle
                            ? `${scannedBottle.currentVolume} ${scannedBottle.unit}`
                            : `${getChemicalTotalStock(scannedChemical.id).total} ${scannedChemical.primaryUnit}`}
                        </div>
                      </div>

                      <div className="p-2 bg-white rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-slate-500 font-medium">Vị trí</span>
                        <div className="font-bold text-slate-800 text-xs mt-0.5 truncate" title={scannedBottle?.location?.cabinet || scannedChemical.storageLocation.cabinet}>
                          {scannedBottle?.location?.cabinet || scannedChemical.storageLocation.cabinet}
                        </div>
                      </div>

                      <div className="p-2 bg-white rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-slate-500 font-medium">
                          {scannedBottle ? 'Hạn sử dụng' : 'Trạng thái kho'}
                        </span>
                        <div className="font-bold font-mono text-slate-800 text-xs mt-0.5">
                          {scannedBottle ? scannedBottle.expiryDate : availableBottlesForChem.length > 0 ? 'Còn hàng' : 'Hết hàng'}
                        </div>
                      </div>
                    </div>

                    {/* Expiry / Archived Warning Banners */}
                    {isBottleExpired && (
                      <div className="p-3 bg-rose-100 text-rose-900 rounded-xl text-xs font-bold flex items-center gap-2">
                        <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>🔴 Hóa chất đã hết hạn – không được phép sử dụng.</span>
                      </div>
                    )}

                    {isBottleArchived && (
                      <div className="p-3 bg-amber-100 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-2">
                        <Archive className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>⚠ Chai này đã được lưu trữ (ARCHIVED). Quản lý cần khôi phục trước khi sử dụng.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* MODE B: MANUAL SELECTION WORKFLOW (Requirement 25) */}
          {/* ======================================================== */}
          {selectionMode === 'MANUAL' && (
            <div className="space-y-4">
              {/* Chemical Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  1. Chọn Hóa chất <span className="text-rose-500">*</span>
                </label>
                <select
                  value={chemicalId}
                  onChange={(e) => {
                    setChemicalId(e.target.value);
                    const c = chemicals.find((x) => x.id === e.target.value);
                    if (c) {
                      setUnit(c.primaryUnit);
                      setBottleId('');
                    }
                  }}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 outline-hidden"
                >
                  {activeChemicals.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.casNumber})
                    </option>
                  ))}
                </select>

                {/* Cách 1: Tóm tắt trạng thái loại hóa chất */}
                {chemicalId && (
                  <div className="mt-2 p-2.5 bg-cyan-50/70 border border-cyan-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 font-medium">Trạng thái kho (Cách 1): </span>
                      <strong className="text-cyan-950 font-bold">
                        Còn {availableBottlesForChem.length} chai
                      </strong>
                      <span className="text-slate-500"> · Tổng tồn: </span>
                      <strong className="text-slate-900 font-mono">
                        {getChemicalTotalStock(chemicalId).total} {unit}
                      </strong>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      availableBottlesForChem.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {availableBottlesForChem.length > 0 ? '✓ Đang còn hàng' : '✕ Hết hàng'}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottle Picker */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    2. Chọn chai cụ thể
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-cyan-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSelectBottle}
                      onChange={(e) => setAutoSelectBottle(e.target.checked)}
                      className="rounded text-cyan-600"
                    />
                    <span>Tự động chọn chai theo FIFO</span>
                  </label>
                </div>

                {!autoSelectBottle && (
                  <select
                    value={bottleId}
                    onChange={(e) => {
                      setBottleId(e.target.value);
                      const b = bottles.find((x) => x.id === e.target.value);
                      if (b) setUnit(b.unit);
                    }}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 outline-hidden"
                  >
                    <option value="">-- Chọn chai cần trừ kho --</option>
                    {availableBottlesForChem.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bottleCode} - Còn: {b.currentVolume} {b.unit} ({b.status}) - Vị trí: {b.location.cabinet}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* COMMON INPUT FIELDS: QUANTITY, PREVIEW, PURPOSE */}
          {/* ======================================================== */}
          {(activeBottle || selectionMode === 'MANUAL' || activeChemical) && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              {/* Cách 1: Tùy chọn Dùng hết 1 chai (Hao trọn chai) */}
              <div
                className={`p-3.5 rounded-2xl border transition-all ${
                  useFullBottle
                    ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl text-white mt-0.5 transition-colors ${
                        useFullBottle ? 'bg-amber-600 shadow-xs' : 'bg-slate-400'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                        <span>Tùy chọn: Dùng hết 1 chai</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">
                          Cách 1: Không cần nhập số mL
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {useFullBottle
                          ? `Đang bật: Hệ thống tự động trừ trọn 1 chai (${targetBottleVolume} ${bottleUnit}) và ${emptyBottleAction === 'ARCHIVE' ? 'chuyển vào Kho Lưu Trữ (Archive)' : 'đánh dấu trạng thái chai là EMPTY'}.`
                          : `Bật tùy chọn này để dùng trọn 1 chai mà không cần phải cân đo hay nhập lượng dùng.`}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={useFullBottle}
                      onChange={(e) => setUseFullBottle(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {/* Tùy chọn xử lý chai sau khi dùng hết: EMPTY hoặc ARCHIVE */}
                {useFullBottle && (
                  <div className="mt-3 pt-3 border-t border-amber-200/70 space-y-2">
                    <label className="block text-[11px] font-bold text-amber-950 uppercase tracking-wider">
                      Xử lý trạng thái chai sau khi dùng:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEmptyBottleAction('EMPTY')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                          emptyBottleAction === 'EMPTY'
                            ? 'bg-white border-amber-500 ring-2 ring-amber-400/30 shadow-xs'
                            : 'bg-white/70 border-amber-200 hover:bg-white text-slate-600'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                            emptyBottleAction === 'EMPTY' ? 'border-amber-600 bg-amber-600' : 'border-slate-300'
                          }`}
                        >
                          {emptyBottleAction === 'EMPTY' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>Đánh dấu ĐÃ HẾT (EMPTY)</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-700 font-bold border border-slate-200">
                              Mặc định
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                            Trừ tồn kho về 0, chuyển trạng thái sang EMPTY và vẫn theo dõi trong danh mục chai.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEmptyBottleAction('ARCHIVE')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                          emptyBottleAction === 'ARCHIVE'
                            ? 'bg-white border-amber-500 ring-2 ring-amber-400/30 shadow-xs'
                            : 'bg-white/70 border-amber-200 hover:bg-white text-slate-600'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                            emptyBottleAction === 'ARCHIVE' ? 'border-amber-600 bg-amber-600' : 'border-slate-300'
                          }`}
                        >
                          {emptyBottleAction === 'ARCHIVE' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>Chuyển vào Kho Lưu Trữ (Archive)</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-100 text-purple-700 font-bold border border-purple-200">
                              Lưu trữ
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                            Đưa chai thẳng vào Archive Center để dọn sạch danh mục hoạt động.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity Input with Real-time Preview (Requirements 7 & 8) */}
              {!useFullBottle ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Số lượng sử dụng ({bottleUnit}) <span className="text-rose-500">*</span>
                    </label>
                    {activeBottle && (
                      <span className="text-[11px] font-mono text-slate-500">
                        Tồn hiện tại: <strong className="text-slate-800">{currentBottleVol} {bottleUnit}</strong>
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Nhập số lượng, vd: 100"
                      className="w-full pl-3.5 pr-14 py-2.5 text-base font-bold font-mono border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-600 outline-hidden"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-500">
                      {bottleUnit}
                    </span>
                  </div>

                  {/* Stock Deduction Preview (Requirement 8) */}
                  {activeBottle && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
                      <div className="p-2 bg-white rounded-xl border border-slate-200 text-center">
                        <span className="text-[10px] text-slate-400">Tồn trước</span>
                        <div className="font-bold font-mono text-slate-700 mt-0.5">
                          {currentBottleVol} {bottleUnit}
                        </div>
                      </div>

                      <div className="p-2 bg-white rounded-xl border border-slate-200 text-center">
                        <span className="text-[10px] text-slate-400">Sử dụng</span>
                        <div className="font-bold font-mono text-rose-600 mt-0.5">
                          -{parsedQty || 0} {bottleUnit}
                        </div>
                      </div>

                      <div
                        className={`p-2 rounded-xl border text-center transition-colors ${
                          isInsufficientStock
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}
                      >
                        <span className="text-[10px] opacity-75">Tồn sau</span>
                        <div className="font-bold font-mono mt-0.5">
                          {isInsufficientStock ? 'KHÔNG ĐỦ' : `${stockRemainingAfter} ${bottleUnit}`}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Full Bottle Usage Summary Preview */
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-amber-600" />
                      <span>Xác nhận trừ trọn 1 chai</span>
                    </span>
                    <span className="font-mono text-[11px] text-amber-800 font-bold">
                      Dung tích chai: {targetBottleVolume} {bottleUnit}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-amber-100 text-center">
                      <span className="text-[10px] text-slate-400">Số chai trước</span>
                      <div className="font-bold font-mono text-slate-700 mt-0.5">
                        {availableBottlesForChem.length || 1} chai
                      </div>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-amber-100 text-center">
                      <span className="text-[10px] text-slate-400">Sử dụng</span>
                      <div className="font-bold font-mono text-amber-700 mt-0.5">
                        -1 chai ({targetBottleVolume} {bottleUnit})
                      </div>
                    </div>

                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                      <span className="text-[10px] text-emerald-600">Số chai sau</span>
                      <div className="font-bold font-mono text-emerald-800 mt-0.5">
                        {Math.max(0, availableBottlesForChem.length - 1)} chai
                      </div>
                    </div>
                  </div>

                  {/* Trạng thái chai sau xử lý */}
                  <div className="p-2.5 bg-white rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Trạng thái chai sau ghi nhận:</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                        emptyBottleAction === 'ARCHIVE'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {emptyBottleAction === 'ARCHIVE'
                        ? '📦 ARCHIVED (Đã lưu trữ)'
                        : '⭕ EMPTY (0 mL - Đã hết)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Purpose & Project (Requirement 12) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mục đích sử dụng <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedPurpose}
                    onChange={(e) => setSelectedPurpose(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
                  >
                    {PRESET_PURPOSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  {selectedPurpose === 'Khác' && (
                    <input
                      type="text"
                      value={customPurpose}
                      onChange={(e) => setCustomPurpose(e.target.value)}
                      placeholder="Nhập mục đích cụ thể..."
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 mt-1.5"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Đề tài / Dự án nghiên cứu
                  </label>
                  <input
                    type="text"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="vd: IRP-2026, Đề tài NCKH..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ghi chú chi tiết
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ghi chú thao tác..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Người ghi nhận (Tự động)
                  </label>
                  <div className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100 text-slate-700 font-medium flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{currentUser.name} ({currentUser.email})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={hasBlocker}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                hasBlocker
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                  : useFullBottle
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{useFullBottle ? 'Xác nhận dùng hết 1 chai' : 'Xác nhận ghi sử dụng'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
