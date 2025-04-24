
type EntityReference = {
    id: string;
    name: string;
}

interface AccessLogUser extends EntityReference {
    email: string;
    profilePicture: string;
}

export type OrganizationAccessLog = {
    id: string;
    status: AccessLogStatus;
    createdAt: string;
    user: AccessLogUser;
    resource: EntityReference;
    action: EntityReference;
    organization: EntityReference | null;
    project: EntityReference | null;
    document: EntityReference | null;
    knowledgeBase: EntityReference | null;
};

export type OrganizationAccessLogsResponse = {
    data: OrganizationAccessLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
};

export type OrganizationAccessLogFilters = {
    search: string;
    resource: string;
    action: string;
    status: string;
};

export enum AccessLogStatus {
    AUTHORIZED = "authorized",
    UNAUTHORIZED = "unauthorized",
}