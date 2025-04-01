import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function useGetSiteQuery({
  siteId,
}: {
  siteId: string | null | undefined;
}) {
  return useQuery({
    queryKey: ["site", siteId],
    queryFn: () => api.sites.getSite(siteId!),
    enabled: !!siteId,
  });
}
