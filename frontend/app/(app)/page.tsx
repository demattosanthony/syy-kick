import { Suspense } from "react";
import { getProjects, me } from "../actions";
import HomeContent from "@/features/chat/home/home-content";

export default async function Home() {
  const user = await me();
  const { data } = await getProjects({
    limit: 6,
  });

  return (
    <Suspense>
      <HomeContent user={user} recentProjects={data} />
    </Suspense>
  );
}
