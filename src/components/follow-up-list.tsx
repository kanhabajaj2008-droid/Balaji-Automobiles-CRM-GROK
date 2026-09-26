import { Link } from "@tanstack/react-router";
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
        <li key={`${item.enquiry_id}-${item.follow_up_date}-${item.customer_name}`}>
          <Link
            to="/enquiry/$id"
            params={{ id: item.enquiry_id }}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{item.customer_name}</p>
              <p className="truncate text-xs text-muted">
                {item.mobile} · {item.vehicle}
                {item.staff_name ? ` · ${item.staff_name}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs tabular-nums text-ink-soft">{formatDate(item.follow_up_date)}</p>
              {item.enquiry_status ? (
                <div className="mt-1 flex justify-end">
                  <StatusBadge status={item.enquiry_status} />
                </div>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
