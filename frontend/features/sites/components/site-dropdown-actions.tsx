"use client";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EllipsisVertical, Edit, Trash } from "lucide-react";
import { Site } from "@/features/sites/types/sites";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteMutationDialog, SiteDeleteDialog } from ".";

export default function SiteDropdownActions({ site, canUpdateOrgSites, canDeleteOrgSites }: { site: Site, canUpdateOrgSites: boolean, canDeleteOrgSites: boolean }) {
    const router = useRouter();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showMutationDialog, setShowMutationDialog] = useState(false);

    return (
        <>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="text-primary"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <EllipsisVertical className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    <DropdownMenuItem
                        disabled={!canUpdateOrgSites}
                        onSelect={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowMutationDialog(true);
                        }}
                        className="hover:cursor-pointer"
                    >
                        <Edit className="w-4 h-4 mr-2" />
                        Update
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={!canDeleteOrgSites}
                        onSelect={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowDeleteDialog(true);
                        }}
                        className="text-destructive hover:cursor-pointer"
                    >
                        <Trash className="w-4 h-4 mr-2" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <SiteMutationDialog
                onUpdate={() => {
                    router.refresh();
                }}
                mode="update"
                site={site}
                organizationId={site.organizationId}
                showDialog={showMutationDialog}
                setShowDialog={setShowMutationDialog}
            />

            <SiteDeleteDialog
                showDeleteDialog={showDeleteDialog}
                setShowDeleteDialog={setShowDeleteDialog}
                site={site}
            />
        </>
    )
}
