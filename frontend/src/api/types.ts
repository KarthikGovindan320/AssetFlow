export type Role = 'ADMIN' | 'ASSET_MANAGER' | 'DEPARTMENT_HEAD' | 'EMPLOYEE';
export type ActiveStatus = 'ACTIVE' | 'INACTIVE';
export type AssetStatus =
  | 'AVAILABLE'
  | 'ALLOCATED'
  | 'RESERVED'
  | 'UNDER_MAINTENANCE'
  | 'LOST'
  | 'RETIRED'
  | 'DISPOSED';
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR';
export type TransferStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED';
export type BookingState = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MaintenanceStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'TECHNICIAN_ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED';
export type AuditItemResult = 'PENDING' | 'VERIFIED' | 'MISSING' | 'DAMAGED';

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: ListMeta;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: ActiveStatus;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  parentDepartmentId: string | null;
  parentDepartment?: { id: string; name: string } | null;
  headUserId: string | null;
  head?: { id: string; name: string; email: string } | null;
  status: ActiveStatus;
  _count?: { members: number; childDepartments: number };
  children?: Department[];
}

export interface CustomFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date';
  required: boolean;
}

export interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  customFields: CustomFieldDef[];
  _count?: { assets: number };
}

export interface Holder {
  type: 'USER' | 'DEPARTMENT';
  id: string;
  name: string;
}

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  categoryId: string;
  category: { id: string; name: string; customFields?: CustomFieldDef[] };
  serialNumber: string | null;
  acquisitionDate: string;
  acquisitionCost: string;
  condition: AssetCondition;
  location: string;
  status: AssetStatus;
  isBookable: boolean;
  customFieldValues: Record<string, unknown> | null;
  photoUrl: string | null;
  expectedRetirementDate: string | null;
  currentAllocation: {
    id: string;
    allocatedAt: string;
    expectedReturnDate: string | null;
    holder: Holder;
  } | null;
}

export interface AssetDetail extends Asset {
  allocations: Allocation[];
  maintenanceRequests: MaintenanceRequest[];
}

export interface Allocation {
  id: string;
  assetId: string;
  asset: { id: string; assetTag: string; name: string; status: AssetStatus; condition: AssetCondition };
  allocatedToUser: { id: string; name: string } | null;
  allocatedToDepartment: { id: string; name: string } | null;
  allocatedBy: { id: string; name: string };
  allocatedAt: string;
  expectedReturnDate: string | null;
  returnedAt: string | null;
  returnCondition: AssetCondition | null;
  returnNotes: string | null;
  status: 'ACTIVE' | 'RETURNED';
  isOverdue?: boolean;
}

export interface TransferRequest {
  id: string;
  assetId: string;
  asset: { id: string; assetTag: string; name: string; status: AssetStatus };
  fromAllocation: {
    id: string;
    allocatedToUser: { id: string; name: string } | null;
    allocatedToDepartment: { id: string; name: string } | null;
  };
  requestedBy: { id: string; name: string };
  requestedForUser: { id: string; name: string } | null;
  requestedForDepartment: { id: string; name: string } | null;
  reason: string;
  status: TransferStatus;
  decisionNotes: string | null;
  decidedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface Booking {
  id: string;
  assetId: string;
  asset: { id: string; assetTag: string; name: string; location: string };
  bookedBy: { id: string; name: string };
  onBehalfOfDepartment: { id: string; name: string } | null;
  startTime: string;
  endTime: string;
  purpose: string;
  status: 'CONFIRMED' | 'CANCELLED';
  derivedState: BookingState;
}

export interface MaintenanceRequest {
  id: string;
  assetId: string;
  asset: { id: string; assetTag: string; name: string; status: AssetStatus; location?: string };
  raisedBy: { id: string; name: string };
  title: string;
  description: string;
  priority: MaintenancePriority;
  photoUrl: string | null;
  status: MaintenanceStatus;
  decisionNotes: string | null;
  decidedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  technicianName: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AuditCycle {
  id: string;
  name: string;
  scopeDepartmentId: string | null;
  scopeDepartment: { id: string; name: string } | null;
  scopeLocation: string | null;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
  createdBy: { id: string; name: string };
  closedAt: string | null;
  createdAt: string;
  assignments: { id: string; auditor: { id: string; name: string; email: string } }[];
  progress: {
    PENDING: number;
    VERIFIED: number;
    MISSING: number;
    DAMAGED: number;
    total: number;
    audited: number;
  };
  items?: AuditItem[];
  closeSummary?: { missing: number; damaged: number; unaudited: number };
}

export interface AuditItem {
  id: string;
  auditCycleId: string;
  assetId: string;
  asset: {
    id: string;
    assetTag: string;
    name: string;
    status: AssetStatus;
    location: string;
    serialNumber: string | null;
  };
  result: AuditItemResult;
  notes: string | null;
  auditedBy: { id: string; name: string } | null;
  auditedAt: string | null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export interface ActivityLogEntry {
  id: string;
  actor: { id: string; name: string; role: Role } | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardKpis {
  cards: {
    assetsAvailable: number;
    assetsAllocated: number;
    maintenanceOpen: number;
    activeBookings: number;
    pendingTransfers: number;
    upcomingReturns: number;
  };
  returns: {
    overdueCount: number;
    upcomingCount: number;
    overdue: DashboardReturn[];
    upcoming: DashboardReturn[];
  };
  generatedAt: string;
}

export interface DashboardReturn {
  id: string;
  expectedReturnDate: string;
  asset: { assetTag: string; name: string };
  allocatedToUser: { name: string } | null;
  allocatedToDepartment: { name: string } | null;
}

export interface ConflictDetails {
  assetId: string;
  assetTag: string;
  currentHolder: Holder;
  allocationId: string;
  allocatedAt: string;
  expectedReturnDate: string | null;
  suggestedAction: 'TRANSFER_REQUEST';
}
