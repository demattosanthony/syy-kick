"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { useDeleteSiteMutation } from "../api";
import { usePermissions } from "@/features/permissions/context";
import { Site } from "../types/sites";
import { useEffect } from "react";
import { toast } from "sonner";

export default function SiteDeleteDialog(
    {
        showDeleteDialog,
        setShowDeleteDialog,
        site,
    }: {
        showDeleteDialog: boolean;
        setShowDeleteDialog: (showDeleteDialog: boolean) => void;
        site: Site;
    }
) {
    const router = useRouter();
    const {
        mutate: deleteSite,
        isPending: isDeletingSite,
        error: deleteSiteError,
        isError: isDeleteSiteError,
        isSuccess: isDeleteSiteSuccess,
        data: deleteSiteData,
    } = useDeleteSiteMutation();

    const {
        canDeleteOrgSites,
    } = usePermissions();

    useEffect(() => {
        if (isDeleteSiteError && deleteSiteError) {
            toast.error("Failed to delete site");
        }

        if (isDeleteSiteSuccess && deleteSiteData) {
            toast.success(deleteSiteData.message)
            router.push('/sites')
        }

    }, [isDeleteSiteError, deleteSiteError, isDeleteSiteSuccess, deleteSiteData]);

    return (<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. <strong>This will permanently delete the site
                        and all projects within it</strong>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                >Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={!canDeleteOrgSites} onClick={(e) => {
                    e.stopPropagation();
                    deleteSite(site.id);
                }} className="bg-destructive text-destructive-foreground">
                    {isDeletingSite ? "Deleting..." : "Delete"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    )
}   