import { JoinOrgHandler } from "@/features/organizations/components";
import api from "@/lib/api";
import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const token = (await params).token;
  const orgDetails = await api.organizations.getOrgFromInviteToken(token);

  if (!orgDetails || !orgDetails.organization) {
    redirect("/");
  }

  return <JoinOrgHandler token={token} initialOrgDetails={orgDetails} />;
}
