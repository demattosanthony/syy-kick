import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function useGetMemberQuery({
  organizationId,
  memberId,
}: {
  organizationId: string;
  memberId: string;
}) {
  return useQuery({
    queryKey: ["organization-member", organizationId, memberId],
    queryFn: () => api.organizations.getOrgMember(organizationId, memberId),
  });
}
