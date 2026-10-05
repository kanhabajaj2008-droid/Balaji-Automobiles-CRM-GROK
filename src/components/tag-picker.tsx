import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTag, listTags } from "@/lib/crm/tags";
import type { Tag } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

export function TagChips({ tags }: { tags?: Tag[] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent"
        >
          {t.name}
        </span>
      ))}
    </div>
  );
}

export function TagFilterBar({
  value,
  onChange,
  allowCreate = true,
}: {
  value: string;
  onChange: (tagId: string) => void;
  allowCreate?: boolean;
}) {
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => listTags() });
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange("")}
        className={cn(
          "h-9 rounded-full px-3 text-xs font-semibold",
          !value ? "bg-ink text-accent-fg" : "bg-surface text-ink-soft ring-1 ring-line",
        )}
      >
        All tags
      </button>
      {(tags.data ?? []).map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id === value ? "" : t.id)}
          className={cn(
            "h-9 rounded-full px-3 text-xs font-semibold",
            value === t.id ? "bg-accent text-accent-fg" : "bg-surface text-ink-soft ring-1 ring-line",
          )}
        >
          {t.name}
          {typeof t.enquiry_count === "number" ? ` (${t.enquiry_count})` : ""}
        </button>
      ))}
      {allowCreate ? <CreateTagInline /> : null}
    </div>
  );
}

function CreateTagInline() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => createTag({ data: { name } }),
    onSuccess: (tag) => {
      toast.success(`Tag “${tag.name}” created`);
      setName("");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 rounded-full bg-surface px-3 text-xs font-semibold text-accent ring-1 ring-line"
      >
        + New tag
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <Input
        autoFocus
        placeholder="e.g. Navratri"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-9 w-36"
      />
      <Button type="submit" size="sm" disabled={create.isPending || name.trim().length < 2}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

export function TagPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const qc = useQueryClient();
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => listTags() });
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => createTag({ data: { name } }),
    onSuccess: (tag) => {
      setName("");
      void qc.invalidateQueries({ queryKey: ["tags"] });
      if (!selectedIds.includes(tag.id)) onChange([...selectedIds, tag.id]);
      toast.success(`Tag “${tag.name}” added`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(tags.data ?? []).map((t) => {
          const on = selectedIds.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className={cn(
                "h-9 rounded-full px-3 text-xs font-semibold ring-1",
                on ? "bg-accent text-accent-fg ring-accent" : "bg-surface text-ink-soft ring-line",
              )}
            >
              {t.name}
            </button>
          );
        })}
        {(tags.data ?? []).length === 0 ? (
          <p className="text-xs text-muted">No tags yet. Create one, e.g. Navratri.</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Create tag (Navratri, Fair, Hot lead…)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10"
        />
        <Button
          type="button"
          variant="outline"
          disabled={create.isPending || name.trim().length < 2}
          onClick={() => create.mutate()}
        >
          Create
        </Button>
      </div>
    </div>
  );
}
