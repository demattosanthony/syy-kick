import { Permissions } from "@/features/permissions/types";
import { AccessLogStatus } from "../types/access-logs";

export const resourceNameToLabel = (resourceName: string) => {
    switch (resourceName) {
        case Permissions.Resources.ORGANIZATION:
            return "Organization";
        case Permissions.Resources.ORGANIZATION_INVITATIONS:
            return "Organization Invitations";
        case Permissions.Resources.ORGANIZATION_MEMBERS:
            return "Organization Members";
        case Permissions.Resources.ORGANIZATION_SEATS:
            return "Organization Seats";
        case Permissions.Resources.ORGANIZATION_SITES:
            return "Organization Sites";
        case Permissions.Resources.ORGANIZATION_ACCESS_LOGS:
            return "Organization Access Logs";
        case Permissions.Resources.ORGANIZATION_PROJECTS:
            return "Project";
        case Permissions.Resources.ORGANIZATION_PROJECT_DOCS:
            return "Project Docs";
        case Permissions.Resources.ORGANIZATION_PROJECT_INVITATIONS:
            return "Project Invitations";
        case Permissions.Resources.ORGANIZATION_PROJECT_MEMBERS:
            return "Project Members";
        case Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES:
            return "Knowledge Bases";
        case Permissions.Resources.PROJECT_ISSUES:
            return "Project Issues";
        case Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS:
            return "Knowledge Bases Docs";
        default:
            return resourceName;
    }
}

// Action color mapping
export const getActionColor = (actionName: string) => {
    switch (actionName) {
        case Permissions.Actions.CREATE:
            return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
        case Permissions.Actions.READ:
            return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
        case Permissions.Actions.UPDATE:
            return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
        case Permissions.Actions.DELETE:
            return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
        default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
    }
}

// Status color mapping
export const getStatusColor = (statusName: string) => {
    switch (statusName) {
        case AccessLogStatus.AUTHORIZED:
            return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
        case AccessLogStatus.UNAUTHORIZED:
            return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
        default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
    }
}

export const accessLogStatusTranslations = {
    [AccessLogStatus.AUTHORIZED]: "Authorized",
    [AccessLogStatus.UNAUTHORIZED]: "Unauthorized",
}
