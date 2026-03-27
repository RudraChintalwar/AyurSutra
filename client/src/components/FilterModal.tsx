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
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();

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
      title: t("filters.applied"),
      description: t("filters.appliedCount", { count: activeFilters.length }),
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
      title: t("filters.cleared"),
      description: t("filters.resetAll"),
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
            <span>{type === 'patients' ? t("filters.filterPatients") : t("filters.filterSessions")}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Priority Filter */}
          <div>
            <Label>{t("filters.priorityLevel")}</Label>
            <Select value={filters.priority} onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={t("filters.selectPriority")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">{t("filters.highPriority")}</SelectItem>
                <SelectItem value="medium">{t("filters.mediumPriority")}</SelectItem>
                <SelectItem value="low">{t("filters.lowPriority")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority Range Slider */}
          <div>
            <Label>{t("filters.priorityScoreRange")}: {filters.priorityRange[0]} - {filters.priorityRange[1]}</Label>
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
              <Label>{t("filters.ayurvedicConstitution")}</Label>
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
            <Label>{t("filters.status")}</Label>
            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={t("filters.selectStatus")} />
              </SelectTrigger>
              <SelectContent>
                {type === 'sessions' ? (
                  <>
                    <SelectItem value="scheduled">{t("sessions.status.scheduled")}</SelectItem>
                    <SelectItem value="completed">{t("patient.completed")}</SelectItem>
                    <SelectItem value="cancelled">{t("common.cancelled")}</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="active">{t("filters.activeTreatment")}</SelectItem>
                    <SelectItem value="new">{t("filters.newPatient")}</SelectItem>
                    <SelectItem value="followup">{t("filters.followupRequired")}</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Therapy Filter */}
          {type === 'sessions' && (
            <div>
              <Label>{t("filters.therapyType")}</Label>
              <Select value={filters.therapy} onValueChange={(value) => setFilters(prev => ({ ...prev, therapy: value }))}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("filters.selectTherapy")} />
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
            <Label>{t("filters.dateRange")}</Label>
            <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={t("filters.selectDateRange")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t("common.today")}</SelectItem>
                <SelectItem value="week">{t("filters.thisWeek")}</SelectItem>
                <SelectItem value="month">{t("filters.thisMonth")}</SelectItem>
                <SelectItem value="quarter">{t("filters.last3Months")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button variant="outline" onClick={clearFilters}>
            <X className="w-4 h-4 mr-2" />
            {t("filters.clearAll")}
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={applyFilters} className="ayur-button-hero">
              <Filter className="w-4 h-4 mr-2" />
              {t("filters.applyFilters")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilterModal;