import { Issue } from "./issues.schema";

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
  totalOpen: number;
  totalClosed: number;
}

export type PaginatedIssues = {
  data: Issue[];
  pagination: Pagination;
};
