import { useOrgFromInviteToken } from "@/features/organizations/api";
import { JoinOrgHandler } from "@/features/organizations/components";
import { useNavigate, useParams } from "react-router";

export function JoinOrgPage() {
  const navigate = useNavigate();
  const { token } = useParams();

  if (!token) {
    navigate("/");
    return;
  }

  const { data: orgDetails, isLoading } = useOrgFromInviteToken(
    token as string
  );

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        Fetching organization details...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      {orgDetails && (
        <JoinOrgHandler
          token={token as string}
          orgDetails={orgDetails.organization}
        />
      )}
    </div>
  );
}
