import { JoinOrgHandler } from "@/features/organizations/components";
import { getOrgFromInviteToken } from "@/app/actions";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const token = (await params).token;
  const orgDetails = await getOrgFromInviteToken(token);

  return <JoinOrgHandler token={token} initialOrgDetails={orgDetails} />;
}
