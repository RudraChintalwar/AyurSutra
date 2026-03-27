import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  X, 
  Calendar,
  Clock,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

interface SearchAndFilterProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: {
    status?: FilterOption[];
    therapy?: FilterOption[];
    priority?: FilterOption[];
    dateRange?: FilterOption[];
  };
  activeFilters?: Record<string, string>;
  onFilterChange?: (filterType: string, value: string) => void;
  onClearFilters?: () => void;
  className?: string;
  showQuickActions?: boolean;
}

const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  filters = {},
  activeFilters = {},
  onFilterChange,
  onClearFilters,
  className,
  showQuickActions = false
}) => {
  const { t } = useLanguage();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeFilterCount = Object.keys(activeFilters).filter(key => activeFilters[key]).length;

  const renderFilterSelect = (type: string, options: FilterOption[], placeholder: string, icon: React.ReactNode) => (
    <div className="space-y-2">
      <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
        {icon}
        <span>{placeholder}</span>
      </div>
      <Select
        value={activeFilters[type] || ""}
        onValueChange={(value) => onFilterChange?.(type, value)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`All ${placeholder}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All {placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center justify-between w-full">
                <span>{option.label}</span>
                {option.count !== undefined && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {option.count}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search and Filter Toggle Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-10 pr-4"
          />
        </div>

        {/* Filter Toggle Button */}
        <Button
          variant={isFilterOpen ? "default" : "outline"}
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="flex items-center space-x-2"
        >
          <Filter className="w-4 h-4" />
          <span>{t("filters.filters")}</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {/* Quick Actions */}
        {showQuickActions && (
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-1" />
              {t("common.today")}
            </Button>
            <Button variant="outline" size="sm">
              <Clock className="w-4 h-4 mr-1" />
              {t("common.recent")}
            </Button>
          </div>
        )}
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("filters.activeFilters")}</span>
          {Object.entries(activeFilters).map(([type, value]) => 
            value ? (
              <Badge 
                key={type} 
                variant="secondary" 
                className="flex items-center space-x-1"
              >
                <span className="capitalize">{type}: {value}</span>
                <button
                  onClick={() => onFilterChange?.(type, "")}
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ) : null
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-xs"
          >
            {t("filters.clearAll")}
          </Button>
        </div>
      )}

      {/* Filter Panel */}
      {isFilterOpen && (
        <div className="ayur-card p-4 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filters.status && renderFilterSelect(
              'status', 
              filters.status, 
              t("filters.status"), 
              <Clock className="w-4 h-4" />
            )}
            
            {filters.therapy && renderFilterSelect(
              'therapy', 
              filters.therapy, 
              t("filters.therapy"), 
              <User className="w-4 h-4" />
            )}
            
            {filters.priority && renderFilterSelect(
              'priority', 
              filters.priority, 
              t("filters.priority"), 
              <Filter className="w-4 h-4" />
            )}
            
            {filters.dateRange && renderFilterSelect(
              'dateRange', 
              filters.dateRange, 
              t("filters.dateRange"), 
              <Calendar className="w-4 h-4" />
            )}
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <Button
              variant="ghost"
              onClick={onClearFilters}
              disabled={activeFilterCount === 0}
            >
              {t("filters.clearFilters")}
            </Button>
            <Button
              onClick={() => setIsFilterOpen(false)}
              className="ayur-button-hero"
            >
              {t("filters.applyFilters")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchAndFilter;