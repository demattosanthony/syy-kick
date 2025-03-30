import { Request, Response, Router } from "express";
import { permissionsOps } from "./permissions.ops";
import { Permissions } from "./permissions.types";
import PermissionsMiddlewares from "./permissions.middlewares";

export default Router()
  .get("/roles", async (req: Request, res: Response) => {
    res.json(await permissionsOps.getRoles());
  })
  .post(
    "/organizations/:orgId/invitations",
    PermissionsMiddlewares.permissions(
      Permissions.Resources.ORGANIZATION_INVITATIONS,
      Permissions.Actions.CREATE
    ),
    permissionsOps.inviteUsers
  )
  .get(
    "/organizations/:orgId/invitations",
    PermissionsMiddlewares.permissions(
      Permissions.Resources.ORGANIZATION_INVITATIONS,
      Permissions.Actions.READ
    ),
    permissionsOps.getInvitations
  )
  .delete(
    "/organizations/:orgId/invitations",
    PermissionsMiddlewares.permissions(
      Permissions.Resources.ORGANIZATION_INVITATIONS,
      Permissions.Actions.DELETE
    ),
    permissionsOps.deleteInvitations
  )
  .get(
    "/organizations/:orgId/transferable-projects",
    PermissionsMiddlewares.permissions(
      Permissions.Resources.ORGANIZATION_PROJECTS,
      Permissions.Actions.READ
    ),
    permissionsOps.getTransferableProjects
  )
  .put(
    "/organizations/:orgId/members/:memberId",
    PermissionsMiddlewares.permissions(
      Permissions.Resources.ORGANIZATION_MEMBERS,
      Permissions.Actions.UPDATE
    ),
    permissionsOps.updateOrgMemberRole
  )
  .delete(
    "/organizations/:orgId/members",
    PermissionsMiddlewares.permissions(
      Permissions.Resources.ORGANIZATION_MEMBERS,
      Permissions.Actions.DELETE
    ),
    permissionsOps.deleteOrgMembers
  );
