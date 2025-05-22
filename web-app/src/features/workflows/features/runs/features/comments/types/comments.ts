export type Comment = {
    id: string;
    comment: string;
    createdAt: string;
    updatedAt: string;
    user: {
        id: string;
        name: string;
    }
}
