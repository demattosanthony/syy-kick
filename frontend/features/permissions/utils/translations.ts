import { Permissions } from "@/types/permissions";

export const membersTableTranslations = Object.freeze({
  members: {
    emptyLabel: "No members found",
    deleteRow: "Remove member",
    editRow: "Edit role",
    deleteRowConfirmation: {
      title: "Are you absolutely sure?",
      body: "This action cannot be undone. This will permanently delete the member from the organization.",
      confirm: "Yes, delete",
    },
    deleteRows: "Remove selected members",
    deleteRowsConfirmation: {
      title: "Are you absolutely sure?",
      body: "This action cannot be undone. This will permanently delete the selected members from the organization.",
      confirm: "Yes, delete",
    },
  },
  pending: {
    emptyLabel: "No pending invitations",
    deleteRow: "Cancel invitation",
    deleteRowConfirmation: {
      title: "Are you absolutely sure?",
      body: "This action cannot be undone. This will permanently delete the invitation.",
      confirm: "Yes, delete",
    },
    deleteRows: "Cancel selected invitations",
    deleteRowsConfirmation: {
      title: "Are you absolutely sure?",
      body: "This action cannot be undone. This will permanently delete the selected invitations.",
      confirm: "Yes, delete",
    },
  },
});

export const editRoleTranslations: Record<string, string> = Object.freeze({
  [Permissions.Resources.ORGANIZATION]: "Organization",
  [Permissions.Resources.ORGANIZATION_INVITATIONS]: "Organization Invitations",
  [Permissions.Resources.ORGANIZATION_MEMBERS]: "Organization Members",
  [Permissions.Resources.ORGANIZATION_SEATS]: "Organization Seats",
  [Permissions.Resources.ORGANIZATION_PROJECTS]: "Organization Projects",
  [Permissions.Resources.ORGANIZATION_PROJECT_DOCS]:
    "Organization Project Docs",
  [Permissions.Resources.ORGANIZATION_PROJECT_INVITATIONS]:
    "Organization Project Invitations",
  [Permissions.Resources.ORGANIZATION_PROJECT_MEMBERS]:
    "Organization Project Members",
  [Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES]:
    "Organization Knowledge Bases",
  [Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS]:
    "Organization Knowledge Bases Docs",
});

export const editRoleActions: Record<string, string> = Object.freeze({
  [Permissions.Actions.CREATE]: "Create",
  [Permissions.Actions.READ]: "Read",
  [Permissions.Actions.UPDATE]: "Update",
  [Permissions.Actions.DELETE]: "Delete",
});
