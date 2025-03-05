import { JoinOrgHandler } from "@/features/organizations/components";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const token = (await params).token;

  return <JoinOrgHandler token={token} />;
}
