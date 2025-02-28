import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { DragAndDropProvider } from "@/components/DragDropProvider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { me } from "../actions";
import FinishOrgSetupBanner from "@/components/organizations/finish-org-setup-banner";
import LoginButtons from "@/components/login-buttons";

export default async function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await me();
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar:state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {user && <AppSidebar user={user} />}

      <SidebarInset>
        <div className="h-full w-full flex flex-col max-h-[-webkit-fill-available] relative">
          <DragAndDropProvider>
            <FinishOrgSetupBanner />

            {!user && (
              <div className="absolute top-4 right-4 z-10">
                <LoginButtons />
              </div>
            )}

            {children}
          </DragAndDropProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
