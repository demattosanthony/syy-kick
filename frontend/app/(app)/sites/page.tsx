"use client";

import { useWorkspace } from "@/components/sidebar/workspace-context";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/features/chat/threads/components";
import { usePermissions } from "@/features/permissions/context";
import { SitesList, SiteMutationDialog } from "@/features/sites/components";
import { useState } from "react";
export default function SitesPage() {
  const { activeWorkspace } = useWorkspace();
  const { canCreateOrgSites } = usePermissions();
  const [showCreateSiteDialog, setShowCreateSiteDialog] = useState(false);

  return (
    <main className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <div className="flex items-center justify-between mb-6 mt-6">
        <h1 className="text-2xl font-bold ">Sites</h1>
        <Button disabled={!canCreateOrgSites} onClick={() => setShowCreateSiteDialog(true)}>Create Site</Button>
      </div>
      <SearchBar />
      <SitesList />
      <SiteMutationDialog
        organizationId={
          activeWorkspace?.type === "organization"
            ? activeWorkspace.id
            : undefined
        }
        mode="create"
        showDialog={showCreateSiteDialog}
        setShowDialog={setShowCreateSiteDialog}
      />
    </main>
  );
}
