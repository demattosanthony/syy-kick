import {
  useDeleteOrganizationMutation,
  useOrganizationsQuery,
} from "@/queries/queries";
import { Organization } from "@/types/user";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import OrganizationCard from "./org-card";

export default function OrganizationsList() {
  // Query hooks
  const queryClient = useQueryClient();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useOrganizationsQuery();
  const deleteOrgMutation = useDeleteOrganizationMutation();

  // State
  const observerTarget = useRef(null);

  // Infinite scroll handling
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  const handleDelete = useCallback(
    (orgId: string) => {
      deleteOrgMutation.mutate(orgId, {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ["adminOrgs"],
          });
        },
      });
    },
    [deleteOrgMutation, queryClient]
  );

  useEffect(() => {
    const element = observerTarget.current;
    const observer = new IntersectionObserver(handleObserver, {
      threshold: 1.0,
    });

    if (element) observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [handleObserver]);

  return (
    <div className="grid gap-4">
      {data?.pages.map((page) =>
        page.organizations?.map((org: Organization) => (
          <OrganizationCard key={org.id} org={org} onDelete={handleDelete} />
        ))
      )}

      <div ref={observerTarget} className="h-4" />
    </div>
  );
}
