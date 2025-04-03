import { sites } from "./sites.schema";

export type Site = typeof sites.$inferSelect;

export type SiteData = Omit<FormattedSite, "id" | "createdAt" | "updatedAt">;

type Pagination = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
};

export type PaginatedSites = {
  data: FormattedSite[];
  pagination: Pagination;
};

export type FormattedSite = {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  address: {
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    placeId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  createdAt: Date;
  updatedAt?: Date | null;
};
