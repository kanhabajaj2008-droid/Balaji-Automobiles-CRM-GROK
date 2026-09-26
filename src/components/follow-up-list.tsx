import { Link } from "@tanstack/react-router";
import { CallActions } from "@/components/call-button";
import { StatusBadge } from "@/components/ui/badge";
import type { FollowUp } from "@/lib/crm/types";
import { formatDate } from "@/lib/utils";

export function FollowUpList({
  items,
  empty,
}: {
  items: FollowUp[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="px-1 py-6 text-sm text-muted">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={`${item.enquiry_id}-${item.follow_up_date}-${item.customer_name}`} className="flex items-center gap-2 py-3">
          <Link
            to="/enquiry/$id"
            params={{ id: item.enquiry_id }}
            className="min-w-0 flex-1"
          >
            <p className="truncate font-medium text-ink">{item.customer_name}</p>
            <p className="truncate text-xs text-muted">
              {item.mobile} · {item.vehicle}
              {item.staff_name ? ` · ${item.staff_name}` : ""}
            </p>
            <p className="mt-1 text-xs tabular-nums text-ink-soft">{formatDate(item.follow_up_date)}</p>
            {item.enquiry_status ? (
              <div className="mt-1">
                <StatusBadge status={item.enquiry_status} />
              </div>
            ) : null}
          </Link>
          <CallActions mobile={item.mobile} size="icon" />
        </li>
      ))}
    </ul>
  );
}
