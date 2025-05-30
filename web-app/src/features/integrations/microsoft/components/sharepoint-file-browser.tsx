import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FolderOpen,
  File,
  ChevronLeft,
  Loader2,
  ExternalLink,
} from "lucide-react";
import api from "@/lib/api";
import microsoftGraphApi from "@/features/integrations/microsoft/api/microsoft-graph";
import sharepointLogo from "@/assets/logos/sharepoint.svg";
import { useNavigate, useSearchParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";

interface SharePointItem {
  id: string;
  name: string;
  folder?: boolean;
  file?: boolean;
  webUrl?: string;
  parentReference?: {
    driveId: string;
    path?: string;
  };
  "@microsoft.graph.downloadUrl"?: string;
  size?: number;
  driveId?: string;
}

interface SharePointFileBrowserProps {
  onFileSelect?: (file: SharePointItem) => void;
  onFolderSelect?: (folder: SharePointItem) => void;
  isDownloading?: boolean;
}

export function SharePointFileBrowser({
  onFileSelect,
  onFolderSelect,
  isDownloading = false,
}: SharePointFileBrowserProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SharePointItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [driveId, setDriveId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const checkAuth = useCallback(async () => {
    try {
      const redirectUri = encodeURIComponent(window.location.href);
      const userToken = await api.auth.getUploadToken(redirectUri);
      if (userToken.accessToken) {
        setAccessToken(userToken.accessToken);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error("Error checking authentication:", err);
      setIsAuthenticated(false);
    }
  }, []);

  // Handle OAuth success
  useEffect(() => {
    const oauthSuccess = searchParams.get("oauth_success");
    const authSource = searchParams.get("auth_source");

    if (oauthSuccess === "true" && authSource === "sharepoint_browser") {
      // Authentication successful from our browser
      setIsAuthenticated(true);
      // Clean up URL params
      setSearchParams({});
      // Check auth again to get the token
      checkAuth();
    }
  }, [searchParams, setSearchParams, checkAuth]);

  // Check authentication status on mount and when popover opens
  useEffect(() => {
    if (open) {
      checkAuth();
    }
  }, [open, checkAuth]);

  // Load drive and initial content when token is available
  useEffect(() => {
    if (accessToken && open) {
      loadInitialContent();
    }
  }, [accessToken, open]);

  const loadInitialContent = async () => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      // Get the user's OneDrive/SharePoint drive
      const driveData = await microsoftGraphApi.getOrgDrive(accessToken);
      if (driveData.webUrl) {
        // Extract drive ID from the URL or use a different approach
        // For now, we'll get the root drive
        const response = await fetch(
          "https://graph.microsoft.com/v1.0/me/drive",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            credentials: "omit",
          }
        );

        if (response.ok) {
          const data = await response.json();
          setDriveId(data.id);
          // Load root folder content
          await loadFolderContent(data.id, "");
        }
      }
    } catch (err) {
      console.error("Error loading initial content:", err);
      setError("Failed to load SharePoint content");
    } finally {
      setLoading(false);
    }
  };

  const loadFolderContent = async (driveId: string, folderPath: string) => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const content = await microsoftGraphApi.getFolderContent(
        driveId,
        folderPath,
        accessToken
      );

      // Transform the content to our format
      const transformedItems: SharePointItem[] = content.map((item: any) => ({
        id: item.id,
        name: item.name,
        folder: !!item.folder,
        file: !!item.file,
        webUrl: item.webUrl,
        parentReference: item.parentReference,
        "@microsoft.graph.downloadUrl": item["@microsoft.graph.downloadUrl"],
        size: item.size,
        driveId: driveId,
      }));

      setItems(transformedItems);
    } catch (err) {
      console.error("Error loading folder content:", err);
      setError("Failed to load folder content");
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = useCallback(
    async (folder: SharePointItem) => {
      if (!driveId || !accessToken) return;

      const newPath = [...currentPath, folder.name];
      setCurrentPath(newPath);

      // Build the folder path
      const folderPath = newPath.join("/");
      await loadFolderContent(driveId, folderPath);

      if (onFolderSelect) {
        onFolderSelect(folder);
      }
    },
    [driveId, currentPath, accessToken, onFolderSelect]
  );

  const navigateBack = useCallback(async () => {
    if (!driveId || !accessToken || currentPath.length === 0) return;

    const newPath = currentPath.slice(0, -1);
    setCurrentPath(newPath);

    const folderPath = newPath.join("/");
    await loadFolderContent(driveId, folderPath);
  }, [driveId, currentPath, accessToken]);

  const handleItemSelect = (item: SharePointItem) => {
    if (item.folder) {
      navigateToFolder(item);
    } else if (item.file && onFileSelect) {
      onFileSelect(item);
      setOpen(false);
    }
  };

  const getCurrentPathDisplay = () => {
    if (currentPath.length === 0) return "SharePoint Files";
    return currentPath.join(" / ");
  };

  const handleAuthenticate = async () => {
    const redirectUri = encodeURIComponent(window.location.href);

    try {
      // Pass auth_source parameter to indicate this is from SharePoint browser
      const authUrl = await api.auth.getMicrosoftFilesInit(
        redirectUri,
        "sharepoint_browser"
      );
      window.location.href = authUrl.url;
    } catch (error) {
      console.error("Error initiating authentication:", error);
      setError("Failed to start authentication");
    }
  };

  const handleGoToIntegrations = () => {
    setOpen(false);
    navigate("/integrations");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 px-2 gap-2"
          type="button"
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <img src={sharepointLogo} alt="SharePoint" width={16} height={16} />
          )}
          <span className="text-sm hidden sm:inline">Browse</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {isAuthenticated === false ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <img
                src={sharepointLogo}
                alt="SharePoint"
                width={20}
                height={20}
              />
              <h3 className="font-medium">Connect SharePoint</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              You need to connect your SharePoint account to browse and select
              files.
            </p>
            <div className="space-y-2">
              <Button className="w-full" onClick={handleAuthenticate}>
                Connect SharePoint
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoToIntegrations}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Go to Integrations
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <div className="flex items-center border-b px-3 h-10">
              {currentPath.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 mr-2"
                  onClick={navigateBack}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <span className="text-sm font-medium truncate flex-1">
                {getCurrentPathDisplay()}
              </span>
            </div>
            <CommandInput
              placeholder="Search files and folders..."
              className="h-9"
            />
            <CommandList>
              {loading ? (
                <div className="space-y-1 py-1 px-2">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-[28px] w-full" />
                  ))}
                </div>
              ) : error ? (
                <CommandEmpty>{error}</CommandEmpty>
              ) : items.length === 0 ? (
                <CommandEmpty>No files or folders found</CommandEmpty>
              ) : (
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      onSelect={() => handleItemSelect(item)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      {item.folder ? (
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <File className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="truncate">{item.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
