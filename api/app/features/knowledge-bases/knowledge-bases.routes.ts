import { Router } from "express";
import { Permissions } from "../permissions/permissions.types";
import * as handlers from "./knowledge-bases.handlers";
import { permissions } from "../../middleware";

export default Router()
  .post(
    "/",
    permissions(
      Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES,
      Permissions.Actions.CREATE
    ),
    handlers.createKnowledgeBase
  )
  .get("/", handlers.listKnowledgeBases)
  .get(
    "/:knowledgeBaseId",
    permissions(
      Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES,
      Permissions.Actions.READ
    ),
    handlers.getKnowledgeBase
  )
  .patch(
    "/:knowledgeBaseId",
    permissions(
      Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES,
      Permissions.Actions.UPDATE
    ),
    handlers.updateKnowledgeBase
  )
  .delete(
    "/:knowledgeBaseId",
    permissions(
      Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES,
      Permissions.Actions.DELETE
    ),
    handlers.deleteKnowledgeBase
  )
  .post(
    "/:knowledgeBaseId/documents",
    permissions(
      Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES,
      Permissions.Actions.CREATE
    ),
    handlers.uploadDocs
  )
  .get(
    "/:knowledgeBaseId/documents",
    permissions(
      Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES,
      Permissions.Actions.READ
    ),
    handlers.getDocs
  )
  .delete(
    "/:knowledgeBaseId/documents",
    permissions(
      Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES,
      Permissions.Actions.DELETE
    ),
    handlers.deleteDocs
  );
