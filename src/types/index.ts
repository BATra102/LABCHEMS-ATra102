export type UserRole = 'MANAGER' | 'USER' | 'ADMIN' | 'LAB_MANAGER' | 'MEMBER';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'DELETED';

export interface UserLimits {
  maxUsagePerTransaction?: number | null; // mL per transaction (e.g. 100 mL), null = unlimited
  dailyUsageLimit?: number | null;        // mL per day (e.g. 500 mL), null = unlimited
  dailyTransactionCount?: number | null;  // count per day (e.g. 10), null = unlimited
  maxStockInQuantity?: number | null;     // max quantity or containers per stock-in
}

export interface UserPermissions {
  viewInventory?: boolean;
  addChemical?: boolean;
  editChemical?: boolean;
  archiveChemical?: boolean;
  deleteChemical?: boolean;
  restoreChemical?: boolean;
  recordUsage?: boolean;
  viewAllUsageHistory?: boolean; // false = only see own usage
  createStockIn?: boolean;
  adjustStock?: boolean;
  importExcel?: boolean;
  viewReports?: boolean;
  manageUsers?: boolean;
}

export interface ApprovalRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: 'USAGE_LIMIT_EXCEEDED' | 'DAILY_LIMIT_EXCEEDED' | 'DAILY_COUNT_EXCEEDED' | 'STOCK_IN_LIMIT_EXCEEDED' | 'STOCK_ADJUSTMENT';
  chemicalId: string;
  chemicalName: string;
  bottleId?: string;
  bottleCode?: string;
  requestedQuantity: number;
  unit: string;
  limitValue?: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export type LocationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LocationChangeRequest {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  bottleId: string;
  bottleCode?: string;
  chemicalId?: string;
  chemicalName?: string;
  currentLocation: string;
  requestedLocation: string;
  reason?: string;
  status: LocationRequestStatus;
  managerId?: string;
  managerName?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  department: string;
  googleId?: string;
  picture?: string;
  avatar_url?: string;
  dateJoined?: string;
  lastLogin?: string;
  position?: string;
  phone?: string;
  member_code?: string;
  notes?: string;
  manager_id?: string;
  manager_name?: string;
  limits?: UserLimits;
  permissions?: UserPermissions;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_name?: string | null;
  deletion_reason?: string | null;
}

export type ChemicalGrade = 
  | 'AR'
  | 'ACS'
  | 'HPLC'
  | 'Analytical Grade'
  | 'Technical'
  | 'Ph. Eur'
  | 'USP'
  | 'Synthesis'
  | 'Standards'
  | 'Standard';

export type ChemicalCategory = 
  | 'Solvents'
  | 'Acids'
  | 'Bases'
  | 'Salts'
  | 'Buffers'
  | 'Standards'
  | 'Reagents'
  | 'Natural product reagents'
  | 'Biological reagents'
  | 'Chromatography solvents'
  | 'Other';

export type PhysicalForm = 'liquid' | 'powder' | 'solution' | 'crystal' | 'gas';

export type VolumeUnit = 'mL' | 'L' | 'µL';
export type MassUnit = 'g' | 'kg' | 'mg' | 'µg';
export type CountUnit = 'bottle' | 'vial' | 'tube';
export type ChemicalUnit = VolumeUnit | MassUnit | CountUnit;

export type GHSPictogram = 
  | 'flammable'
  | 'corrosive'
  | 'toxic'
  | 'health-hazard'
  | 'oxidizing'
  | 'compressed-gas'
  | 'environmental'
  | 'irritant'
  | 'explosive';

export interface StorageLocation {
  building: string;
  room: string;
  cabinet: string;
  shelf: string;
}

export type StorageHazardType = 'GENERAL' | 'FLAMMABLE' | 'ACID' | 'BASE' | 'TOXIC' | 'COLD' | 'DRY';

export interface StorageCabinet {
  id: string;
  name: string; // e.g. "Cabinet C1", "Cabinet Acid A1"
  displayName?: string; // e.g. "Cabinet C1 - Dung môi hữu cơ (Phòng 302, Nhà A)"
  building: string;
  room: string;
  shelves: string[]; // e.g. ["Shelf 1", "Shelf 2", "Shelf 3", "Shelf 4"]
  hazardType?: StorageHazardType;
  notes?: string;
}

export type BottleStatus = 
  | 'FULL' 
  | 'IN_USE' 
  | 'LOW' 
  | 'EMPTY' 
  | 'EXPIRED' 
  | 'DISPOSED' 
  | 'UNOPENED' 
  | 'OPENED'
  | 'ARCHIVED';

export interface QrHistoryRecord {
  oldQrId: string;
  newQrId: string;
  regeneratedBy: string;
  reason: string;
  timestamp: string;
}

export interface QrScanLog {
  id: string;
  qrId: string;
  bottleId?: string;
  bottleCode?: string;
  chemicalId: string;
  chemicalName: string;
  userId: string;
  userName: string;
  scannedAt: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  actionTaken?: 'VIEW' | 'RECORD_USAGE' | 'STOCK_IN' | 'RESTORE' | 'RELOCATE' | 'REPORT_ISSUE';
}

export interface DeletionLog {
  id: string;
  entityType: 'CHEMICAL' | 'BOTTLE';
  entityId: string;
  chemicalId: string;
  chemicalName: string;
  bottleIds: string[];
  stockAtDeletion: number;
  unit: ChemicalUnit;
  deletedBy: string;
  deletedAt: string;
  reason: string;
  previousStatus: string;
}

export interface RestoreLog {
  id: string;
  entityType: 'CHEMICAL' | 'BOTTLE';
  entityId: string;
  chemicalId: string;
  chemicalName: string;
  restoredBy: string;
  restoredAt: string;
  reason?: string;
  previousStatus: string;
  newStatus: string;
}

export interface Bottle {
  id: string; // e.g. bottle-hex-001
  chemicalId: string;
  bottleCode: string; // e.g. HEX-001
  qrId?: string; // Bottle-level Unique QR ID e.g. "LAB-HEX-001"
  qrToken?: string; // Verification token
  qrHistory?: QrHistoryRecord[];
  lotNumber: string;
  initialVolume: number;
  currentVolume: number;
  unit: ChemicalUnit;
  openedDate?: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  receivedDate: string; // YYYY-MM-DD
  location: StorageLocation;
  barcode?: string;
  notes?: string;
  status: BottleStatus;
  disposedDate?: string;
  disposalReason?: string;
  disposedBy?: string;
  disposalNotes?: string;
  archivedAt?: string;
  archivedBy?: string;
  previousStatus?: BottleStatus;
}

export interface ChemicalSafety {
  ghsPictograms: GHSPictogram[];
  hazardClass: string;
  ppe: string[];
  incompatibilities: string;
  sdsUrl?: string;
}

export type ChemicalStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'DISPOSED';

export interface Chemical {
  id: string;
  code: string;
  name: string;
  englishName: string;
  casNumber: string;
  chemicalFormula: string;
  molecularWeight?: number;
  grade: ChemicalGrade;
  category: ChemicalCategory;
  physicalForm: PhysicalForm;
  primaryUnit: ChemicalUnit;
  manufacturer: string;
  catalogNumber?: string;
  minimumStock: number; // Critical threshold (<= minStock -> CRITICAL)
  warningStock: number; // Low stock threshold (<= warnStock -> LOW_STOCK)
  targetStock: number;  // Used for target stock purchase calculation
  unitPrice: number;    // VND
  storageLocation: StorageLocation;
  storageConditions: string;
  safetyInfo: ChemicalSafety;
  responsiblePerson: string;
  notes?: string;
  status?: ChemicalStatus; // ACTIVE | INACTIVE | ARCHIVED (Mục 7 & 10)
  archivedDate?: string;
  archivedReason?: string;
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  isDemo?: boolean;
}

export type TransactionType = 'USAGE' | 'STOCK_IN' | 'INITIAL' | 'ADJUSTMENT' | 'DISPOSAL' | 'REVERSAL';

export interface InventoryTransaction {
  id: string;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  type: TransactionType;
  chemicalId: string;
  chemicalName: string;
  bottleId?: string;
  bottleCode?: string;
  quantity: number;
  unit: ChemicalUnit;
  previousStock: number;
  newStock: number;
  user: string;
  userId?: string;
  userEmail?: string;
  source?: 'QR_SCAN' | 'MANUAL';
  project?: string;
  experiment?: string;
  purpose?: string;
  notes?: string;
  isReversed?: boolean;
  reversedBy?: string;
  reversalReason?: string;
  originalTransactionId?: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface InventoryAuditItem {
  bottleId: string;
  bottleCode: string;
  chemicalId: string;
  chemicalName: string;
  systemVolume: number;
  physicalVolume: number;
  difference: number;
  unit: ChemicalUnit;
  reason: string;
}

export interface InventoryAuditSession {
  id: string;
  code: string; // e.g. KIEMKE-2026-001
  date: string;
  conductedBy: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  items: InventoryAuditItem[];
  notes?: string;
}

export interface StockDiscrepancyReport {
  id: string;
  chemicalId: string;
  chemicalName: string;
  bottleId?: string;
  bottleCode?: string;
  systemQuantity: number;
  physicalQuantity: number;
  unit: ChemicalUnit;
  difference: number;
  reportedBy: string;
  reportedDate: string;
  reason: string;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
  resolvedBy?: string;
  resolvedDate?: string;
  resolutionNotes?: string;
}

export interface LabNotification {
  id: string;
  timestamp: string;
  type:
    | 'NEW_USER_PENDING'
    | 'USER_APPROVED'
    | 'USER_DEACTIVATED'
    | 'LOW_STOCK'
    | 'CRITICAL_STOCK'
    | 'EXPIRED_BOTTLE'
    | 'EXPIRING_SOON'
    | 'DISCREPANCY_REPORT'
    | 'USAGE_CONFIRMATION'
    | 'APPROVAL_REQUEST';
  title: string;
  message: string;
  targetRole?: 'MANAGER' | 'USER' | 'ALL';
  targetUserId?: string;
  read: boolean;
  linkTab?: string;
}

export interface EmailAlertLog {
  id: string;
  timestamp: string;
  toEmail: string;
  recipientName: string;
  subject: string;
  chemicalId: string;
  chemicalName: string;
  currentStock: number;
  threshold: number;
  unit: ChemicalUnit;
  status: 'SENT' | 'SIMULATED';
  contentSnippet: string;
  triggerType: 'LOW_STOCK' | 'CRITICAL_STOCK' | 'EXPIRED';
}

export type PurchasePriority = 'CRITICAL' | 'LOW' | 'NORMAL';
export type PurchaseStatus = 'PENDING' | 'ORDERED' | 'RECEIVED';

export interface PurchaseItem {
  id: string;
  chemicalId: string;
  chemicalName: string;
  currentStock: number;
  minimumStock: number;
  targetStock: number;
  recommendedPurchase: number;
  unit: ChemicalUnit;
  supplier: string;
  estimatedCost: number;
  priority: PurchasePriority;
  status: PurchaseStatus;
  orderedDate?: string;
  receivedDate?: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entityType: 'CHEMICAL' | 'BOTTLE' | 'TRANSACTION' | 'PURCHASE' | 'SETTINGS' | 'USER' | 'ADJUSTMENT' | 'DISCREPANCY' | 'IMPORT' | 'REQUEST';
  entityId: string;
  previousData?: string;
  newData?: string;
  description: string;
}

export type StockStatus = 'NORMAL' | 'LOW_STOCK' | 'CRITICAL' | 'EMPTY';
export type ExpiryStatus = 'EXPIRED' | 'EXPIRING_SOON' | 'EXPIRING' | 'VALID';
