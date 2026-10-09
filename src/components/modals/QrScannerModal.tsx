import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  MultiFormatReader,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from '@zxing/library';
import { useLab } from '../../context/LabContext';
import { Bottle, Chemical } from '../../types';
import { parseScannedQrDetails, getBottleQrId } from '../../utils/qrCode';
import { getBottleStatusLabel, getDaysRemaining, calculateBottleStatus } from '../../utils/status';
import { convertUnit } from '../../utils/units';
import { bottleService } from '../../services/bottleService';
import { chemicalService } from '../../services/chemicalService';
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
  FlaskConical,
  PackagePlus,
  MapPin,
  Calendar,
  AlertTriangle,
  History,
  ShieldAlert,
  SlidersHorizontal,
  Plus,
  AlertOctagon,
  Check,
  ChevronDown,
  ChevronUp,
  Barcode,
  Sparkles,
  Info,
  Clock,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBottleIdentified: (bottle: Bottle) => void;
  onOpenRecordUsage?: (chemicalId: string, bottleId?: string) => void;
  onOpenStockIn?: (chemicalId?: string, preselectedBottleCode?: string) => void;
  onOpenAddChemical?: () => void;
}

type ModalView = 'SCANNING' | 'BOTTLE_DETAIL' | 'NOT_FOUND';

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
    createStockAdjustment,
    logQrScan,
    referenceDate,
    transactions,
    createApprovalRequest,
  } = useLab();

  // Core references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);
  const barcodeDetectorRef = useRef<any>(null);

  // Lock flag to prevent repeated duplicate scans
  const isLockedRef = useRef<boolean>(false);

  // Navigation states
  const [currentView, setCurrentView] = useState<ModalView>('SCANNING');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);

  // Scanning & Detection states
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [scannedCode, setScannedCode] = useState<string>('');
  const [matchedBottle, setMatchedBottle] = useState<Bottle | null>(null);
  const [matchedChemical, setMatchedChemical] = useState<Chemical | null>(null);

  // Collapsible manual entry fallback
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [manualCodeInput, setManualCodeInput] = useState<string>('');

  // Quick Action form toggles inside BOTTLE_DETAIL
  const [activeActionTab, setActiveActionTab] = useState<'NONE' | 'USAGE' | 'ADJUST' | 'HISTORY'>('NONE');

  // Inline Quick Usage form states
  const [useQuantity, setUseQuantity] = useState<string>('50');
  const [usePurpose, setUsePurpose] = useState<string>('Thí nghiệm kiểm nghiệm');
  const [useProject, setUseProject] = useState<string>('LAB-2026');
  const [useNotes, setUseNotes] = useState<string>('');
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageSuccess, setUsageSuccess] = useState<string | null>(null);
  const [isSubmittingUsage, setIsSubmittingUsage] = useState<boolean>(false);

  // Inline Quick Stock Adjust form states (Manager only)
  const [adjustQuantity, setAdjustQuantity] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('Đối soát kiểm kê thực tế định kỳ');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState<boolean>(false);

  // Initialize BarcodeDetector and ZXing readers
  useEffect(() => {
    try {
      zxingReaderRef.current = new MultiFormatReader();
    } catch (e) {
      console.warn('ZXing MultiFormatReader init notice:', e);
    }

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
            'codabar',
          ],
        });
      } catch (e) {
        console.warn('Native BarcodeDetector init notice:', e);
      }
    }
  }, []);

  // Short audio beep feedback & haptics (Warehouse scanner feel)
  const playScanFeedback = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Warehouse scanner dual-frequency crisp chirp
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch {
      // Ignore audio synthesis failure
    }

    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([70]);
      }
    } catch {
      // Ignore vibration error
    }
  }, []);

  // Camera Management
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

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setPermissionDenied(false);
    setCameraActive(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Trình duyệt không hỗ trợ truy cập máy ảnh trực tiếp.');
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
      console.warn('Camera access notice:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setCameraError('Bạn chưa cấp quyền máy ảnh trong trình duyệt. Vui lòng nhấn "Cho phép camera" bên dưới để quét mã.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Không tìm thấy thiết bị camera trên thiết bị này.');
      } else {
        setCameraError('Không thể khởi động camera. Vui lòng tải ảnh mã hoặc nhập mã dự phòng.');
      }
      setCameraActive(false);
    }
  }, [facingMode]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch toggle error:', err);
    }
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Reset & Re-open Modal
  useEffect(() => {
    if (isOpen) {
      isLockedRef.current = false;
      setCurrentView('SCANNING');
      setIsSearching(false);
      setScannedCode('');
      setMatchedBottle(null);
      setMatchedChemical(null);
      setActiveActionTab('NONE');
      setUsageError(null);
      setUsageSuccess(null);
      setAdjustError(null);
      setAdjustSuccess(null);
      startCamera();
    } else {
      isLockedRef.current = true;
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Main Automatic Code Resolver: Query Supabase & Local Database
  const resolveScannedCode = useCallback(
    async (rawCode: string) => {
      const trimmed = rawCode.trim();
      if (!trimmed) return;

      // Extract & normalize code (e.g. LABCHEM:BOTTLE:HEX-001 -> HEX-001)
      const parsed = parseScannedQrDetails(trimmed);
      const cleanIdent = (parsed.identifier || trimmed)
        .replace(/^(LABCHEM:BOTTLE:|LABCHEM:CHEMICAL:|BOTTLE:|CHEM:)/i, '')
        .trim();

      setScannedCode(cleanIdent);
      setIsSearching(true);

      // Play instant beep & vibrate
      playScanFeedback();

      try {
        // 1. Check local memory bottles first (instantaneous <10ms match)
        const targetLower = cleanIdent.toLowerCase();
        let targetBottle = bottles.find(
          (b) =>
            b.bottleCode.toLowerCase() === targetLower ||
            b.id.toLowerCase() === targetLower ||
            (b.qrId && b.qrId.toLowerCase() === targetLower) ||
            (b.barcode && b.barcode.toLowerCase() === targetLower) ||
            getBottleQrId(b.bottleCode).toLowerCase() === targetLower ||
            b.bottleCode.toLowerCase() === `lab-${targetLower}` ||
            (targetLower.startsWith('lab-') && b.bottleCode.toLowerCase() === targetLower.replace(/^lab-/i, ''))
        );

        let targetChem: Chemical | null = null;

        // 2. If not found in local memory or for live Supabase accuracy: query Supabase directly
        if (!targetBottle) {
          const { data: dbBottle } = await bottleService.findByQrOrCode(cleanIdent);
          if (dbBottle) {
            targetBottle = dbBottle;
          }
        }

        // 3. If Bottle Found -> Retrieve chemical record
        if (targetBottle) {
          targetChem = chemicals.find((c) => c.id === targetBottle?.chemicalId) || null;

          if (!targetChem && targetBottle.chemicalId) {
            const { data: dbChem } = await chemicalService.fetchById(targetBottle.chemicalId);
            if (dbChem) {
              targetChem = dbChem;
            }
          }

          // Pre-populate forms
          setMatchedBottle(targetBottle);
          setMatchedChemical(targetChem);
          setAdjustQuantity(String(targetBottle.currentVolume));

          // Log scan in database & history
          logQrScan({
            qrId: targetBottle.qrId || getBottleQrId(targetBottle.bottleCode),
            bottleId: targetBottle.id,
            bottleCode: targetBottle.bottleCode,
            chemicalId: targetBottle.chemicalId,
            chemicalName: targetChem?.name || 'Hóa chất',
            actionTaken: 'VIEW',
          });

          // Small 250ms HUD transition for smooth warehouse scanner feel
          setTimeout(() => {
            setIsSearching(false);
            setCurrentView('BOTTLE_DETAIL');
            stopCamera();
          }, 250);

          return;
        }

        // 4. Check if code matches Chemical / Catalog Number / Barcode (Cách 1)
        const chemMatch = chemicals.find(
          (c) =>
            c.code.toLowerCase() === targetLower ||
            c.id.toLowerCase() === targetLower ||
            c.casNumber.toLowerCase() === targetLower ||
            (c.catalogNumber && c.catalogNumber.toLowerCase() === targetLower) ||
            c.name.toLowerCase() === targetLower ||
            c.englishName.toLowerCase() === targetLower
        );

        if (chemMatch) {
          const chemBottles = bottles.filter(
            (b) => b.chemicalId === chemMatch.id && b.status !== 'ARCHIVED' && b.status !== 'DISPOSED' && b.currentVolume > 0
          );
          const firstBottle = chemBottles[0] || null;

          setMatchedChemical(chemMatch);
          setMatchedBottle(firstBottle);
          if (firstBottle) {
            setAdjustQuantity(String(firstBottle.currentVolume));
          }

          logQrScan({
            qrId: cleanIdent,
            bottleId: firstBottle?.id,
            bottleCode: firstBottle?.bottleCode || chemMatch.code,
            chemicalId: chemMatch.id,
            chemicalName: chemMatch.name,
            actionTaken: 'VIEW',
          });

          setTimeout(() => {
            setIsSearching(false);
            setCurrentView('BOTTLE_DETAIL');
            stopCamera();
          }, 250);
          return;
        }

        // 5. Bottle & Chemical NOT Found in Database -> Requirement 4
        setTimeout(() => {
          setIsSearching(false);
          setMatchedBottle(null);
          setMatchedChemical(null);
          setCurrentView('NOT_FOUND');
          stopCamera();
        }, 250);
      } catch (err) {
        console.error('Error resolving bottle code:', err);
        setIsSearching(false);
        setCurrentView('NOT_FOUND');
        stopCamera();
      }
    },
    [bottles, chemicals, logQrScan, playScanFeedback, stopCamera]
  );

  // Handler triggered when a code is identified in video frame
  const handleCodeDetected = useCallback(
    (codeText: string) => {
      if (isLockedRef.current) return;
      isLockedRef.current = true; // Lock scanning to avoid repeated scans
      resolveScannedCode(codeText);
    },
    [resolveScannedCode]
  );

  // Continuous Camera Scanning Loop (QR + 1D Barcode)
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !canvasRef.current || currentView !== 'SCANNING') {
      return;
    }

    let isSubscribed = true;

    const scanFrame = async () => {
      if (!isSubscribed || isLockedRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Tier 1: Hardware-Accelerated BarcodeDetector (QR & 1D Barcodes: Code 128, Code 39, EAN, UPC)
          if (barcodeDetectorRef.current) {
            try {
              const barcodes = await barcodeDetectorRef.current.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleCodeDetected(barcodes[0].rawValue);
                return;
              }
            } catch {
              // Ignore native detector frame error
            }
          }

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Tier 2: jsQR (Fastest JavaScript QR Decoder)
          try {
            const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });
            if (qrResult && qrResult.data) {
              handleCodeDetected(qrResult.data);
              return;
            }
          } catch {
            // Ignore jsQR frame error
          }

          // Tier 3: ZXing MultiFormatReader (Cross-platform 1D Barcode decoder fallback)
          if (zxingReaderRef.current) {
            try {
              const luminanceSource = new RGBLuminanceSource(
                imageData.data,
                imageData.width,
                imageData.height
              );
              const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
              const zxingResult = zxingReaderRef.current.decode(binaryBitmap);
              if (zxingResult && zxingResult.getText()) {
                handleCodeDetected(zxingResult.getText());
                return;
              }
            } catch {
              // NotFoundException is standard on frames without codes
            }
          }
        }
      }

      if (isSubscribed && !isLockedRef.current) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isSubscribed = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraActive, currentView, handleCodeDetected]);

  // Restart Scanning (Reset to Camera mode cleanly)
  const handleRescan = () => {
    isLockedRef.current = false;
    setScannedCode('');
    setMatchedBottle(null);
    setMatchedChemical(null);
    setActiveActionTab('NONE');
    setUsageError(null);
    setUsageSuccess(null);
    setAdjustError(null);
    setAdjustSuccess(null);
    setCurrentView('SCANNING');
    startCamera();
  };

  // Image Upload Fallback Decoder
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        // 1. Try BarcodeDetector
        if (barcodeDetectorRef.current) {
          try {
            const detected = await barcodeDetectorRef.current.detect(img);
            if (detected && detected.length > 0 && detected[0].rawValue) {
              handleCodeDetected(detected[0].rawValue);
              return;
            }
          } catch {}
        }

        // 2. Try jsQR
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (qr && qr.data) {
          handleCodeDetected(qr.data);
          return;
        }

        // 3. Try ZXing
        if (zxingReaderRef.current) {
          try {
            const lum = new RGBLuminanceSource(imageData.data, imageData.width, imageData.height);
            const bmp = new BinaryBitmap(new HybridBinarizer(lum));
            const zx = zxingReaderRef.current.decode(bmp);
            if (zx && zx.getText()) {
              handleCodeDetected(zx.getText());
              return;
            }
          } catch {}
        }

        setCameraError(`Không tìm thấy mã QR hoặc Barcode nào trong tệp "${file.name}".`);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Manual code submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    handleCodeDetected(manualCodeInput.trim());
  };

  // Execute Quick Usage directly from card
  const handleExecuteQuickUsage = async () => {
    if (!matchedBottle || !matchedChemical) return;
    setUsageError(null);
    setUsageSuccess(null);

    const qty = parseFloat(useQuantity);
    if (isNaN(qty) || qty <= 0) {
      setUsageError('Số lượng sử dụng phải lớn hơn 0.');
      return;
    }

    if (qty > matchedBottle.currentVolume + 0.0001) {
      setUsageError(
        `Không đủ tồn kho! Chai ${matchedBottle.bottleCode} chỉ còn ${matchedBottle.currentVolume} ${matchedBottle.unit}.`
      );
      return;
    }

    // Check permissions
    const canUse = isManager || currentUser.permissions?.recordUsage !== false;
    if (!canUse) {
      setUsageError('Bạn chưa được cấp quyền ghi sử dụng hóa chất.');
      return;
    }

    // Limit checks
    if (!isManager && currentUser.limits?.maxUsagePerTransaction) {
      const inMl = convertUnit(qty, matchedBottle.unit, 'mL') ?? qty;
      if (inMl > currentUser.limits.maxUsagePerTransaction) {
        setUsageError(
          `Vượt định mức cho phép (${currentUser.limits.maxUsagePerTransaction} mL/lần). Đã chuyển sang phê duyệt quản lý.`
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
          limitValue: currentUser.limits.maxUsagePerTransaction,
          requestedQuantity: inMl,
          unit: matchedBottle.unit,
          reason: `Quét QR chai: ${usePurpose} (${useProject})`,
        });
        return;
      }
    }

    setIsSubmittingUsage(true);
    try {
      await recordUsage({
        chemicalId: matchedBottle.chemicalId,
        bottleId: matchedBottle.id,
        quantity: qty,
        unit: matchedBottle.unit,
        date: new Date().toISOString().split('T')[0],
        purpose: usePurpose,
        project: useProject,
        notes: useNotes ? `[Quét QR Thao Tác Nhanh] ${useNotes}` : '[Quét QR Thao Tác Nhanh]',
      });

      const updatedRemaining = Math.max(0, matchedBottle.currentVolume - qty);
      setMatchedBottle({
        ...matchedBottle,
        currentVolume: updatedRemaining,
        status: updatedRemaining === 0 ? 'EMPTY' : 'IN_USE',
      });

      setUsageSuccess(
        `Đã xuất kho thành công -${qty} ${matchedBottle.unit} từ chai ${matchedBottle.bottleCode}. Tồn mới: ${updatedRemaining} ${matchedBottle.unit}.`
      );

      setTimeout(() => {
        setActiveActionTab('NONE');
        setUsageSuccess(null);
      }, 2500);
    } catch (err: any) {
      setUsageError(err.message || 'Không thể thực hiện xuất kho.');
    } finally {
      setIsSubmittingUsage(false);
    }
  };

  // Execute Quick Use Full Bottle (Cách 1: Trừ trọn 1 chai)
  const handleExecuteQuickUseFullBottle = async () => {
    if (!matchedChemical) return;
    setUsageError(null);
    setUsageSuccess(null);
    setIsSubmittingUsage(true);

    try {
      const res = recordUsage({
        chemicalId: matchedChemical.id,
        bottleId: matchedBottle?.id,
        useFullBottle: true,
        date: new Date().toISOString().split('T')[0],
        purpose: 'Dùng hết 1 chai',
        notes: '[Cách 1] Dùng hết 1 chai',
        source: 'QR_SCAN',
      });

      if (!res.success) {
        setUsageError(res.message);
      } else {
        setUsageSuccess(res.message);
        if (matchedBottle) {
          setMatchedBottle({
            ...matchedBottle,
            currentVolume: 0,
            status: 'EMPTY',
          });
        }
        setTimeout(() => {
          setActiveActionTab('NONE');
          setUsageSuccess(null);
        }, 2500);
      }
    } catch (err: any) {
      setUsageError(err.message || 'Lỗi khi ghi nhận dùng hết chai');
    } finally {
      setIsSubmittingUsage(false);
    }
  };

  // Execute Quick Stock Adjust (Manager only)
  const handleExecuteQuickAdjust = async () => {
    if (!matchedBottle || !isManager) return;
    setAdjustError(null);
    setAdjustSuccess(null);

    const newQty = parseFloat(adjustQuantity);
    if (isNaN(newQty) || newQty < 0) {
      setAdjustError('Số lượng tồn thực tế phải là số >= 0.');
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const diff = newQty - matchedBottle.currentVolume;
      createStockAdjustment({
        chemicalId: matchedBottle.chemicalId,
        bottleId: matchedBottle.id,
        adjustmentAmount: diff,
        unit: matchedBottle.unit,
        reason: adjustReason,
      });

      setMatchedBottle({
        ...matchedBottle,
        currentVolume: newQty,
        status: newQty === 0 ? 'EMPTY' : matchedBottle.status,
      });

      setAdjustSuccess(
        `Đã điều chỉnh tồn chai ${matchedBottle.bottleCode} về ${newQty} ${matchedBottle.unit} thành công!`
      );

      setTimeout(() => {
        setActiveActionTab('NONE');
        setAdjustSuccess(null);
      }, 2500);
    } catch (err: any) {
      setAdjustError(err.message || 'Lỗi khi điều chỉnh tồn kho.');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  if (!isOpen) return null;

  // Bottle status derivations
  const bottleStatus = matchedBottle
    ? calculateBottleStatus(
        matchedBottle.currentVolume,
        matchedBottle.initialVolume,
        matchedBottle.expiryDate,
        referenceDate
      )
    : 'FULL';

  const isExpired = bottleStatus === 'EXPIRED';
  const isEmpty = matchedBottle ? matchedBottle.currentVolume <= 0 || matchedBottle.status === 'EMPTY' : false;
  const daysLeft = matchedBottle ? getDaysRemaining(matchedBottle.expiryDate, referenceDate) : 0;

  // Filter transactions for this specific bottle
  const bottleTxs = matchedBottle
    ? transactions.filter((t) => t.bottleId === matchedBottle.id || t.bottleCode === matchedBottle.bottleCode)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Cổng Thao Tác Nhanh Bằng QR</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  AUTO SCANNER
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Tự động nhận diện QR & Barcode 1D → Tra cứu và mở chai hóa chất tức thì
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {currentView !== 'SCANNING' && (
              <button
                type="button"
                onClick={handleRescan}
                className="px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Quét chai khác</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: LIVE CAMERA AUTO-SCANNER                                          */}
        {/* ========================================================================= */}
        {currentView === 'SCANNING' && (
          <div className="flex flex-col flex-1 overflow-y-auto">
            {/* Camera Viewfinder */}
            <div className="relative aspect-4/3 sm:aspect-16/10 bg-black overflow-hidden flex items-center justify-center shrink-0">
              <canvas ref={canvasRef} className="hidden" />

              <video
                ref={videoRef}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />

              {/* State: Camera Disabled or Permission Denied */}
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 z-10">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 shadow-inner">
                    <Camera className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    {permissionDenied ? 'Yêu cầu quyền truy cập camera' : cameraError ? 'Không thể mở camera' : 'Đang bật camera tự động...'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-sm leading-relaxed">
                    {permissionDenied
                      ? 'Vui lòng nhấn "Cho phép camera" bên dưới để hệ thống tự động nhận diện mã chai hóa chất.'
                      : cameraError || 'Đang kết nối ống kính camera...'}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Cho phép camera / Thử lại</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 text-xs font-semibold text-cyan-300 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải ảnh mã từ máy</span>
                    </button>
                  </div>
                </div>
              )}

              {/* State: Active HUD Reticle & Laser Sweep */}
              {cameraActive && !isSearching && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="relative w-60 h-60 sm:w-68 sm:h-68 rounded-2xl border-2 border-cyan-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] flex items-center justify-center overflow-hidden">
                    {/* Targeting Brackets */}
                    <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                    <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                    <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                    <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />

                    {/* Animated Laser Scanning Beam */}
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_14px_#22d3ee] animate-[bounce_2s_ease-in-out_infinite]" />

                    {/* Center Helper Text */}
                    <div className="text-[10px] font-mono font-medium text-cyan-300/90 bg-slate-950/80 px-2.5 py-1 rounded-full border border-cyan-500/30 backdrop-blur-xs flex items-center gap-1.5">
                      <Barcode className="w-3 h-3 text-cyan-400" />
                      <span>Căn mã QR hoặc Barcode 1D vào khung</span>
                    </div>
                  </div>
                </div>
              )}

              {/* State: HUD Brief Loading (Requirement 3) */}
              {isSearching && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xs z-30 animate-in fade-in">
                  <div className="w-16 h-16 rounded-3xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 mb-3 animate-pulse shadow-[0_0_25px_rgba(6,182,212,0.4)]">
                    <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    Đang tìm chai hóa chất...
                  </h3>
                  <div className="text-xs font-mono text-cyan-300 mt-1 flex items-center gap-1.5">
                    <span>Mã:</span>
                    <strong className="px-2 py-0.5 bg-cyan-950 border border-cyan-800 rounded font-bold">
                      {scannedCode}
                    </strong>
                  </div>
                </div>
              )}

              {/* Camera Action Pills */}
              {cameraActive && (
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between z-20 pointer-events-auto">
                  <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-700/60">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-slate-300">Đang quét tự động</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700/60">
                    {hasTorch && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          torchOn
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                        }`}
                        title="Bật/Tắt Flash"
                      >
                        <Flashlight className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={toggleCameraFacing}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Đổi camera"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Tải ảnh QR/Barcode từ máy"
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

            {/* Bottom Guidance & Collapsible Manual Fallback */}
            <div className="p-4 sm:p-5 space-y-3 bg-slate-900 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Đưa mã QR hoặc Barcode trên chai vào khung camera để nhận diện ngay.</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <span>{showManualInput ? 'Ẩn nhập mã' : 'Nhập mã thủ công'}</span>
                  {showManualInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Collapsed manual input fallback */}
              {showManualInput && (
                <form
                  onSubmit={handleManualSubmit}
                  className="pt-2 border-t border-slate-800 animate-in fade-in space-y-2"
                >
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Nhập mã chai / QR / Barcode thủ công (Dự phòng)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={manualCodeInput}
                        onChange={(e) => setManualCodeInput(e.target.value)}
                        placeholder="vd: HEX-001, ACN-001, LABCHEM:BOTTLE:HEX-001..."
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400 font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs"
                    >
                      Tìm chai
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: BOTTLE DETAIL CARD (AUTO-OPENED UPON SUCCESSFUL DETECTION)         */}
        {/* ========================================================================= */}
        {currentView === 'BOTTLE_DETAIL' && matchedBottle && (
          <div className="p-5 sm:p-6 space-y-5 flex-1 overflow-y-auto bg-slate-900 text-slate-100">
            {/* Top Recognized Header Banner */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-1.5">
                    <span>ĐÃ NHẬN DIỆN CHAI HÓA CHẤT</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <h3 className="text-base font-bold text-white truncate mt-0.5">
                    {matchedChemical?.name || 'Chai hóa chất'}
                  </h3>
                  <div className="text-xs text-slate-300 font-mono flex items-center gap-2 mt-0.5">
                    <span>
                      Mã chai: <strong className="text-emerald-300">{matchedBottle.bottleCode}</strong>
                    </span>
                    <span>·</span>
                    <span>Số lô: <strong className="text-slate-200">{matchedBottle.lotNumber || 'N/A'}</strong></span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border ${
                    isExpired
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : isEmpty
                      ? 'bg-slate-700/50 text-slate-300 border-slate-600'
                      : 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30'
                  }`}
                >
                  {getBottleStatusLabel(matchedBottle.status).text}
                </span>
              </div>
            </div>

            {/* Warnings: Expired or Empty */}
            {isExpired && (
              <div className="p-3.5 bg-rose-500/20 border border-rose-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-rose-200 animate-in fade-in">
                <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-300">⚠ CHAI ĐÃ HẾT HẠN SỬ DỤNG!</div>
                  <div className="mt-0.5 text-rose-200/90 leading-relaxed">
                    Chai đã quá hạn vào <strong>{matchedBottle.expiryDate}</strong>. Không được sử dụng trong các thí nghiệm phân tích.
                  </div>
                </div>
              </div>
            )}

            {isEmpty && (
              <div className="p-3.5 bg-slate-800 border border-slate-700 rounded-2xl flex items-start gap-2.5 text-xs text-slate-300 animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-200">CHAI ĐÃ HẾT DUNG TÍCH (0 {matchedBottle.unit})</div>
                  <div className="mt-0.5 text-slate-400">
                    Vui lòng tiến hành Nhập kho thêm chai mới hoặc hủy bỏ chai rỗng.
                  </div>
                </div>
              </div>
            )}

            {/* Comprehensive Information Grid (Requirement 3) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Box 1: Quantity */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <div className="text-[10px] text-slate-400 font-medium">Hiện có trong chai</div>
                <div className="text-base font-bold font-mono text-cyan-300 mt-1">
                  {matchedBottle.currentVolume} / {matchedBottle.initialVolume} {matchedBottle.unit}
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      matchedBottle.currentVolume / matchedBottle.initialVolume > 0.5
                        ? 'bg-cyan-400'
                        : matchedBottle.currentVolume / matchedBottle.initialVolume > 0.2
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                    style={{
                      width: `${Math.min(100, (matchedBottle.currentVolume / matchedBottle.initialVolume) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Box 2: Location */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <div className="text-[10px] text-slate-400 font-medium">Vị trí lưu trữ</div>
                <div className="text-xs font-bold text-white mt-1 flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{matchedBottle.location?.cabinet || 'Tủ C1'}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {matchedBottle.location?.shelf || 'Kệ 1'} · {matchedBottle.location?.room || 'Phòng Lab'}
                </div>
              </div>

              {/* Box 3: Expiry Date */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <div className="text-[10px] text-slate-400 font-medium">Hạn sử dụng</div>
                <div className="text-xs font-bold font-mono mt-1 text-white flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>{matchedBottle.expiryDate}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {daysLeft > 0 ? `Còn ${daysLeft} ngày` : 'Đã hết hạn'}
                </div>
              </div>

              {/* Box 4: CAS & Grade */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <div className="text-[10px] text-slate-400 font-medium">CAS & Tinh khiết</div>
                <div className="text-xs font-mono font-bold text-white mt-1 truncate">
                  {matchedChemical?.casNumber || 'N/A'}
                </div>
                <div className="text-[10px] text-cyan-300 mt-0.5 truncate">
                  {matchedChemical?.grade || 'AR Grade'} · {matchedChemical?.manufacturer || 'Standard'}
                </div>
              </div>
            </div>

            {/* Additional Details: Manufacturer & Safety Info */}
            <div className="p-3.5 bg-slate-800/50 rounded-2xl border border-slate-700/50 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
                <span>
                  Nhà sản xuất: <strong className="text-white">{matchedChemical?.manufacturer || 'Lab Standard'}</strong>
                </span>
                <span>
                  Ngày nhập: <strong className="text-white">{matchedBottle.receivedDate || '2026-08-01'}</strong>
                  {matchedBottle.openedDate && (
                    <> · Mở nắp: <strong className="text-white">{matchedBottle.openedDate}</strong></>
                  )}
                </span>
              </div>

              {/* Safety pictograms & hazard statement */}
              {matchedChemical?.safetyInfo?.ghsPictograms && matchedChemical.safetyInfo.ghsPictograms.length > 0 && (
                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>An toàn hóa chất:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {matchedChemical.safetyInfo.ghsPictograms.map((ghs) => (
                      <span
                        key={ghs}
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      >
                        {ghs}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* SUB-FORM 1: Quick Usage Form (Xuất kho / Ghi sử dụng)                     */}
            {/* ========================================================================= */}
            {activeActionTab === 'USAGE' && (
              <div className="p-4 bg-slate-800/90 border border-cyan-500/40 rounded-2xl space-y-3.5 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wide">
                      Ghi Sử Dụng Nhanh Từ Chai {matchedBottle.bottleCode}
                    </span>
                  </div>
                  <span className="text-[11px] text-cyan-300 font-mono">
                    {currentUser.name} ({currentUser.role})
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
                      Số lượng dùng ({matchedBottle.unit}) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={matchedBottle.currentVolume}
                      value={useQuantity}
                      onChange={(e) => setUseQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-cyan-400 outline-hidden"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">
                      Còn lại: <strong className="text-white">{matchedBottle.currentVolume} {matchedBottle.unit}</strong>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Mục đích thí nghiệm
                    </label>
                    <input
                      type="text"
                      value={usePurpose}
                      onChange={(e) => setUsePurpose(e.target.value)}
                      placeholder="Chiết mẫu, phân tích GC-MS..."
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
                    onClick={() => setActiveActionTab('NONE')}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingUsage}
                    onClick={handleExecuteQuickUsage}
                    className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSubmittingUsage ? 'Đang trừ kho...' : 'Xác nhận trừ kho'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* SUB-FORM 2: Quick Adjust Stock Form (Manager Only)                        */}
            {/* ========================================================================= */}
            {activeActionTab === 'ADJUST' && isManager && (
              <div className="p-4 bg-slate-800/90 border border-amber-500/40 rounded-2xl space-y-3.5 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wide">
                      Điều Chỉnh Tồn Kho Chai {matchedBottle.bottleCode} (Quản lý)
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-300 font-mono">Quyền: MANAGER</span>
                </div>

                {adjustSuccess && (
                  <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{adjustSuccess}</span>
                  </div>
                )}

                {adjustError && (
                  <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{adjustError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Số lượng tồn thực tế ({matchedBottle.unit}) <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-amber-400 outline-hidden"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">
                      Hiện tại trên hệ thống: <strong className="text-white">{matchedBottle.currentVolume} {matchedBottle.unit}</strong>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Lý do điều chỉnh <span className="text-amber-400">*</span>
                    </label>
                    <select
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-400 outline-hidden"
                    >
                      <option value="Đối soát kiểm kê thực tế định kỳ">Đối soát kiểm kê thực tế định kỳ</option>
                      <option value="Bay hơi tự nhiên theo thời gian">Bay hơi tự nhiên theo thời gian</option>
                      <option value="Hao hụt mẫu trong thao tác">Hao hụt mẫu trong thao tác</option>
                      <option value="Đổ vỡ / Tràn dung môi">Đổ vỡ / Tràn dung môi</option>
                      <option value="Cân chỉnh sai số ban đầu">Cân chỉnh sai số ban đầu</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Ghi chú đối soát kiểm kê
                    </label>
                    <input
                      type="text"
                      value={adjustNotes}
                      onChange={(e) => setAdjustNotes(e.target.value)}
                      placeholder="Ghi chú chi tiết cho biên bản kiểm kê..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-400 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => setActiveActionTab('NONE')}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingAdjust}
                    onClick={handleExecuteQuickAdjust}
                    className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSubmittingAdjust ? 'Đang lưu...' : 'Lưu điều chỉnh tồn'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* SUB-FORM 3: Bottle Usage History Accordion                                */}
            {/* ========================================================================= */}
            {activeActionTab === 'HISTORY' && (
              <div className="p-4 bg-slate-800/90 border border-slate-700 rounded-2xl space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <History className="w-4 h-4 text-cyan-400" />
                    <span>Lịch sử sử dụng & điều chỉnh chai {matchedBottle.bottleCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveActionTab('NONE')}
                    className="text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>

                {bottleTxs.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-xs">
                    Chưa có lịch sử giao dịch nào được ghi nhận cho chai này.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {bottleTxs.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            {tx.type === 'ADJUSTMENT' ? '⚡ Điều chỉnh tồn' : '📉 Xuất sử dụng'}:{' '}
                            {tx.type === 'ADJUSTMENT' ? `${tx.previousStock} → ${tx.newStock}` : `-${tx.quantity}`}{' '}
                            {tx.unit}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Bởi: <strong>{tx.user}</strong> · {tx.date} ({tx.notes || tx.purpose || 'N/A'})
                          </div>
                        </div>
                        <div className="text-right font-mono text-[11px] text-cyan-300">
                          {tx.newStock} {tx.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Action Footer Buttons (Requirement 3: Nhập, Xuất, Điều chỉnh, Lịch sử, Đóng) */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setActiveActionTab(activeActionTab === 'HISTORY' ? 'NONE' : 'HISTORY')
                  }
                  className={`px-3 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border ${
                    activeActionTab === 'HISTORY'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Lịch sử ({bottleTxs.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onBottleIdentified(matchedBottle);
                    onClose();
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Mở hồ sơ chi tiết toàn màn hình"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Chi tiết hồ sơ</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* 1. Nhập kho thêm */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenStockIn) {
                      onOpenStockIn(matchedBottle.chemicalId, matchedBottle.bottleCode);
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <PackagePlus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Nhập kho</span>
                </button>

                {/* 2. Điều chỉnh số lượng (Chỉ Manager) */}
                {isManager && (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveActionTab(activeActionTab === 'ADJUST' ? 'NONE' : 'ADJUST')
                    }
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border ${
                      activeActionTab === 'ADJUST'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-amber-300 hover:bg-slate-700 border-slate-700'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Điều chỉnh số lượng</span>
                  </button>
                )}

                {/* 3. Xuất kho / Ghi sử dụng */}
                {!isExpired && !isEmpty && (
                  <>
                    {/* Nút 1-chạm: Dùng hết 1 chai (Cách 1) */}
                    <button
                      type="button"
                      disabled={isSubmittingUsage}
                      onClick={handleExecuteQuickUseFullBottle}
                      className="px-3.5 py-2 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Trừ trọn 1 chai khỏi kho mà không cần nhập số mL"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-800" />
                      <span>⚡ Dùng hết 1 chai</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveActionTab(activeActionTab === 'USAGE' ? 'NONE' : 'USAGE')
                      }
                      className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <FlaskConical className="w-4 h-4" />
                      <span>Nhập số mL dùng</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: NOT FOUND NOTIFICATION (Requirement 4)                            */}
        {/* ========================================================================= */}
        {currentView === 'NOT_FOUND' && (
          <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-4 flex-1 bg-slate-900 animate-in fade-in">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Không tìm thấy chai hóa chất
              </h3>
              <div className="mt-1 text-xs text-slate-400 font-mono">
                Mã: <strong className="text-amber-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">{scannedCode || 'N/A'}</strong>
              </div>
              <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
                Mã quét không trùng khớp với bất kỳ chai nào trong cơ sở dữ liệu Supabase. Bạn có thể quét lại hoặc thêm chai mới vào kho ngay.
              </p>
            </div>

            {/* Exactly 2 options as requested in Requirement 4 */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRescan}
                className="px-4 py-2.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>Quét lại</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenStockIn) {
                    onOpenStockIn(undefined, scannedCode);
                  }
                }}
                className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm chai mới</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
