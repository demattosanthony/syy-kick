"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Project } from "@/types/project";
import CreateProjectDialog from "./create-project-dialog";
import { usePermissions } from "@/features/permissions/context";
import Image from "next/image";
import Link from "next/link";
import { useWorkspace } from "@/components/sidebar/workspace-context";

// Add this style tag for the pin point shape
const PinStyles = () => (
  <style jsx global>{`
    .location-marker {
      width: 28px;
      height: 28px;
      background-color: hsl(var(--marker-fill, 215 5% 15%));
      border-radius: 50% 50% 0 50%;
      transform: rotate(45deg);
      position: relative;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .location-marker::after {
      content: "";
      position: absolute;
      top: 9px;
      left: 9px;
      width: 10px;
      height: 10px;
      background-color: white;
      border-radius: 50%;
    }

    /* Add overlay to hide Google logo */
    .map-container {
      position: relative;
      overflow: hidden;
    }

    .map-container::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 25px;
      background-color: hsl(var(--muted));
      z-index: 10;
    }
  `}</style>
);
const ProjectPreviews = ({ projects }: { projects: Project[] }) => {
  const { canCreateOrgProjects } = usePermissions();
  const { activeWorkspace } = useWorkspace();

  return (
    <div className="w-full max-w-[950px] px-6 mx-auto">
      <PinStyles />

      {projects?.length > 0 && (
        <div className="flex flex-col gap-1 mb-3 ">
          <h3 className="text-lg font-medium">Recent Projects</h3>
          <p className="text-sm text-muted-foreground">
            Continue working on your recent projects
          </p>
        </div>
      )}

      {projects.length === 0 && canCreateOrgProjects ? (
        <div className="flex justify-center items-center w-full">
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6 w-full max-w-md flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <div className="location-marker"></div>
            </div>
            <h3 className="text-lg font-medium mb-1">
              Create your first project
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by creating a project to organize your work
            </p>
            <CreateProjectDialog
              organizationId={
                activeWorkspace?.type === "organization"
                  ? activeWorkspace.id
                  : undefined
              }
              trigger={
                <button className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium">
                  New Project
                </button>
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              prefetch={true}
              className="block"
            >
              <ProjectCard project={project} />
            </Link>
          ))}

          {/* Add "Create Project" card if there are fewer than 6 projects */}
          {projects.length < 6 && canCreateOrgProjects && <AddProjectCard organizationId={activeWorkspace?.type === "organization" ? activeWorkspace.id : undefined} />}
        </div>
      )}
    </div>
  );
};

interface ProjectCardProps {
  project: Project;
}

function ProjectCard({ project }: ProjectCardProps) {
  const mapUrl = useMemo(() => {
    // Create Google Maps Static API URL for satellite view
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

    // Default to a generic location if coordinates aren't available
    const hasLocation = project.address;
    // Default to a view of ocean water if coordinates aren't available
    const lat = hasLocation ? project.site?.address?.latitude : "28.4595";
    const lng = hasLocation ? project.site?.address?.longitude : "-80.5327";

    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=400x200&maptype=satellite&key=${apiKey}`;
  }, [project]);

  return (
    <motion.div
      className="bg-card text-card-foreground rounded-lg shadow-sm border border-border overflow-hidden cursor-pointer"
      initial={{ y: 0, boxShadow: "var(--shadow-sm)" }}
      whileHover={{
        y: -2,
        boxShadow: "var(--shadow-md)",
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="relative h-[120px] w-full bg-muted">
        {/* Map Image */}
        <Image
          src={mapUrl}
          alt={`Location of ${project.name}`}
          className="w-full h-full object-cover"
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          priority={false} // Only set to true for above-the-fold images
          loading="lazy"
          onError={(e) => {
            // Fallback if image fails to load
            e.currentTarget.src =
              "https://placehold.co/400x200/e2e8f0/64748b?text=No+Location";
          }}
        />

        {/* Location marker matching the image exactly */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            {/* Pin drop shadow */}
            <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-8 h-2 bg-black/30 rounded-full blur-sm"></div>

            {/* Location marker that matches the image */}
            <div className="location-marker"></div>
          </div>
        </div>

        {/* Gradient overlay to help with text visibility */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent"></div>
      </div>

      {/* Move the content div up to overlap with the map */}
      <div className="relative p-3 mt-[-20px] bg-card rounded-t-lg z-10">
        <h3 className="font-medium text-sm line-clamp-1">{project.name}</h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground">
            {project.site?.address
              ? project.site?.address?.address +
              (project.site?.address?.city ? `, ${project.site?.address?.city}` : "") +
              (project.site?.address?.state ? `, ${project.site?.address?.state}` : "") +
              (project.site?.address?.postalCode ? `, ${project.site?.address?.postalCode}` : "")
              : "No location"}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function AddProjectCard({ organizationId }: { organizationId: string | undefined }) {
  return (
    <motion.div
      className="bg-card text-card-foreground rounded-lg shadow-sm border border-border overflow-hidden cursor-pointer h-full flex flex-col items-center justify-center"
      initial={{ y: 0, boxShadow: "var(--shadow-sm)" }}
      whileHover={{
        y: -2,
        boxShadow: "var(--shadow-md)",
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <CreateProjectDialog
        organizationId={organizationId}
        trigger={
          <div className="p-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 5V19M5 12H19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="font-medium text-sm mb-1">Add Project</h3>
            <p className="text-xs text-muted-foreground">
              Create a new project
            </p>
          </div>
        }
      />
    </motion.div>
  );
}

export default ProjectPreviews;
