import { ProjectsHeader } from "@/features/projects/components";
import ProjectNavigationTabs from "@/features/projects/components/project-nav-tabs";

export default function ProjectPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen h-screen bg-background flex items-center flex-col relative">
      <ProjectsHeader />

      <ProjectNavigationTabs />

      <div className="pt-2 w-full flex flex-1 justify-center overflow-y-auto">
        {children}
      </div>
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
          display: "none"
        }}
        name="microsoftPickerFrame"
      />
      {children}
    </div>
  );
}
