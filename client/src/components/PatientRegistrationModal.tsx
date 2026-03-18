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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.email || !formData.phone) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Patient Registered!",
      description: `${formData.name} has been successfully added to your patient list`,
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
            <span>Register New Patient</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center">
              <User className="w-4 h-4 mr-2 text-primary" />
              Personal Information
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter patient's full name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder="Age"
                    value={formData.age}
                    onChange={(e) => handleInputChange('age', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
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
                <Label htmlFor="phone">Phone Number *</Label>
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
                <Label htmlFor="address">Address</Label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Textarea
                    id="address"
                    placeholder="Enter complete address"
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
              Medical Information
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="dosha">Ayurvedic Constitution (Dosha)</Label>
                <Select value={formData.dosha} onValueChange={(value) => handleInputChange('dosha', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select primary dosha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vata">Vata Dominant</SelectItem>
                    <SelectItem value="pitta">Pitta Dominant</SelectItem>
                    <SelectItem value="kapha">Kapha Dominant</SelectItem>
                    <SelectItem value="vata-pitta">Vata-Pitta</SelectItem>
                    <SelectItem value="pitta-kapha">Pitta-Kapha</SelectItem>
                    <SelectItem value="vata-kapha">Vata-Kapha</SelectItem>
                    <SelectItem value="tridoshic">Tridoshic (Balanced)</SelectItem>
                  </SelectContent>
                </Select>
                {formData.dosha && (
                  <div className="mt-2">
                    <Badge className={`dosha-${formData.dosha.split('-')[0]}`}>
                      {formData.dosha.charAt(0).toUpperCase() + formData.dosha.slice(1)} Constitution
                    </Badge>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="chiefComplaint">Chief Complaint</Label>
                <Textarea
                  id="chiefComplaint"
                  placeholder="Primary reason for seeking treatment"
                  value={formData.chiefComplaint}
                  onChange={(e) => handleInputChange('chiefComplaint', e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="medicalHistory">Medical History</Label>
                <Textarea
                  id="medicalHistory"
                  placeholder="Previous conditions, surgeries, allergies"
                  value={formData.medicalHistory}
                  onChange={(e) => handleInputChange('medicalHistory', e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="currentMedications">Current Medications</Label>
                <Textarea
                  id="currentMedications"
                  placeholder="List current medications and supplements"
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
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="ayur-button-hero">
            <UserPlus className="w-4 h-4 mr-2" />
            Register Patient
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PatientRegistrationModal;