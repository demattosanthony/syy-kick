import JoinOrgHandler from "@/components/organizations/join-org-handler";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const token = (await params).token;

  return <JoinOrgHandler token={token} />;
}
