export const APP_NAME = "BALAJI SALES APP";
export const APP_TAGLINE = "Sales Enquiry & Customer CRM";

/** How often owner/staff screens pull shared enquiry data (ms). */
export const LIVE_POLL_MS = 4000;

export const VEHICLES = [
  "Splendor Plus",
  "Splendor+ Xtec",
  "HF Deluxe",
  "Passion Plus",
  "Super Splendor",
  "Glamour",
  "Xtreme 125R",
  "Xtreme 160R",
  "Xpulse 200 4V",
  "Destini 125",
  "Maestro Edge 125",
  "Pleasure+ Xtec",
  "Karizma XMR",
  "Xoom 125",
  "Vida V1 Plus",
  "Other",
] as const;

export const PURCHASE_MODES = ["Cash", "Finance", "Exchange", "Cash + Exchange"] as const;

export const LEAD_SOURCES = [
  "Walk-in",
  "Phone",
  "Reference",
  "Online",
  "Existing Customer",
  "Other",
] as const;

export const ENQUIRY_STATUSES = [
  "New",
  "Follow-up",
  "Interested",
  "Negotiation",
  "Booked",
  "Sold",
  "Lost",
] as const;

export const FOLLOW_UP_STATUSES = [
  "Pending",
  "Completed",
  "No Response",
  "Interested",
  "Not Interested",
  "Call Later",
  "Booked",
  "Lost",
] as const;

export const DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "year", label: "This Year" },
  { id: "custom", label: "Custom" },
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number]["id"];
export type Vehicle = (typeof VEHICLES)[number];
export type PurchaseMode = (typeof PURCHASE_MODES)[number];
export type LeadSource = (typeof LEAD_SOURCES)[number];
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];
export type UserRole = "owner" | "staff";
