export type SyyclopsFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  type: string;
  fileHash: string | null;
  syyclops_path: string | null;
  sharepoint_path: string | null;
  google_drive_path: string | null;
  file_origin_type: "syyclops" | "sharepoint" | "google_drive";
  category: "drawing" | "document" | null;
  createdAt: string;
  updatedAt: string;
  url?: string;
};
