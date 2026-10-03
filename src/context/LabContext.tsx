import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Chemical,
  Bottle,
  InventoryTransaction,
  PurchaseItem,
  User,
  UserRole,
  UserStatus,
  AuditLog,
  StockStatus,
  ExpiryStatus,
  ChemicalUnit,
  ChemicalGrade,
  ChemicalCategory,
  StockDiscrepancyReport,
  LabNotification,
  EmailAlertLog,
  Supplier,
  InventoryAuditSession,
  InventoryAuditItem,
  UserLimits,
  UserPermissions,
  ApprovalRequest,
  StorageCabinet,
  QrScanLog,
  DeletionLog,
  RestoreLog,
} from '../types';
import {
  DEMO_CHEMICALS,
  DEMO_BOTTLES,
  DEMO_TRANSACTIONS,
  DEMO_PURCHASE_LIST,
  DEMO_USERS,
  DEMO_SUPPLIERS,
} from '../data/demoData';
import { DEFAULT_STORAGE_CABINETS } from '../data/storageCabinets';
import { ParsedImportRow } from '../utils/excelImportExport';
import { convertUnit, areUnitsCompatible } from '../utils/units';
import { getBottleQrId, parseScannedQrText } from '../utils/qrCode';
import {
  calculateStockStatus,
  calculateExpiryStatus,
  calculateBottleStatus,
  calculateRecommendedPurchase,
} from '../utils/status';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { chemicalService, rowToChemical } from '../services/chemicalService';
import { bottleService, rowToBottle } from '../services/bottleService';
import { usageService, rowToUsageTransaction } from '../services/usageService';
import { authService } from '../services/authService';
import { auditService } from '../services/auditService';

const STORAGE_KEY = 'labchem_inventory_v1';
export const DEFAULT_MANAGER_EMAIL = 'buianhtra2021@gmail.com';

interface EmailSettings {
  autoEmailOnLowStock: boolean;
  managerEmail: string;
  notifyCriticalOnly: boolean;
  notifyOnDiscrepancy: boolean;
  notifyOnNewUser: boolean;
}

interface LabContextType {
  chemicals: Chemical[];
  bottles: Bottle[];
  transactions: InventoryTransaction[];
  purchaseItems: PurchaseItem[];
  auditLogs: AuditLog[];
  users: User[];
  currentUser: User;
  setCurrentUser: (user: User) => void;
  referenceDate: string;

  // Role permissions & Workflow
  isManager: boolean;
  canExportHistory: boolean;
  canManageUsers: boolean;
  pendingUsersCount: number;

  // Google OAuth / Authentication
  signInWithGoogle: (email: string, name?: string, picture?: string, googleId?: string) => {
    success: boolean;
    message: string;
    user?: User;
    isPending?: boolean;
  };
  signOut: () => void;

  // User Management & Permissions (Manager Only)
  approveUser: (userId: string) => { success: boolean; message: string };
  rejectUser: (userId: string) => { success: boolean; message: string };
  deactivateUser: (userId: string) => { success: boolean; message: string };
  activateUser: (userId: string) => { success: boolean; message: string };
  changeUserRole: (userId: string, newRole: UserRole) => { success: boolean; message: string };
  addUser: (userData: Omit<User, 'id'>) => { success: boolean; message: string; user?: User };
  updateUser: (id: string, update: Partial<User>) => { success: boolean; message: string };
  changeUserDepartment: (userId: string, newDepartment: string) => { success: boolean; message: string };
  canManageTargetUser: (target: User) => { allowed: boolean; message: string };
  deleteUser: (id: string, reason?: string) => { success: boolean; message: string };
  deleteDeactivatedManager: (userId: string, reason?: string) => { success: boolean; message: string };
  restoreUser: (userId: string) => { success: boolean; message: string };
  updateUserLimits: (userId: string, limits: UserLimits) => { success: boolean; message: string };
  updateUserPermissions: (userId: string, permissions: UserPermissions) => { success: boolean; message: string };

  // Approval Requests
  approvalRequests: ApprovalRequest[];
  createApprovalRequest: (request: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'status'>) => { success: boolean; message: string; id?: string };
  resolveApprovalRequest: (id: string, action: 'APPROVE' | 'REJECT', resolutionNotes?: string) => { success: boolean; message: string };

  // Calculations
  getChemicalTotalStock: (chemicalId: string) => { total: number; unit: ChemicalUnit };
  getChemicalBottles: (chemicalId: string) => Bottle[];
  getChemicalStockStatus: (chemicalId: string) => StockStatus;
  getChemicalExpiryStatus: (chemicalId: string) => ExpiryStatus;

  // Actions
  recordUsage: (params: {
    chemicalId: string;
    bottleId?: string;
    autoSelectBottle?: boolean;
    quantity: number;
    unit: ChemicalUnit;
    date: string;
    project?: string;
    experiment?: string;
    purpose?: string;
    notes?: string;
    userId?: string;
    source?: 'QR_SCAN' | 'MANUAL';
  }) => {
    success: boolean;
    message: string;
    transactionIds?: string[];
    limitExceeded?: boolean;
    limitType?: string;
  };

  stockIn: (params: {
    chemicalId: string;
    bottleCode?: string;
    lotNumber: string;
    quantity: number;
    unit: ChemicalUnit;
    supplier?: string;
    purchaseDate?: string;
    expiryDate: string;
    price?: number;
    storageLocation?: { building: string; room: string; cabinet: string; shelf: string };
    notes?: string;
    existingBottleId?: string;
  }) => { success: boolean; message: string; bottleId?: string; limitExceeded?: boolean };

  // Reversal / Void transaction (Manager only)
  reverseTransaction: (transactionId: string, reason: string) => { success: boolean; message: string };

  // Discrepancy & Stock Adjustment (User reports, Manager resolves)
  discrepancyReports: StockDiscrepancyReport[];
  reportDiscrepancy: (params: {
    chemicalId: string;
    bottleId?: string;
    physicalQuantity: number;
    unit: ChemicalUnit;
    reason: string;
  }) => { success: boolean; message: string };
  resolveDiscrepancy: (
    reportId: string,
    action: 'ADJUST' | 'REJECT',
    adjustmentQuantity?: number,
    notes?: string
  ) => { success: boolean; message: string };
  createStockAdjustment: (params: {
    chemicalId: string;
    bottleId?: string;
    adjustmentAmount: number;
    unit: ChemicalUnit;
    reason: string;
  }) => { success: boolean; message: string };

  // Notifications & Email alerts
  notifications: LabNotification[];
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  unreadNotificationsCount: number;
  emailAlertLogs: EmailAlertLog[];
  emailSettings: EmailSettings;
  updateEmailSettings: (settings: Partial<EmailSettings>) => void;
  sendManualTestEmailAlert: (chemicalId?: string) => { success: boolean; message: string };

  // Master Chemical management & Lifecycle (Manager only - Mục 4, 7, 10, Soft Delete & Restore)
  addChemical: (chemical: Omit<Chemical, 'id'>) => { success: boolean; message: string; chemical?: Chemical };
  updateChemical: (id: string, chemical: Partial<Chemical>) => { success: boolean; message: string };
  archiveChemical: (id: string, reason?: string) => { success: boolean; message: string };
  restoreChemical: (id: string, reason?: string) => { success: boolean; message: string };
  deleteChemical: (id: string, reason?: string) => { success: boolean; message: string };

  // Deletion & Archive Management (Sections 24-44)
  deletionLogs: DeletionLog[];
  restoreLogs: RestoreLog[];
  qrScanLogs: QrScanLog[];
  logQrScan: (params: {
    qrId: string;
    chemicalId: string;
    chemicalName: string;
    bottleId?: string;
    bottleCode?: string;
    actionTaken?: 'VIEW' | 'RECORD_USAGE' | 'STOCK_IN' | 'RESTORE' | 'RELOCATE' | 'REPORT_ISSUE';
  }) => void;

  // Bottle management & Lifecycle (Manager only - Mục 3, 5, 8)
  updateBottle: (id: string, update: Partial<Bottle>) => { success: boolean; message: string };
  disposeBottle: (params: { bottleId: string; reason: string; disposalVolume?: number; notes?: string }) => { success: boolean; message: string };
  deleteBottle: (bottleId: string, reason: string) => { success: boolean; message: string };
  restoreBottle: (bottleId: string) => { success: boolean; message: string };
  stockAdjustment: (params: { bottleId: string; physicalQuantity: number; reason: string; notes?: string }) => { success: boolean; message: string };

  // Suppliers management (Mục 32)
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id'>) => { success: boolean; message: string };
  updateSupplier: (id: string, update: Partial<Supplier>) => { success: boolean; message: string };
  deleteSupplier: (id: string) => { success: boolean; message: string };

  // Inventory Audit (Kiểm kê kho - Mục 25)
  auditSessions: InventoryAuditSession[];
  startAuditSession: (notes?: string) => InventoryAuditSession;
  saveAuditItem: (sessionId: string, item: InventoryAuditItem) => void;
  completeAuditSession: (sessionId: string) => { success: boolean; message: string; adjustmentsCreated: number };

  updatePurchaseStatus: (id: string, status: 'PENDING' | 'ORDERED' | 'RECEIVED') => { success: boolean; message: string };
  addCustomPurchaseItem: (item: Omit<PurchaseItem, 'id'>) => { success: boolean; message: string };

  // Excel / CSV / Google Sheets Batch Import (Sections 66 - 79)
  importExcelChemicals: (
    parsedRows: ParsedImportRow[],
    duplicateHandling: 'SKIP' | 'UPDATE' | 'CANCEL'
  ) => { success: boolean; message: string; importedCount: number };

  // Storage Cabinets Catalog (Quản lý Danh mục Tủ lưu trữ)
  storageCabinets: StorageCabinet[];
  addStorageCabinet: (cabinet: Omit<StorageCabinet, 'id'>) => { success: boolean; message: string; cabinet?: StorageCabinet };
  updateStorageCabinet: (id: string, updates: Partial<StorageCabinet>) => { success: boolean; message: string };
  deleteStorageCabinet: (id: string) => { success: boolean; message: string };

  // Data management
  resetToDemoData: () => void;
  clearAllData: () => void;
  exportDatabaseJSON: () => string;
  importDatabaseJSON: (jsonStr: string) => { success: boolean; message: string };

  // Supabase Cloud Database & Realtime
  isSupabaseConfigured: boolean;
  isRealtimeActive: boolean;
  isSyncing: boolean;
  refreshFromSupabase: () => Promise<void>;
}

const LabContext = createContext<LabContextType | undefined>(undefined);

export const LabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const referenceDate = '2026-10-01';

  // 1. Users state
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_users`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((u: User) => {
            const demoMatch = DEMO_USERS.find((d) => d.id === u.id);
            const isUManager = u.role === 'MANAGER' || u.role === 'ADMIN';
            return {
              ...u,
              limits: u.limits || demoMatch?.limits || {
                maxUsagePerTransaction: isUManager ? null : 100,
                dailyUsageLimit: isUManager ? null : 500,
                dailyTransactionCount: isUManager ? null : 10,
                maxStockInQuantity: isUManager ? null : 5,
              },
              permissions: u.permissions || demoMatch?.permissions || {
                viewInventory: true,
                addChemical: isUManager,
                editChemical: isUManager,
                archiveChemical: isUManager,
                deleteChemical: isUManager,
                recordUsage: true,
                viewAllUsageHistory: isUManager,
                createStockIn: isUManager,
                adjustStock: isUManager,
                importExcel: isUManager,
                viewReports: true,
                manageUsers: isUManager,
              },
            };
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
    return DEMO_USERS;
  });

  // Current active user
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedId = localStorage.getItem(`${STORAGE_KEY}_current_user_id`);
    if (savedId) {
      const found = users.find((u) => u.id === savedId);
      if (found) return found;
    }
    // Default to first active manager (Bùi Anh Trà)
    const manager = users.find((u) => u.role === 'MANAGER' && u.status === 'ACTIVE');
    return manager || users[0] || DEMO_USERS[0];
  });

  // 2. Roles & Permissions derived values
  const isManager = currentUser.role === 'MANAGER' || currentUser.role === 'ADMIN';
  const canManageUsers = isManager && currentUser.status === 'ACTIVE';
  const canExportHistory = isManager && currentUser.status === 'ACTIVE';
  const pendingUsersCount = useMemo(() => users.filter((u) => u.status === 'PENDING').length, [users]);

  // Persist users & active user
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_users`, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_current_user_id`, currentUser.id);
  }, [currentUser]);

  // 3. Chemicals & Bottles state
  const [chemicals, setChemicals] = useState<Chemical[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_chemicals`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEMO_CHEMICALS;
  });

  const [bottles, setBottles] = useState<Bottle[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_bottles`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEMO_BOTTLES;
  });

  const [transactions, setTransactions] = useState<InventoryTransaction[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_transactions`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEMO_TRANSACTIONS;
  });

  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_purchase`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEMO_PURCHASE_LIST;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_audit`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'audit-init',
        timestamp: '2026-10-01T08:00:00.000Z',
        user: 'Hệ thống',
        action: 'Khởi tạo cơ sở dữ liệu LabChem',
        entityType: 'SETTINGS',
        entityId: 'SYSTEM',
        description: 'Tải bộ dữ liệu tiêu chuẩn phòng thí nghiệm Dược liệu & Chiết xuất với phân quyền Google OAuth và kiểm soát tự động.',
      },
    ];
  });

  // 4. Notifications & Email Alerts
  const [notifications, setNotifications] = useState<LabNotification[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_notifications`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'notif-pending-mai',
        timestamp: '2026-10-01T06:10:00Z',
        type: 'NEW_USER_PENDING',
        title: 'Tài khoản mới chờ phê duyệt',
        message: 'Lê Thị Mai (lethimai.pending@gmail.com) vừa đăng nhập Google lần đầu. Vui lòng phê duyệt để cấp quyền sử dụng.',
        targetRole: 'MANAGER',
        read: false,
        linkTab: 'users',
      },
      {
        id: 'notif-hexane-low',
        timestamp: '2026-10-01T07:45:00Z',
        type: 'LOW_STOCK',
        title: 'Cảnh báo tồn kho: n-Hexane 99%',
        message: 'Tồn kho n-Hexane 99% còn 400 mL (dưới mức tối thiểu 500 mL). Đã tự động tạo đề xuất mua 1,100 mL.',
        targetRole: 'MANAGER',
        read: false,
        linkTab: 'purchase',
      },
    ];
  });

  const [emailAlertLogs, setEmailAlertLogs] = useState<EmailAlertLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_email_logs`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'email-init-1',
        timestamp: '2026-10-01T07:45:10Z',
        toEmail: DEFAULT_MANAGER_EMAIL,
        recipientName: 'Bùi Anh Trà (Lab Manager)',
        subject: '[LabChem Cảnh Báo] Hóa chất "n-Hexane 99%" đã đạt mức cảnh báo tồn kho thấp!',
        chemicalId: 'chem-hexane',
        chemicalName: 'n-Hexane 99%',
        currentStock: 400,
        threshold: 500,
        unit: 'mL',
        status: 'SENT',
        contentSnippet: 'Kính gửi Quản lý phòng lab,\n\nHóa chất n-Hexane 99% (HEX-01, CAS: 110-54-3) hiện chỉ còn 400 mL, thấp hơn mức tối thiểu quy định (500 mL). Đề xuất đặt mua bổ sung: 1,100 mL từ nhà cung cấp Merck KGaA.',
        triggerType: 'CRITICAL_STOCK',
      },
    ];
  });

  const [emailSettings, setEmailSettings] = useState<EmailSettings>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_email_settings`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      autoEmailOnLowStock: true,
      managerEmail: DEFAULT_MANAGER_EMAIL,
      notifyCriticalOnly: false,
      notifyOnDiscrepancy: true,
      notifyOnNewUser: true,
    };
  });

  // 5. Stock Discrepancy Reports (Section 45)
  const [discrepancyReports, setDiscrepancyReports] = useState<StockDiscrepancyReport[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_discrepancies`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  // 5b. Approval Requests (Section 10 & 11: Member Limit Overrides)
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_approvals`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'req-001',
        userId: 'user-nguyen-a',
        userName: 'Nguyễn Văn A',
        userEmail: 'nguyenvana.lab@gmail.com',
        type: 'USAGE_LIMIT_EXCEEDED',
        chemicalId: 'chem-hexane',
        chemicalName: 'n-Hexane 99%',
        bottleId: 'bottle-hex-001',
        bottleCode: 'HEX-001',
        requestedQuantity: 250,
        unit: 'mL',
        limitValue: 100,
        reason: 'Cần trích ly phân đoạn lớn bình lắng 2L cho đề tài Dolichandrone',
        status: 'PENDING',
        requestedAt: '2026-10-01T08:15:00Z',
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_approvals`, JSON.stringify(approvalRequests));
  }, [approvalRequests]);

  // 6. Suppliers (Mục 32)
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_suppliers`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEMO_SUPPLIERS;
  });

  // 7. Inventory Audit Sessions (Mục 25)
  const [auditSessions, setAuditSessions] = useState<InventoryAuditSession[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_audit_sessions`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_suppliers`, JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_audit_sessions`, JSON.stringify(auditSessions));
  }, [auditSessions]);

  // 8. Storage Cabinets (Danh mục Tủ & Vị trí Lưu Trữ)
  const [storageCabinets, setStorageCabinets] = useState<StorageCabinet[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_cabinets`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_STORAGE_CABINETS;
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_cabinets`, JSON.stringify(storageCabinets));
  }, [storageCabinets]);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_chemicals`, JSON.stringify(chemicals));
  }, [chemicals]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_bottles`, JSON.stringify(bottles));
  }, [bottles]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_transactions`, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_purchase`, JSON.stringify(purchaseItems));
  }, [purchaseItems]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_audit`, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_notifications`, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_email_logs`, JSON.stringify(emailAlertLogs));
  }, [emailAlertLogs]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_email_settings`, JSON.stringify(emailSettings));
  }, [emailSettings]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_discrepancies`, JSON.stringify(discrepancyReports));
  }, [discrepancyReports]);

  // 9. Deletion Logs, Restore Logs & QR Scan Logs (Sections 24-44)
  const [deletionLogs, setDeletionLogs] = useState<DeletionLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_deletion_logs`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [restoreLogs, setRestoreLogs] = useState<RestoreLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_restore_logs`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [qrScanLogs, setQrScanLogs] = useState<QrScanLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_qr_scan_logs`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_deletion_logs`, JSON.stringify(deletionLogs));
  }, [deletionLogs]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_restore_logs`, JSON.stringify(restoreLogs));
  }, [restoreLogs]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_qr_scan_logs`, JSON.stringify(qrScanLogs));
  }, [qrScanLogs]);

  // 10. Supabase Cloud Database & Realtime Synchronization
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshFromSupabase = async () => {
    if (!isSupabaseConfigured()) return;
    setIsSyncing(true);
    try {
      const [chemRes, bottleRes, txRes, userRes, auditRes] = await Promise.all([
        chemicalService.fetchAll(),
        bottleService.fetchAll(),
        usageService.fetchUsageTransactions(),
        authService.fetchProfiles(),
        auditService.fetchAll(100),
      ]);

      if (chemRes.data && chemRes.data.length > 0) {
        setChemicals(chemRes.data);
      }
      if (bottleRes.data && bottleRes.data.length > 0) {
        setBottles(bottleRes.data);
      }
      if (txRes.data && txRes.data.length > 0) {
        setTransactions(txRes.data);
      }
      if (userRes.data && userRes.data.length > 0) {
        setUsers(userRes.data);
      }
      if (auditRes.data && auditRes.data.length > 0) {
        setAuditLogs(auditRes.data);
      }
    } catch (err) {
      console.warn('refreshFromSupabase error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsRealtimeActive(false);
      return;
    }

    refreshFromSupabase();

    const channel = supabase
      .channel('labchem-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bottles' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newBottle = rowToBottle(payload.new);
            setBottles((prev) => {
              const idx = prev.findIndex((b) => b.id === newBottle.id || b.bottleCode === newBottle.bottleCode);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = newBottle;
                return copy;
              }
              return [newBottle, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedBottle = rowToBottle(payload.new);
            setBottles((prev) =>
              prev.map((b) => (b.id === updatedBottle.id ? updatedBottle : b))
            );
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setBottles((prev) => prev.filter((b) => b.id !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chemicals' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newChem = rowToChemical(payload.new);
            setChemicals((prev) => {
              if (prev.some((c) => c.id === newChem.id)) return prev;
              return [newChem, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedChem = rowToChemical(payload.new);
            setChemicals((prev) =>
              prev.map((c) => (c.id === updatedChem.id ? updatedChem : c))
            );
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setChemicals((prev) => prev.filter((c) => c.id !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'usage_transactions' },
        (payload) => {
          const newTx = rowToUsageTransaction(payload.new);
          setTransactions((prev) => {
            if (prev.some((t) => t.id === newTx.id)) return prev;
            return [newTx, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            setUsers((prev) =>
              prev.map((u) => {
                if (u.id === row.id) {
                  return {
                    ...u,
                    name: row.full_name || u.name,
                    role: (row.role || u.role) as any,
                    status: (row.status || u.status) as any,
                    department: row.department || u.department,
                    limits: row.limits || u.limits,
                    permissions: row.permissions || u.permissions,
                  };
                }
                return u;
              })
            );
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const logQrScan = ({
    qrId,
    chemicalId,
    chemicalName,
    bottleId,
    bottleCode,
    actionTaken = 'VIEW',
  }: {
    qrId: string;
    chemicalId: string;
    chemicalName: string;
    bottleId?: string;
    bottleCode?: string;
    actionTaken?: 'VIEW' | 'RECORD_USAGE' | 'STOCK_IN' | 'RESTORE' | 'RELOCATE' | 'REPORT_ISSUE';
  }) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const newLog: QrScanLog = {
      id: `qr-scan-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      qrId,
      bottleId,
      bottleCode,
      chemicalId,
      chemicalName,
      userId: currentUser.id,
      userName: currentUser.name,
      scannedAt: new Date().toISOString(),
      actionTaken,
      deviceType: isMobile ? 'mobile' : 'desktop',
    };

    setQrScanLogs((prev) => [newLog, ...prev]);

    logAudit(
      'QUÉT MÃ QR',
      bottleId ? 'BOTTLE' : 'CHEMICAL',
      bottleId || chemicalId,
      `${currentUser.name} quét QR "${qrId}" cho ${bottleCode ? `Chai ${bottleCode} (${chemicalName})` : chemicalName}. Thao tác: ${actionTaken}`
    );
  };

  // Helper: Log audit action (Section 52: Timestamp, User, Action, Object, Before, After, Reason)
  const logAudit = (
    action: string,
    entityType: AuditLog['entityType'],
    entityId: string,
    description: string,
    previousData?: any,
    newData?: any
  ) => {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      user: currentUser ? currentUser.name : 'Hệ thống',
      action,
      entityType,
      entityId,
      description,
      previousData: previousData ? JSON.stringify(previousData) : undefined,
      newData: newData ? JSON.stringify(newData) : undefined,
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  // Helper: Dispatch automated email alert to manager on low stock
  const dispatchAutomatedEmailAlert = (
    chem: Chemical,
    newStock: number,
    threshold: number,
    triggerType: 'LOW_STOCK' | 'CRITICAL_STOCK'
  ) => {
    if (!emailSettings.autoEmailOnLowStock) return;
    if (emailSettings.notifyCriticalOnly && triggerType !== 'CRITICAL_STOCK') return;

    const emailId = `email-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const recommended = Math.max(0, chem.targetStock - newStock);
    const subject = `[LabChem Cảnh Báo] Hóa chất "${chem.name}" đã đạt mức cảnh báo tồn kho thấp!`;
    const snippet = `Kính gửi Quản lý phòng lab,\n\nHệ thống ghi nhận hóa chất ${chem.name} (Mã: ${chem.code}, CAS: ${chem.casNumber}) vừa đạt mức cảnh báo.\nTồn kho hiện tại: ${newStock} ${chem.primaryUnit} (Mức tối thiểu: ${chem.minimumStock} ${chem.primaryUnit}, Cảnh báo: ${chem.warningStock} ${chem.primaryUnit}).\nĐề xuất đặt mua bổ sung: ${recommended} ${chem.primaryUnit} từ nhà cung cấp ${chem.manufacturer}.\n\nVui lòng đăng nhập hệ thống LabChem để xem xét và duyệt đơn mua sắm.`;

    const newEmailLog: EmailAlertLog = {
      id: emailId,
      timestamp: new Date().toISOString(),
      toEmail: emailSettings.managerEmail,
      recipientName: 'Quản lý phòng thí nghiệm',
      subject,
      chemicalId: chem.id,
      chemicalName: chem.name,
      currentStock: newStock,
      threshold,
      unit: chem.primaryUnit,
      status: 'SENT',
      contentSnippet: snippet,
      triggerType,
    };

    setEmailAlertLogs((prev) => [newEmailLog, ...prev]);

    // Also push into manager in-app notifications
    const newNotif: LabNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
      type: triggerType,
      title: `[Cảnh báo tồn kho] ${chem.name} sắp hết!`,
      message: `Tồn kho còn ${newStock} ${chem.primaryUnit} (ngưỡng: ${threshold} ${chem.primaryUnit}). Đã tự động gửi email thông báo tới ${emailSettings.managerEmail}.`,
      targetRole: 'MANAGER',
      read: false,
      linkTab: 'purchase',
    };
    setNotifications((prev) => [newNotif, ...prev]);

    logAudit(
      'GỬI EMAIL CẢNH BÁO TỒN KHO TỰ ĐỘNG',
      'CHEMICAL',
      chem.id,
      `Đã tự động gửi email cảnh báo tồn kho thấp của "${chem.name}" (${newStock} ${chem.primaryUnit}) tới ${emailSettings.managerEmail}`
    );
  };

  // Helper: Calculate total physical stock for chemical in primary unit
  const getChemicalBottles = (chemicalId: string, includeArchived = false) => {
    return bottles.filter((b) => b.chemicalId === chemicalId && (includeArchived || b.status !== 'ARCHIVED'));
  };

  const getChemicalTotalStock = (chemicalId: string): { total: number; unit: ChemicalUnit } => {
    const chem = chemicals.find((c) => c.id === chemicalId);
    if (!chem || chem.status === 'ARCHIVED') return { total: 0, unit: chem?.primaryUnit || 'mL' };

    const chemBottles = bottles.filter(
      (b) => b.chemicalId === chemicalId && b.currentVolume > 0 && b.status !== 'ARCHIVED' && b.status !== 'DISPOSED'
    );
    let total = 0;
    for (const b of chemBottles) {
      const converted = convertUnit(b.currentVolume, b.unit, chem.primaryUnit);
      if (converted !== null) {
        total += converted;
      }
    }
    return {
      total: Math.round(total * 10000) / 10000,
      unit: chem.primaryUnit,
    };
  };

  const getChemicalStockStatus = (chemicalId: string): StockStatus => {
    const chem = chemicals.find((c) => c.id === chemicalId);
    if (!chem || chem.status === 'ARCHIVED') return 'NORMAL';
    const { total } = getChemicalTotalStock(chemicalId);
    return calculateStockStatus(total, chem.minimumStock, chem.warningStock);
  };

  const getChemicalExpiryStatus = (chemicalId: string): ExpiryStatus => {
    const chem = chemicals.find((c) => c.id === chemicalId);
    if (!chem || chem.status === 'ARCHIVED') return 'VALID';
    const chemBottles = bottles.filter(
      (b) => b.chemicalId === chemicalId && b.currentVolume > 0 && b.status !== 'ARCHIVED' && b.status !== 'DISPOSED'
    );
    if (chemBottles.length === 0) return 'VALID';
    const sorted = [...chemBottles].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    return calculateExpiryStatus(sorted[0].expiryDate, referenceDate);
  };

  // Helper: Synchronize purchase recommendation
  const syncPurchaseItemForChemical = (
    chem: Chemical,
    newTotalStock: number,
    currentPurchaseList: PurchaseItem[]
  ): PurchaseItem[] => {
    const priority =
      newTotalStock <= chem.minimumStock
        ? 'CRITICAL'
        : newTotalStock <= chem.warningStock
        ? 'LOW'
        : 'NORMAL';

    const existingIdx = currentPurchaseList.findIndex((p) => p.chemicalId === chem.id);
    const recommended = calculateRecommendedPurchase(newTotalStock, chem.targetStock, chem.warningStock);

    if (priority === 'NORMAL') {
      if (existingIdx >= 0 && currentPurchaseList[existingIdx].status === 'PENDING') {
        return currentPurchaseList.filter((p) => p.chemicalId !== chem.id);
      }
      return currentPurchaseList;
    }

    if (existingIdx >= 0) {
      const updated = [...currentPurchaseList];
      updated[existingIdx] = {
        ...updated[existingIdx],
        currentStock: newTotalStock,
        minimumStock: chem.minimumStock,
        targetStock: chem.targetStock,
        recommendedPurchase: recommended,
        priority,
      };
      return updated;
    }

    const newItem: PurchaseItem = {
      id: `purch-${chem.id}-${Date.now().toString(36)}`,
      chemicalId: chem.id,
      chemicalName: chem.name,
      currentStock: newTotalStock,
      minimumStock: chem.minimumStock,
      targetStock: chem.targetStock,
      recommendedPurchase: recommended,
      unit: chem.primaryUnit,
      supplier: chem.manufacturer,
      estimatedCost: 0,
      priority,
      status: 'PENDING',
      notes: priority === 'CRITICAL' ? 'Tự động tạo: Mức tồn kho báo động đỏ!' : 'Tự động tạo: Đạt ngưỡng cảnh báo',
    };
    return [newItem, ...currentPurchaseList];
  };

  // =========================================================================
  // GOOGLE OAUTH / AUTHENTICATION (Sections 36, 38, 39)
  // =========================================================================
  const signInWithGoogle = (email: string, name?: string, picture?: string, googleId?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Vui lòng nhập địa chỉ Google Email hợp lệ.' };
    }

    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (existing) {
      // 12. XỬ LÝ EMAIL GOOGLE: Nếu tài khoản đã bị xóa (DELETED) -> Không cho truy cập
      if (existing.status === 'DELETED') {
        logAudit(
          'ĐĂNG NHẬP GOOGLE BỊ CHẶN (TÀI KHOẢN ĐÃ XÓA)',
          'USER',
          existing.id,
          `Tài khoản đã bị xóa ${existing.email} (${existing.name}) cố gắng đăng nhập qua Google OAuth.`
        );
        return {
          success: false,
          message: 'Tài khoản này đã bị xóa khỏi hệ thống LabChem. Vui lòng liên hệ Manager để được cấp quyền lại.',
        };
      }

      // Section 42 & 58: Check if account is DEACTIVATED
      if (existing.status === 'DEACTIVATED') {
        logAudit(
          'ĐĂNG NHẬP GOOGLE BỊ CHẶN',
          'USER',
          existing.id,
          `Tài khoản bị vô hiệu hóa ${existing.email} cố gắng đăng nhập.`
        );
        return {
          success: false,
          message: 'Tài khoản của bạn đã bị vô hiệu hóa bởi Quản lý phòng lab. Không thể truy cập hệ thống.',
        };
      }

      const updatedUser: User = {
        ...existing,
        lastLogin: new Date().toISOString(),
        picture: picture || existing.picture,
        name: name?.trim() || existing.name,
      };

      setUsers((prev) => prev.map((u) => (u.id === existing.id ? updatedUser : u)));
      setCurrentUser(updatedUser);

      logAudit(
        'ĐĂNG NHẬP GOOGLE',
        'USER',
        existing.id,
        `${existing.name} (${existing.email}) đã đăng nhập qua Google OAuth. Vai trò: ${existing.role}, Trạng thái: ${existing.status}`
      );

      return {
        success: true,
        message: `Đăng nhập Google thành công: ${existing.name} (${existing.role})`,
        user: updatedUser,
        isPending: existing.status === 'PENDING',
      };
    }

    // NEW GOOGLE USER SIGN-IN (Section 38 & 39)
    // Section 38: MANAGER_EMAIL config check
    const isDefaultManager =
      cleanEmail === DEFAULT_MANAGER_EMAIL.toLowerCase() ||
      cleanEmail === 'tranminh.admin@gmail.com' ||
      cleanEmail === 'manager@lab.com';

    const role: UserRole = isDefaultManager ? 'MANAGER' : 'USER';
    const status: UserStatus = isDefaultManager ? 'ACTIVE' : 'PENDING';

    const usernamePart = cleanEmail.split('@')[0];
    const derivedName =
      name?.trim() ||
      usernamePart
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const newUser: User = {
      id: `user-g-${Date.now().toString(36)}`,
      name: derivedName,
      email: cleanEmail,
      role,
      status,
      department: isDefaultManager ? 'Ban Quản trị Phòng Thí nghiệm' : 'Nghiên cứu sinh / Học viên mới',
      position: isDefaultManager ? 'Quản lý phòng lab (Lab Manager)' : 'Học viên',
      dateJoined: new Date().toISOString().split('T')[0],
      lastLogin: new Date().toISOString(),
      googleId: googleId || `gid-${Date.now()}`,
      picture,
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);

    if (status === 'PENDING') {
      // Section 39 & 57: Push notification for Manager
      const notif: LabNotification = {
        id: `notif-new-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'NEW_USER_PENDING',
        title: 'Tài khoản mới chờ phê duyệt',
        message: `Người dùng mới "${newUser.name}" (${newUser.email}) vừa đăng nhập Google lần đầu. Vui lòng phê duyệt để cấp quyền sử dụng.`,
        targetRole: 'MANAGER',
        read: false,
        linkTab: 'users',
      };
      setNotifications((prev) => [notif, ...prev]);

      logAudit(
        'ĐĂNG KÝ GOOGLE MỚI (PENDING)',
        'USER',
        newUser.id,
        `Tài khoản Google mới tạo: ${newUser.name} (${newUser.email}) đang ở trạng thái PENDING chờ Quản lý duyệt.`
      );

      return {
        success: true,
        message: 'Your account is waiting for manager approval (Tài khoản đang chờ Quản lý phê duyệt).',
        user: newUser,
        isPending: true,
      };
    }

    logAudit(
      'KHỞI TẠO MANAGER GOOGLE',
      'USER',
      newUser.id,
      `Tài khoản Quản lý đầu tiên ${newUser.email} kích hoạt thành công.`
    );

    return {
      success: true,
      message: `Chào mừng Quản lý ${newUser.name}! Tài khoản được thiết lập toàn quyền MANAGER.`,
      user: newUser,
      isPending: false,
    };
  };

  const signOut = () => {
    // Revert to demo manager for convenience, or clear
    const manager = users.find((u) => u.role === 'MANAGER' && u.status === 'ACTIVE') || DEMO_USERS[0];
    setCurrentUser(manager);
    logAudit('ĐĂNG XUẤT', 'USER', currentUser.id, `${currentUser.name} đã đăng xuất phiên làm việc.`);
  };

  // =========================================================================
  // USER MANAGEMENT & APPROVAL WORKFLOW (Section 41, 57, 58, 59)
  // =========================================================================
  const approveUser = (userId: string) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý (MANAGER) mới có quyền duyệt tài khoản.' };
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Không tìm thấy người dùng.' };

    const updated = users.map((u) =>
      u.id === userId ? { ...u, status: 'ACTIVE' as UserStatus, role: u.role || 'USER' } : u
    );
    setUsers(updated);
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, status: 'ACTIVE' }));
    }

    // User notification
    const notif: LabNotification = {
      id: `notif-appr-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'USER_APPROVED',
      title: 'Tài khoản của bạn đã được phê duyệt!',
      message: `Quản lý đã duyệt tài khoản của bạn (${target.email}). Bạn có thể bắt đầu ghi nhận sử dụng hóa chất.`,
      targetUserId: target.id,
      targetRole: 'USER',
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    logAudit(
      'APPROVE USER',
      'USER',
      userId,
      `${currentUser.name} đã phê duyệt tài khoản ${target.name} (${target.email}): PENDING → ACTIVE`
    );

    return { success: true, message: `Đã phê duyệt tài khoản cho ${target.name} (ACTIVE).` };
  };

  const rejectUser = (userId: string) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý (MANAGER) mới có quyền từ chối.' };
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Không tìm thấy người dùng.' };

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: 'DEACTIVATED' as UserStatus } : u)));

    logAudit('REJECT USER', 'USER', userId, `${currentUser.name} đã từ chối tài khoản ${target.name} (${target.email}).`);
    return { success: true, message: `Đã từ chối tài khoản ${target.name}.` };
  };

  // 1 & 2: PHÂN CẤP QUYỀN & XÁC ĐỊNH ACCOUNT THUỘC QUYỀN MANAGER
  const isSuperAdmin =
    currentUser.role === 'ADMIN' ||
    currentUser.email.toLowerCase() === DEFAULT_MANAGER_EMAIL.toLowerCase();

  const canManageTargetUser = (target: User): { allowed: boolean; message: string } => {
    if (!isManager) {
      return {
        allowed: false,
        message: 'ACCESS DENIED: 403 Forbidden. Chỉ Quản lý (MANAGER) mới có quyền quản lý thành viên.',
      };
    }

    if (isSuperAdmin) {
      return { allowed: true, message: '' };
    }

    // Không thể can thiệp vào tài khoản Super Admin / Quản trị viên cấp cao
    if (target.role === 'ADMIN') {
      return {
        allowed: false,
        message: 'ACCESS DENIED: 403 Forbidden. Không có quyền sửa đổi hoặc xóa Quản trị viên cấp cao (ADMIN).',
      };
    }

    // Không được tự ý sửa/xóa Manager khác (trừ khi là chính mình hoặc quy trình xóa Manager đã Deactivated hợp lệ)
    if (
      (target.role === 'MANAGER' || target.role === 'LAB_MANAGER') &&
      target.id !== currentUser.id
    ) {
      return {
        allowed: false,
        message: 'ACCESS DENIED: 403 Forbidden. Không được tự ý sửa đổi hoặc can thiệp tài khoản của Quản lý khác.',
      };
    }

    // Đối với User thông thường: Phải thuộc quyền quản lý của Manager hiện tại (user.manager_id = current_manager.id)
    if (target.role === 'USER' || target.role === 'MEMBER') {
      if (target.manager_id && target.manager_id !== currentUser.id) {
        return {
          allowed: false,
          message: `ACCESS DENIED: 403 Forbidden. Thành viên "${target.name}" thuộc phạm vi quản lý của ${target.manager_name || 'Manager khác'}. Bạn không có thẩm quyền thao tác.`,
        };
      }
    }

    return { allowed: true, message: '' };
  };

  const deactivateUser = (userId: string) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: 403 Forbidden. Chỉ Quản lý (MANAGER) mới có quyền vô hiệu hóa.' };
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Không tìm thấy người dùng.' };

    const check = canManageTargetUser(target);
    if (!check.allowed) {
      return { success: false, message: check.message };
    }

    // Section 59: Prevent deactivating the last active Manager!
    if (target.role === 'MANAGER' && target.status === 'ACTIVE') {
      const activeManagers = users.filter((u) => u.role === 'MANAGER' && u.status === 'ACTIVE' && u.id !== userId);
      if (activeManagers.length === 0) {
        return { success: false, message: 'Quy định an toàn: Không thể vô hiệu hóa Quản lý (MANAGER) duy nhất còn lại của hệ thống.' };
      }
    }

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: 'DEACTIVATED' as UserStatus } : u)));
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, status: 'DEACTIVATED' }));
    }

    logAudit(
      'KHÓA TÀI KHOẢN',
      'USER',
      userId,
      `ACTION: LOCK_USER | TARGET: ${target.name} (${target.email}) | BỘ MÔN: ${target.department} | THỰC HIỆN BỞI: ${currentUser.name} | THỜI GIAN: ${new Date().toLocaleString('vi-VN')}`
    );
    return {
      success: true,
      message: `Đã khóa tài khoản "${target.name}". Tài khoản này không thể đăng nhập hoặc thực hiện giao dịch, nhưng lịch sử sử dụng được bảo toàn.`,
    };
  };

  const activateUser = (userId: string) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: 403 Forbidden. Chỉ Quản lý (MANAGER) mới có quyền kích hoạt.' };
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Không tìm thấy người dùng.' };

    const check = canManageTargetUser(target);
    if (!check.allowed) {
      return { success: false, message: check.message };
    }

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: 'ACTIVE' as UserStatus } : u)));
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, status: 'ACTIVE' }));
    }

    logAudit(
      'MỞ KHÓA TÀI KHOẢN',
      'USER',
      userId,
      `ACTION: UNLOCK_USER | TARGET: ${target.name} (${target.email}) | BỘ MÔN: ${target.department} | THỰC HIỆN BỞI: ${currentUser.name} | THỜI GIAN: ${new Date().toLocaleString('vi-VN')}`
    );
    return { success: true, message: `Đã mở khóa tài khoản "${target.name}".` };
  };

  const changeUserRole = (userId: string, newRole: UserRole) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: 403 Forbidden. Chỉ Quản lý (MANAGER) mới có quyền cấp hoặc đổi vai trò.' };
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Không tìm thấy người dùng.' };

    const check = canManageTargetUser(target);
    if (!check.allowed) {
      return { success: false, message: check.message };
    }

    // Section 59: Prevent demoting the last manager
    if (target.role === 'MANAGER' && newRole === 'USER') {
      const otherActiveManagers = users.filter((u) => u.role === 'MANAGER' && u.status === 'ACTIVE' && u.id !== userId);
      if (otherActiveManagers.length === 0) {
        return { success: false, message: 'Không thể hạ quyền Quản lý duy nhất đang hoạt động của hệ thống!' };
      }
    }

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, role: newRole }));
    }

    logAudit('CHANGE ROLE', 'USER', userId, `${currentUser.name} đã đổi vai trò của ${target.name}: ${target.role} → ${newRole}`);
    return { success: true, message: `Đã đổi vai trò của ${target.name} thành ${newRole}.` };
  };

  const addUser = (userData: Omit<User, 'id'>) => {
    if (!canManageUsers) {
      return { success: false, message: 'ACCESS DENIED: 403 Forbidden. Chỉ Quản lý (MANAGER) mới có quyền thêm thành viên mới.' };
    }
    const newId = `user-${Date.now().toString(36)}`;
    const newUser: User = {
      ...userData,
      id: newId,
      manager_id: userData.manager_id || currentUser.id,
      manager_name: userData.manager_name || currentUser.name,
      status: userData.status || 'ACTIVE',
      dateJoined: userData.dateJoined || new Date().toISOString().split('T')[0],
      lastLogin: new Date().toISOString(),
    };
    setUsers((prev) => [...prev, newUser]);
    logAudit('Thêm người dùng', 'USER', newId, `${currentUser.name} đã thêm thành viên: ${newUser.name} (${newUser.role}, ${newUser.department})`);
    return { success: true, message: `Đã thêm thành viên "${newUser.name}".`, user: newUser };
  };

  // 4, 5, 7, 8: CẬP NHẬT THÔNG TIN THÀNH VIÊN & CHUYỂN BỘ MÔN
  const updateUser = (id: string, update: Partial<User>) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: 403 Forbidden. Chỉ Quản lý (MANAGER) mới có quyền sửa thông tin thành viên.' };
    }
    const target = users.find((u) => u.id === id);
    if (!target) return { success: false, message: 'Không tìm thấy thành viên.' };

    const check = canManageTargetUser(target);
    if (!check.allowed) {
      return { success: false, message: check.message };
    }

    // Bảo vệ không cho thay đổi email Google định danh trừ khi Super Admin
    const safeUpdate = { ...update };
    delete (safeUpdate as any).id;
    if (safeUpdate.email && safeUpdate.email.trim().toLowerCase() !== target.email.toLowerCase() && !isSuperAdmin) {
      delete safeUpdate.email;
    }

    const oldDept = target.department;
    const isDeptChanged = safeUpdate.department && safeUpdate.department !== oldDept;

    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...safeUpdate } : u)));
    if (currentUser.id === id) {
      setCurrentUser((prev) => ({ ...prev, ...safeUpdate }));
    }

    // Lập chi tiết thay đổi để ghi Audit Log (Mục 8)
    const changeLogs: string[] = [];
    if (safeUpdate.name && safeUpdate.name !== target.name) changeLogs.push(`Tên: "${target.name}" → "${safeUpdate.name}"`);
    if (isDeptChanged) changeLogs.push(`Bộ môn: "${oldDept}" → "${safeUpdate.department}"`);
    if (safeUpdate.position !== undefined && safeUpdate.position !== target.position) changeLogs.push(`Chức danh: "${target.position || 'Chưa có'}" → "${safeUpdate.position}"`);
    if (safeUpdate.phone !== undefined && safeUpdate.phone !== target.phone) changeLogs.push(`SĐT: "${target.phone || 'Chưa có'}" → "${safeUpdate.phone}"`);
    if (safeUpdate.member_code !== undefined && safeUpdate.member_code !== target.member_code) changeLogs.push(`Mã TV: "${target.member_code || 'Chưa có'}" → "${safeUpdate.member_code}"`);
    if (safeUpdate.notes !== undefined && safeUpdate.notes !== target.notes) changeLogs.push(`Ghi chú: "${safeUpdate.notes}"`);
    if (safeUpdate.manager_id && safeUpdate.manager_id !== target.manager_id) changeLogs.push(`Manager phụ trách: "${target.manager_name || 'Chưa có'}" → "${safeUpdate.manager_name || safeUpdate.manager_id}"`);

    const logDetails = changeLogs.length > 0 ? changeLogs.join(', ') : 'Cập nhật thông tin hồ sơ';

    logAudit(
      isDeptChanged ? 'CHUYỂN BỘ MÔN' : 'UPDATE_USER',
      'USER',
      id,
      `ACTION: ${isDeptChanged ? 'CHANGE_DEPARTMENT' : 'UPDATE_USER'} | USER: ${target.name} (${target.email}) | ${logDetails} | CHANGED BY: ${currentUser.name} | TIME: ${new Date().toLocaleString('vi-VN')}`
    );

    return {
      success: true,
      message: isDeptChanged
        ? `Đã chuyển thành viên "${target.name}" sang bộ môn "${safeUpdate.department}".`
        : `Đã cập nhật thông tin thành viên "${target.name}".`,
    };
  };

  const changeUserDepartment = (userId: string, newDepartment: string) => {
    return updateUser(userId, { department: newDepartment });
  };

  // 1, 5, 6, 9, 10, 11: XÓA TÀI KHOẢN MANAGER ĐÃ DEACTIVATED (Soft delete)
  const deleteDeactivatedManager = (userId: string, reason?: string) => {
    // 10. CHỈ MANAGER CÓ QUYỀN XÓA (Backend / Context permission check)
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: 403 Forbidden. Chỉ Quản lý (MANAGER) mới có quyền xóa tài khoản.' };
    }

    const target = users.find((u) => u.id === userId);
    if (!target) {
      return { success: false, message: 'Không tìm thấy tài khoản người dùng cần xóa.' };
    }

    // 9. KHÔNG CHO TỰ XÓA TÀI KHOẢN CỦA CHÍNH MÌNH
    if (target.id === currentUser.id) {
      return { success: false, message: 'Quy định an toàn: Bạn không thể tự xóa tài khoản Manager của chính mình.' };
    }

    // 1. ĐIỀU KIỆN ĐƯỢC XÓA: role = MANAGER AND status = DEACTIVATED
    const isTargetManager = target.role === 'MANAGER' || target.role === 'ADMIN' || target.role === 'LAB_MANAGER';
    if (!isTargetManager) {
      return {
        success: false,
        message: 'Chức năng này chỉ áp dụng cho tài khoản Quản lý (MANAGER). Không thể xóa tài khoản vai trò USER theo quy trình này.',
      };
    }

    if (target.status !== 'DEACTIVATED') {
      return {
        success: false,
        message: `Chỉ cho phép xóa tài khoản Manager khi đang ở trạng thái DEACTIVATED (Vô hiệu hóa). Trạng thái hiện tại: ${target.status}. Vui lòng Khóa/Vô hiệu hóa tài khoản trước.`,
      };
    }

    // 9. KHÔNG CHO XÓA MANAGER CUỐI CÙNG CỦA HỆ THỐNG
    const remainingActiveManagers = users.filter(
      (u) => (u.role === 'MANAGER' || u.role === 'ADMIN' || u.role === 'LAB_MANAGER') && u.status === 'ACTIVE' && u.id !== userId
    );
    if (remainingActiveManagers.length === 0) {
      return {
        success: false,
        message: 'Không thể xóa Manager cuối cùng của hệ thống. Phải có ít nhất một Manager đang hoạt động.',
      };
    }

    // 6. SỬ DỤNG SOFT DELETE (Bảo toàn lịch sử giao dịch và logs)
    const deletionTimestamp = new Date().toISOString();
    const updatedUser: User = {
      ...target,
      status: 'DELETED',
      deleted_at: deletionTimestamp,
      deleted_by: currentUser.id,
      deleted_by_name: currentUser.name,
      deletion_reason: reason || 'Quản lý thực hiện xóa tài khoản Manager đã vô hiệu hóa',
    };

    setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));

    // 11. AUDIT LOG
    logAudit(
      'DELETE_USER',
      'USER',
      userId,
      `ACTION: DELETE_USER | TARGET: ${target.name} | TARGET EMAIL: ${target.email} | TARGET ROLE: ${target.role} | PERFORMED BY: ${currentUser.name} | PERFORMED AT: ${new Date().toLocaleString('vi-VN')} | STATUS: SUCCESS | REASON: ${reason || 'Xóa tài khoản Manager đã Deactivated'}`
    );

    // 13. UI SAU KHI XÓA
    return {
      success: true,
      message: `${target.name} đã được đưa vào Lịch sử xóa. Lịch sử thao tác của tài khoản vẫn được bảo toàn.`,
    };
  };

  // 12, 13, 16, 17, 18, 19: XÓA ACCOUNT THUỘC QUYỀN QUẢN LÝ (Soft Delete)
  const deleteUser = (userId: string, reason?: string) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: 403 Forbidden. Chỉ Quản lý (MANAGER) mới có quyền xóa tài khoản.' };
    }

    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Không tìm thấy tài khoản người dùng cần xóa.' };

    if (target.id === currentUser.id) {
      return { success: false, message: 'Quy định an toàn: Bạn không thể tự xóa tài khoản của chính mình.' };
    }

    // Nếu là Manager: phải là Deactivated Manager và tuân theo quy tắc an toàn
    if (target.role === 'MANAGER' || target.role === 'ADMIN' || target.role === 'LAB_MANAGER') {
      if (target.role === 'ADMIN') {
        return { success: false, message: 'ACCESS DENIED: 403 Forbidden. Không thể xóa tài khoản Quản trị viên cấp cao (ADMIN).' };
      }
      return deleteDeactivatedManager(userId, reason);
    }

    // Nếu là User: Kiểm tra quyền quản lý (Section 12: target.manager_id = current_user.id)
    const check = canManageTargetUser(target);
    if (!check.allowed) {
      return { success: false, message: check.message };
    }

    // Soft Delete (Bảo toàn nguyên vẹn lịch sử giao dịch và logs)
    const deletionTimestamp = new Date().toISOString();
    const updatedUser: User = {
      ...target,
      status: 'DELETED',
      deleted_at: deletionTimestamp,
      deleted_by: currentUser.id,
      deleted_by_name: currentUser.name,
      deletion_reason: reason || 'Xóa account thuộc phạm vi quản lý',
    };

    setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));

    // 17. AUDIT LOG KHI XÓA
    logAudit(
      'DELETE_USER',
      'USER',
      userId,
      `ACTION: DELETE_USER | TARGET: ${target.name} | TARGET EMAIL: ${target.email} | TARGET DEPARTMENT: ${target.department} | DELETED BY: ${currentUser.name} | DELETED AT: ${new Date().toLocaleString('vi-VN')} | REASON: ${reason || 'Xóa thành viên thuộc quyền quản lý'}`
    );

    return {
      success: true,
      message: `Thành viên "${target.name}" đã được đưa vào Lịch sử xóa. Lịch sử sử dụng và giao dịch vẫn được bảo toàn nguyên vẹn.`,
    };
  };

  // 8. KHÔI PHỤC TÀI KHOẢN (DELETED -> DEACTIVATED)
  const restoreUser = (userId: string) => {
    // 10. CHỈ MANAGER CÓ QUYỀN KHÔI PHỤC
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: 403 Forbidden. Chỉ Quản lý (MANAGER) mới có quyền khôi phục tài khoản.' };
    }

    const target = users.find((u) => u.id === userId);
    if (!target) {
      return { success: false, message: 'Không tìm thấy tài khoản người dùng.' };
    }

    if (target.status !== 'DELETED') {
      return { success: false, message: `Tài khoản "${target.name}" không nằm trong danh sách đã xóa.` };
    }

    // Kiểm tra quyền khôi phục (nếu là user thì phải thuộc quyền hoặc admin)
    if (target.role === 'USER' || target.role === 'MEMBER') {
      if (target.manager_id && target.manager_id !== currentUser.id && !isSuperAdmin) {
        return {
          success: false,
          message: `ACCESS DENIED: 403 Forbidden. Bạn không có quyền khôi phục tài khoản thuộc Manager khác.`,
        };
      }
    }

    // Khi khôi phục: DELETED -> DEACTIVATED (Không tự động chuyển thành ACTIVE)
    const updatedUser: User = {
      ...target,
      status: 'DEACTIVATED',
      deleted_at: undefined,
      deleted_by: undefined,
      deleted_by_name: undefined,
      deletion_reason: undefined,
    };

    setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));

    // 11. AUDIT LOG
    logAudit(
      'RESTORE_USER',
      'USER',
      userId,
      `ACTION: RESTORE_USER | TARGET: ${target.name} | TARGET EMAIL: ${target.email} | TARGET ROLE: ${target.role} | PERFORMED BY: ${currentUser.name} | PERFORMED AT: ${new Date().toLocaleString('vi-VN')} | STATUS: SUCCESS | CHUYỂN VỀ: DEACTIVATED`
    );

    return {
      success: true,
      message: `Đã khôi phục tài khoản "${target.name}" về trạng thái DEACTIVATED (Vô hiệu hóa). Bạn có thể bấm "Mở khóa" nếu muốn kích hoạt lại.`,
    };
  };

  const updateUserLimits = (userId: string, limits: UserLimits) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: 403 Forbidden. Chỉ Quản lý mới có quyền thiết lập giới hạn cho thành viên.' };
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Không tìm thấy thành viên.' };

    const check = canManageTargetUser(target);
    if (!check.allowed) {
      return { success: false, message: check.message };
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, limits: { ...u.limits, ...limits } } : u))
    );
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, limits: { ...prev.limits, ...limits } }));
    }

    logAudit(
      'UPDATE USER LIMITS',
      'USER',
      userId,
      `${currentUser.name} cập nhật giới hạn cho ${target.name}: Tối đa/lần: ${limits.maxUsagePerTransaction ?? 'Không giới hạn'} mL, Ngày: ${limits.dailyUsageLimit ?? 'Không giới hạn'} mL, Số lần/ngày: ${limits.dailyTransactionCount ?? 'Không giới hạn'}, Nhập kho: ${limits.maxStockInQuantity ?? 'Không giới hạn'}`
    );

    return { success: true, message: `Đã cập nhật giới hạn thao tác cho "${target.name}".` };
  };

  const updateUserPermissions = (userId: string, permissions: UserPermissions) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý mới có quyền phân quyền chi tiết.' };
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Không tìm thấy thành viên.' };

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, permissions: { ...u.permissions, ...permissions } } : u))
    );
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, permissions: { ...prev.permissions, ...permissions } }));
    }

    logAudit(
      'UPDATE USER PERMISSIONS',
      'USER',
      userId,
      `${currentUser.name} cập nhật quyền hạn module cho ${target.name}.`
    );

    return { success: true, message: `Đã cập nhật quyền hạn module cho "${target.name}".` };
  };

  const createApprovalRequest = (requestData: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'status'>) => {
    const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newReq: ApprovalRequest = {
      ...requestData,
      id,
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
    };
    setApprovalRequests((prev) => [newReq, ...prev]);

    // Send notification to Managers
    const notif: LabNotification = {
      id: `notif-req-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'APPROVAL_REQUEST',
      title: `Yêu cầu phê duyệt từ ${requestData.userName}`,
      message: `${requestData.userName} yêu cầu vượt giới hạn: ${requestData.requestedQuantity} ${requestData.unit} cho ${requestData.chemicalName}. Lý do: ${requestData.reason}`,
      targetRole: 'MANAGER',
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    logAudit(
      'CREATE APPROVAL REQUEST',
      'REQUEST',
      id,
      `${requestData.userName} gửi yêu cầu phê duyệt ${requestData.type}: ${requestData.requestedQuantity} ${requestData.unit} ${requestData.chemicalName}. Lý do: ${requestData.reason}`
    );

    return { success: true, message: 'Đã gửi yêu cầu tới Quản lý phòng lab phê duyệt!', id };
  };

  const resolveApprovalRequest = (id: string, action: 'APPROVE' | 'REJECT', resolutionNotes?: string) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý mới có quyền phê duyệt.' };
    }
    const req = approvalRequests.find((r) => r.id === id);
    if (!req) return { success: false, message: 'Không tìm thấy yêu cầu.' };
    if (req.status !== 'PENDING') {
      return { success: false, message: 'Yêu cầu này đã được xử lý trước đó.' };
    }

    const resolvedAt = new Date().toISOString();

    if (action === 'APPROVE') {
      // Execute the requested usage transaction with MANAGER override!
      const userObj = users.find((u) => u.id === req.userId);
      const chemObj = chemicals.find((c) => c.id === req.chemicalId);

      if (userObj && chemObj) {
        recordUsage({
          chemicalId: req.chemicalId,
          bottleId: req.bottleId,
          autoSelectBottle: !req.bottleId,
          quantity: req.requestedQuantity,
          unit: req.unit as ChemicalUnit,
          date: new Date().toISOString().split('T')[0],
          purpose: `[Duyệt vượt hạn mức] ${req.reason}`,
          notes: `Quản lý ${currentUser.name} phê duyệt đơn yêu cầu #${req.id}. ${resolutionNotes || ''}`,
          userId: req.userId,
        });
      }

      setApprovalRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'APPROVED',
                resolvedAt,
                resolvedBy: currentUser.name,
                resolutionNotes: resolutionNotes || 'Quản lý chấp thuận cho phép sử dụng vượt hạn mức.',
              }
            : r
        )
      );

      logAudit(
        'APPROVE REQUEST',
        'REQUEST',
        id,
        `${currentUser.name} phê duyệt yêu cầu của ${req.userName} (${req.requestedQuantity} ${req.unit} ${req.chemicalName}).`
      );

      return { success: true, message: `Đã phê duyệt yêu cầu của ${req.userName} và ghi nhận giao dịch thành công!` };
    } else {
      setApprovalRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'REJECTED',
                resolvedAt,
                resolvedBy: currentUser.name,
                resolutionNotes: resolutionNotes || 'Quản lý từ chối yêu cầu vượt hạn mức.',
              }
            : r
        )
      );

      logAudit(
        'REJECT REQUEST',
        'REQUEST',
        id,
        `${currentUser.name} từ chối yêu cầu của ${req.userName}. Lý do: ${resolutionNotes || 'Không chấp thuận'}`
      );

      return { success: true, message: `Đã từ chối yêu cầu của ${req.userName}.` };
    }
  };

  // =========================================================================
  // USAGE TRANSACTION WORKFLOW (Section 46, 47, 48, 49, 63)
  // =========================================================================
  const recordUsage = ({
    chemicalId,
    bottleId,
    autoSelectBottle = false,
    quantity,
    unit,
    date,
    project,
    experiment,
    purpose,
    notes,
    userId,
    source = 'MANUAL',
  }: {
    chemicalId: string;
    bottleId?: string;
    autoSelectBottle?: boolean;
    quantity: number;
    unit: ChemicalUnit;
    date: string;
    project?: string;
    experiment?: string;
    purpose?: string;
    notes?: string;
    userId?: string;
    source?: 'QR_SCAN' | 'MANUAL';
  }) => {
    const activeUser = userId ? users.find((u) => u.id === userId) || currentUser : currentUser;

    // 1. Permission & Status check (Section 42, 54, 57, 58)
    if (activeUser.status === 'PENDING') {
      return {
        success: false,
        message: 'Tài khoản của bạn đang chờ Quản lý phê duyệt (Pending approval). Không thể ghi nhận sử dụng hóa chất.',
      };
    }
    if (activeUser.status === 'SUSPENDED') {
      return {
        success: false,
        message: 'Tài khoản của bạn đang bị tạm ngưng (Suspended). Vui lòng liên hệ Quản lý phòng lab.',
      };
    }
    if (activeUser.status === 'DEACTIVATED') {
      return {
        success: false,
        message: 'Tài khoản đã bị vô hiệu hóa (Deactivated). Không thể thực hiện giao dịch.',
      };
    }

    // 2. Validate quantity
    if (quantity <= 0) {
      return { success: false, message: 'Số lượng sử dụng phải lớn hơn 0.' };
    }

    const chem = chemicals.find((c) => c.id === chemicalId);
    if (!chem) return { success: false, message: 'Không tìm thấy hóa chất.' };

    if (chem.status === 'ARCHIVED') {
      return {
        success: false,
        message: `Hóa chất "${chem.name}" đã được lưu trữ (ARCHIVED). Quản lý cần khôi phục trước khi ghi nhận sử dụng.`,
      };
    }

    if (!areUnitsCompatible(unit, chem.primaryUnit)) {
      return { success: false, message: `Đơn vị "${unit}" không tương thích với đơn vị kho của ${chem.name} (${chem.primaryUnit}).` };
    }

    // 2b. Check Permission & Member Limits (Prompt requirement)
    const isTargetManager = activeUser.role === 'MANAGER' || activeUser.role === 'ADMIN';
    if (!isTargetManager) {
      if (activeUser.permissions && activeUser.permissions.recordUsage === false) {
        return { success: false, message: 'ACCESS DENIED: Tài khoản của bạn không được cấp quyền ghi nhận sử dụng (Record Usage).' };
      }

      if (activeUser.limits) {
        const limits = activeUser.limits;
        const qtyInMl = convertUnit(quantity, unit, 'mL') ?? quantity;

        // 1. Max usage per transaction
        if (limits.maxUsagePerTransaction !== null && limits.maxUsagePerTransaction !== undefined && qtyInMl > limits.maxUsagePerTransaction) {
          return {
            success: false,
            limitExceeded: true,
            limitType: 'USAGE_PER_TX',
            message: `VƯỢT GIỚI HẠN: Bạn chỉ được phép sử dụng tối đa ${limits.maxUsagePerTransaction} mL cho mỗi lần ghi nhận (yêu cầu: ${qtyInMl} mL). Bạn có thể gửi yêu cầu Quản lý phê duyệt để được cấp phép ngoại lệ.`,
          };
        }

        // 2. Daily usage limit
        if (limits.dailyUsageLimit !== null && limits.dailyUsageLimit !== undefined) {
          const todayStr = date || referenceDate;
          let todayUsageMl = 0;
          transactions.forEach((tx) => {
            if (tx.type === 'USAGE' && tx.user === activeUser.name && tx.date === todayStr && !tx.isReversed) {
              const txMl = convertUnit(tx.quantity, tx.unit, 'mL') ?? tx.quantity;
              todayUsageMl += txMl;
            }
          });

          if (todayUsageMl + qtyInMl > limits.dailyUsageLimit) {
            const remaining = Math.max(0, Math.round((limits.dailyUsageLimit - todayUsageMl) * 10) / 10);
            return {
              success: false,
              limitExceeded: true,
              limitType: 'DAILY_USAGE',
              message: `VƯỢT GIỚI HẠN NGÀY: Bạn đã sử dụng ${todayUsageMl} mL hôm nay. Giới hạn tối đa là ${limits.dailyUsageLimit} mL/ngày (còn lại: ${remaining} mL, yêu cầu: ${qtyInMl} mL). Vui lòng gửi yêu cầu Quản lý phê duyệt.`,
            };
          }
        }

        // 3. Daily transaction count limit
        if (limits.dailyTransactionCount !== null && limits.dailyTransactionCount !== undefined) {
          const todayStr = date || referenceDate;
          const todayTxCount = transactions.filter(
            (tx) => tx.type === 'USAGE' && tx.user === activeUser.name && tx.date === todayStr && !tx.isReversed
          ).length;

          if (todayTxCount >= limits.dailyTransactionCount) {
            return {
              success: false,
              limitExceeded: true,
              limitType: 'DAILY_COUNT',
              message: `VƯỢT GIỚI HẠN SỐ LẦN GHI: Bạn đã đạt giới hạn tối đa ${limits.dailyTransactionCount} lần ghi nhận sử dụng trong ngày hôm nay (${todayTxCount}/${limits.dailyTransactionCount} lần). Vui lòng gửi yêu cầu Quản lý phê duyệt.`,
            };
          }
        }
      }
    }

    // 3. SPECIFIC BOTTLE USAGE
    if (bottleId && !autoSelectBottle) {
      const targetBottle = bottles.find((b) => b.id === bottleId && b.chemicalId === chemicalId);
      if (!targetBottle) {
        return { success: false, message: 'Không tìm thấy chai được chọn.' };
      }

      // Check Archived or Disposed
      if (targetBottle.status === 'ARCHIVED') {
        return {
          success: false,
          message: `Chai ${targetBottle.bottleCode} đã được lưu trữ (ARCHIVED). Quản lý cần khôi phục trước khi sử dụng.`,
        };
      }
      if (targetBottle.status === 'DISPOSED') {
        return {
          success: false,
          message: `Chai ${targetBottle.bottleCode} đã thanh lý. Không thể ghi nhận sử dụng.`,
        };
      }

      // Check Expired (Section 65 Test P: Expired bottle → không cho sử dụng)
      const bStatus = calculateBottleStatus(targetBottle.currentVolume, targetBottle.initialVolume, targetBottle.expiryDate, referenceDate);
      if (bStatus === 'EXPIRED') {
        return {
          success: false,
          message: `Chai ${targetBottle.bottleCode} đã hết hạn sử dụng (${targetBottle.expiryDate}). Quy định an toàn phòng thí nghiệm: Không được sử dụng chai hết hạn!`,
        };
      }

      if (targetBottle.currentVolume <= 0 || targetBottle.status === 'EMPTY') {
        return { success: false, message: `Chai ${targetBottle.bottleCode} đã hết hóa chất (EMPTY). Vui lòng chọn chai khác.` };
      }

      if (!areUnitsCompatible(unit, targetBottle.unit)) {
        return { success: false, message: `Đơn vị "${unit}" không tương thích với đơn vị chai (${targetBottle.unit}).` };
      }

      const neededInBottleUnit = convertUnit(quantity, unit, targetBottle.unit);
      if (neededInBottleUnit === null) {
        return { success: false, message: 'Lỗi chuyển đổi đơn vị đo lường.' };
      }

      // Section 47 & Requirement 8: Check insufficient stock in bottle (No negative balance)
      if (neededInBottleUnit > targetBottle.currentVolume + 0.0001) {
        return {
          success: false,
          message: `Không đủ tồn kho. Chai ${targetBottle.bottleCode} chỉ còn ${targetBottle.currentVolume} ${targetBottle.unit} (yêu cầu ${quantity} ${unit}).`,
        };
      }

      // Calculate new volume atomically
      const newBottleVolume = Math.max(0, Math.round((targetBottle.currentVolume - neededInBottleUnit) * 10000) / 10000);
      const newStatus =
        newBottleVolume === 0
          ? 'EMPTY'
          : calculateBottleStatus(newBottleVolume, targetBottle.initialVolume, targetBottle.expiryDate, referenceDate);

      const updatedBottles = bottles.map((b) =>
        b.id === targetBottle.id
          ? {
              ...b,
              currentVolume: newBottleVolume,
              status: newStatus,
              openedDate: b.openedDate || date,
            }
          : b
      );
      setBottles(updatedBottles);

      // Create transaction
      const txId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      const newTx: InventoryTransaction = {
        id: txId,
        timestamp: new Date().toISOString(),
        date,
        type: 'USAGE',
        chemicalId: chem.id,
        chemicalName: chem.name,
        bottleId: targetBottle.id,
        bottleCode: targetBottle.bottleCode,
        quantity,
        unit,
        previousStock: targetBottle.currentVolume,
        newStock: newBottleVolume,
        user: activeUser.name,
        userId: activeUser.id,
        userEmail: activeUser.email,
        source: source || 'MANUAL',
        project: project || 'Dược liệu & Chiết xuất',
        experiment,
        purpose: purpose || 'Nghiên cứu / Thí nghiệm',
        notes: notes || `Sử dụng từ chai ${targetBottle.bottleCode}`,
      };
      setTransactions((prev) => [newTx, ...prev]);

      // Calculate new total stock
      let newTotal = 0;
      for (const b of updatedBottles) {
        if (b.chemicalId === chemicalId && b.currentVolume > 0) {
          const conv = convertUnit(b.currentVolume, b.unit, chem.primaryUnit);
          if (conv !== null) newTotal += conv;
        }
      }
      newTotal = Math.round(newTotal * 10000) / 10000;

      // Sync purchase list
      setPurchaseItems((prev) => syncPurchaseItemForChemical(chem, newTotal, prev));

      // Check Low Stock & trigger automated email notification
      if (newTotal <= chem.minimumStock) {
        dispatchAutomatedEmailAlert(chem, newTotal, chem.minimumStock, 'CRITICAL_STOCK');
      } else if (newTotal <= chem.warningStock) {
        dispatchAutomatedEmailAlert(chem, newTotal, chem.warningStock, 'LOW_STOCK');
      }

      // Audit log (Section 52)
      logAudit(
        'USE CHEMICAL',
        'TRANSACTION',
        txId,
        `${activeUser.name} đã dùng ${quantity} ${unit} từ chai ${targetBottle.bottleCode} (${chem.name}): ${targetBottle.currentVolume} → ${newBottleVolume} ${targetBottle.unit}. Tổng kho còn: ${newTotal} ${chem.primaryUnit}.`
      );

      // Async sync to Supabase Realtime Database
      if (isSupabaseConfigured()) {
        usageService.recordUsage({
          bottleId: targetBottle.id,
          quantityUsed: neededInBottleUnit,
          userId: activeUser.id,
          userName: activeUser.name,
          chemicalId: chem.id,
          chemicalName: chem.name,
          purpose,
          projectName: project,
          notes,
        }).catch((err) => console.warn('Supabase usage recording error:', err));
      }

      return {
        success: true,
        message: `Đã ghi nhận sử dụng ${quantity} ${unit} từ chai ${targetBottle.bottleCode}. Chai còn lại: ${newBottleVolume} ${targetBottle.unit}.`,
        transactionIds: [txId],
      };
    }

    // 4. AUTO-SELECT BOTTLE (Section 49: IN_USE first, earliest expiry, exclude EMPTY & EXPIRED)
    const availableBottles = bottles.filter((b) => {
      if (b.chemicalId !== chemicalId || b.currentVolume <= 0 || b.status === 'EMPTY') return false;
      const bStatus = calculateBottleStatus(b.currentVolume, b.initialVolume, b.expiryDate, referenceDate);
      return bStatus !== 'EXPIRED'; // Rule: Do not select expired bottles
    });

    if (availableBottles.length === 0) {
      return { success: false, message: `Hóa chất ${chem.name} không còn chai khả dụng (tất cả đã hết hoặc hết hạn).` };
    }

    const sortedBottles = [...availableBottles].sort((a, b) => {
      const statusWeight = (s: string) => {
        if (s === 'IN_USE') return 1;
        if (s === 'LOW') return 2;
        if (s === 'FULL') return 3;
        return 4;
      };
      const wA = statusWeight(a.status);
      const wB = statusWeight(b.status);
      if (wA !== wB) return wA - wB;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });

    const totalNeededInPrimary = convertUnit(quantity, unit, chem.primaryUnit);
    if (totalNeededInPrimary === null) {
      return { success: false, message: `Lỗi đơn vị ${unit}.` };
    }

    const { total: currentTotalStock } = getChemicalTotalStock(chem.id);
    if (totalNeededInPrimary > currentTotalStock + 0.0001) {
      return {
        success: false,
        message: `Insufficient stock. Kho chỉ còn ${currentTotalStock} ${chem.primaryUnit} (yêu cầu ${quantity} ${unit}).`,
      };
    }

    let remainingNeeded = quantity;
    const createdTxIds: string[] = [];
    const updatedBottlesMap = new Map<string, Bottle>();
    bottles.forEach((b) => updatedBottlesMap.set(b.id, { ...b }));
    const deductionsSummary: string[] = [];

    for (const b of sortedBottles) {
      if (remainingNeeded <= 0.00001) break;
      const bottleRef = updatedBottlesMap.get(b.id)!;
      const neededInBottleUnit = convertUnit(remainingNeeded, unit, bottleRef.unit);
      if (neededInBottleUnit === null) continue;

      const deductInBottleUnit = Math.min(bottleRef.currentVolume, neededInBottleUnit);
      const deductInReqUnit = convertUnit(deductInBottleUnit, bottleRef.unit, unit)!;

      const newVolume = Math.max(0, Math.round((bottleRef.currentVolume - deductInBottleUnit) * 10000) / 10000);
      const newStatus =
        newVolume === 0
          ? 'EMPTY'
          : calculateBottleStatus(newVolume, bottleRef.initialVolume, bottleRef.expiryDate, referenceDate);

      bottleRef.currentVolume = newVolume;
      bottleRef.status = newStatus;
      if (!bottleRef.openedDate) bottleRef.openedDate = date;

      const subTxId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      createdTxIds.push(subTxId);

      const subTx: InventoryTransaction = {
        id: subTxId,
        timestamp: new Date().toISOString(),
        date,
        type: 'USAGE',
        chemicalId: chem.id,
        chemicalName: chem.name,
        bottleId: bottleRef.id,
        bottleCode: bottleRef.bottleCode,
        quantity: Math.round(deductInReqUnit * 10000) / 10000,
        unit,
        previousStock: b.currentVolume,
        newStock: newVolume,
        user: activeUser.name,
        userId: activeUser.id,
        userEmail: activeUser.email,
        source: source || 'MANUAL',
        project: project || 'Dược liệu & Chiết xuất',
        experiment,
        purpose: purpose || 'Tự động trừ chai (FIFO)',
        notes: notes || `Trừ tự động từ chai ${bottleRef.bottleCode}`,
      };

      setTransactions((prev) => [subTx, ...prev]);
      deductionsSummary.push(`${subTx.quantity} ${unit} từ chai ${bottleRef.bottleCode} (còn ${newVolume} ${bottleRef.unit})`);
      remainingNeeded -= deductInReqUnit;

      // Sync individual bottle deduction to Supabase
      if (isSupabaseConfigured()) {
        usageService.recordUsage({
          bottleId: bottleRef.id,
          quantityUsed: deductInBottleUnit,
          userId: activeUser.id,
          userName: activeUser.name,
          chemicalId: chem.id,
          chemicalName: chem.name,
          purpose: purpose || 'Tự động trừ chai (FIFO)',
          projectName: project,
          notes: notes || `Trừ tự động từ chai ${bottleRef.bottleCode}`,
        }).catch((err) => console.warn('Supabase FIFO usage recording error:', err));
      }
    }

    const nextBottlesList = Array.from(updatedBottlesMap.values());
    setBottles(nextBottlesList);

    let newTotal = 0;
    for (const b of nextBottlesList) {
      if (b.chemicalId === chemicalId && b.currentVolume > 0) {
        const conv = convertUnit(b.currentVolume, b.unit, chem.primaryUnit);
        if (conv !== null) newTotal += conv;
      }
    }
    newTotal = Math.round(newTotal * 10000) / 10000;

    setPurchaseItems((prev) => syncPurchaseItemForChemical(chem, newTotal, prev));

    if (newTotal <= chem.minimumStock) {
      dispatchAutomatedEmailAlert(chem, newTotal, chem.minimumStock, 'CRITICAL_STOCK');
    } else if (newTotal <= chem.warningStock) {
      dispatchAutomatedEmailAlert(chem, newTotal, chem.warningStock, 'LOW_STOCK');
    }

    logAudit(
      'USE CHEMICAL (AUTO FIFO)',
      'TRANSACTION',
      createdTxIds[0] || 'tx-auto',
      `${activeUser.name} đã dùng ${quantity} ${unit} của ${chem.name}: [${deductionsSummary.join('; ')}]. Tổng còn: ${newTotal} ${chem.primaryUnit}.`
    );

    return {
      success: true,
      message: `Đã tự động trừ: ${deductionsSummary.join(', ')}.`,
      transactionIds: createdTxIds,
    };
  };

  // =========================================================================
  // STOCK IN WORKFLOW (Section 51: Manager Only)
  // =========================================================================
  const stockIn = ({
    chemicalId,
    bottleCode,
    lotNumber,
    quantity,
    unit,
    supplier,
    purchaseDate,
    expiryDate,
    price,
    storageLocation,
    notes,
    existingBottleId,
  }: {
    chemicalId: string;
    bottleCode?: string;
    lotNumber: string;
    quantity: number;
    unit: ChemicalUnit;
    supplier?: string;
    purchaseDate?: string;
    expiryDate: string;
    price?: number;
    storageLocation?: { building: string; room: string; cabinet: string; shelf: string };
    notes?: string;
    existingBottleId?: string;
  }) => {
    const canStockIn = isManager || currentUser.permissions?.createStockIn;
    if (!canStockIn) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý hoặc thành viên được cấp quyền mới có thể nhập kho hóa chất.' };
    }

    if (!isManager && currentUser.limits?.maxStockInQuantity !== null && currentUser.limits?.maxStockInQuantity !== undefined) {
      if (quantity > currentUser.limits.maxStockInQuantity) {
        return {
          success: false,
          limitExceeded: true,
          message: `VƯỢT GIỚI HẠN NHẬP KHO: Bạn chỉ được phép nhập tối đa ${currentUser.limits.maxStockInQuantity} đơn vị/lần (yêu cầu: ${quantity} ${unit}). Vui lòng liên hệ Quản lý phòng lab.`,
        };
      }
    }

    const chem = chemicals.find((c) => c.id === chemicalId);
    if (!chem) return { success: false, message: 'Không tìm thấy hóa chất.' };
    if (chem.status === 'ARCHIVED') {
      return { success: false, message: `Hóa chất "${chem.name}" đã được lưu trữ (ARCHIVED). Quản lý cần khôi phục trước khi nhập kho.` };
    }
    if (quantity <= 0) return { success: false, message: 'Số lượng nhập phải lớn hơn 0.' };

    const loc = storageLocation || chem.storageLocation;
    const pDate = purchaseDate || new Date().toISOString().split('T')[0];

    let targetBottleId = '';
    let targetBottleCode = '';
    let updatedBottlesList = [...bottles];

    if (existingBottleId) {
      const bIdx = updatedBottlesList.findIndex((b) => b.id === existingBottleId);
      if (bIdx >= 0) {
        const b = updatedBottlesList[bIdx];
        const addedInBottleUnit = convertUnit(quantity, unit, b.unit) || quantity;
        const newVol = Math.round((b.currentVolume + addedInBottleUnit) * 10000) / 10000;
        const newStatus = calculateBottleStatus(newVol, b.initialVolume + addedInBottleUnit, b.expiryDate, referenceDate);

        updatedBottlesList[bIdx] = {
          ...b,
          currentVolume: newVol,
          initialVolume: b.initialVolume + addedInBottleUnit,
          status: newStatus,
        };
        targetBottleId = b.id;
        targetBottleCode = b.bottleCode;
      }
    } else {
      const existingChemBottles = bottles.filter((b) => b.chemicalId === chemicalId);
      const nextNum = existingChemBottles.length + 1;
      const codePrefix = chem.code ? chem.code.split('-')[0] : 'BOT';
      const autoCode = bottleCode || `${codePrefix}-${String(nextNum).padStart(3, '0')}`;

      // Requirement 16: Check duplicate bottle code
      const isDuplicate = bottles.some((b) => b.bottleCode.toLowerCase() === autoCode.toLowerCase() && b.status !== 'ARCHIVED');
      if (isDuplicate) {
        return {
          success: false,
          message: `Bottle ${autoCode} đã tồn tại trong hệ thống. Không thể nhập kho trùng mã chai.`,
        };
      }

      const newBottleId = `bottle-${chem.id}-${Date.now().toString(36)}`;
      const newStatus = calculateBottleStatus(quantity, quantity, expiryDate, referenceDate);

      const newBottle: Bottle = {
        id: newBottleId,
        chemicalId: chem.id,
        bottleCode: autoCode,
        lotNumber: lotNumber || `LOT-${new Date().getFullYear()}-${nextNum}`,
        initialVolume: quantity,
        currentVolume: quantity,
        unit,
        expiryDate,
        receivedDate: pDate,
        location: loc,
        status: newStatus,
        notes,
      };

      updatedBottlesList = [newBottle, ...updatedBottlesList];
      targetBottleId = newBottleId;
      targetBottleCode = autoCode;

      if (isSupabaseConfigured()) {
        bottleService.insert(newBottle).catch((err) => console.warn('Supabase bottle insert error:', err));
      }
    }

    setBottles(updatedBottlesList);

    // Auto-register or update cabinet catalog when a cabinet is specified in stock-in
    if (loc && loc.cabinet) {
      const cabName = loc.cabinet.trim();
      const shelfName = loc.shelf?.trim();
      setStorageCabinets((prev) => {
        const existing = prev.find((c) => c.name.toLowerCase() === cabName.toLowerCase());
        if (!existing) {
          const newCab: StorageCabinet = {
            id: `cab-${Date.now().toString(36)}`,
            name: cabName,
            displayName: `${cabName} (${loc.room || 'Phòng 302'}, ${loc.building || 'Building A'})`,
            building: loc.building || 'Building A',
            room: loc.room || 'Room 302',
            shelves: shelfName ? [shelfName] : ['Shelf 1'],
            hazardType: 'GENERAL',
          };
          return [...prev, newCab];
        } else if (shelfName && !existing.shelves.some((s) => s.toLowerCase() === shelfName.toLowerCase())) {
          return prev.map((c) =>
            c.id === existing.id ? { ...c, shelves: [...c.shelves, shelfName] } : c
          );
        }
        return prev;
      });
    }

    // Calculate new total stock
    let newTotal = 0;
    for (const b of updatedBottlesList) {
      if (b.chemicalId === chemicalId && b.currentVolume > 0) {
        const conv = convertUnit(b.currentVolume, b.unit, chem.primaryUnit);
        if (conv !== null) newTotal += conv;
      }
    }
    newTotal = Math.round(newTotal * 10000) / 10000;

    const txId = `tx-in-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const tx: InventoryTransaction = {
      id: txId,
      timestamp: new Date().toISOString(),
      date: pDate,
      type: 'STOCK_IN',
      chemicalId: chem.id,
      chemicalName: chem.name,
      bottleId: targetBottleId,
      bottleCode: targetBottleCode,
      quantity,
      unit,
      previousStock: newTotal - (convertUnit(quantity, unit, chem.primaryUnit) || quantity),
      newStock: newTotal,
      user: currentUser.name,
      notes: `Nhập kho Lot: ${lotNumber || 'N/A'}${supplier ? ` từ ${supplier}` : ''}`,
    };
    setTransactions((prev) => [tx, ...prev]);

    setPurchaseItems((prev) => syncPurchaseItemForChemical(chem, newTotal, prev));

    logAudit(
      'STOCK IN',
      'BOTTLE',
      targetBottleId,
      `${currentUser.name} nhập kho chai ${targetBottleCode} (${chem.name}): +${quantity} ${unit}. Tổng tồn mới: ${newTotal} ${chem.primaryUnit}.`
    );

    return {
      success: true,
      message: `Đã nhập kho thành công chai ${targetBottleCode} (+${quantity} ${unit}). Tổng tồn: ${newTotal} ${chem.primaryUnit}.`,
      bottleId: targetBottleId,
    };
  };

  // =========================================================================
  // REVERSAL / VOID TRANSACTION (Section 53 & Section 65 Test Q)
  // =========================================================================
  const reverseTransaction = (transactionId: string, reason: string) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý (MANAGER) mới có quyền hoàn tác giao dịch.' };
    }

    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (tx.isReversed) {
      return { success: false, message: 'Giao dịch này đã được hoàn tác trước đó.' };
    }

    // Mark original transaction as reversed
    const updatedTransactions = transactions.map((t) =>
      t.id === transactionId
        ? {
            ...t,
            isReversed: true,
            reversedBy: currentUser.name,
            reversalReason: reason || 'Hoàn tác bởi Quản lý',
          }
        : t
    );

    // If it was a USAGE transaction, refund stock to the bottle
    if (tx.type === 'USAGE' && tx.bottleId) {
      const chem = chemicals.find((c) => c.id === tx.chemicalId);
      const updatedBottles = bottles.map((b) => {
        if (b.id === tx.bottleId) {
          const conv = convertUnit(tx.quantity, tx.unit, b.unit) || tx.quantity;
          const restoredVol = Math.round((b.currentVolume + conv) * 10000) / 10000;
          const newStatus = calculateBottleStatus(restoredVol, b.initialVolume, b.expiryDate, referenceDate);
          return {
            ...b,
            currentVolume: restoredVol,
            status: newStatus,
          };
        }
        return b;
      });
      setBottles(updatedBottles);

      // Create offsetting reversal transaction
      const revTxId = `tx-rev-${Date.now()}`;
      const revTx: InventoryTransaction = {
        id: revTxId,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        type: 'ADJUSTMENT',
        chemicalId: tx.chemicalId,
        chemicalName: tx.chemicalName,
        bottleId: tx.bottleId,
        bottleCode: tx.bottleCode,
        quantity: tx.quantity,
        unit: tx.unit,
        previousStock: tx.newStock,
        newStock: tx.previousStock,
        user: currentUser.name,
        notes: `[Hoàn Tác] Khôi phục giao dịch #${tx.id}: ${reason}`,
        originalTransactionId: tx.id,
      };
      setTransactions([revTx, ...updatedTransactions]);

      if (chem) {
        const { total } = getChemicalTotalStock(chem.id);
        const restoredTotal = total + (convertUnit(tx.quantity, tx.unit, chem.primaryUnit) || tx.quantity);
        setPurchaseItems((prev) => syncPurchaseItemForChemical(chem, restoredTotal, prev));
      }

      logAudit(
        'REVERSE TRANSACTION',
        'TRANSACTION',
        tx.id,
        `${currentUser.name} đã hoàn tác giao dịch ${tx.id} (+${tx.quantity} ${tx.unit} hoàn lại chai ${tx.bottleCode}). Lý do: ${reason}`
      );

      return {
        success: true,
        message: `Đã hoàn tác giao dịch #${tx.id}. Lượng hóa chất ${tx.quantity} ${tx.unit} đã được khôi phục về chai ${tx.bottleCode}.`,
      };
    }

    setTransactions(updatedTransactions);
    logAudit('REVERSE TRANSACTION', 'TRANSACTION', tx.id, `${currentUser.name} đã hủy bỏ giao dịch ${tx.id}.`);
    return { success: true, message: `Đã hoàn tác giao dịch #${tx.id}.` };
  };

  // =========================================================================
  // DISCREPANCY REPORT & STOCK ADJUSTMENT (Section 45)
  // =========================================================================
  const reportDiscrepancy = ({
    chemicalId,
    bottleId,
    physicalQuantity,
    unit,
    reason,
  }: {
    chemicalId: string;
    bottleId?: string;
    physicalQuantity: number;
    unit: ChemicalUnit;
    reason: string;
  }) => {
    const chem = chemicals.find((c) => c.id === chemicalId);
    if (!chem) return { success: false, message: 'Không tìm thấy hóa chất.' };

    const bottle = bottleId ? bottles.find((b) => b.id === bottleId) : undefined;
    const systemQty = bottle ? bottle.currentVolume : getChemicalTotalStock(chem.id).total;
    const diff = Math.round((physicalQuantity - systemQty) * 10000) / 10000;

    const reportId = `disc-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const newReport: StockDiscrepancyReport = {
      id: reportId,
      chemicalId: chem.id,
      chemicalName: chem.name,
      bottleId: bottle?.id,
      bottleCode: bottle?.bottleCode,
      systemQuantity: systemQty,
      physicalQuantity,
      unit,
      difference: diff,
      reportedBy: currentUser.name,
      reportedDate: new Date().toISOString(),
      reason,
      status: 'PENDING',
    };

    setDiscrepancyReports((prev) => [newReport, ...prev]);

    // Push notification to Manager
    const notif: LabNotification = {
      id: `notif-disc-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'DISCREPANCY_REPORT',
      title: 'Báo cáo chênh lệch tồn kho thực tế',
      message: `${currentUser.name} báo cáo chênh lệch ${chem.name}: Hệ thống ${systemQty} ${unit} vs Thực tế ${physicalQuantity} ${unit} (Lệch: ${diff > 0 ? '+' : ''}${diff} ${unit}).`,
      targetRole: 'MANAGER',
      read: false,
      linkTab: 'inventory',
    };
    setNotifications((prev) => [notif, ...prev]);

    logAudit(
      'BÁO CÁO CHÊNH LỆCH TỒN KHO',
      'DISCREPANCY',
      reportId,
      `${currentUser.name} báo cáo chênh lệch tồn kho cho ${chem.name}: Thực tế ${physicalQuantity} vs Hệ thống ${systemQty} (${diff}). Lý do: ${reason}`
    );

    return {
      success: true,
      message: `Đã gửi báo cáo chênh lệch tồn kho tới Quản lý thành công. Quản lý sẽ kiểm tra và điều chỉnh tồn kho.`,
    };
  };

  const resolveDiscrepancy = (
    reportId: string,
    action: 'ADJUST' | 'REJECT',
    adjustmentQuantity?: number,
    notes?: string
  ) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý (MANAGER) mới có quyền xử lý báo cáo chênh lệch.' };
    }

    const report = discrepancyReports.find((r) => r.id === reportId);
    if (!report) return { success: false, message: 'Không tìm thấy báo cáo.' };

    if (action === 'ADJUST') {
      const targetQty = adjustmentQuantity !== undefined ? adjustmentQuantity : report.physicalQuantity;
      const targetBottle = report.bottleId ? bottles.find((b) => b.id === report.bottleId) : bottles.find((b) => b.chemicalId === report.chemicalId);

      if (targetBottle) {
        const prevVol = targetBottle.currentVolume;
        const newVol = targetQty;
        const newStatus = calculateBottleStatus(newVol, targetBottle.initialVolume, targetBottle.expiryDate, referenceDate);

        setBottles((prev) =>
          prev.map((b) => (b.id === targetBottle.id ? { ...b, currentVolume: newVol, status: newStatus } : b))
        );

        // Record adjustment transaction
        const txId = `tx-adj-${Date.now()}`;
        const tx: InventoryTransaction = {
          id: txId,
          timestamp: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          type: 'ADJUSTMENT',
          chemicalId: report.chemicalId,
          chemicalName: report.chemicalName,
          bottleId: targetBottle.id,
          bottleCode: targetBottle.bottleCode,
          quantity: Math.abs(newVol - prevVol),
          unit: targetBottle.unit,
          previousStock: prevVol,
          newStock: newVol,
          user: currentUser.name,
          notes: `[Điều chỉnh chênh lệch] ${notes || report.reason}`,
        };
        setTransactions((prev) => [tx, ...prev]);
      }

      setDiscrepancyReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: 'RESOLVED',
                resolvedBy: currentUser.name,
                resolvedDate: new Date().toISOString(),
                resolutionNotes: notes || 'Đã điều chỉnh theo số lượng thực tế kiểm kê.',
              }
            : r
        )
      );

      logAudit(
        'STOCK ADJUSTMENT',
        'ADJUSTMENT',
        reportId,
        `${currentUser.name} đã duyệt điều chỉnh tồn kho cho ${report.chemicalName}. Tồn kho cập nhật: ${targetQty} ${report.unit}.`
      );

      return { success: true, message: `Đã duyệt và điều chỉnh tồn kho thành công.` };
    }

    // REJECT
    setDiscrepancyReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              status: 'REJECTED',
              resolvedBy: currentUser.name,
              resolvedDate: new Date().toISOString(),
              resolutionNotes: notes || 'Quản lý từ chối điều chỉnh sau khi kiểm tra lại chai.',
            }
          : r
      )
    );

    logAudit('TỪ CHỐI BÁO CÁO CHÊNH LỆCH', 'DISCREPANCY', reportId, `${currentUser.name} từ chối báo cáo chênh lệch.`);
    return { success: true, message: 'Đã từ chối báo cáo chênh lệch.' };
  };

  const createStockAdjustment = ({
    chemicalId,
    bottleId,
    adjustmentAmount,
    unit,
    reason,
  }: {
    chemicalId: string;
    bottleId?: string;
    adjustmentAmount: number;
    unit: ChemicalUnit;
    reason: string;
  }) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý (MANAGER) mới có quyền tạo điều chỉnh tồn kho (Stock Adjustment).' };
    }

    const chem = chemicals.find((c) => c.id === chemicalId);
    if (!chem) return { success: false, message: 'Không tìm thấy hóa chất.' };

    const targetBottle = bottleId ? bottles.find((b) => b.id === bottleId) : bottles.find((b) => b.chemicalId === chemicalId);
    if (!targetBottle) return { success: false, message: 'Không tìm thấy chai để điều chỉnh.' };

    const prevVol = targetBottle.currentVolume;
    const newVol = Math.max(0, Math.round((prevVol + adjustmentAmount) * 10000) / 10000);
    const newStatus = calculateBottleStatus(newVol, targetBottle.initialVolume, targetBottle.expiryDate, referenceDate);

    setBottles((prev) =>
      prev.map((b) => (b.id === targetBottle.id ? { ...b, currentVolume: newVol, status: newStatus } : b))
    );

    const txId = `tx-adj-direct-${Date.now()}`;
    const tx: InventoryTransaction = {
      id: txId,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      type: 'ADJUSTMENT',
      chemicalId: chem.id,
      chemicalName: chem.name,
      bottleId: targetBottle.id,
      bottleCode: targetBottle.bottleCode,
      quantity: Math.abs(adjustmentAmount),
      unit,
      previousStock: prevVol,
      newStock: newVol,
      user: currentUser.name,
      notes: `[Stock Adjustment] ${reason}`,
    };
    setTransactions((prev) => [tx, ...prev]);

    logAudit(
      'STOCK ADJUSTMENT',
      'ADJUSTMENT',
      txId,
      `${currentUser.name} điều chỉnh tồn kho chai ${targetBottle.bottleCode} (${chem.name}): ${prevVol} → ${newVol} ${targetBottle.unit}. Lý do: ${reason}`
    );

    return {
      success: true,
      message: `Đã điều chỉnh tồn kho chai ${targetBottle.bottleCode}: ${prevVol} → ${newVol} ${targetBottle.unit}.`,
    };
  };

  // =========================================================================
  // NOTIFICATIONS & EMAIL NOTIFICATIONS (Section 60, 61, and user request)
  // =========================================================================
  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.read && (n.targetRole === 'ALL' || (isManager ? n.targetRole === 'MANAGER' : n.targetRole === 'USER'))).length;
  }, [notifications, isManager]);

  const updateEmailSettings = (update: Partial<EmailSettings>) => {
    setEmailSettings((prev) => ({ ...prev, ...update }));
    logAudit('CẬP NHẬT CẤU HÌNH EMAIL', 'SETTINGS', 'EMAIL', `${currentUser.name} cập nhật cấu hình email thông báo tự động.`);
  };

  const sendManualTestEmailAlert = (chemicalId?: string) => {
    const chem = chemicalId ? chemicals.find((c) => c.id === chemicalId) : chemicals[0];
    if (!chem) return { success: false, message: 'Không tìm thấy hóa chất để thử nghiệm.' };

    const { total } = getChemicalTotalStock(chem.id);
    dispatchAutomatedEmailAlert(chem, total, chem.warningStock, 'LOW_STOCK');
    return {
      success: true,
      message: `Đã gửi email thử nghiệm cảnh báo tồn kho tới ${emailSettings.managerEmail} thành công!`,
    };
  };

  // =========================================================================
  // MASTER CHEMICAL CRUD (Manager Only)
  // =========================================================================
  const addChemical = (chemicalData: Omit<Chemical, 'id'>) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý (MANAGER) mới có quyền thêm danh mục hóa chất mới.' };
    }

    const newId = `chem-${chemicalData.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 15)}-${Date.now().toString(36)}`;
    const newChem: Chemical = {
      ...chemicalData,
      id: newId,
    };

    setChemicals((prev) => [newChem, ...prev]);

    // Initial bottle
    const initialQty = chemicalData.targetStock || chemicalData.warningStock || 1000;
    const initialBottle: Bottle = {
      id: `bottle-${newId}-001`,
      chemicalId: newId,
      bottleCode: `${chemicalData.code ? chemicalData.code.split('-')[0] : 'BOT'}-001`,
      lotNumber: `LOT-${new Date().getFullYear()}-001`,
      initialVolume: initialQty,
      currentVolume: initialQty,
      unit: chemicalData.primaryUnit,
      expiryDate: '2028-10-01',
      receivedDate: new Date().toISOString().split('T')[0],
      location: chemicalData.storageLocation,
      status: 'FULL',
    };
    setBottles((prev) => [initialBottle, ...prev]);

    if (isSupabaseConfigured()) {
      chemicalService.insert(newChem).catch((err) => console.warn('Supabase chemical insert error:', err));
      bottleService.insert(initialBottle).catch((err) => console.warn('Supabase bottle insert error:', err));
    }

    logAudit('Thêm hóa chất mới', 'CHEMICAL', newId, `${currentUser.name} đã thêm hóa chất: ${newChem.name}`);
    return { success: true, message: `Đã thêm hóa chất "${newChem.name}" thành công!`, chemical: newChem };
  };

  const updateChemical = (id: string, chemicalUpdate: Partial<Chemical>) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý (MANAGER) mới có quyền sửa hóa chất.' };
    }
    const existing = chemicals.find((c) => c.id === id);
    if (!existing) return { success: false, message: 'Không tìm thấy hóa chất.' };

    setChemicals((prev) => prev.map((c) => (c.id === id ? { ...c, ...chemicalUpdate } : c)));

    if (isSupabaseConfigured()) {
      chemicalService.update(id, chemicalUpdate).catch((err) => console.warn('Supabase chemical update error:', err));
    }

    logAudit('Cập nhật thông tin hóa chất', 'CHEMICAL', id, `${currentUser.name} đã sửa hóa chất ${existing.name}`);
    return { success: true, message: `Đã cập nhật hóa chất "${existing.name}".` };
  };

  const archiveChemical = (id: string, reason?: string) => {
    const canDelete = isManager || currentUser.permissions?.deleteChemical || currentUser.permissions?.archiveChemical;
    if (!canDelete) {
      return { success: false, message: 'ACCESS DENIED (403): Chỉ Quản lý (MANAGER) mới có quyền xóa hoặc lưu trữ hóa chất.' };
    }
    const chem = chemicals.find((c) => c.id === id);
    if (!chem) return { success: false, message: 'Không tìm thấy hóa chất.' };

    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const deleteReason = reason?.trim() || 'Hóa chất không còn sử dụng';

    // Total stock at deletion
    const totalStockInfo = getChemicalTotalStock(chem.id);
    const chemBottleIds = bottles.filter((b) => b.chemicalId === id).map((b) => b.id);

    // Soft delete Chemical: status = 'ARCHIVED'
    setChemicals((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: 'ARCHIVED',
              archivedDate: today,
              archivedReason: deleteReason,
              deletedAt: nowIso,
              deletedBy: currentUser.name,
              deletionReason: deleteReason,
              updatedAt: nowIso,
            }
          : c
      )
    );

    // Cascade Soft delete to Bottles of this chemical
    setBottles((prev) =>
      prev.map((b) =>
        b.chemicalId === id && b.status !== 'ARCHIVED'
          ? {
              ...b,
              previousStatus: b.status,
              status: 'ARCHIVED',
              archivedAt: nowIso,
              archivedBy: currentUser.name,
            }
          : b
      )
    );

    // Record DeletionLog
    const delLog: DeletionLog = {
      id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      entityType: 'CHEMICAL',
      entityId: id,
      chemicalId: id,
      chemicalName: chem.name,
      bottleIds: chemBottleIds,
      stockAtDeletion: totalStockInfo.total,
      unit: totalStockInfo.unit,
      deletedBy: currentUser.name,
      deletedAt: nowIso,
      reason: deleteReason,
      previousStatus: chem.status || 'ACTIVE',
    };
    setDeletionLogs((prev) => [delLog, ...prev]);

    logAudit(
      'XÓA MỀM / LƯU TRỮ HÓA CHẤT',
      'CHEMICAL',
      id,
      `${currentUser.name} đã chuyển ${chem.name} vào Kho lưu trữ (Archive). Tồn kho: ${totalStockInfo.total} ${totalStockInfo.unit}. Lý do: ${deleteReason}`
    );

    if (isSupabaseConfigured()) {
      chemicalService.softDelete(id, currentUser.id, currentUser.name, deleteReason).catch((err) => console.warn('Supabase chemical archive error:', err));
    }

    return { success: true, message: `Đã chuyển hóa chất "${chem.name}" vào Kho lưu trữ / Thùng rác. Lịch sử giao dịch được bảo toàn.` };
  };

  const restoreChemical = (id: string, reason?: string) => {
    const canRestore = isManager || currentUser.permissions?.restoreChemical || currentUser.permissions?.deleteChemical;
    if (!canRestore) {
      return { success: false, message: 'ACCESS DENIED (403): Chỉ Quản lý (MANAGER) mới có quyền khôi phục hóa chất.' };
    }
    const chem = chemicals.find((c) => c.id === id);
    if (!chem) return { success: false, message: 'Không tìm thấy hóa chất.' };

    // Requirement 35: Duplicate chemical check before restore
    const activeDuplicate = chemicals.find(
      (c) =>
        c.id !== id &&
        c.status !== 'ARCHIVED' &&
        ((chem.code && c.code && c.code.toLowerCase() === chem.code.toLowerCase()) ||
         (chem.casNumber && c.casNumber && c.casNumber.toLowerCase() === chem.casNumber.toLowerCase()))
    );
    if (activeDuplicate) {
      return {
        success: false,
        message: `Không thể khôi phục trực tiếp vì đã có hóa chất đang hoạt động "${activeDuplicate.name}" trùng mã (${activeDuplicate.code}) hoặc CAS (${activeDuplicate.casNumber}).`,
      };
    }

    const nowIso = new Date().toISOString();
    const restoreReason = reason || 'Khôi phục bởi Quản lý';

    if (isSupabaseConfigured()) {
      chemicalService.restore(id).catch((err) => console.warn('Supabase chemical restore error:', err));
    }

    // Restore Chemical to ACTIVE
    setChemicals((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: 'ACTIVE',
              archivedDate: undefined,
              archivedReason: undefined,
              deletedAt: undefined,
              deletedBy: undefined,
              deletionReason: undefined,
              updatedAt: nowIso,
            }
          : c
      )
    );

    // Restore Bottles of this chemical
    setBottles((prev) =>
      prev.map((b) =>
        b.chemicalId === id && b.status === 'ARCHIVED'
          ? {
              ...b,
              status: b.previousStatus || (b.currentVolume <= 0 ? 'EMPTY' : 'IN_USE'),
              archivedAt: undefined,
              archivedBy: undefined,
            }
          : b
      )
    );

    // Record RestoreLog
    const restLog: RestoreLog = {
      id: `rest-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      entityType: 'CHEMICAL',
      entityId: id,
      chemicalId: id,
      chemicalName: chem.name,
      restoredBy: currentUser.name,
      restoredAt: nowIso,
      reason: restoreReason,
      previousStatus: 'ARCHIVED',
      newStatus: 'ACTIVE',
    };
    setRestoreLogs((prev) => [restLog, ...prev]);

    logAudit('KHÔI PHỤC HÓA CHẤT', 'CHEMICAL', id, `${currentUser.name} đã khôi phục ${chem.name} về danh mục hoạt động.`);
    return { success: true, message: `Đã khôi phục thành công hóa chất "${chem.name}" về kho hoạt động!` };
  };

  const deleteChemical = (id: string, reason?: string) => {
    // Requirements 25 & 44: Soft delete only, never hard delete!
    return archiveChemical(id, reason);
  };

  // Bottle management (Mục 3, 5, 8, Soft Delete & Restore Bottle)
  const deleteBottle = (bottleId: string, reason: string) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED (403): Chỉ Quản lý mới có quyền xóa chai hóa chất.' };
    }
    const b = bottles.find((x) => x.id === bottleId);
    if (!b) return { success: false, message: 'Không tìm thấy chai.' };

    const chem = chemicals.find((c) => c.id === b.chemicalId);
    const nowIso = new Date().toISOString();
    const deleteReason = reason || 'Chai lưu trữ / xóa mềm';

    setBottles((prev) =>
      prev.map((item) =>
        item.id === bottleId
          ? {
              ...item,
              previousStatus: item.status,
              status: 'ARCHIVED',
              archivedAt: nowIso,
              archivedBy: currentUser.name,
            }
          : item
      )
    );

    const delLog: DeletionLog = {
      id: `del-bot-${Date.now()}`,
      entityType: 'BOTTLE',
      entityId: bottleId,
      chemicalId: b.chemicalId,
      chemicalName: chem?.name || 'Unknown',
      bottleIds: [b.id],
      stockAtDeletion: b.currentVolume,
      unit: b.unit,
      deletedBy: currentUser.name,
      deletedAt: nowIso,
      reason: deleteReason,
      previousStatus: b.status,
    };
    setDeletionLogs((prev) => [delLog, ...prev]);

    logAudit('XÓA MỀM CHAI', 'BOTTLE', bottleId, `${currentUser.name} đã lưu trữ chai ${b.bottleCode}. Lý do: ${deleteReason}`);
    return { success: true, message: `Đã lưu trữ chai ${b.bottleCode} thành công.` };
  };

  const restoreBottle = (bottleId: string) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED (403): Chỉ Quản lý mới có quyền khôi phục chai.' };
    }
    const b = bottles.find((x) => x.id === bottleId);
    if (!b) return { success: false, message: 'Không tìm thấy chai.' };

    const chem = chemicals.find((c) => c.id === b.chemicalId);
    const nowIso = new Date().toISOString();

    setBottles((prev) =>
      prev.map((item) =>
        item.id === bottleId
          ? {
              ...item,
              status: item.previousStatus || (item.currentVolume <= 0 ? 'EMPTY' : 'IN_USE'),
              archivedAt: undefined,
              archivedBy: undefined,
            }
          : item
      )
    );

    const restLog: RestoreLog = {
      id: `rest-bot-${Date.now()}`,
      entityType: 'BOTTLE',
      entityId: bottleId,
      chemicalId: b.chemicalId,
      chemicalName: chem?.name || 'Unknown',
      restoredBy: currentUser.name,
      restoredAt: nowIso,
      previousStatus: 'ARCHIVED',
      newStatus: b.previousStatus || 'IN_USE',
    };
    setRestoreLogs((prev) => [restLog, ...prev]);

    logAudit('KHÔI PHỤC CHAI', 'BOTTLE', bottleId, `${currentUser.name} đã khôi phục chai ${b.bottleCode}.`);
    return { success: true, message: `Đã khôi phục chai ${b.bottleCode} về danh mục hoạt động.` };
  };

  // Bottle management (Mục 3, 5, 8)
  const updateBottle = (id: string, update: Partial<Bottle>) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý mới có quyền sửa thông tin chai.' };
    }
    const existing = bottles.find((b) => b.id === id);
    if (!existing) return { success: false, message: 'Không tìm thấy chai.' };

    // Section 5: Current quantity must NOT be edited directly via general edit
    const safeUpdate = { ...update };
    delete (safeUpdate as any).currentVolume;

    setBottles((prev) => prev.map((b) => (b.id === id ? { ...b, ...safeUpdate } : b)));
    logAudit('SỬA THÔNG TIN CHAI', 'BOTTLE', id, `${currentUser.name} đã cập nhật thông tin chai ${existing.bottleCode}`);
    return { success: true, message: `Đã cập nhật chai "${existing.bottleCode}" thành công.` };
  };

  const disposeBottle = ({
    bottleId,
    reason,
    disposalVolume,
    notes,
  }: {
    bottleId: string;
    reason: string;
    disposalVolume?: number;
    notes?: string;
  }) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý mới có quyền thanh lý chai hóa chất.' };
    }

    const bottle = bottles.find((b) => b.id === bottleId);
    if (!bottle) return { success: false, message: 'Không tìm thấy chai.' };

    const chem = chemicals.find((c) => c.id === bottle.chemicalId);
    const today = new Date().toISOString().split('T')[0];
    const prevVol = bottle.currentVolume;
    const finalDisposalVol = disposalVolume !== undefined ? disposalVolume : prevVol;

    // Update bottle status to DISPOSED and set volume to 0
    setBottles((prev) =>
      prev.map((b) =>
        b.id === bottleId
          ? {
              ...b,
              currentVolume: 0,
              status: 'DISPOSED',
              disposedDate: today,
              disposalReason: reason,
              disposedBy: currentUser.name,
              disposalNotes: notes,
            }
          : b
      )
    );

    // Create DISPOSAL transaction (Section 8)
    const txId = `tx-disp-${Date.now()}`;
    const tx: InventoryTransaction = {
      id: txId,
      timestamp: new Date().toISOString(),
      date: today,
      type: 'DISPOSAL',
      chemicalId: bottle.chemicalId,
      chemicalName: chem ? chem.name : bottle.chemicalId,
      bottleId: bottle.id,
      bottleCode: bottle.bottleCode,
      quantity: finalDisposalVol,
      unit: bottle.unit,
      previousStock: prevVol,
      newStock: 0,
      user: currentUser.name,
      notes: `[Thanh lý chai] Lý do: ${reason}. ${notes || ''}`,
    };
    setTransactions((prev) => [tx, ...prev]);

    logAudit(
      'THANH LÝ CHAI HÓA CHẤT',
      'BOTTLE',
      bottle.id,
      `${currentUser.name} thanh lý chai ${bottle.bottleCode} (${finalDisposalVol} ${bottle.unit}). Lý do: ${reason}`
    );

    return {
      success: true,
      message: `Đã thanh lý chai ${bottle.bottleCode}. Lượng tồn giảm ${finalDisposalVol} ${bottle.unit} về 0. Lịch sử giao dịch được bảo toàn vĩnh viễn.`,
    };
  };

  const stockAdjustment = ({
    bottleId,
    physicalQuantity,
    reason,
    notes,
  }: {
    bottleId: string;
    physicalQuantity: number;
    reason: string;
    notes?: string;
  }) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý mới có quyền điều chỉnh tồn kho thực tế.' };
    }

    const bottle = bottles.find((b) => b.id === bottleId);
    if (!bottle) return { success: false, message: 'Không tìm thấy chai để điều chỉnh.' };

    const chem = chemicals.find((c) => c.id === bottle.chemicalId);
    const prevVol = bottle.currentVolume;
    const newVol = Math.max(0, Math.round(physicalQuantity * 10000) / 10000);
    const diff = Math.round((newVol - prevVol) * 10000) / 10000;
    const today = new Date().toISOString().split('T')[0];

    const newStatus = calculateBottleStatus(newVol, bottle.initialVolume, bottle.expiryDate, referenceDate, bottle.openedDate);

    setBottles((prev) =>
      prev.map((b) => (b.id === bottleId ? { ...b, currentVolume: newVol, status: newStatus } : b))
    );

    const txId = `tx-adj-${Date.now()}`;
    const tx: InventoryTransaction = {
      id: txId,
      timestamp: new Date().toISOString(),
      date: today,
      type: 'ADJUSTMENT',
      chemicalId: bottle.chemicalId,
      chemicalName: chem ? chem.name : bottle.chemicalId,
      bottleId: bottle.id,
      bottleCode: bottle.bottleCode,
      quantity: Math.abs(diff),
      unit: bottle.unit,
      previousStock: prevVol,
      newStock: newVol,
      user: currentUser.name,
      notes: `[Điều chỉnh tồn kho thực tế] Hệ thống: ${prevVol} ${bottle.unit} → Thực tế: ${newVol} ${bottle.unit} (${diff >= 0 ? '+' : ''}${diff}). Lý do: ${reason}. ${notes || ''}`,
    };
    setTransactions((prev) => [tx, ...prev]);

    logAudit(
      'STOCK ADJUSTMENT',
      'ADJUSTMENT',
      txId,
      `${currentUser.name} điều chỉnh tồn kho chai ${bottle.bottleCode} (${chem?.name}): ${prevVol} → ${newVol} ${bottle.unit} (${diff >= 0 ? '+' : ''}${diff}). Lý do: ${reason}`
    );

    return {
      success: true,
      message: `Đã điều chỉnh tồn kho chai ${bottle.bottleCode}: ${prevVol} → ${newVol} ${bottle.unit} (${diff >= 0 ? '+' : ''}${diff}). Đã tạo giao dịch và lưu Audit Log.`,
    };
  };

  // Suppliers management (Mục 32)
  const addSupplier = (supplierData: Omit<Supplier, 'id'>) => {
    if (!isManager) return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý mới có quyền thêm nhà cung cấp.' };
    const newId = `supp-${Date.now().toString(36)}`;
    const newSupplier: Supplier = { ...supplierData, id: newId };
    setSuppliers((prev) => [...prev, newSupplier]);
    logAudit('THÊM NHÀ CUNG CẤP', 'SETTINGS', newId, `${currentUser.name} đã thêm nhà cung cấp: ${newSupplier.name}`);
    return { success: true, message: `Đã thêm nhà cung cấp "${newSupplier.name}".` };
  };

  const updateSupplier = (id: string, update: Partial<Supplier>) => {
    if (!isManager) return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý mới có quyền sửa nhà cung cấp.' };
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));
    logAudit('SỬA NHÀ CUNG CẤP', 'SETTINGS', id, `${currentUser.name} đã sửa thông tin nhà cung cấp.`);
    return { success: true, message: 'Đã cập nhật thông tin nhà cung cấp.' };
  };

  const deleteSupplier = (id: string) => {
    if (!isManager) return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý mới có quyền xóa nhà cung cấp.' };
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    logAudit('XÓA NHÀ CUNG CẤP', 'SETTINGS', id, `${currentUser.name} đã xóa nhà cung cấp.`);
    return { success: true, message: 'Đã xóa nhà cung cấp.' };
  };

  // Inventory Audit Sessions (Mục 25)
  const startAuditSession = (notes?: string): InventoryAuditSession => {
    const newSession: InventoryAuditSession = {
      id: `audit-sess-${Date.now()}`,
      code: `KIEMKE-${new Date().getFullYear()}-${String(auditSessions.length + 1).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0],
      conductedBy: currentUser.name,
      status: 'IN_PROGRESS',
      items: [],
      notes,
    };
    setAuditSessions((prev) => [newSession, ...prev]);
    return newSession;
  };

  const saveAuditItem = (sessionId: string, item: InventoryAuditItem) => {
    setAuditSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const exists = s.items.findIndex((i) => i.bottleId === item.bottleId);
        const newItems = exists >= 0 ? s.items.map((i, idx) => (idx === exists ? item : i)) : [...s.items, item];
        return { ...s, items: newItems };
      })
    );
  };

  const completeAuditSession = (sessionId: string) => {
    if (!isManager) return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý mới có quyền chốt kiểm kê.', adjustmentsCreated: 0 };
    const session = auditSessions.find((s) => s.id === sessionId);
    if (!session) return { success: false, message: 'Không tìm thấy đợt kiểm kê.', adjustmentsCreated: 0 };

    let adjustmentsCount = 0;
    session.items.forEach((item) => {
      if (Math.abs(item.difference) > 0.0001) {
        stockAdjustment({
          bottleId: item.bottleId,
          physicalQuantity: item.physicalVolume,
          reason: `Kiểm kê định kỳ [${session.code}]: ${item.reason || 'Điều chỉnh theo số liệu thực tế'}`,
        });
        adjustmentsCount++;
      }
    });

    setAuditSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: 'COMPLETED' } : s))
    );

    logAudit('HOÀN THÀNH KIỂM KÊ KHO', 'ADJUSTMENT', sessionId, `${currentUser.name} đã chốt đợt kiểm kê ${session.code}, tạo ${adjustmentsCount} phiếu điều chỉnh tồn kho.`);
    return {
      success: true,
      message: `Đã hoàn thành kiểm kê ${session.code}! Đã tự động tạo ${adjustmentsCount} phiếu điều chỉnh tồn kho.`,
      adjustmentsCreated: adjustmentsCount,
    };
  };

  const updatePurchaseStatus = (id: string, status: 'PENDING' | 'ORDERED' | 'RECEIVED') => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý (MANAGER) mới có quyền duyệt đơn mua hàng.' };
    }
    const item = purchaseItems.find((p) => p.id === id);
    if (!item) return { success: false, message: 'Không tìm thấy đơn hàng dự kiến.' };

    const today = new Date().toISOString().split('T')[0];

    if (status === 'RECEIVED') {
      const chem = chemicals.find((c) => c.id === item.chemicalId);
      if (chem) {
        stockIn({
          chemicalId: chem.id,
          quantity: item.recommendedPurchase,
          unit: item.unit,
          lotNumber: `LOT-REC-${Date.now().toString(36).toUpperCase()}`,
          supplier: item.supplier,
          expiryDate: '2028-10-01',
          purchaseDate: today,
          notes: `Nhập kho tự động từ đơn đặt hàng đã nhận (#${item.id})`,
        });
      }
    }

    setPurchaseItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status,
              orderedDate: status === 'ORDERED' ? today : p.orderedDate,
              receivedDate: status === 'RECEIVED' ? today : p.receivedDate,
            }
          : p
      )
    );

    logAudit('Cập nhật đơn mua sắm', 'PURCHASE', id, `${currentUser.name} chuyển trạng thái đơn ${item.chemicalName} sang ${status}`);
    return { success: true, message: `Đã cập nhật trạng thái đơn sang "${status}".` };
  };

  const addCustomPurchaseItem = (item: Omit<PurchaseItem, 'id'>) => {
    if (!isManager) {
      return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý (MANAGER) mới có quyền.' };
    }
    const newId = `purch-custom-${Date.now().toString(36)}`;
    const newItem: PurchaseItem = { ...item, id: newId };
    setPurchaseItems((prev) => [newItem, ...prev]);
    logAudit('Thêm yêu cầu mua sắm thủ công', 'PURCHASE', newId, `${currentUser.name} đã thêm đề xuất mua ${item.chemicalName}`);
    return { success: true, message: `Đã thêm đề xuất mua ${item.chemicalName}.` };
  };

  // Storage Cabinets Catalog Management (Quản lý Danh mục Tủ)
  const addStorageCabinet = (cabinet: Omit<StorageCabinet, 'id'>) => {
    const newId = `cab-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const newCabinet: StorageCabinet = {
      ...cabinet,
      id: newId,
      displayName: cabinet.displayName || `${cabinet.name} (${cabinet.room}, ${cabinet.building})`,
    };
    setStorageCabinets((prev) => [...prev, newCabinet]);
    logAudit('THÊM VỊ TRÍ TỦ', 'SETTINGS', newId, `${currentUser.name} đã thêm tủ lưu trữ mới: ${cabinet.name} (${cabinet.room})`);
    return { success: true, message: `Đã thêm tủ "${cabinet.name}" vào danh mục thành công!`, cabinet: newCabinet };
  };

  const updateStorageCabinet = (id: string, updates: Partial<StorageCabinet>) => {
    setStorageCabinets((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    logAudit('CẬP NHẬT VỊ TRÍ TỦ', 'SETTINGS', id, `${currentUser.name} đã cập nhật thông tin tủ ID: ${id}`);
    return { success: true, message: 'Đã cập nhật thông tin vị trí tủ thành công!' };
  };

  const deleteStorageCabinet = (id: string) => {
    const cab = storageCabinets.find((c) => c.id === id);
    if (!cab) return { success: false, message: 'Không tìm thấy vị trí tủ.' };

    const inUse = bottles.some(
      (b) =>
        b.location.cabinet?.trim().toLowerCase() === cab.name.trim().toLowerCase() &&
        b.status !== 'DISPOSED' &&
        b.status !== 'EMPTY'
    );
    if (inUse) {
      return {
        success: false,
        message: `Không thể xóa tủ "${cab.name}" vì hiện vẫn còn chai hóa chất hoạt động cất giữ tại đây.`,
      };
    }

    setStorageCabinets((prev) => prev.filter((c) => c.id !== id));
    logAudit('XÓA VỊ TRÍ TỦ', 'SETTINGS', id, `${currentUser.name} đã xóa tủ "${cab.name}" khỏi danh mục.`);
    return { success: true, message: `Đã xóa tủ "${cab.name}" khỏi danh mục thành công!` };
  };

  // =========================================================================
  // EXCEL / CSV / GOOGLE SHEETS BATCH IMPORT (Sections 66 - 75)
  // =========================================================================
  const importExcelChemicals = (
    parsedRows: ParsedImportRow[],
    duplicateHandling: 'SKIP' | 'UPDATE' | 'CANCEL'
  ) => {
    if (!isManager) {
      return {
        success: false,
        message: 'ACCESS DENIED: Chức năng nhập kho bằng Excel / Google Sheets chỉ dành riêng cho QUẢN LÝ (MANAGER).',
        importedCount: 0,
      };
    }

    if (duplicateHandling === 'CANCEL') {
      return { success: false, message: 'Đã hủy thao tác nhập dữ liệu.', importedCount: 0 };
    }

    // Filter out error rows - only import VALID and WARNING rows
    const actionableRows = parsedRows.filter((r) => r.status !== 'ERROR');
    if (actionableRows.length === 0) {
      return { success: false, message: 'Không có dòng hợp lệ nào để nhập kho.', importedCount: 0 };
    }

    let newChemicalsCount = 0;
    let updatedChemicalsCount = 0;
    let newBottlesCount = 0;
    let skippedRowsCount = 0;

    const newChemicals: Chemical[] = [...chemicals];
    const newBottles: Bottle[] = [...bottles];
    const newTransactions: InventoryTransaction[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Helper map for fast lookup
    const chemByCas = new Map<string, Chemical>();
    const chemByCode = new Map<string, Chemical>();
    newChemicals.forEach((c) => {
      if (c.casNumber) chemByCas.set(c.casNumber.trim().toLowerCase(), c);
      if (c.code) chemByCode.set(c.code.trim().toUpperCase(), c);
    });

    const bottleCodeSet = new Set(newBottles.map((b) => b.bottleCode.trim().toUpperCase()));

    for (const row of actionableRows) {
      const cleanCas = row.casNumber ? row.casNumber.trim().toLowerCase() : '';
      const cleanCode = row.chemicalCode ? row.chemicalCode.trim().toUpperCase() : '';

      // Check duplicate chemical (Section 75)
      let targetChem: Chemical | undefined =
        (cleanCas ? chemByCas.get(cleanCas) : undefined) ||
        (cleanCode ? chemByCode.get(cleanCode) : undefined);

      if (targetChem) {
        // Section 75: Chemical already exists
        if (duplicateHandling === 'UPDATE') {
          // Update information
          targetChem.englishName = row.englishName || targetChem.englishName;
          targetChem.chemicalFormula = row.formula || targetChem.chemicalFormula;
          if (row.molecularWeight) targetChem.molecularWeight = row.molecularWeight;
          targetChem.grade = (row.grade as ChemicalGrade) || targetChem.grade;
          targetChem.category = (row.category as ChemicalCategory) || targetChem.category;
          targetChem.manufacturer = row.manufacturer || targetChem.manufacturer;
          targetChem.warningStock = row.warningStock || targetChem.warningStock;
          targetChem.minimumStock = row.minimumStock || targetChem.minimumStock;
          targetChem.targetStock = row.targetStock || targetChem.targetStock;
          updatedChemicalsCount++;
        }
      } else {
        // Create new Chemical
        const chemId = `chem-${(row.chemicalCode || row.chemicalName).toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 16)}-${Date.now().toString(36)}`;
        const createdChem: Chemical = {
          id: chemId,
          code: row.chemicalCode || `HC-${String(newChemicals.length + 1).padStart(3, '0')}`,
          name: row.chemicalName,
          englishName: row.englishName || row.chemicalName,
          casNumber: row.casNumber || '',
          chemicalFormula: row.formula || '',
          molecularWeight: row.molecularWeight,
          grade: (row.grade as ChemicalGrade) || 'AR',
          category: (row.category as ChemicalCategory) || 'Solvents',
          physicalForm: 'liquid',
          primaryUnit: row.unit || 'mL',
          minimumStock: row.minimumStock || 500,
          warningStock: row.warningStock || 850,
          targetStock: row.targetStock || 1500,
          unitPrice: 0,
          storageConditions: '15-25°C',
          safetyInfo: {
            ghsPictograms: [],
            hazardClass: '',
            ppe: ['Găng tay', 'Kính bảo hộ'],
            incompatibilities: '',
          },
          responsiblePerson: currentUser.name,
          storageLocation: row.location || {
            building: 'Building A',
            room: 'Room 302',
            cabinet: 'Cabinet C1',
            shelf: 'Shelf 1',
          },
          manufacturer: row.manufacturer || row.supplier || 'Merck KGaA',
        };
        newChemicals.push(createdChem);
        if (cleanCas) chemByCas.set(cleanCas, createdChem);
        if (createdChem.code) chemByCode.set(createdChem.code.trim().toUpperCase(), createdChem);
        targetChem = createdChem;
        newChemicalsCount++;
      }

      if (!targetChem) continue;

      // Check Bottle Code Duplicate
      const bCode = row.bottleCode.trim().toUpperCase();
      if (bottleCodeSet.has(bCode)) {
        if (duplicateHandling === 'SKIP') {
          skippedRowsCount++;
          continue;
        }
      }

      // Create new Bottle
      const bottleId = `bottle-${targetChem.id}-${bCode || Date.now().toString(36)}`;
      const newBottle: Bottle = {
        id: bottleId,
        chemicalId: targetChem.id,
        bottleCode: row.bottleCode || `${targetChem.code}-001`,
        lotNumber: row.lotNumber || `LOT-${new Date().getFullYear()}-001`,
        initialVolume: row.quantity,
        currentVolume: row.quantity, // Section 69: Current volume equals initial volume
        unit: row.unit,
        expiryDate: row.expiryDate,
        receivedDate: today,
        openedDate: row.openedDate,
        location: row.location || targetChem.storageLocation,
        status: calculateBottleStatus(row.quantity, row.quantity, row.expiryDate, referenceDate),
      };

      newBottles.push(newBottle);
      bottleCodeSet.add(bCode);
      newBottlesCount++;

      // Section 70: Create Stock In Transaction
      const txId = `tx-nk-excel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      newTransactions.push({
        id: txId,
        timestamp: new Date().toISOString(),
        date: today,
        type: 'STOCK_IN',
        chemicalId: targetChem.id,
        chemicalName: targetChem.name,
        bottleId: newBottle.id,
        bottleCode: newBottle.bottleCode,
        quantity: row.quantity,
        unit: row.unit,
        previousStock: 0,
        newStock: row.quantity,
        user: currentUser.name,
        notes: `[Nhập từ Excel/Google Sheets] Số lô: ${newBottle.lotNumber} · Hạn dùng: ${newBottle.expiryDate} · NCC: ${row.supplier || targetChem.manufacturer}`,
      });
    }

    setChemicals(newChemicals);
    setBottles(newBottles);
    if (newTransactions.length > 0) {
      setTransactions((prev) => [...newTransactions, ...prev]);
    }

    logAudit(
      'NHẬP KHO EXCEL / GOOGLE SHEETS',
      'IMPORT',
      'EXCEL',
      `${currentUser.name} đã nhập ${newBottlesCount} chai hóa chất (${newChemicalsCount} hóa chất mới, ${updatedChemicalsCount} cập nhật, ${skippedRowsCount} bỏ qua) từ biểu mẫu chuẩn.`
    );

    return {
      success: true,
      message: `Nhập kho thành công! Đã tạo ${newBottlesCount} chai hóa chất (${newChemicalsCount} hóa chất mới tạo, ${updatedChemicalsCount} hóa chất liên kết/cập nhật).`,
      importedCount: newBottlesCount,
    };
  };

  // Reset to Demo Data
  const resetToDemoData = () => {
    setChemicals(DEMO_CHEMICALS);
    setBottles(DEMO_BOTTLES);
    setTransactions(DEMO_TRANSACTIONS);
    setPurchaseItems(DEMO_PURCHASE_LIST);
    setUsers(DEMO_USERS);
    setCurrentUser(DEMO_USERS[0]);
    setAuditLogs([
      {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user: currentUser.name,
        action: 'Reset về dữ liệu Demo ban đầu',
        entityType: 'SETTINGS',
        entityId: 'SYSTEM',
        description: 'Đã hoàn tác và tải lại danh mục 17 hóa chất & 18 chai demo',
      },
    ]);
    localStorage.removeItem(`${STORAGE_KEY}_chemicals`);
    localStorage.removeItem(`${STORAGE_KEY}_bottles`);
    localStorage.removeItem(`${STORAGE_KEY}_transactions`);
    localStorage.removeItem(`${STORAGE_KEY}_purchase`);
    localStorage.removeItem(`${STORAGE_KEY}_audit`);
    localStorage.removeItem(`${STORAGE_KEY}_users`);
    localStorage.removeItem(`${STORAGE_KEY}_notifications`);
    localStorage.removeItem(`${STORAGE_KEY}_email_logs`);
    localStorage.removeItem(`${STORAGE_KEY}_discrepancies`);
  };

  const clearAllData = () => {
    if (!isManager) return;
    setChemicals([]);
    setBottles([]);
    setTransactions([]);
    setPurchaseItems([]);
    setAuditLogs([
      {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user: currentUser.name,
        action: 'Xóa sạch dữ liệu kho (Empty database)',
        entityType: 'SETTINGS',
        entityId: 'SYSTEM',
        description: 'Toàn bộ hóa chất và lịch sử sử dụng đã được làm rỗng.',
      },
    ]);
  };

  const exportDatabaseJSON = () => {
    const backup = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser.name,
      chemicals,
      bottles,
      transactions,
      purchaseItems,
      users,
      discrepancyReports,
      emailAlertLogs,
      auditLogs,
    };
    return JSON.stringify(backup, null, 2);
  };

  const importDatabaseJSON = (jsonStr: string) => {
    if (!isManager) return { success: false, message: 'ACCESS DENIED: Chỉ Quản lý mới có quyền phục hồi dữ liệu.' };
    try {
      const data = JSON.parse(jsonStr);
      if (!data.chemicals || !data.bottles) {
        return { success: false, message: 'Tệp JSON không hợp lệ: thiếu bảng chemicals hoặc bottles.' };
      }
      setChemicals(data.chemicals || []);
      setBottles(data.bottles || []);
      setTransactions(data.transactions || []);
      setPurchaseItems(data.purchaseItems || []);
      if (Array.isArray(data.users)) setUsers(data.users);
      if (Array.isArray(data.discrepancyReports)) setDiscrepancyReports(data.discrepancyReports);
      if (Array.isArray(data.emailAlertLogs)) setEmailAlertLogs(data.emailAlertLogs);
      logAudit('Khôi phục cơ sở dữ liệu', 'SETTINGS', 'BACKUP', 'Khôi phục toàn bộ dữ liệu từ tệp sao lưu JSON');
      return { success: true, message: 'Khôi phục cơ sở dữ liệu thành công!' };
    } catch (e: any) {
      return { success: false, message: `Lỗi đọc tệp JSON: ${e.message}` };
    }
  };

  return (
    <LabContext.Provider
      value={{
        chemicals,
        bottles,
        transactions,
        purchaseItems,
        auditLogs,
        users,
        currentUser,
        setCurrentUser,
        referenceDate,

        isManager,
        canExportHistory,
        canManageUsers,
        pendingUsersCount,

        signInWithGoogle,
        signOut,

        approveUser,
        rejectUser,
        deactivateUser,
        activateUser,
        changeUserRole,
        addUser,
        updateUser,
        changeUserDepartment,
        canManageTargetUser,
        deleteUser,
        deleteDeactivatedManager,
        restoreUser,
        updateUserLimits,
        updateUserPermissions,

        approvalRequests,
        createApprovalRequest,
        resolveApprovalRequest,

        getChemicalTotalStock,
        getChemicalBottles,
        getChemicalStockStatus,
        getChemicalExpiryStatus,

        recordUsage,
        stockIn,
        reverseTransaction,

        discrepancyReports,
        reportDiscrepancy,
        resolveDiscrepancy,
        createStockAdjustment,

        notifications,
        markNotificationAsRead,
        clearAllNotifications,
        unreadNotificationsCount,
        emailAlertLogs,
        emailSettings,
        updateEmailSettings,
        sendManualTestEmailAlert,

        addChemical,
        updateChemical,
        archiveChemical,
        restoreChemical,
        deleteChemical,

        deletionLogs,
        restoreLogs,
        qrScanLogs,
        logQrScan,

        updateBottle,
        disposeBottle,
        deleteBottle,
        restoreBottle,
        stockAdjustment,

        suppliers,
        addSupplier,
        updateSupplier,
        deleteSupplier,

        auditSessions,
        startAuditSession,
        saveAuditItem,
        completeAuditSession,

        updatePurchaseStatus,
        addCustomPurchaseItem,
        importExcelChemicals,

        storageCabinets,
        addStorageCabinet,
        updateStorageCabinet,
        deleteStorageCabinet,

        resetToDemoData,
        clearAllData,
        exportDatabaseJSON,
        importDatabaseJSON,

        // Supabase Cloud Database & Realtime Sync
        isSupabaseConfigured: isSupabaseConfigured(),
        isRealtimeActive,
        isSyncing,
        refreshFromSupabase,
      }}
    >
      {children}
    </LabContext.Provider>
  );
};

export const useLab = () => {
  const context = useContext(LabContext);
  if (!context) {
    throw new Error('useLab must be used within a LabProvider');
  }
  return context;
};

export const useLabContext = useLab;
