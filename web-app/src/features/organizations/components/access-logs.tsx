/** Hooks */
import useDebounce from "@/hooks/use-debounce";
import { useGetOrgAccessLogsQuery } from "../api";
import { useState, useCallback, useMemo } from "react";

/** UI Components */
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResourceIcon } from "@/features/permissions/components";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Building,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  RefreshCw,
} from "lucide-react";

/** Types */
import { User } from "@/types/user";
import { Permissions } from "@/features/permissions/types/permissions";
import {
  AccessLogStatus,
  OrganizationAccessLog,
  OrganizationAccessLogsResponse,
} from "@/features/organizations/types/access-logs";

/** Utils */
import { format } from "date-fns";
import Constants from "@/features/permissions/utils/user-permissions-constants";
import {
  actionsTranslations,
  resourcesTranslations,
} from "@/features/permissions/utils";
import {
  accessLogStatusTranslations,
  getActionColor,
  getStatusColor,
  resourceNameToLabel,
} from "../utils";

const isOrganizationAccessLog = (
  log: OrganizationAccessLog
): log is OrganizationAccessLog => {
  return "organization" in log;
};

export default function AccessLogs({
  organizationId,
  resources,
  actions,
  status,
  user,
  type,
}: {
  organizationId: string;
  resources: [string, Permissions.Resources][];
  actions: [string, Permissions.Actions][];
  status: [string, AccessLogStatus][];
  user: User;
  type: "organization";
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    resource: "all",
    action: "all",
    status: "all",
  });
  const [isFiltering, setIsFiltering] = useState(false);

  const debouncedSearch = useDebounce(search, 500);

  const {
    data: organizationLogs,
    isLoading: isOrganizationLogsLoading,
    refetch: refetchOrganizationLogs,
  } = useGetOrgAccessLogsQuery(
    organizationId,
    currentPage,
    10,
    {
      ...filters,
      search: debouncedSearch,
    },
    type !== "organization"
  );

  const refetch = useCallback(() => {
    if (type === "organization") {
      refetchOrganizationLogs();
    }
  }, [refetchOrganizationLogs, type]);

  const data: OrganizationAccessLogsResponse | undefined = useMemo(() => {
    if (type === "organization") {
      return organizationLogs;
    }
  }, [organizationLogs, type]);

  const isLoading = useMemo(() => {
    if (type === "organization") {
      return isOrganizationLogsLoading;
    }
  }, [isOrganizationLogsLoading, type]);

  const handleRefresh = useCallback(() => {
    refetch();
    setCurrentPage(1);
  }, [refetch]);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setIsFiltering(true);
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
    setTimeout(() => setIsFiltering(false), 300);
  }, []);

  const filteredLogs: OrganizationAccessLog[] = useMemo(
    () => data?.data || [],
    [data]
  );
  const totalLogs = useMemo(() => data?.pagination.total || 0, [data]);
  const totalPages = useMemo(() => data?.pagination.pages || 1, [data]);

  return (
    <section className="container mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Access Logs History</CardTitle>
              <CardDescription>
                Monitor and analyze system access patterns
              </CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search by user, organization, project..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select
                value={filters.resource}
                onValueChange={(value) => handleFilterChange("resource", value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue>
                    {filters.resource !== "all" && (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0">
                          <ResourceIcon
                            resource={filters.resource as Permissions.Resources}
                          />
                        </span>
                        <span className="truncate">
                          {resourcesTranslations[filters.resource]}
                        </span>
                      </div>
                    )}
                    {filters.resource === "all" && "All Resources"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  {type === "organization" && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Organization</SelectLabel>
                        {resources
                          .filter(([_, value]) =>
                            Constants.OrganizationResources.includes(value)
                          )
                          .map(([key, value]) => (
                            <SelectItem key={key} value={value}>
                              <div className="flex items-center gap-2">
                                <ResourceIcon
                                  resource={value as Permissions.Resources}
                                />
                                {resourcesTranslations[value]}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>

              <Select
                value={filters.action}
                onValueChange={(value) => handleFilterChange("action", value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actions.map(([key, value]) => (
                    <SelectItem key={key} value={value}>
                      <Badge
                        variant="outline"
                        className={getActionColor(value)}
                      >
                        {actionsTranslations[value]}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {status.map(([key, value]) => (
                    <SelectItem key={key} value={value}>
                      <Badge
                        variant="outline"
                        className={getStatusColor(value)}
                      >
                        {accessLogStatusTranslations[value]}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Logs Table */}
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="transition-all duration-300 min-h-[400px]">
                {isLoading || isFiltering ? (
                  <AccessLogsSkeleton />
                ) : filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="transition-all duration-300"
                    >
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 rounded-full">
                            <AvatarImage
                              src={log.user?.profilePicture}
                              alt={log.user.name}
                            />
                            <AvatarFallback className="rounded-full">
                              {log.user.name
                                ?.split(" ")
                                .map((n: string) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="font-medium flex items-center gap-1">
                              {log.user.name}
                              {user && log.user.email === user.email && (
                                <Badge variant="outline" className="text-xs">
                                  Me
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {log.user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="bg-primary/10 rounded-full p-1"
                          >
                            <ResourceIcon
                              resource={
                                log.resource.name as Permissions.Resources
                              }
                            />
                          </Badge>
                          <span>{resourceNameToLabel(log.resource.name)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getActionColor(log.action.name)}
                        >
                          {actionsTranslations[log.action.name]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.status === AccessLogStatus.AUTHORIZED ? (
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Authorized
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Unauthorized
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {isOrganizationAccessLog(log) &&
                            log.organization?.name && (
                              <div className="flex items-center gap-1">
                                <Building className="h-3 w-3 text-muted-foreground" />
                                <span>{log.organization.name}</span>
                              </div>
                            )}
                          {log.document?.name && (
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span>{log.document.name}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-[600px] text-center">
                      <div className="flex items-start justify-center h-full text-muted-foreground">
                        No results found.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalLogs > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * 10 + 1} to{" "}
                {Math.min(currentPage * 10, totalLogs)} of {totalLogs} entries
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

const AccessLogsSkeleton = () => {
  return (
    <>
      {Array.from({ length: 10 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-10 w-24" />
          </TableCell>
          <TableCell>
            <div className="flex items-center space-x-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20" />
          </TableCell>
          <TableCell>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
};
