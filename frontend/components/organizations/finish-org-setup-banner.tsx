"use client";

import Link from "next/link";
import { Button } from "../ui/button";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { useWorkspace } from "../sidebar/workspace-context";

export default function FinishOrgSetupBanner() {
  const { activeWorkspace } = useWorkspace();

  const showFinishOrganizationSetup =
    activeWorkspace?.type === "organization" &&
    activeWorkspace?.subscriptionStatus !== "active";

  if (!showFinishOrganizationSetup) {
    return null;
  }

  return (
    <div className="flex w-full items-center gap-2 p-2">
      <Link href="/settings?tab=organization" className="w-full">
        <Button className="w-full" variant={"secondary"}>
          <TriangleAlert size={16} />
          Please complete the payment process to use Teams Pro features
          <ArrowRight size={16} />
        </Button>
      </Link>
    </div>
  );
}
