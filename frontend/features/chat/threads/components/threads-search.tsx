"use client";

import { Input } from "@/components/ui/input";
import useDebounce from "@/hooks/use-debounce";
import { Search } from "lucide-react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const { replace } = useRouter();
  const [searchTerm, setSearchTerm] = useState(initialSearch || "");
  const debouncedSearchTerm = useDebounce(searchTerm, debounceMs);

  const handleSearch = useCallback(
    (term: string) => {
      const params = new URLSearchParams(searchParams);
      if (term) {
        params.set(searchParamKey, term);
      } else {
        params.delete(searchParamKey);
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, replace, searchParamKey]
  );

  useEffect(() => {
    handleSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, handleSearch]);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4" />
      <Input
        type="search"
        placeholder={placeholder}
        className="w-full pl-9 py-2 border-none bg-accent"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onBlur={() => onClose && onClose()}
        autoFocus
      />
    </div>
  );
}
