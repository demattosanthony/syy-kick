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
  FolderOpen,
  File,
  ChevronLeft,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import microsoftGraphApi from "@/features/integrations/microsoft/api/microsoft-graph";
import type { GraphDriveItem } from "@/features/integrations/microsoft/api/microsoft-graph";
import sharepointLogo from "@/assets/logos/sharepoint.svg";

// Cache keys for localStorage
const CACHE_KEYS = {
  SHAREPOINT_ROOT_ITEMS: "sharepoint_root_items",
  SHAREPOINT_DRIVE_ID: "sharepoint_drive_id",
} as const;

// Types
export type SharePointItem = Omit<GraphDriveItem, "folder" | "file"> & {
  folder?: boolean;
  file?: boolean;
  driveId?: string;
};

interface SharePointFileBrowserProps {
  onFileSelect?: (file: SharePointItem) => void;
  onFolderSelect?: (folder: SharePointItem) => void;
  isDownloading?: boolean;
  displayMode?: "popover" | "inline";
}

interface AuthState {
  isAuthenticated: boolean | null;
  accessToken: string | null;
}

interface BrowserState {
  items: SharePointItem[];
  currentPath: string[];
  driveId: string | undefined;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  isSearching: boolean;
  fileDetailLoading: string | null;
}

// Cache helper functions
const getCachedRootItems = (): SharePointItem[] => {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.SHAREPOINT_ROOT_ITEMS);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
};

const setCachedRootItems = (items: SharePointItem[]) => {
  try {
    localStorage.setItem(
      CACHE_KEYS.SHAREPOINT_ROOT_ITEMS,
      JSON.stringify(items)
    );
  } catch {
    // Ignore storage errors
  }
};

const getCachedDriveId = (): string | undefined => {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.SHAREPOINT_DRIVE_ID);
    return cached || undefined;
  } catch {
    return undefined;
  }
};

const setCachedDriveId = (driveId: string) => {
  try {
    localStorage.setItem(CACHE_KEYS.SHAREPOINT_DRIVE_ID, driveId);
  } catch {
    // Ignore storage errors
  }
};

const clearSharePointCache = () => {
  try {
    localStorage.removeItem(CACHE_KEYS.SHAREPOINT_ROOT_ITEMS);
    localStorage.removeItem(CACHE_KEYS.SHAREPOINT_DRIVE_ID);
  } catch {
    // Ignore storage errors
  }
};

// Get initial browser state with cached data
const getInitialBrowserState = (): BrowserState => {
  const cachedItems = getCachedRootItems();
  const cachedDriveId = getCachedDriveId();

  return {
    items: cachedItems,
    currentPath: [],
    driveId: cachedDriveId,
    loading: cachedItems.length === 0, // Don't show loading if we have cached items
    error: null,
    searchQuery: "",
    isSearching: false,
    fileDetailLoading: null,
  };
};

// Custom hook for authentication
const useSharePointAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: null,
    accessToken: null,
  });
  const [searchParams, setSearchParams] = useSearchParams();

  const checkAuth = useCallback(async () => {
    try {
      const redirectUri = encodeURIComponent(window.location.href);
      const userToken = await api.auth.getUploadToken(redirectUri);

      if (userToken.accessToken) {
        setAuthState({
          isAuthenticated: true,
          accessToken: userToken.accessToken,
        });
      } else {
        setAuthState({
          isAuthenticated: false,
          accessToken: null,
        });
      }
    } catch (err) {
      console.error("Error checking authentication:", err);
      setAuthState({
        isAuthenticated: false,
        accessToken: null,
      });
    }
  }, []);

  // Handle OAuth redirect
  useEffect(() => {
    const oauthSuccess = searchParams.get("oauth_success");
    const authSource = searchParams.get("auth_source");

    if (oauthSuccess === "true" && authSource === "sharepoint_browser") {
      setAuthState((prev) => ({ ...prev, isAuthenticated: true }));
      setSearchParams({});
      checkAuth();
    }
  }, [searchParams, setSearchParams, checkAuth]);

  const authenticate = async () => {
    const redirectUri = encodeURIComponent(window.location.href);
    const authUrl = await api.auth.getMicrosoftFilesInit(
      redirectUri,
      "sharepoint_browser"
    );
    window.location.href = authUrl.url;
  };

  return {
    ...authState,
    checkAuth,
    authenticate,
  };
};

// Custom hook for file browser logic
const useSharePointBrowser = (accessToken: string | null) => {
  const [state, setState] = useState<BrowserState>(getInitialBrowserState);

  const updateState = useCallback((updates: Partial<BrowserState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const loadFolderContent = useCallback(
    async (
      driveId: string,
      folderPath: string,
      showLoading: boolean = true
    ) => {
      if (!accessToken || !driveId) return;

      if (showLoading) {
        updateState({ loading: true, error: null });
      } else {
        updateState({ error: null });
      }

      try {
        const content = await microsoftGraphApi.getFolderContent(
          driveId,
          folderPath,
          accessToken
        );

        const transformedItems: SharePointItem[] = content.map((item) => ({
          ...item,
          folder: !!item.folder,
          file: !!item.file,
          driveId,
        }));

        // Cache root items if this is the root folder
        if (folderPath === "") {
          setCachedRootItems(transformedItems);
          setCachedDriveId(driveId);
        }

        updateState({ items: transformedItems, loading: false });
      } catch (err) {
        updateState({
          error: "Failed to load folder content. Please try again.",
          loading: false,
        });
      }
    },
    [accessToken, updateState]
  );

  const searchFiles = useCallback(
    async (query: string) => {
      if (!accessToken || !state.driveId || !query.trim()) {
        if (state.driveId && !query) {
          // Clear search - reload current folder
          const folderPath = state.currentPath.join("/");
          await loadFolderContent(state.driveId, folderPath, true);
        }
        return;
      }

      updateState({ isSearching: true, loading: true, error: null });

      try {
        const searchResults = await microsoftGraphApi.searchFiles(
          state.driveId,
          query,
          accessToken
        );

        const transformedItems: SharePointItem[] = searchResults.map(
          (item) => ({
            ...item,
            folder: !!item.folder,
            file: !!item.file,
            driveId: item.parentReference?.driveId || state.driveId,
          })
        );

        updateState({ items: transformedItems, loading: false });
      } catch (err) {
        updateState({
          error: "Failed to search files. Please try again.",
          loading: false,
        });
      }
    },
    [
      accessToken,
      state.driveId,
      state.currentPath,
      loadFolderContent,
      updateState,
    ]
  );

  const loadInitialDrive = useCallback(async () => {
    if (!accessToken) return;

    // If we have cached items but still need to refresh, don't show loading
    const hasCachedItems = state.items.length > 0;
    if (!hasCachedItems) {
      updateState({ loading: true, error: null });
    }

    try {
      const driveData = await microsoftGraphApi.getOrgDrive(accessToken);

      if (driveData?.id) {
        // Update drive ID in state and cache
        updateState({ driveId: driveData.id, currentPath: [] });
        setCachedDriveId(driveData.id);

        // Load root folder content - don't show loading if we have cached items
        await loadFolderContent(driveData.id, "", !hasCachedItems);
      } else {
        // Clear cache if we can't get drive data
        clearSharePointCache();
        updateState({
          error: "Failed to load your SharePoint drive. Please try again.",
          loading: false,
          items: [],
          driveId: undefined,
        });
      }
    } catch (err) {
      // Clear cache on error
      clearSharePointCache();
      updateState({
        error: "An error occurred while loading SharePoint content.",
        loading: false,
        items: [],
        driveId: undefined,
      });
    }
  }, [accessToken, state.items.length, loadFolderContent, updateState]);

  return {
    ...state,
    updateState,
    loadFolderContent,
    searchFiles,
    loadInitialDrive,
  };
};

// Utility functions
const extractPathFromSearchResult = (
  folder: SharePointItem
): { path: string[]; driveId: string } | null => {
  if (folder.parentReference?.path && folder.parentReference?.driveId) {
    const driveId = folder.parentReference.driveId;
    const parentFullPath = folder.parentReference.path;
    const driveRootPrefix = `/drives/${driveId}/root:`;

    let relativeParentPath = "";
    if (parentFullPath.startsWith(driveRootPrefix)) {
      relativeParentPath = parentFullPath.substring(driveRootPrefix.length);
    } else if (parentFullPath === `/drives/${driveId}/root`) {
      relativeParentPath = "";
    } else {
      return null;
    }

    if (relativeParentPath.startsWith("/")) {
      relativeParentPath = relativeParentPath.substring(1);
    }

    const parentSegments = relativeParentPath
      ? relativeParentPath.split("/").filter(Boolean)
      : [];

    return {
      path: [...parentSegments, folder.name],
      driveId,
    };
  }

  // Fallback: try to extract from webUrl
  if (folder.webUrl && folder.driveId) {
    try {
      const url = new URL(folder.webUrl);
      const pathParts = url.pathname.split("/");
      const docsIndex = pathParts.findIndex(
        (part) =>
          part.toLowerCase().includes("documents") ||
          part.toLowerCase().includes("document%20library")
      );

      if (docsIndex !== -1 && docsIndex < pathParts.length - 1) {
        const pathSegments = pathParts
          .slice(docsIndex + 1)
          .map((segment) => decodeURIComponent(segment))
          .filter(Boolean);

        return {
          path: pathSegments,
          driveId: folder.driveId,
        };
      }
    } catch (err) {
      // Ignore URL parsing errors
    }
  }

  return null;
};

// Sub-components
const AuthPrompt: React.FC<{
  onAuthenticate: () => void;
  onNavigateToIntegrations: () => void;
}> = ({ onAuthenticate, onNavigateToIntegrations }) => (
  <div className="p-4 space-y-3 bg-card rounded-md">
    <div className="flex items-center gap-2 mb-2">
      <img src={sharepointLogo} alt="SharePoint" width={20} height={20} />
      <h3 className="font-medium">Connect SharePoint</h3>
    </div>
    <p className="text-sm text-muted-foreground">
      You need to connect your SharePoint account to browse and select files.
    </p>
    <div className="space-y-2">
      <Button className="w-full" onClick={onAuthenticate}>
        Connect SharePoint
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={onNavigateToIntegrations}
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Go to Integrations
      </Button>
    </div>
  </div>
);

const FileBrowserHeader: React.FC<{
  currentPath: string[];
  isSearching: boolean;
  searchQuery: string;
  onNavigateBack: () => void;
}> = ({ currentPath, isSearching, searchQuery, onNavigateBack }) => {
  const getCurrentPathDisplay = () => {
    if (currentPath.length === 0) return "SharePoint Files";
    return currentPath.join(" / ");
  };

  return (
    <div className="flex items-center border-b px-3 h-10">
      {currentPath.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 mr-2"
          onClick={onNavigateBack}
          disabled={isSearching}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      <span className="text-sm font-medium truncate flex-1">
        {isSearching && searchQuery
          ? `Search results for "${searchQuery}"`
          : getCurrentPathDisplay()}
      </span>
    </div>
  );
};

const FileList: React.FC<{
  items: SharePointItem[];
  loading: boolean;
  error: string | null;
  isSearching: boolean;
  searchQuery: string;
  fileDetailLoading: string | null;
  onItemSelect: (item: SharePointItem) => void;
  initialLoadAttempted: boolean;
}> = ({
  items,
  loading,
  error,
  isSearching,
  searchQuery,
  fileDetailLoading,
  onItemSelect,
  initialLoadAttempted,
}) => {
  if (!initialLoadAttempted || loading) {
    return (
      <div className="space-y-1 py-1 px-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[28px] w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <CommandEmpty>{error}</CommandEmpty>;
  }

  if (items.length === 0) {
    return (
      <CommandEmpty>
        {isSearching
          ? `No results found for "${searchQuery}"`
          : "No files or folders found"}
      </CommandEmpty>
    );
  }

  return (
    <CommandGroup heading={isSearching ? "Search Results" : undefined}>
      {items.map((item) => (
        <CommandItem
          key={item.id}
          value={item.name}
          onSelect={() => onItemSelect(item)}
          className="flex items-center gap-2 cursor-pointer"
          disabled={fileDetailLoading === item.id}
        >
          {fileDetailLoading === item.id ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : item.folder ? (
            <FolderOpen className="h-4 w-4 text-blue-400 fill-blue-400 border-blue-400" />
          ) : (
            <File className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="truncate">{item.name}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
};

// Main component
export function SharePointFileBrowser({
  onFileSelect,
  onFolderSelect,
  isDownloading = false,
  displayMode = "popover",
}: SharePointFileBrowserProps) {
  const [, setOpen] = useState(displayMode === "inline" ? true : false);
  const [initialLoadAttempted, setInitialLoadAttempted] = useState(false);
  const navigate = useNavigate();

  const { isAuthenticated, accessToken, checkAuth, authenticate } =
    useSharePointAuth();

  const {
    items,
    currentPath,
    driveId,
    loading,
    error,
    searchQuery,
    isSearching,
    fileDetailLoading,
    updateState,
    loadFolderContent,
    searchFiles,
    loadInitialDrive,
  } = useSharePointBrowser(accessToken);

  // Check auth when component mounts
  useEffect(() => {
    if (isAuthenticated === null || isAuthenticated === false) {
      checkAuth();
    }
  }, [isAuthenticated, checkAuth]);

  // Load initial data
  useEffect(() => {
    if (isAuthenticated && accessToken && !initialLoadAttempted) {
      setInitialLoadAttempted(true);
      // Always load initial drive to refresh data in background
      // loadInitialDrive will handle showing cached items immediately if available
      loadInitialDrive();
    }
  }, [isAuthenticated, accessToken, initialLoadAttempted, loadInitialDrive]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        if (!isSearching) {
          updateState({ isSearching: true });
        }
        if (driveId) {
          searchFiles(searchQuery);
        }
      } else if (isSearching) {
        updateState({ isSearching: false });
        if (driveId) {
          const folderPath = currentPath.join("/");
          loadFolderContent(driveId, folderPath, true);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    searchQuery,
    driveId,
    isSearching,
    currentPath,
    updateState,
    searchFiles,
    loadFolderContent,
  ]);

  // Effect to clear item-specific loading when parent signals download is complete
  useEffect(() => {
    if (!isDownloading && fileDetailLoading) {
      updateState({ fileDetailLoading: null });
    }
  }, [isDownloading, fileDetailLoading, updateState]);

  const navigateToFolder = useCallback(
    async (folder: SharePointItem) => {
      if (!accessToken) return;

      let newPath: string[] = [];
      let targetDriveId = driveId;

      if (isSearching) {
        const extractedPath = extractPathFromSearchResult(folder);
        if (extractedPath) {
          newPath = extractedPath.path;
          targetDriveId = extractedPath.driveId;

          if (driveId !== targetDriveId) {
            updateState({ driveId: targetDriveId });
          }
        } else {
          updateState({
            error: "Cannot navigate to this folder from search results.",
          });
          return;
        }
      } else {
        newPath = [...currentPath, folder.name];
      }

      updateState({
        currentPath: newPath,
        searchQuery: "",
        isSearching: false,
      });

      if (targetDriveId) {
        await loadFolderContent(targetDriveId, newPath.join("/"), true);
      }

      if (onFolderSelect) {
        onFolderSelect(folder);
      }
    },
    [
      accessToken,
      driveId,
      currentPath,
      isSearching,
      updateState,
      loadFolderContent,
      onFolderSelect,
    ]
  );

  const navigateBack = useCallback(async () => {
    if (!driveId || !accessToken || currentPath.length === 0) return;

    const newPath = currentPath.slice(0, -1);
    updateState({
      currentPath: newPath,
      searchQuery: "",
      isSearching: false,
    });

    await loadFolderContent(driveId, newPath.join("/"), true);
  }, [driveId, currentPath, accessToken, updateState, loadFolderContent]);

  const handleItemSelect = useCallback(
    async (item: SharePointItem) => {
      if (item.folder) {
        navigateToFolder(item);
      } else if (item.file && onFileSelect) {
        updateState({ fileDetailLoading: item.id });

        try {
          let fileToSelect = { ...item };

          if (
            !fileToSelect["@microsoft.graph.downloadUrl"] &&
            fileToSelect.driveId &&
            accessToken
          ) {
            const fileDetails = await microsoftGraphApi.getFile(
              fileToSelect.driveId,
              fileToSelect.id,
              accessToken
            );

            if (fileDetails?.["@microsoft.graph.downloadUrl"]) {
              fileToSelect["@microsoft.graph.downloadUrl"] =
                fileDetails["@microsoft.graph.downloadUrl"];
            } else {
              updateState({
                error: `No download URL available for ${fileToSelect.name}.`,
                fileDetailLoading: null,
              });
              return;
            }
          }

          if (fileToSelect["@microsoft.graph.downloadUrl"]) {
            onFileSelect(fileToSelect);
            if (displayMode === "popover") {
              setOpen(false);
            }
          }
        } catch (err) {
          updateState({
            error: "Error selecting file. Please try again.",
            fileDetailLoading: null,
          });
        }
      }
    },
    [
      accessToken,
      navigateToFolder,
      onFileSelect,
      updateState,
      setOpen,
      displayMode,
    ]
  );

  const handleGoToIntegrations = () => {
    setOpen(false);
    navigate("/integrations");
  };

  const browserContent = (
    <>
      {isAuthenticated === false ? (
        <AuthPrompt
          onAuthenticate={authenticate}
          onNavigateToIntegrations={handleGoToIntegrations}
        />
      ) : (
        <Command className="h-[400px] flex flex-col bg-card">
          <FileBrowserHeader
            currentPath={currentPath}
            isSearching={isSearching}
            searchQuery={searchQuery}
            onNavigateBack={navigateBack}
          />
          <CommandInput
            placeholder="Search files and folders..."
            className="h-9"
            value={searchQuery}
            onValueChange={(value) => updateState({ searchQuery: value })}
          />
          <CommandList className="flex-1 overflow-y-auto max-h-[320px]">
            <FileList
              items={items}
              loading={loading}
              error={error}
              isSearching={isSearching}
              searchQuery={searchQuery}
              fileDetailLoading={fileDetailLoading}
              onItemSelect={handleItemSelect}
              initialLoadAttempted={initialLoadAttempted}
            />
          </CommandList>
        </Command>
      )}
    </>
  );

  if (displayMode === "inline") {
    return (
      <div className="w-full h-full border rounded-md">{browserContent}</div>
    );
  }

  return browserContent;
}
