import { Issue } from "./issues.schema";

export type PaginatedIssues = {
  data: Issue[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
};
