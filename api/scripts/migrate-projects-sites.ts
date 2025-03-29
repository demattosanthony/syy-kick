import { and, eq, inArray, isNull, or } from "drizzle-orm";
import db from "../app/config/db";
import {
  memberRoles,
  organizations,
  permissions,
  Project,
  projects,
  resources,
  roles,
  users,
} from "../app/config/schema";
import { sites } from "../app/features/sites/sites.schema";
import { Permissions } from "../app/features/permissions/permissions.types";

// Add new organization sites resource

await db
  .insert(resources)
  .values({ name: "org_sites", description: "The organization sites" })
  .execute();

// Add resource permissions to org admin and org manager
const actions = await db.query.actions.findMany();
const resource = await db.query.resources.findFirst({
  where: eq(resources.name, "org_sites"),
});

if (!resource) {
  throw new Error("Resource not found");
}

const orgAdminsAndManagersRoles = await db.query.roles.findMany({
  where: or(
    eq(roles.name, Permissions.Roles.ORGANIZATION_ADMIN),
    eq(roles.name, Permissions.Roles.ORGANIZATION_MANAGER)
  ),
});

const orgAdminsAndManagers = await db.query.memberRoles.findMany({
  where: and(
    inArray(
      memberRoles.roleId,
      orgAdminsAndManagersRoles.map((r) => r.id)
    ),
    isNull(memberRoles.projectId)
  ),
});

// Insert permissions for each action
const permissionsList = [];
for (let i = 0; i < orgAdminsAndManagers.length; i++) {
  const role = orgAdminsAndManagers[i];
  for (let j = 0; j < actions.length; j++) {
    const action = actions[j];
    permissionsList.push({
      memberRoleId: role.id,
      resourceId: resource.id,
      actionId: action.id,
    });
  }
}
await db.insert(permissions).values(permissionsList);

// Get all projects
const projectsList = await db.query.projects.findMany();

const groupedSitesProjects: {
  address: string;
  city: string;
  postalCode: string;
  state: string;
  country: string;
  latitude?: string | null;
  longitude?: string | null;
  projects: Project[];
  organizationId: string | null;
}[] = [];

const findIndexOfSiteWithSameAddress = (
  list: typeof groupedSitesProjects,
  project: Project
) => {
  const index = list.findIndex((item) => {
    return (
      item.address === project.address &&
      item.city === project.city &&
      item.postalCode === project.postalCode
    );
  });

  if (index === -1) {
    return null;
  }

  return index;
};

// Group projects by site
projectsList.forEach((project) => {
  if (
    !project?.address ||
    !project?.city ||
    !project?.postalCode ||
    !project?.country ||
    !project?.state
  ) {
    return;
  }

  const siteIndex = findIndexOfSiteWithSameAddress(
    groupedSitesProjects,
    project
  );

  if (siteIndex !== null) {
    groupedSitesProjects[siteIndex].projects.push(project);
  } else {
    groupedSitesProjects.push({
      address: project.address!,
      city: project.city!,
      postalCode: project.postalCode!,
      state: project.state ?? "",
      country: project.country ?? "",
      latitude: project.latitude,
      longitude: project.longitude,
      projects: [project],
      organizationId: project.organizationId,
    });
  }
});

const sitesToInsert = groupedSitesProjects.map((group) => ({
  name: `Site - ${group.city}`,
  slug: group.address.toLowerCase().replace(/\s/g, "-"),
  address: group.address,
  city: group.city,
  postalCode: group.postalCode,
  state: group.state,
  country: group.country,
  latitude: group.latitude,
  longitude: group.longitude,
  organizationId: group.organizationId,
}));

// Insert sites
if (sitesToInsert.length > 0) {
  const insertedSites = await db
    .insert(sites)
    .values(sitesToInsert)
    .returning({ id: sites.id });

  for (let i = 0; i < groupedSitesProjects.length; i++) {
    const site = groupedSitesProjects[i];
    const siteId = insertedSites[i].id;
    const projectIds = site.projects.map((p) => p.id);

    await db
      .update(projects)
      .set({ siteId })
      .where(inArray(projects.id, projectIds));
  }
}

// Update organizations slug
const organizationsList = await db.query.organizations.findMany();
const organizationsSlugs = organizationsList.map((org, i) => {
  const base = org.name ?? org.id;

  return {
    id: org.id,
    slug: base.toLowerCase().replace(/\s/g, "-"),
  };
});

for (const orgSlug of organizationsSlugs) {
  let slug = orgSlug.slug;
  let index = 1;

  while (
    await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    })
  ) {
    slug = `${orgSlug.slug}-${index}`;
    index++;
  }

  await db
    .update(organizations)
    .set({ slug })
    .where(eq(organizations.id, orgSlug.id));
}

// Update projects slug
const projectsListWithSite = await db.query.projects.findMany();
const projectsSlugs = projectsListWithSite.map((project) => {
  return {
    id: project.id,
    slug: project.name.toLowerCase().replace(/\s/g, "-"),
  };
});

projectsSlugs.forEach(async (projectSlug) => {
  let slug = projectSlug.slug;
  let index = 1;

  while (
    await db.query.projects.findFirst({ where: eq(projects.slug, slug) })
  ) {
    slug = `${projectSlug.slug}-${index}`;
    index++;
  }

  await db
    .update(projects)
    .set({ slug })
    .where(eq(projects.id, projectSlug.id));
});

// Update user's username
const usersList = await db.query.users.findMany();
const usersUsernames = usersList.map((user) => {
  return {
    id: user.id,
    username: user.name?.toLowerCase().replace(/\s/g, "-"),
  };
});

for (const userUsername of usersUsernames) {
  await db
    .update(users)
    .set({ username: userUsername.username })
    .where(eq(users.id, userUsername.id));
}
