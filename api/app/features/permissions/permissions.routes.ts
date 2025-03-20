import { Request, Response, Router } from "express";
import { permissionsOps } from "./permissions.ops";
import { permissions } from "../../middleware";
import { Permissions } from "./permissions.types";

export default Router()
  .get("/roles", async (req: Request, res: Response) => {
    res.json(await permissionsOps.getRoles());
  })
  .post(
    "/organizations/:orgId/invitations",
    permissions(
      Permissions.Resources.ORGANIZATION_INVITATIONS,
      Permissions.Actions.CREATE
    ),
    permissionsOps.inviteUsers
  )
  .get(
    "/organizations/:orgId/invitations",
    permissions(
      Permissions.Resources.ORGANIZATION_INVITATIONS,
      Permissions.Actions.READ
    ),
    permissionsOps.getInvitations
  )
  .delete(
    "/organizations/:orgId/invitations",
    permissions(
      Permissions.Resources.ORGANIZATION_INVITATIONS,
      Permissions.Actions.DELETE
    ),
    permissionsOps.deleteInvitations
  )
  .get(
    "/organizations/:orgId/transferable-projects",
    permissions(
      Permissions.Resources.ORGANIZATION_PROJECTS,
      Permissions.Actions.READ
    ),
    permissionsOps.getTransferableProjects
  )
  .put(
    "/organizations/:orgId/members/:memberId",
    permissions(
      Permissions.Resources.ORGANIZATION_MEMBERS,
      Permissions.Actions.UPDATE
    ),
    permissionsOps.updateOrgMemberRole
  )
  .delete(
    "/organizations/:orgId/members",
    permissions(
      Permissions.Resources.ORGANIZATION_MEMBERS,
      Permissions.Actions.DELETE
    ),
    permissionsOps.deleteOrgMembers
  );
