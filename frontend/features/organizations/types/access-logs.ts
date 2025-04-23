
type EntityReference = {
    id: string;
    name: string;
}

interface AccessLogUser extends EntityReference {
    email: string;
    profilePicture: string;
}

export type AccessLog = {
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

export type AccessLogsResponse = {
    data: AccessLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
};

export type Filters = {
    search: string;
    resource: string;
    action: string;
    status: string;
};

export enum AccessLogStatus {
    AUTHORIZED = "authorized",
    UNAUTHORIZED = "unauthorized",
}