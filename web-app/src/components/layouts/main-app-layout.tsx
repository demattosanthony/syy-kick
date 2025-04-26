import { useMeQuery } from "@/features/user/api";
import { Outlet } from "react-router";
import { LoginButtons } from "@/features/auth/components";
import { FinishOrgSetupBanner } from "@/features/organizations/components";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function MainAppLayout() {
  const { data: user } = useMeQuery();
  return (
    <SidebarProvider defaultOpen={true}>
      {user && <AppSidebar user={user} />}

      <SidebarInset>
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
