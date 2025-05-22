import { Input } from "@/components/ui/input";
import useDebounce from "@/hooks/use-debounce";
import { Search, X } from "lucide-react";
import { useSearchParams, useNavigate, useLocation } from "react-router";
import { useCallback, useEffect, useState } from "react";

interface SearchBarProps {
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  searchParamKey?: string;
  onClose?: () => void;
  initialSearch?: string;
}

export default function SearchBar({
  placeholder = "Search...",
  debounceMs = 300,
  className = "mb-6",
  searchParamKey = "search",
  initialSearch,
  onClose,
}: SearchBarProps) {
  const searchParams = useSearchParams();
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState(() => {
    return initialSearch || searchParams[0].get(searchParamKey) || "";
  });
  const debouncedSearchTerm = useDebounce(searchTerm, debounceMs);

  const handleSearch = useCallback(
    (term: string) => {
      const params = new URLSearchParams(searchParams[0]);
      if (term) {
        params.set(searchParamKey, term);
      } else {
        params.delete(searchParamKey);
      }
      navigate(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, navigate, searchParamKey]
  );

  const handleClear = useCallback(() => {
    setSearchTerm("");
  }, []);

  // Update URL params when debounced search term changes
  useEffect(() => {
    const currentSearchParam = searchParams[0].get(searchParamKey) || "";
    if (debouncedSearchTerm !== currentSearchParam) {
      handleSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, handleSearch, searchParams, searchParamKey]);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2 border-none bg-accent"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onBlur={() => onClose && onClose()}
        autoFocus
      />
      {searchTerm && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
