import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function useGetSiteQuery({ siteId }: { siteId: string }) {
  return useQuery({
    queryKey: ["site", siteId],
    queryFn: () => api.sites.getSite(siteId),
  });
}
