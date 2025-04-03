export type IssueStatus = "open" | "closed";

export interface Issue {
  id: string;
  projectId: string;
  creatorId: string;
  title: string;
  description?: string | null;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedIssues {
  data: Issue[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
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
