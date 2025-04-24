/** Express */
import { Router } from "express";

/** Middlewares */
import PermissionsMiddlewares from "../../permissions/permissions.middlewares";

/** Types */
import { Permissions } from "../../permissions/permissions.types";

/** Handlers */
import { handlers } from "./seats.handlers";

export default Router({ mergeParams: true })
    .put(
        "",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION_SEATS,
            Permissions.Actions.UPDATE
        ),
        handlers.updateSeats
    )
    .post(
        "/validate",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION_SEATS,
            Permissions.Actions.READ
        ),
        handlers.validateSeatUpdate
    );