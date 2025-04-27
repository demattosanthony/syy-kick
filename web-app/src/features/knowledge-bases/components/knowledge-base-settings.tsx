import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

// UI component imports
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// API and data fetching imports
import {
  useDeleteKnowledgeBase,
  useKnowledgeBase,
  useUpdateKnowledgeBase,
} from "../api";

// Custom component imports
import { usePermissions } from "@/features/permissions/context";
import { useMeQuery } from "@/features/user/api";
import { PermissionsConstants } from "@/features/permissions/utils";
import { Permissions } from "@/types/permissions";
import { AccessLogStatus } from "@/features/organizations/types";
import { AccessLogs } from "@/features/organizations/components";

const KnowledgeBaseSettings = ({ kbId }: { kbId: string }) => {
  const navigate = useNavigate();

  const { data: user } = useMeQuery();
  const { data: knowledgeBase } = useKnowledgeBase(kbId);

  const { canDeleteOrgProjects, canReadOrgKnowledgeBaseAccessLogs } =
    usePermissions();

  const updateKnowledgeBaseMutation = useUpdateKnowledgeBase();
  const deleteKnowledgeBaseMutation = useDeleteKnowledgeBase();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  // Handle form submission
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateKnowledgeBaseMutation.mutateAsync({
        knowledgeBaseId: kbId,
        data: {
          name: formData.name,
          description: formData.description,
        },
      });

      toast.success("Settings updated", {
        description:
          "Your knowledge base settings have been updated successfully.",
      });
    } catch (error) {
      console.error("Failed to update knowledge base settings:", error);
      toast.error(
        "Failed to update knowledge base settings. Please try again."
      );
    }
  };

  async function handleDeleteKnowledgeBase() {
    try {
      await deleteKnowledgeBaseMutation.mutateAsync(kbId);
      toast.success("Knowledge base deleted", {
        description: "Your knowledge base has been deleted successfully.",
      });
      navigate("/knowledge-bases");
    } catch {
      toast.error("Failed to delete knowledge base. Please try again.");
    }
  }

  // Load form values
  useEffect(() => {
    if (knowledgeBase) {
      setFormData({
        name: knowledgeBase.name,
        description: knowledgeBase.description || "",
      });
    }
  }, [knowledgeBase]);

  return (
    <div className="flex flex-col h-screen w-full">
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-3xl mx-auto pt-6 px-6 w-full">
          <div className="space-y-6 pb-10 w-full">
            {/* Knowledge Base Details Section */}
            <section className="space-y-4">
              <div className="space-y-1">
                <h1 className="text-xl font-medium">Knowledge Base Settings</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your knowledge base settings and configuration.
                </p>
              </div>

              <Card className="p-6">
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Knowledge Base Name"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Knowledge Base Description"
                        rows={4}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={updateKnowledgeBaseMutation.isPending}
                      >
                        {updateKnowledgeBaseMutation.isPending
                          ? "Saving..."
                          : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                </form>
              </Card>
            </section>

            {canReadOrgKnowledgeBaseAccessLogs &&
              knowledgeBase?.organizationId &&
              user && (
                <AccessLogs
                  organizationId={knowledgeBase.organizationId}
                  resources={Object.entries(Permissions.Resources).filter(
                    ([_, value]) =>
                      PermissionsConstants.OrganizationKnowledgeBaseResources.includes(
                        value
                      ) &&
                      value !==
                        Permissions.Resources
                          .ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS
                  )}
                  actions={Object.entries(Permissions.Actions)}
                  status={Object.entries(AccessLogStatus)}
                  type="knowledge-base"
                  knowledgeBaseId={kbId}
                  user={user}
                />
              )}

            {/* Danger Zone Section */}
            <section className="flex items-center justify-between px-2">
              <div className="space-y-1">
                <h2 className="text-base font-medium">Danger Zone</h2>
                <p className="text-sm text-muted-foreground">
                  Delete your knowledge base and all its data permanently.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={!canDeleteOrgProjects}
                    variant="destructive"
                  >
                    Delete Knowledge Base
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      your knowledge base and all associated data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteKnowledgeBase}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Knowledge Base
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseSettings;
