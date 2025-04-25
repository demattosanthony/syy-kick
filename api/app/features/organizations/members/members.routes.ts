/** Express */
import { Router } from "express";

/** Middlewares */
import PermissionsMiddlewares from "../../permissions/permissions.middlewares";

/** Types */
import { Permissions } from "../../permissions/permissions.types";

/** Handlers */
import { handlers } from "./members.handlers";

export default Router({ mergeParams: true })
    .get(
        "",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION_MEMBERS,
            Permissions.Actions.READ
        ),
        handlers.listMembers
    )
    .get(
        "/:memberId",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION_MEMBERS,
            Permissions.Actions.READ
        ),
        handlers.getMemberRole
    );
