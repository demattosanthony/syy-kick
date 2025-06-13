/** Hooks & Methods */
import { memo } from "react";

/** Types */
import { Permissions } from "@/features/permissions/types/permissions";

/** Icons */
import { Building, MapPin, Shield, UserRoundPlus, Users } from "lucide-react";

const ResourceIcon = ({
  resource,
  size = 16,
}: {
  resource: Permissions.Resources;
  size?: number;
}) => {
  switch (resource) {
    case Permissions.Resources.ORGANIZATION:
      return <Building size={size} />;
    case Permissions.Resources.ORGANIZATION_INVITATIONS:
      return <UserRoundPlus size={size} />;
    case Permissions.Resources.ORGANIZATION_MEMBERS:
      return <Users size={size} />;
    case Permissions.Resources.ORGANIZATION_SEATS:
      return <Users size={size} />;
    case Permissions.Resources.ORGANIZATION_SITES:
      return <MapPin size={size} />;
    default:
      return <Shield size={size} />;
  }
};

export default memo(ResourceIcon);
