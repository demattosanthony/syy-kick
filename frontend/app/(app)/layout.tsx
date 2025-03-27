import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { LoginButtons } from "@/features/auth/components";
import { FinishOrgSetupBanner } from "@/features/organizations/components";
import api from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await api.auth.me();
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar:state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {user && <AppSidebar user={user} />}

      <SidebarInset>
        <div className="h-full w-full flex flex-col max-h-[-webkit-fill-available] relative">
          <FinishOrgSetupBanner />

          {!user && (
            <div className="absolute top-4 right-4 z-10">
              <LoginButtons />
            </div>
          )}

          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
