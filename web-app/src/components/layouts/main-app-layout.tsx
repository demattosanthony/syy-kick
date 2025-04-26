import { useMeQuery } from "@/features/user/api";
import { Outlet } from "react-router";
import { SidebarInset } from "../ui/sidebar";
import { SidebarProvider } from "../ui/sidebar";
import { LoginButtons } from "@/features/auth/components";
import { FinishOrgSetupBanner } from "@/features/organizations/components";
import { AppSidebar } from "../sidebar/app-sidebar";

export default function MainAppLayout() {
  const { data: user } = useMeQuery();
  return (
    <SidebarProvider>
      {user && <AppSidebar user={user} />}

      <SidebarInset className="overflow-hidden  flex flex-1 flex-col overflow-y-auto h-screen max-h-[calc(100vh-50px)]">
        <FinishOrgSetupBanner />

        {!user && (
          <div className="absolute top-4 right-4 z-10">
            <LoginButtons />
          </div>
        )}

        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
