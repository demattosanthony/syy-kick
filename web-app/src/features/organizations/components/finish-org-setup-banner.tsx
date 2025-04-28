import { Button } from "@/components/ui/button";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { useWorkspace } from "@/workspace-context";
import { Link } from "react-router";

const FinishOrgSetupBanner = () => {
  const { activeWorkspace } = useWorkspace();

  const showFinishOrganizationSetup =
    activeWorkspace?.type === "organization" &&
    activeWorkspace?.subscriptionStatus !== "active" &&
    activeWorkspace?.subscriptionStatus !== "trialing";

  if (!showFinishOrganizationSetup) {
    return null;
  }

  return (
    <div className="flex w-full items-center gap-2 p-2">
      <Link to="/settings?tab=organization" className="w-full">
        <Button className="w-full" variant={"secondary"}>
          <TriangleAlert size={16} />
          Please complete the payment process to use Teams Pro features
          <ArrowRight size={16} />
        </Button>
      </Link>
    </div>
  );
};

export default FinishOrgSetupBanner;
