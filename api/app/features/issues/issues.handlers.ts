import { Request, Response } from "express";
import { z } from "zod";
import { issueOps } from "./issues.ops";
import { ISSUE_STATUS } from "./issues.schema";
import { PaginatedIssues } from "./issues.types";

export const issueHandlers = {
  /**
   * List issues for a specific project
   */
  list: async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params; // Assuming projectId is in the route path
      if (!projectId) {
        res.status(400).json({ message: "Project ID is required" });
        return;
      }

      const status = req.query.status as
        | (typeof ISSUE_STATUS)[number]
        | undefined;
      if (status && !ISSUE_STATUS.includes(status)) {
        res.status(400).json({ message: "Invalid status filter" });
        return;
      }

      console.log(
        "Listing issues for project:",
        projectId,
        "with status:",
        status
      );

      const issues = await issueOps.getAllIssues({
        projectId: projectId,
        status: status,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        searchTerm: req.query.searchTerm as string,
      });

      res.json(issues as PaginatedIssues);
    } catch (error) {
      console.error("Error listing issues:", error);
      res.status(500).json({ message: "Failed to retrieve issues" });
    }
  },

  /**
   * Get a single issue by ID
   */
  get: async (req: Request, res: Response) => {
    try {
      const { issueNumber, projectId } = req.params;
      const issue = await issueOps.getIssue({
        issueNumber: Number(issueNumber),
        projectId: projectId,
      });

      if (!issue) {
        res.status(404).json({
          message: "Issue not found",
        });
        return;
      }

      res.json(issue);
    } catch (error) {
      console.error("Error getting issue:", error);
      res.status(500).json({ message: "Failed to retrieve issue" });
    }
  },

  /**
   * Create a new issue within a project
   */
  create: async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params; // Assuming projectId is in the route path
      if (!projectId) {
        res.status(400).json({ message: "Project ID is required" });
        return;
      }

      // Assuming user ID comes from authentication middleware
      const creatorId = req.dbUser?.id;
      if (!creatorId) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const issueData = {
        projectId: projectId,
        creatorId: creatorId,
        title: req.body.title,
        description: req.body.description,
        dueDate: req.body.dueDate, // Added dueDate
      };

      // Validation happens within issueOps.createIssue
      const newIssue = await issueOps.createIssue({ data: issueData });

      res.status(201).json({
        message: "Issue created successfully",
        issueId: newIssue.id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
        return;
      }
      console.error("Error creating issue:", error);
      res.status(500).json({ message: "Failed to create issue" });
    }
  },

  /**
   * Update an existing issue
   */
  update: async (req: Request, res: Response) => {
    try {
      const { issueNumber, projectId } = req.params;

      // Validation happens within issueOps.updateIssue
      await issueOps.updateIssue({
        issueNumber: Number(issueNumber),
        projectId: projectId,
        data: req.body, // Pass the request body directly
      });

      res.status(200).json({
        // Changed to 200 for update confirmation
        message: "Issue updated successfully",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
        return;
      }
      console.error("Error updating issue:", error);
      res.status(500).json({ message: "Failed to update issue" });
    }
  },

  /**
   * Delete an issue
   */
  delete: async (req: Request, res: Response) => {
    try {
      const { issueNumber, projectId } = req.params;

      await issueOps.deleteIssue({
        issueNumber: Number(issueNumber),
        projectId: projectId,
      });

      res.status(200).json({
        // Changed to 200 for delete confirmation
        message: "Issue deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting issue:", error);
      res.status(500).json({ message: "Failed to delete issue" });
    }
  },
};
