import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { DragAndDropProvider } from "@/components/DragDropProvider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { me } from "../actions";

export default async function MainAppLayout({
  children,
  header,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
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
            {header}

            {children}
          </DragAndDropProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
