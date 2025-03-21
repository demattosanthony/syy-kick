import { JoinOrgHandler } from "@/features/organizations/components";
import api from "@/lib/api";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const token = (await params).token;
  const orgDetails = await api.organizations.getOrgFromInviteToken(token);

  return <JoinOrgHandler token={token} initialOrgDetails={orgDetails} />;
}
