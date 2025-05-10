export type SortOption = "recent" | "name-asc" | "name-desc" | "created-asc" | "created-desc";

export type SharePointFile = {
    name: string;
    webDavUrl?: string;
    webUrl?: string;
    size: number;
    id: string;
    folder?: {
        childCount?: number;
    };
    parentReference?: {
        driveId?: string;
        sharepointIds?: {
            listId: string;
            webId: string;
            siteId: string;
            siteUrl: string;
        };
    };

    sharepointIds?: {
        listItemUniqueId?: string;
        listItemId?: string;
        listId?: string;
        webId?: string;
        siteId?: string;
        siteUrl?: string;
    };

    "@sharePoint.embedUrl"?: string;
    "@sharePoint.endpoint"?: string;
    "@sharePoint.listUrl"?: string;
};