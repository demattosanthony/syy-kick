import { FormattedSite, Site } from "./sites.types";
import z from "zod";

export const formatSites = (sites: Site[]): FormattedSite[] => {
  return sites.map((site) => ({
    id: site.id,
    organizationId: site.organizationId,
    userId: site.userId,
    address: site.address,
    city: site.city,
    state: site.state,
    postalCode: site.postalCode,
    country: site.country,
    placeId: site.placeId,
    latitude: site.latitude ? parseFloat(site.latitude) : null,
    longitude: site.longitude ? parseFloat(site.longitude) : null,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
  }));
};

export const validationSchema = {
  create: z.object({
    address: z.string().nonempty(),
    city: z.string().nonempty(),
    state: z.string().nonempty(),
    postalCode: z.string().nonempty(),
    country: z.string().nonempty(),
    placeId: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
  })
};
