export type Address = {
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  placeId?: string;
  latitude?: string;
  longitude?: string;
};

export type Site = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: Address;
  createdAt: string;
  updatedAt: string;
};

export type MutationSiteData = Omit<Site, "id" | "createdAt" | "updatedAt"> & {
  organizationId?: string;
  type: "organization" | "personal";
};
