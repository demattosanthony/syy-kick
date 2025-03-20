import { getOrgIdOrUnedfined } from "../../utils";
import { schemas } from "./knowledge-bases.schemas";
import { Request, Response } from "express";
import * as ops from "./knowledge-bases.ops";

export const createKnowledgeBase = async (req: Request, res: Response) => {
  const orgId = getOrgIdOrUnedfined(req.workspace);
  const userId = req.dbUser?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const data = schemas.createKnowledgeBase.parse({
    ...req.body,
    userId: orgId ? undefined : userId,
    organizationId: orgId,
  });
  const kb = await ops.createKnowledgeBase(data, userId);
  res.json(kb);
};

export const listKnowledgeBases = async (req: Request, res: Response) => {
  const userId = req.dbUser?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const orgId = getOrgIdOrUnedfined(req.workspace);
  const kbs = await ops.listKnowledgeBases(userId, orgId);
  res.json(kbs);
};

export const getKnowledgeBase = async (req: Request, res: Response) => {
  const { knowledgeBaseId } = req.params;
  const kb = await ops.getKnowledgeBase(knowledgeBaseId);
  res.json(kb);
};

export const deleteKnowledgeBase = async (req: Request, res: Response) => {
  const { knowledgeBaseId } = req.params;
  await ops.deleteKnowledgeBase(knowledgeBaseId);
  res.json({ success: true });
};

export const updateKnowledgeBase = async (req: Request, res: Response) => {
  const { knowledgeBaseId } = req.params;
  const userId = req.dbUser?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });

    return;
  }

  const data = schemas.updateKnowledgeBase.parse(req.body);
  const kb = await ops.updateKnowledgeBase(knowledgeBaseId, data);
  res.json(kb);
};

export const uploadDocs = async (req: Request, res: Response) => {
  const { knowledgeBaseId } = req.params;
  const data = schemas.docsUpload.parse(req.body);
  const result = await ops.uploadDocs(knowledgeBaseId, data);
  res.json(result);
};

export const getDocs = async (req: Request, res: Response) => {
  const { knowledgeBaseId } = req.params;
  const { path = "" } = req.query;
  const docs = await ops.getDocs(knowledgeBaseId, path as string);
  res.json(docs);
};
