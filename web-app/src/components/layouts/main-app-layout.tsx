import { useMeQuery } from "@/features/user/api";
import { SidebarInset } from "../ui/sidebar";
import { SidebarProvider } from "../ui/sidebar";
import { LoginButtons } from "@/features/auth/components";
import { FinishOrgSetupBanner } from "@/features/organizations/components";
import { AppSidebar } from "../sidebar/app-sidebar";

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user } = useMeQuery();
  return (
    <div className="flex flex-col h-full">
      <SidebarProvider>
        {user && <AppSidebar user={user} />}

        <SidebarInset className="overflow-hidden  flex flex-1 flex-col overflow-y-auto h-screen max-h-[calc(100vh-50px)]">
          <FinishOrgSetupBanner />

          {!user && (
            <div className="absolute top-4 right-4 z-10">
              <LoginButtons />
            </div>
          )}

          {children}
        </SidebarInset>
      </SidebarProvider>

      <iframe
        id="microsoft-picker-iframe"
        style={{
          width: "70%",
          height: "600px",
          border: "none",
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1000,
          display: "none",
        }}
        name="microsoftPickerFrame"
      />
    </div>
  );
}
