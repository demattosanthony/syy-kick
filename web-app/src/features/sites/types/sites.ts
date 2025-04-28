export type Site = {
  id: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  placeId?: string;
  latitude?: string;
  longitude?: string;
  organizationId?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
};

export type MutationSiteData = Omit<
  Site,
  "id" | "createdAt" | "updatedAt"
>;
