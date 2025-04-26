"use client";
import { Button } from "@/components/ui/button";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { Clock, ArrowUp, ArrowDown, Calendar, FilterIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { SortOption } from "../types";

export default function ProjectsFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const [open, setOpen] = useState(false);

  const sort = (searchParams.get("sort") as SortOption) || "created-desc";

  const handleSortChange = (option: SortOption) => {
    const params = new URLSearchParams(searchParams);
    params.set("sort", option);
    replace(`${pathname}?${params.toString()}`);
  };

  const getActiveFilterLabel = () => {
    let label = null;

    switch (sort) {
      case "recent":
        label = "Recent";
        break;
      case "name-asc":
        label = "Name (A-Z)";
        break;
      case "name-desc":
        label = "Name (Z-A)";
        break;
      case "created-asc":
        label = "Date (Oldest)";
        break;
      case "created-desc":
        label = "Date (Newest)";
        break;
      default:
        label = null;
    }

    return label;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild className="flex items-center gap-2 w-34">
        <Button variant="outline">
          <FilterIcon className="h-4 w-4" />
          {getActiveFilterLabel()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="grid gap-2">
          <Button
            variant="ghost"
            className={cn("justify-between", sort === "recent" && "bg-muted")}
            onClick={() => {
              handleSortChange("recent");
              setOpen(false);
            }}
          >
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              <span>Recent</span>
            </div>
          </Button>

          <div className="flex flex-col">
            <Button
              variant="ghost"
              className={cn(
                "justify-between",
                (sort === "name-asc" || sort === "name-desc") && "bg-muted"
              )}
              onClick={() => {
                handleSortChange(
                  sort === "name-asc" ? "name-desc" : "name-asc"
                );
                setOpen(false);
              }}
            >
              <div className="flex items-center">
                <span className="mr-2 font-mono">AZ</span>
                <span>Name</span>
              </div>
              {sort === "name-asc" ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex flex-col">
            <Button
              variant="ghost"
              className={cn(
                "justify-between",
                (sort === "created-asc" || sort === "created-desc") &&
                  "bg-muted"
              )}
              onClick={() => {
                handleSortChange(
                  sort === "created-desc" ? "created-asc" : "created-desc"
                );
                setOpen(false);
              }}
            >
              <div className="flex items-center">
                <Calendar className="mr-2 h-4 w-4" />
                <span>Date</span>
              </div>
              {sort === "created-asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
