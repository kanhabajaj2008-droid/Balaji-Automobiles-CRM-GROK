import type {
  EnquiryStatus,
  FollowUpStatus,
  LeadSource,
  PurchaseMode,
  UserRole,
} from "./constants";

export type Profile = {
  user_id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ShowroomSettings = {
  showroom_name: string;
  showroom_address: string;
  phone: string;
  default_follow_up_days: number;
};

export type StaffOption = {
  user_id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  active: boolean;
};

export type Tag = {
  id: string;
  name: string;
  created_at?: string;
  enquiry_count?: number;
};

export type Enquiry = {
  id: string;
  enquiry_date: string;
  customer_name: string;
  mobile: string;
  village: string;
  vehicle: string;
  purchase_mode: PurchaseMode;
  expected_delivery: string | null;
  lead_source: LeadSource;
  status: EnquiryStatus;
  next_follow_up: string | null;
  next_follow_up_time: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string | null;
  estimated_value: number | null;
  exchange_required: boolean;
  exchange_vehicle: string | null;
  notes: string | null;
  is_demo: boolean;
  tags: Tag[];
  created_at: string;
  updated_at: string;
};

export type FollowUp = {
  id: string;
  enquiry_id: string;
  staff_id: string;
  staff_name: string | null;
  follow_up_date: string;
  follow_up_time: string | null;
  status: FollowUpStatus;
  notes: string | null;
  next_follow_up_date: string | null;
  next_follow_up_time: string | null;
  created_at: string;
  customer_name?: string;
  mobile?: string;
  vehicle?: string;
  enquiry_status?: EnquiryStatus;
  tags?: Tag[];
};

export type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
};

export type AssignmentHistory = {
  id: string;
  enquiry_id: string;
  previous_staff: string | null;
  previous_staff_name: string | null;
  new_staff: string | null;
  new_staff_name: string | null;
  changed_by: string;
  changed_by_name: string | null;
  changed_at: string;
};

export type DashboardStats = {
  total: number;
  neu: number;
  openFollowUps: number;
  todayFollowUps: number;
  overdueFollowUps: number;
  sold: number;
  lost: number;
  conversionRate: number;
  estimatedPipeline: number;
  soldValue: number;
};

export type NamedCount = { name: string; count: number; value?: number };

export type DashboardPayload = {
  stats: DashboardStats;
  byMonth: { month: string; enquiries: number; sold: number }[];
  byVehicle: NamedCount[];
  byPurchaseMode: NamedCount[];
  byLeadSource: NamedCount[];
  staffPerformance: StaffPerformance[];
  todayFollowUps: FollowUp[];
  overdueFollowUps: FollowUp[];
};

export type StaffPerformance = {
  user_id: string;
  full_name: string;
  total: number;
  followUpsCompleted: number;
  pendingFollowUps: number;
  sold: number;
  lost: number;
  conversion: number;
};

export type EnquiryFilters = {
  q?: string;
  status?: EnquiryStatus | "";
  vehicle?: string;
  staffId?: string;
  purchaseMode?: PurchaseMode | "";
  leadSource?: LeadSource | "";
  from?: string;
  to?: string;
  followUpFrom?: string;
  followUpTo?: string;
  tagId?: string;
};

export type SessionInfo = {
  profile: Profile;
  settings: ShowroomSettings;
  staff: StaffOption[];
  ownerExists: boolean;
};

export type EnquiryDetail = {
  enquiry: Enquiry;
  followUps: FollowUp[];
  assignments: AssignmentHistory[];
  audit: AuditRow[];
};
