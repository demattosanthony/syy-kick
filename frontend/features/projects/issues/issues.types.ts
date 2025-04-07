import { User } from "@/types/user";

export type IssueStatus = "open" | "closed";

export interface IssueComment {
  id: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
  author: User;
}

export interface Issue {
  id: string;
  projectId: string;
  creatorId: string;
  title: string;
  issueNumber: number;
  description?: string | null;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
  creator: User;

  comments?: IssueComment[];
}

export interface PaginatedIssues {
  data: Issue[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
    totalOpen: number;
    totalClosed: number;
  };
}

export interface CreateIssueData {
  title: string;
  description?: string;
}

export interface UpdateIssueData {
  title?: string;
  description?: string | null;
  status?: IssueStatus;
}
