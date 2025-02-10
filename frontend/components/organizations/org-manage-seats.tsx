import { Organization } from "@/types/user";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "../ui/input";
import api from "@/lib/api";
import { toast } from "sonner";
import { useUpdateOrganizationSeatsMutation } from "@/queries/queries";
import { PRICING_PLANS } from "@/lib/pricing";
import { usePathname, useSearchParams } from "next/navigation";

export default function OrgManageSeats({
  org,
  members,
}: {
  org: Organization;
  members:
    | {
        user: {
          id: string;
          email: string;
          name: string;
          profilePicture: string;
        };
        role: "owner" | "member";
      }[]
    | undefined;
}) {
  const [seats, setSeats] = useState(org.seats);
  const [isLoading, setIsLoading] = useState(false);
  const hasChanges = seats !== org.seats;
  const memberCount = members?.length || 0;
  const updateSeats = useUpdateOrganizationSeatsMutation();
  const pathName = usePathname();
  const searchParams = useSearchParams();

  const handleSave = async () => {
    try {
      setIsLoading(true);

      // First validate the seat update
      const validation = await api.organizations.validateSeatUpdate(
        org.id,
        seats
      );
      if (!validation.success) {
        toast.error(validation.error || "Failed to update seats");
        return;
      }

      // Update the seats using mutation
      const result = await updateSeats.mutateAsync({ orgId: org.id, seats });
      if (!result.success) {
        toast.error(result.error || "Failed to update seats");
        return;
      }

      toast.success("Successfully updated seats");
    } catch (error) {
      console.error("Failed to update seats:", error);
      toast.error("Failed to update seats");
    } finally {
      setIsLoading(false);
    }
  };

  // Add effect to sync seats with org.seats
  useEffect(() => {
    setSeats(org.seats);
  }, [org.seats]);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-medium">Billing & Seats</h2>
      </div>

      <Card className="p-6 space-y-6">
        {/* Billing Row */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Subscription</h3>
            <p className="text-sm text-muted-foreground">
              {org.subscriptionStatus === "active"
                ? "Manage your billing information and subscription details."
                : "Complete your organization setup by adding billing information."}
            </p>
          </div>
          <Button
            onClick={async () => {
              try {
                if (org.subscriptionStatus === "active") {
                  const url = await api.payments.createPortalSession(
                    org.id,
                    pathName + "?" + searchParams.toString()
                  );
                  window.location.href = url;
                } else {
                  const url = await api.payments.createCheckoutSession(
                    PRICING_PLANS.TEAMS.lookup_key,
                    org.seats,
                    org.id
                  );
                  window.location.href = url;
                }
              } catch (error) {
                console.error("Error with billing action:", error);
              }
            }}
            className={
              org.subscriptionStatus === "active"
                ? ""
                : "bg-blue-600 hover:bg-blue-700 animate-pulse"
            }
          >
            {org.subscriptionStatus === "active" ? "Manage Billing" : "Upgrade"}
          </Button>
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Seats Row */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium">Seat Management</h3>
            <p className="text-sm text-muted-foreground">
              {memberCount} of {org.seats} seats used ($
              {org.seats * PRICING_PLANS.TEAMS.cost}/month)
            </p>
          </div>

          <div className="space-y-4">
            <div className="h-2 bg-secondary rounded-full overflow-hidden w-[225px]">
              <div
                className="h-full bg-primary rounded-full"
                style={{
                  width: `${(memberCount / org.seats) * 100}%`,
                }}
              />
            </div>

            <div className="flex justify-end">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-7"
                  onClick={() =>
                    setSeats((prev) => Math.max(memberCount, prev - 1))
                  }
                  disabled={isLoading || seats <= memberCount}
                >
                  <Minus className="h-3 w-3" />
                </Button>

                <Input
                  value={seats}
                  onChange={(e) => {
                    const value = Math.max(
                      memberCount,
                      parseInt(e.target.value) || memberCount
                    );
                    setSeats(value);
                  }}
                  className="w-8 h-7 text-center p-0"
                  disabled={isLoading}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-7"
                  onClick={() => setSeats((prev) => prev + 1)}
                  disabled={isLoading}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {hasChanges && (
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isLoading}>
                  {isLoading ? "Processing..." : "Update Seats"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
