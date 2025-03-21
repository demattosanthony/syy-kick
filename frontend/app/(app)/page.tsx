import { Suspense } from "react";
import HomeContent from "@/features/chat/home/home-content";
import api from "@/lib/api";

export default async function Home() {
  const user = await api.auth.me();
  const { data } = await api.projects.listProjects({
    limit: 6,
  });

  return (
    <Suspense>
      <HomeContent user={user} recentProjects={data} />
    </Suspense>
  );
}
