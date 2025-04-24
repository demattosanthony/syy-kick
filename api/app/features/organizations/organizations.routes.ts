/** Express */
import { Router } from "express";

/** Handlers */
import { handlers } from "./organizations.handlers";

/** Permissions */
import { Permissions } from "../permissions/permissions.types";

/** Middleware */
import { auth } from "../../middleware";
import PermissionsMiddlewares from "../permissions/permissions.middlewares";

/** Routes */
import accessLogsRouter from "./access-logs/access-logs.routes";

export default Router()
    .get("", handlers.list)
    .post("", handlers.create)
    .get(
        "/:id",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION,
            Permissions.Actions.READ
        ),
        handlers.get
    )
    .put(
        "/:id",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION,
            Permissions.Actions.UPDATE
        ),
        handlers.update
    )
    .delete(
        "/:id",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION,
            Permissions.Actions.DELETE
        ),
        handlers.delete
    )
    .get(
        "/:id/permissions",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION_MEMBERS,
            Permissions.Actions.READ
        )
    )
    .get(
        "/:id/members",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION_MEMBERS,
            Permissions.Actions.READ
        ),
        handlers.listMembers
    )
    .get(
        "/:id/members/:userId",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION_MEMBERS,
            Permissions.Actions.READ
        ),
        handlers.getMemberRole
    )
    .post(
        "/:id/seats/validate",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION_SEATS,
            Permissions.Actions.READ
        ),
        handlers.validateSeatUpdate
    )
    .put(
        "/:id/seats",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION_SEATS,
            Permissions.Actions.UPDATE
        ),
        handlers.updateSeats
    )
    .get(
        "/:id/transferable-permissions",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION_INVITATIONS,
            Permissions.Actions.CREATE
        ),
        handlers.getTransferablePermissions
    )
    .get("/:id/user-role", auth, handlers.getUserRole)
    .use("/:id/access-logs", accessLogsRouter);
