import { useOrgFromInviteToken } from "@/features/organizations/api";
import { JoinOrgHandler } from "@/features/organizations/components";
import { useNavigate, useSearchParams } from "react-router";

export function JoinOrgPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  if (!token) {
    navigate("/");
    return;
  }

  const { data: orgDetails } = useOrgFromInviteToken(token);

  if (!orgDetails || !orgDetails.organization) {
    navigate("/");
  }

  return <JoinOrgHandler token={token} initialOrgDetails={orgDetails} />;
}
