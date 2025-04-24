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
import seatsRouter from "./seats/seats.routes";
import membersRouter from "./members/members.routes";
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
    .use("/:id/seats", seatsRouter)
    .get("/:id/user-role", auth, handlers.getUserRole)
    .use("/:id/access-logs", accessLogsRouter)
    .use("/:id/members", membersRouter);
