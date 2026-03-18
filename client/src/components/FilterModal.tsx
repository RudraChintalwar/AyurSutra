import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'patients' | 'sessions';
}

const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose, type }) => {
  const [filters, setFilters] = useState<{
    priority: string;
    dosha: string[];
    status: string;
    therapy: string;
    dateRange: string;
    priorityRange: number[];
  }>({
    priority: '',
    dosha: [],
    status: '',
    therapy: '',
    dateRange: '',
    priorityRange: [0, 100],
  });
  const { toast } = useToast();

  const handleDoshaChange = (dosha: string, checked: boolean | string) => {
    const isChecked = checked === true;
    setFilters(prev => ({
      ...prev,
      dosha: isChecked 
        ? [...prev.dosha, dosha]
        : prev.dosha.filter(d => d !== dosha)
    }));
  };

  const applyFilters = () => {
    const activeFilters = Object.entries(filters).filter(([key, value]) => {
      if (key === 'dosha') return (value as string[]).length > 0;
      if (key === 'priorityRange') return (value as number[])[0] > 0 || (value as number[])[1] < 100;
      return value !== '' && value !== null;
    });

    toast({
      title: "Filters Applied",
      description: `${activeFilters.length} filter(s) applied successfully`,
    });
    onClose();
  };

  const clearFilters = () => {
    setFilters({
      priority: '',
      dosha: [],
      status: '',
      therapy: '',
      dateRange: '',
      priorityRange: [0, 100],
    });
    toast({
      title: "Filters Cleared",
      description: "All filters have been reset",
    });
  };

  const doshaOptions = ['Vata', 'Pitta', 'Kapha'];
  const therapyOptions = [
    'Panchakarma Detox',
    'Abhyanga Massage',
    'Shirodhara',
    'Nasya',
    'Basti',
    'Virechana'
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <Filter className="w-5 h-5 text-primary" />
            <span>Filter {type === 'patients' ? 'Patients' : 'Sessions'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Priority Filter */}
          <div>
            <Label>Priority Level</Label>
            <Select value={filters.priority} onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High Priority (80+)</SelectItem>
                <SelectItem value="medium">Medium Priority (60-79)</SelectItem>
                <SelectItem value="low">Low Priority (0-59)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority Range Slider */}
          <div>
            <Label>Priority Score Range: {filters.priorityRange[0]} - {filters.priorityRange[1]}</Label>
            <Slider
              value={filters.priorityRange}
              onValueChange={(value) => setFilters(prev => ({ ...prev, priorityRange: value }))}
              max={100}
              min={0}
              step={10}
              className="mt-3"
            />
          </div>

          {/* Dosha Filter */}
          {type === 'patients' && (
            <div>
              <Label>Ayurvedic Constitution</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {doshaOptions.map((dosha) => (
                  <div key={dosha} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dosha-${dosha}`}
                      checked={filters.dosha.includes(dosha)}
                      onCheckedChange={(checked) => handleDoshaChange(dosha, checked)}
                    />
                    <Label htmlFor={`dosha-${dosha}`} className="text-sm">
                      {dosha}
                    </Label>
                  </div>
                ))}
              </div>
              {filters.dosha.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {filters.dosha.map((dosha) => (
                    <Badge key={dosha} className={`dosha-${dosha.toLowerCase()} text-xs`}>
                      {dosha}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status Filter */}
          <div>
            <Label>Status</Label>
            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {type === 'sessions' ? (
                  <>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="active">Active Treatment</SelectItem>
                    <SelectItem value="new">New Patient</SelectItem>
                    <SelectItem value="followup">Follow-up Required</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Therapy Filter */}
          {type === 'sessions' && (
            <div>
              <Label>Therapy Type</Label>
              <Select value={filters.therapy} onValueChange={(value) => setFilters(prev => ({ ...prev, therapy: value }))}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select therapy" />
                </SelectTrigger>
                <SelectContent>
                  {therapyOptions.map((therapy) => (
                    <SelectItem key={therapy} value={therapy}>
                      {therapy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date Range Filter */}
          <div>
            <Label>Date Range</Label>
            <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">Last 3 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button variant="outline" onClick={clearFilters}>
            <X className="w-4 h-4 mr-2" />
            Clear All
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={applyFilters} className="ayur-button-hero">
              <Filter className="w-4 h-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilterModal;