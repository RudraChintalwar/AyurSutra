import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, User, Phone, Mail, MapPin, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface PatientRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PatientRegistrationModal: React.FC<PatientRegistrationModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    age: '',
    gender: '',
    address: '',
    dosha: '',
    chiefComplaint: '',
    medicalHistory: '',
    currentMedications: '',
  });
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.email || !formData.phone) {
      toast({
        title: language === "hi" ? "त्रुटि" : "Error",
        description: t("patientReg.fillRequired"),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("patientReg.registered"),
      description: t("patientReg.registeredDesc", { name: formData.name }),
    });

    // Reset form
    setFormData({
      name: '',
      email: '',
      phone: '',
      age: '',
      gender: '',
      address: '',
      dosha: '',
      chiefComplaint: '',
      medicalHistory: '',
      currentMedications: '',
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <UserPlus className="w-5 h-5 text-primary" />
            <span>{t("patientReg.title")}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center">
              <User className="w-4 h-4 mr-2 text-primary" />
              {t("patientReg.personalInfo")}
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">{t("patientReg.fullName")} *</Label>
                <Input
                  id="name"
                  placeholder={t("patientReg.fullNamePlaceholder")}
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age">{t("patientReg.age")}</Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder={t("patientReg.age")}
                    value={formData.age}
                    onChange={(e) => handleInputChange('age', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="gender">{t("patientReg.gender")}</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("patientReg.selectGender")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("common.male")}</SelectItem>
                      <SelectItem value="female">{t("common.female")}</SelectItem>
                      <SelectItem value="other">{t("common.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="email">{t("patientReg.email")} *</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="patient@email.com"
                    className="pl-10"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">{t("patientReg.phone")} *</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="+91 9876543210"
                    className="pl-10"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">{t("patientReg.address")}</Label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Textarea
                    id="address"
                    placeholder={t("patientReg.addressPlaceholder")}
                    className="pl-10"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Medical Information */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-primary" />
              {t("patientReg.medicalInfo")}
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="dosha">{t("patientReg.dosha")}</Label>
                <Select value={formData.dosha} onValueChange={(value) => handleInputChange('dosha', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("patientReg.selectDosha")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vata">{t("patientReg.vataDominant")}</SelectItem>
                    <SelectItem value="pitta">{t("patientReg.pittaDominant")}</SelectItem>
                    <SelectItem value="kapha">{t("patientReg.kaphaDominant")}</SelectItem>
                    <SelectItem value="vata-pitta">Vata-Pitta</SelectItem>
                    <SelectItem value="pitta-kapha">Pitta-Kapha</SelectItem>
                    <SelectItem value="vata-kapha">Vata-Kapha</SelectItem>
                    <SelectItem value="tridoshic">{t("patientReg.tridoshic")}</SelectItem>
                  </SelectContent>
                </Select>
                {formData.dosha && (
                  <div className="mt-2">
                    <Badge className={`dosha-${formData.dosha.split('-')[0]}`}>
                      {formData.dosha.charAt(0).toUpperCase() + formData.dosha.slice(1)} {t("patientReg.constitution")}
                    </Badge>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="chiefComplaint">{t("doctorDashboard.chiefComplaint")}</Label>
                <Textarea
                  id="chiefComplaint"
                  placeholder={t("patientReg.chiefComplaintPlaceholder")}
                  value={formData.chiefComplaint}
                  onChange={(e) => handleInputChange('chiefComplaint', e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="medicalHistory">{t("patientReg.medicalHistory")}</Label>
                <Textarea
                  id="medicalHistory"
                  placeholder={t("patientReg.medicalHistoryPlaceholder")}
                  value={formData.medicalHistory}
                  onChange={(e) => handleInputChange('medicalHistory', e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="currentMedications">{t("patientReg.currentMedications")}</Label>
                <Textarea
                  id="currentMedications"
                  placeholder={t("patientReg.currentMedicationsPlaceholder")}
                  value={formData.currentMedications}
                  onChange={(e) => handleInputChange('currentMedications', e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-4 pt-6 border-t">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} className="ayur-button-hero">
            <UserPlus className="w-4 h-4 mr-2" />
            {t("patientReg.registerPatient")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PatientRegistrationModal;