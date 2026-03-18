import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings,
  User,
  Bell,
  Shield,
  Heart,
  Save,
  Camera,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Palette,
  Monitor,
  Download,
  FileText
} from 'lucide-react';
import { mockData } from '@/data/mockData';

const PatientSettings = () => {
  const currentPatientId = 'p1';
  const currentPatient = mockData.patients.find(p => p.id === currentPatientId);

  const [profileData, setProfileData] = useState({
    name: currentPatient?.name || 'Asha Nair',
    email: currentPatient?.email || 'asha.nair@example.com',
    phone: currentPatient?.phone || '+91-9876543210',
    dob: currentPatient?.dob || '1989-08-12',
    gender: currentPatient?.gender || 'Female',
    address: 'Mumbai, Maharashtra, India',
    emergencyContact: '+91-9876543211',
    emergencyName: 'Raj Nair (Spouse)'
  });

  const [notifications, setNotifications] = useState({
    sessionReminders: true,
    medicationAlerts: true,
    appointmentUpdates: true,
    healthTips: true,
    doctorMessages: true,
    systemUpdates: false,
    smsNotifications: true,
    emailNotifications: true
  });

  const [preferences, setPreferences] = useState({
    language: 'english',
    timezone: 'Asia/Kolkata',
    units: 'metric',
    reminderTime: 2, // hours before
    dataSharing: true,
    researchParticipation: false
  });

  const handleProfileUpdate = () => {
    console.log('Profile updated:', profileData);
  };

  const handleNotificationUpdate = () => {
    console.log('Notifications updated:', notifications);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-primary">
            Account Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your personal information and preferences
          </p>
        </div>
        <Button className="ayur-button-accent">
          <Save className="w-4 h-4 mr-2" />
          Save All Changes
        </Button>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="ayur-card p-6 animate-slide-up">
            <div className="flex items-start space-x-6 mb-6">
              <div className="relative">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={currentPatient?.avatar} alt={currentPatient?.name} />
                  <AvatarFallback>
                    {currentPatient?.name?.split(' ').map(n => n[0]).join('') || 'AN'}
                  </AvatarFallback>
                </Avatar>
                <Button size="sm" variant="outline" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0">
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1">
                <h3 className="font-playfair text-2xl font-semibold">{profileData.name}</h3>
                <p className="text-muted-foreground">Patient ID: {currentPatientId}</p>
                <div className="flex items-center space-x-3 mt-2">
                  <Badge className="dosha-vata px-3 py-1">
                    {currentPatient?.dosha} Constitution
                  </Badge>
                  <Badge variant="outline">
                    <Heart className="w-3 h-3 mr-1" />
                    Active Patient
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="dob">Date of Birth</Label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="dob"
                      type="date"
                      value={profileData.dob}
                      onChange={(e) => setProfileData({ ...profileData, dob: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Input
                    id="gender"
                    value={profileData.gender}
                    onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="address">Address</Label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="address"
                      value={profileData.address}
                      onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="emergencyName">Emergency Contact Name</Label>
                  <Input
                    id="emergencyName"
                    value={profileData.emergencyName}
                    onChange={(e) => setProfileData({ ...profileData, emergencyName: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="emergencyContact">Emergency Contact Phone</Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="emergencyContact"
                      value={profileData.emergencyContact}
                      onChange={(e) => setProfileData({ ...profileData, emergencyContact: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />
            
            <div className="flex justify-end">
              <Button onClick={handleProfileUpdate} className="ayur-button-hero">
                Update Profile
              </Button>
            </div>
          </Card>

          {/* Health Summary */}
          <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <Heart className="w-5 h-5 mr-2 text-primary" />
              Health Summary
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-primary/5 rounded-lg text-center">
                <div className="text-lg font-bold text-primary">
                  {currentPatient?.dosha}
                </div>
                <div className="text-sm text-muted-foreground">Body Constitution</div>
              </div>

              <div className="p-4 bg-accent/5 rounded-lg text-center">
                <div className="text-lg font-bold text-accent">
                  {currentPatient?.llm_recommendation.therapy}
                </div>
                <div className="text-sm text-muted-foreground">Current Treatment</div>
              </div>

              <div className="p-4 bg-green-100 rounded-lg text-center">
                <div className="text-lg font-bold text-green-600">
                  {currentPatient?.llm_recommendation.priority_score}
                </div>
                <div className="text-sm text-muted-foreground">Health Score</div>
              </div>
            </div>

            <div className="mt-4">
              <Label className="text-sm font-medium text-muted-foreground">Chief Complaint</Label>
              <p className="text-sm mt-1">{currentPatient?.reason_for_visit}</p>
            </div>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="ayur-card p-6 animate-slide-up">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-primary" />
              Notification Preferences
            </h3>

            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-4">Treatment Notifications</h4>
                <div className="space-y-4">
                  {Object.entries(notifications).slice(0, 5).map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between py-2">
                      <div>
                        <div className="font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {key === 'sessionReminders' && 'Get notified before scheduled sessions'}
                          {key === 'medicationAlerts' && 'Reminders for herbal treatments and medicines'}
                          {key === 'appointmentUpdates' && 'Changes to your appointment schedule'}
                          {key === 'healthTips' && 'Daily Ayurvedic health tips and advice'}
                          {key === 'doctorMessages' && 'Messages from your practitioner'}
                        </div>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => 
                          setNotifications({ ...notifications, [key]: checked })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-4">Delivery Methods</h4>
                <div className="space-y-4">
                  {Object.entries(notifications).slice(5).map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between py-2">
                      <div>
                        <div className="font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {key === 'systemUpdates' && 'App updates and maintenance notices'}
                          {key === 'smsNotifications' && 'Receive notifications via SMS'}
                          {key === 'emailNotifications' && 'Receive notifications via email'}
                        </div>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => 
                          setNotifications({ ...notifications, [key]: checked })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator className="my-6" />
            
            <div className="flex justify-end">
              <Button onClick={handleNotificationUpdate} className="ayur-button-hero">
                Save Preferences
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Privacy & Security */}
        <TabsContent value="privacy" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="ayur-card p-6 animate-slide-up">
              <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-primary" />
                Privacy & Security
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Data Sharing</div>
                    <div className="text-sm text-muted-foreground">
                      Allow sharing anonymized data for research
                    </div>
                  </div>
                  <Switch
                    checked={preferences.dataSharing}
                    onCheckedChange={(checked) => 
                      setPreferences({ ...preferences, dataSharing: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Research Participation</div>
                    <div className="text-sm text-muted-foreground">
                      Participate in Ayurvedic research studies
                    </div>
                  </div>
                  <Switch
                    checked={preferences.researchParticipation}
                    onCheckedChange={(checked) => 
                      setPreferences({ ...preferences, researchParticipation: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="w-4 h-4 mr-2" />
                    Download My Data
                  </Button>

                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    Privacy Policy
                  </Button>

                  <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700">
                    Delete Account
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <h3 className="font-playfair text-xl font-semibold mb-4">Data Overview</h3>
              
              <div className="space-y-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Medical Records</span>
                    <span className="text-sm text-muted-foreground">3 documents</span>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Session History</span>
                    <span className="text-sm text-muted-foreground">
                      {mockData.sessions.filter(s => s.patient_id === currentPatientId).length} sessions
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Symptom Tracking</span>
                    <span className="text-sm text-muted-foreground">
                      {currentPatient?.symptoms.length} symptoms tracked
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Account Created</span>
                    <span className="text-sm text-muted-foreground">
                      Aug 15, 2025
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* System Preferences */}
        <TabsContent value="preferences" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="ayur-card p-6 animate-slide-up">
              <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
                <Palette className="w-5 h-5 mr-2 text-primary" />
                Appearance
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Dark Mode</div>
                    <div className="text-sm text-muted-foreground">Toggle dark theme</div>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Large Text</div>
                    <div className="text-sm text-muted-foreground">Increase text size</div>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Animations</div>
                    <div className="text-sm text-muted-foreground">Enable UI animations</div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">High Contrast</div>
                    <div className="text-sm text-muted-foreground">Improve readability</div>
                  </div>
                  <Switch />
                </div>
              </div>
            </Card>

            <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
                <Monitor className="w-5 h-5 mr-2 text-primary" />
                System Preferences
              </h3>

              <div className="space-y-4">
                <div>
                  <Label>Language</Label>
                  <Input value="English" className="mt-1" />
                </div>

                <div>
                  <Label>Timezone</Label>
                  <Input value="Asia/Kolkata (IST)" className="mt-1" />
                </div>

                <div>
                  <Label>Measurement Units</Label>
                  <Input value="Metric (kg, cm)" className="mt-1" />
                </div>

                <div>
                  <Label>Reminder Time</Label>
                  <Input 
                    type="number" 
                    value={preferences.reminderTime}
                    onChange={(e) => setPreferences({ 
                      ...preferences, 
                      reminderTime: parseInt(e.target.value) 
                    })}
                    className="mt-1" 
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Hours before appointment
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PatientSettings;