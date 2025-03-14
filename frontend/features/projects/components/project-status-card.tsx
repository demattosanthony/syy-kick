"use client";

import { Project } from "@/types/project";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const ProjectStatusCard = ({ project }: { project: Project }) => {
  // Calculate completion percentage based on dates
  const calculateCompletionPercentage = () => {
    if (!project?.estimatedStartDate || !project?.estimatedEndDate) {
      return 0;
    }

    const startDate = new Date(project.estimatedStartDate).getTime();
    const endDate = new Date(project.estimatedEndDate).getTime();
    const currentDate = new Date().getTime();

    // If project hasn't started yet
    if (currentDate < startDate) {
      return 0;
    }

    // If project is past end date
    if (currentDate > endDate) {
      return 100;
    }

    // Calculate percentage between start and end date
    const totalDuration = endDate - startDate;
    const elapsedDuration = currentDate - startDate;
    const percentage = Math.round((elapsedDuration / totalDuration) * 100);

    return percentage;
  };

  const completionPercentage = calculateCompletionPercentage();

  return (
    <Card className="p-4">
      <h2 className="font-semibold mb-4">Project Status</h2>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span>{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} />
        </div>
        <div className="grid grid-cols-2 gap-1 text-sm">
          <div>
            <div className="text-muted-foreground">Start Date</div>
            <div>
              {project?.estimatedStartDate
                ? new Date(project.estimatedStartDate).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }
                  )
                : "Not set"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Target End Date</div>
            <div>
              {project?.estimatedEndDate
                ? new Date(project.estimatedEndDate).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }
                  )
                : "Not set"}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProjectStatusCard;
