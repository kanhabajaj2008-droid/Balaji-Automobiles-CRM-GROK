import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { EnquiryStatus } from "@/lib/crm/constants";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_CLASS: Record<string, string> = {
  New: "status-new",
  "Follow-up": "status-follow-up",
  Interested: "status-interested",
  Negotiation: "status-negotiation",
  Booked: "status-booked",
  Sold: "status-sold",
  Lost: "status-lost",
  Pending: "status-pending",
  Completed: "status-sold",
  "No Response": "status-overdue",
  "Not Interested": "status-lost",
  "Call Later": "status-follow-up",
};

export function StatusBadge({ status }: { status: EnquiryStatus | string }) {
  return <Badge className={STATUS_CLASS[status] ?? "status-follow-up"}>{status}</Badge>;
}
