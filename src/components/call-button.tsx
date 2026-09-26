import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { telHref, whatsappHref } from "@/lib/utils";

export function CallButton({
  mobile,
  size = "default",
  label = "Call",
}: {
  mobile: string | null | undefined;
  size?: "default" | "sm" | "icon";
  label?: string;
}) {
  const href = telHref(mobile);
  if (!href) return null;
  return (
    <Button asChild size={size} className="bg-sold text-white hover:bg-sold/90">
      <a href={href} onClick={(e) => e.stopPropagation()}>
        <Phone />
        {size === "icon" ? <span className="sr-only">Call</span> : label}
      </a>
    </Button>
  );
}

export function WhatsAppButton({
  mobile,
  size = "default",
}: {
  mobile: string | null | undefined;
  size?: "default" | "sm" | "icon";
}) {
  const href = whatsappHref(mobile);
  if (!href) return null;
  return (
    <Button asChild size={size} variant="outline" className="border-[#25D366] text-[#128C7E]">
      <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        <MessageCircle />
        {size === "icon" ? <span className="sr-only">WhatsApp</span> : "WhatsApp"}
      </a>
    </Button>
  );
}

export function CallActions({
  mobile,
  size = "default",
}: {
  mobile: string | null | undefined;
  size?: "default" | "sm" | "icon";
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <CallButton mobile={mobile} size={size} />
      <WhatsAppButton mobile={mobile} size={size} />
    </div>
  );
}
