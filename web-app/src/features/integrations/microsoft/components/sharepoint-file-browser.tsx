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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [fileDetailLoading, setFileDetailLoading] = useState<string | null>(
    null
  );
  const [initialLoadAttempted, setInitialLoadAttempted] = useState(false);

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
      // If opening and not authenticated, try to check/get auth
      if (isAuthenticated === null || isAuthenticated === false) {
        checkAuth();
      }
      // If already authenticated, but no driveId, it might be the first load after auth
      // The initial content loading effect below will handle this.
    } else {
      // Reset states when popover is closed for a clean start next time
      // setAccessToken(null); // Keep token if already fetched, checkAuth will re-validate if needed
      // setIsAuthenticated(null); // Keep auth status unless explicitly logged out
      setItems([]);
      setCurrentPath([]);
      setDriveId(null);
      setError(null);
      setSearchQuery("");
      setIsSearching(false);
      setFileDetailLoading(null);
      setInitialLoadAttempted(false); // Reset for next open
      setLoading(false); // Ensure loading is reset
    }
  }, [open, checkAuth, isAuthenticated]);

  // `loadFolderContent` needs to be defined before the useEffect that uses it.
  const loadFolderContent = useCallback(
    async (currentDriveId: string, folderPath: string) => {
      if (!accessToken || !currentDriveId) {
        console.warn(
          "loadFolderContent: Aborted, no accessToken or currentDriveId"
        );
        return;
      }

      setLoading(true);
      setError(null);
      console.log(
        `loadFolderContent: For drive: ${currentDriveId}, path: '${
          folderPath || "root"
        }'`
      );

      try {
        const content = await microsoftGraphApi.getFolderContent(
          currentDriveId,
          folderPath,
          accessToken
        );

        const transformedItems: SharePointItem[] = content.map((item: any) => ({
          id: item.id,
          name: item.name,
          folder: !!item.folder,
          file: !!item.file,
          webUrl: item.webUrl,
          parentReference: item.parentReference,
          "@microsoft.graph.downloadUrl": item["@microsoft.graph.downloadUrl"],
          size: item.size,
          driveId: currentDriveId,
        }));

        setItems(transformedItems);

        if (!folderPath) {
          // Loading root folder
          setCurrentPath((prevPath) => {
            if (prevPath.length === 0) {
              console.log(
                "loadFolderContent: currentPath is already root. No change."
              );
              return prevPath; // Already root, no change to currentPath itself
            }
            console.log("loadFolderContent: Setting currentPath to root []");
            return []; // Navigating to root
          });
        }
        // If folderPath is not empty, currentPath is assumed to be set correctly
        // by the calling function (navigateToFolder, navigateBack).
      } catch (err) {
        console.error("loadFolderContent: Error loading folder content:", err);
        setError("Failed to load folder content. Please try again.");
      } finally {
        setLoading(false);
        console.log("loadFolderContent: Set loading to false.");
      }
    },
    [accessToken]
  );

  // Load drive and initial root content when authenticated and popover opens
  useEffect(() => {
    const loadInitialData = async () => {
      if (
        !open ||
        !accessToken ||
        driveId || // If driveId is already set, initial load was successful
        initialLoadAttempted ||
        loading // Prevent concurrent loads
      ) {
        return;
      }

      console.log("Initial Load: Triggered");
      setLoading(true);
      setInitialLoadAttempted(true); // Mark that an attempt is being made
      setError(null);
      setSearchQuery("");
      setIsSearching(false);

      try {
        console.log("Initial Load: Fetching org drive...");
        const driveData = await microsoftGraphApi.getOrgDrive(accessToken);

        if (driveData && driveData.id) {
          console.log("Initial Load: Org drive fetched:", driveData.id);
          setDriveId(driveData.id);
          await loadFolderContent(driveData.id, ""); // This sets its own loading states
        } else {
          console.error("Initial Load: Failed to get drive data or drive ID.");
          setError("Failed to load your SharePoint drive. Please try again.");
          setInitialLoadAttempted(false); // Reset to allow retry if popover is closed and reopened
        }
      } catch (err) {
        console.error(
          "Initial Load: Error loading initial SharePoint content:",
          err
        );
        setError(
          "An error occurred while loading SharePoint content. Check connection or try again."
        );
        setInitialLoadAttempted(false); // Reset to allow retry
      } finally {
        // setLoading(false) is tricky here because loadFolderContent also sets it.
        // If getOrgDrive fails, loadFolderContent might not run.
        // If loadFolderContent runs, it sets loading false.
        // Ensure loading is false if this path completes without loadFolderContent setting it.
        if (loading && !driveId) {
          // If still loading and driveId wasn't set (e.g. error before loadFolderContent)
          setLoading(false);
        }
        // If loadFolderContent was called, it would have set setLoading(false).
        // If driveId was set, loadFolderContent was called.
      }
    };

    if (isAuthenticated && open) {
      // Only attempt if authenticated and popover is open
      loadInitialData();
    }
  }, [
    open,
    accessToken,
    driveId, // If driveId changes (e.g. reset to null), this effect could re-evaluate
    initialLoadAttempted,
    isAuthenticated,
    loadFolderContent, // loadFolderContent is a dependency
    loading, // Added loading as a guard
  ]);

  const searchFilesAndFolders = useCallback(
    async (query: string) => {
      if (!accessToken || !driveId || !query) {
        // If query is empty, load current folder content
        if (driveId) {
          const folderPath = currentPath.join("/");
          await loadFolderContent(driveId, folderPath);
        }
        return;
      }

      setIsSearching(true);
      setLoading(true);
      setError(null);

      try {
        const searchResults = await microsoftGraphApi.searchFiles(
          driveId,
          query,
          accessToken
        );
        const transformedItems: SharePointItem[] = searchResults.map(
          (item: any) => ({
            id: item.id,
            name: item.name,
            folder: !!item.folder,
            file: !!item.file,
            webUrl: item.webUrl,
            parentReference: item.parentReference,
            "@microsoft.graph.downloadUrl":
              item["@microsoft.graph.downloadUrl"],
            size: item.size,
            driveId: item.parentReference?.driveId || driveId, // Ensure driveId is present
          })
        );
        setItems(transformedItems);
        console.log("searchFilesAndFolders: Search results:", transformedItems);
      } catch (err) {
        console.error("Error searching files:", err);
        setError("Failed to search for files and folders.");
      } finally {
        setLoading(false);
        // setIsSearching(false); // Do not set isSearching to false here, keep search context
      }
    },
    [accessToken, driveId, currentPath]
  );

  // Debounce search function
  useEffect(() => {
    const debouncedSearchHandler = setTimeout(() => {
      if (searchQuery) {
        if (!isSearching) {
          console.log("useEffectSearch: Entering search mode.");
          setIsSearching(true);
        }
        // Ensure component driveId is set before searching on it
        if (driveId) {
          console.log(
            `useEffectSearch: Searching for '${searchQuery}' on drive ${driveId}`
          );
          searchFilesAndFolders(searchQuery); // searchFilesAndFolders uses component's driveId from its closure
        } else {
          console.warn(
            "useEffectSearch: No component driveId available to search on yet."
          );
          // Optionally, setError or wait for driveId to be set if this is an issue.
        }
      } else {
        // searchQuery is empty
        if (isSearching) {
          // Search was active, and query just got cleared (e.g., user deleted all text)
          console.log(
            "useEffectSearch: Search query cleared while isSearching was true. Exiting search mode."
          );
          setIsSearching(false);
          // Reload the current folder view based on currentPath and component's driveId
          if (driveId && open && initialLoadAttempted) {
            const folderPath = currentPath.join("/");
            console.log(
              `useEffectSearch: Reloading folder '${folderPath}' on drive ${driveId} after search clear.`
            );
            loadFolderContent(driveId, folderPath);
          } else {
            console.log(
              "useEffectSearch: Conditions not met to reload folder after search clear (driveId, open, or initialLoad)."
            );
          }
        }
        // If searchQuery is empty and isSearching is already false, do nothing here.
        // We are in normal browse mode; content is loaded by navigation actions.
      }
    }, 500);

    return () => clearTimeout(debouncedSearchHandler);
  }, [
    searchQuery,
    driveId, // Component's current driveId state
    isSearching,
    currentPath, // For reloading current folder view
    open,
    initialLoadAttempted,
    searchFilesAndFolders, // useCallback dep
    loadFolderContent, // useCallback dep
    setIsSearching, // From useState, stable
  ]);

  const navigateToFolder = useCallback(
    async (folder: SharePointItem) => {
      if (!accessToken) return;

      let newPathArray: string[];
      let pathForApi: string = "";
      let determinedDriveId: string | null = null;

      if (
        isSearching &&
        folder.parentReference &&
        folder.parentReference.path &&
        folder.parentReference.driveId
      ) {
        console.log(
          "navigateToFolder (Search):",
          folder.name,
          "ParentRef:",
          folder.parentReference
        );
        determinedDriveId = folder.parentReference.driveId;

        const parentFullPath = folder.parentReference.path;
        console.log(
          "navigateToFolder (Search): parentFullPath:",
          parentFullPath
        );

        const driveRootPrefix = `/drives/${determinedDriveId}/root:`;
        let relativeParentPath = "";

        if (parentFullPath.startsWith(driveRootPrefix)) {
          relativeParentPath = parentFullPath.substring(driveRootPrefix.length);
          console.log(
            "navigateToFolder (Search): Extracted relativeParentPath:",
            relativeParentPath
          );
        } else if (parentFullPath === `/drives/${determinedDriveId}/root`) {
          relativeParentPath = ""; // Parent is the root of this drive
          console.log("navigateToFolder (Search): Parent is root");
        } else {
          console.warn(
            "navigateToFolder (Search): Unrecognized parentReference.path format:",
            parentFullPath
          );
          setError("Cannot determine folder path from search result.");
          return;
        }

        if (relativeParentPath.startsWith("/")) {
          relativeParentPath = relativeParentPath.substring(1);
          console.log(
            "navigateToFolder (Search): Trimmed leading slash, relativeParentPath:",
            relativeParentPath
          );
        }
        const parentSegments = relativeParentPath
          ? relativeParentPath.split("/").filter(Boolean)
          : [];
        console.log(
          "navigateToFolder (Search): Parent segments:",
          parentSegments
        );

        const folderNameStr =
          typeof folder.name === "string" ? folder.name : "";
        if (!folderNameStr) {
          console.error("navigateToFolder (Search): Folder name is invalid.");
          setError("Cannot navigate: Invalid folder name from search.");
          return;
        }
        newPathArray = [...parentSegments, folderNameStr];
        pathForApi = newPathArray.join("/");
        console.log(
          "navigateToFolder (Search): Final constructed path:",
          pathForApi
        );
        console.log(
          "navigateToFolder (Search): Path array for breadcrumbs:",
          newPathArray
        );

        // Update component's main driveId if navigating to a different drive
        if (driveId !== determinedDriveId) {
          console.log(
            `navigateToFolder (Search): Drive context changing from ${driveId} to ${determinedDriveId}`
          );
          setDriveId(determinedDriveId);
        }
        setCurrentPath(newPathArray);
      } else if (isSearching && folder.webUrl) {
        // Fallback: Try to extract path from webUrl for search results
        console.log(
          "navigateToFolder (Search Fallback): Using webUrl:",
          folder.webUrl
        );

        // First, ensure we have the right driveId
        determinedDriveId = folder.driveId || driveId;
        if (!determinedDriveId) {
          console.error(
            "navigateToFolder (Search Fallback): No driveId available"
          );
          setError("Cannot navigate: Drive information missing.");
          return;
        }

        // Try to extract the path from the webUrl
        // Example URL: https://company.sharepoint.com/sites/SiteName/Shared%20Documents/ace%20iot/tagging-tool
        try {
          const url = new URL(folder.webUrl);
          const pathParts = url.pathname.split("/");

          // Find "Shared Documents" or similar document library indicator
          const docsIndex = pathParts.findIndex(
            (part) =>
              part.toLowerCase().includes("documents") ||
              part.toLowerCase().includes("document%20library")
          );

          if (docsIndex !== -1 && docsIndex < pathParts.length - 1) {
            // Get path segments after the document library
            const pathSegments = pathParts
              .slice(docsIndex + 1)
              .map((segment) => decodeURIComponent(segment))
              .filter(Boolean);

            console.log(
              "navigateToFolder (Search Fallback): Extracted path segments from URL:",
              pathSegments
            );

            newPathArray = pathSegments;
            pathForApi = pathSegments.join("/");

            if (driveId !== determinedDriveId) {
              setDriveId(determinedDriveId);
            }
            setCurrentPath(newPathArray);
          } else {
            console.warn(
              "navigateToFolder (Search Fallback): Could not extract path from webUrl"
            );
            // Fall through to standard navigation
            determinedDriveId = null; // Reset to trigger standard navigation
          }
        } catch (err) {
          console.error(
            "navigateToFolder (Search Fallback): Error parsing webUrl:",
            err
          );
          // Fall through to standard navigation
          determinedDriveId = null; // Reset to trigger standard navigation
        }
      }

      // Only do standard navigation if we haven't determined a path from search
      if (!determinedDriveId) {
        // Standard navigation (browsing, not from search)
        if (!driveId) {
          console.error(
            "navigateToFolder (Standard): Component driveId is null."
          );
          setError("Cannot navigate, main drive information missing.");
          return;
        }
        determinedDriveId = driveId; // Use component's current main driveId
        const folderNameStr =
          typeof folder.name === "string" ? folder.name : "";
        if (!folderNameStr) {
          console.error("navigateToFolder (Standard): Folder name is invalid.");
          setError("Cannot navigate: Invalid folder name.");
          return;
        }
        newPathArray = [...currentPath, folderNameStr];
        pathForApi = newPathArray.join("/");
        setCurrentPath(newPathArray);
        console.log(
          "navigateToFolder (Standard): Path:",
          pathForApi,
          "on drive:",
          determinedDriveId
        );
      }

      // Exit search mode
      setSearchQuery("");
      setIsSearching(false);

      if (!determinedDriveId) {
        console.error(
          "navigateToFolder: determinedDriveId is null before API call."
        );
        setError("Cannot load folder: Critical drive ID missing.");
        return;
      }
      // pathForApi can be "" for root, which is valid for loadFolderContent.
      console.log(
        `navigateToFolder: Calling loadFolderContent with driveId: ${determinedDriveId}, path: '${pathForApi}'`
      );
      await loadFolderContent(determinedDriveId, pathForApi);

      if (onFolderSelect) {
        onFolderSelect(folder);
      }
    },
    [
      driveId, // Component's current main driveId state
      currentPath,
      accessToken,
      isSearching,
      loadFolderContent,
      onFolderSelect,
      setDriveId, // From useState, stable
      setCurrentPath, // From useState, stable
      setSearchQuery, // From useState, stable
      setIsSearching, // From useState, stable
    ]
  );

  const navigateBack = useCallback(async () => {
    if (!driveId || !accessToken || currentPath.length === 0) return;

    const newPath = currentPath.slice(0, -1);
    setCurrentPath(newPath);
    setSearchQuery(""); // Clear search when navigating back
    setIsSearching(false);
    // setLoading(true); // loadFolderContent will handle its own loading state

    const folderPath = newPath.join("/");
    await loadFolderContent(driveId, folderPath);
  }, [driveId, currentPath, accessToken, loadFolderContent]);

  const handleItemSelect = async (item: SharePointItem) => {
    console.log("handleItemSelect: item:", item);
    console.log("handleItemSelect: isSearching:", isSearching);
    console.log(
      "handleItemSelect: item.parentReference:",
      item.parentReference
    );

    if (item.folder) {
      navigateToFolder(item);
    } else if (item.file && onFileSelect) {
      setFileDetailLoading(item.id);
      try {
        let fileToSelect = { ...item };
        if (!fileToSelect["@microsoft.graph.downloadUrl"]) {
          if (fileToSelect.driveId && fileToSelect.id && accessToken) {
            console.log(
              `Fetching details for file ${fileToSelect.name} (ID: ${fileToSelect.id}) as download URL is missing.`
            );
            const fileDetails = await microsoftGraphApi.getFile(
              fileToSelect.driveId,
              fileToSelect.id,
              accessToken
            );
            if (fileDetails && fileDetails["@microsoft.graph.downloadUrl"]) {
              fileToSelect["@microsoft.graph.downloadUrl"] =
                fileDetails["@microsoft.graph.downloadUrl"];
            } else {
              console.error(
                "Could not retrieve download URL for the selected file after fetching details.",
                fileDetails
              );
              setError(
                `No download URL available for ${fileToSelect.name}. It might be an unsupported file type or have restricted access.`
              );
              setFileDetailLoading(null);
              // Do not close popover, allow user to see error
              return;
            }
          } else {
            console.error(
              "Cannot fetch file details: missing driveId, itemId, or accessToken."
            );
            setError("Cannot fetch file details for selection.");
            setFileDetailLoading(null);
            return; // Do not close popover
          }
        }

        if (fileToSelect["@microsoft.graph.downloadUrl"]) {
          onFileSelect(fileToSelect);
          setOpen(false);
          setSearchQuery(""); // Clear search on successful file selection
          setIsSearching(false);
        } else {
          // This case should ideally be caught by the checks above
          console.error(
            `File ${fileToSelect.name} still has no download URL before calling onFileSelect.`
          );
          setError(
            `Could not process file ${fileToSelect.name} for selection.`
          );
          // Do not close popover
        }
      } catch (err) {
        console.error("Error processing file selection:", err);
        setError("Error selecting file. Please try again.");
      } finally {
        setFileDetailLoading(null);
      }
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
                  disabled={isSearching} // Disable back button while searching
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
            <CommandInput
              placeholder="Search files and folders..."
              className="h-9"
              value={searchQuery}
              onValueChange={(value) => {
                setSearchQuery(value);
                // Don't immediately change isSearching here, let the debounced effect handle it
                // if (value) {
                //   setIsSearching(true); // Set searching mode when user types
                // } else {
                //   setIsSearching(false); // Clear searching mode if input is empty
                // }
              }}
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
                <CommandEmpty>
                  {isSearching
                    ? `No results found for "${searchQuery}"`
                    : "No files or folders found"}
                </CommandEmpty>
              ) : (
                <CommandGroup
                  heading={
                    isSearching && items.length > 0
                      ? "Search Results"
                      : undefined
                  }
                >
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      onSelect={() => handleItemSelect(item)}
                      className="flex items-center gap-2 cursor-pointer"
                      disabled={fileDetailLoading === item.id}
                    >
                      {fileDetailLoading === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : item.folder ? (
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
