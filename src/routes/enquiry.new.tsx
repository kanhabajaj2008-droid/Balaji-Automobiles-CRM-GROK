import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated } from "@/components/auth-gate";
import { EnquiryForm } from "@/components/enquiry-form";
import { PageHeader } from "@/components/kpi";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/enquiry/new")({ component: NewEnquiryPage });

function NewEnquiryPage() {
  const navigate = useNavigate();
  return (
    <Authenticated>
      {(session) => (
        <div>
          <PageHeader title="New enquiry" subtitle="Capture the customer before they leave the floor" />
          <Card>
            <CardContent className="pt-5">
              <EnquiryForm
                session={session}
                onSaved={(id) => navigate({ to: "/enquiry/$id", params: { id } })}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </Authenticated>
  );
}
