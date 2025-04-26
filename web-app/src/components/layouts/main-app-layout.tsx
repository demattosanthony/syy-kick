import { Outlet, useLoaderData } from "react-router";
import { LoginButtons } from "@/features/auth/components";
import { FinishOrgSetupBanner } from "@/features/organizations/components";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { User } from "@/types/user";

export default function MainAppLayout() {
  const user = useLoaderData() as User | null;

  return (
    <SidebarProvider defaultOpen={true}>
      {user && <AppSidebar user={user} />}

      <SidebarInset className="overflow-hidden  flex flex-1 flex-col overflow-y-auto">
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
