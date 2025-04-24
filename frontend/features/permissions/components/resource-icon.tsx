/** Hooks & Methods */
import { memo } from "react";

/** Types */
import { Permissions } from "@/features/permissions/types/permissions";

/** Icons */
import { Book, Building, CircleDot, FileText, FolderOpen, MapPin, Shield, UserRoundPlus, Users } from "lucide-react";

const ResourceIcon = ({ resource, size = 16 }: { resource: Permissions.Resources, size?: number }) => {
    switch (resource) {
        case Permissions.Resources.ORGANIZATION:
            return <Building size={size} />
        case Permissions.Resources.ORGANIZATION_INVITATIONS:
        case Permissions.Resources.ORGANIZATION_PROJECT_INVITATIONS:
            return <UserRoundPlus size={size} />
        case Permissions.Resources.ORGANIZATION_MEMBERS:
        case Permissions.Resources.ORGANIZATION_PROJECT_MEMBERS:
            return <Users size={size} />
        case Permissions.Resources.ORGANIZATION_SEATS:
            return <Users size={size} />
        case Permissions.Resources.ORGANIZATION_SITES:
            return <MapPin size={size} />
        case Permissions.Resources.ORGANIZATION_PROJECTS:
            return <FolderOpen size={size} />
        case Permissions.Resources.ORGANIZATION_PROJECT_DOCS:
            return <FileText size={size} />
        case Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES:
            return <Book size={size} />
        case Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS:
            return <FileText size={size} />
        case Permissions.Resources.PROJECT_ISSUES:
            return <CircleDot size={size} />
        default:
            return <Shield size={size} />
    }
}

export default memo(ResourceIcon);