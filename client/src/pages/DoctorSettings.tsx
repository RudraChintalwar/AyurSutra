import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings,
  User,
  Bell,
  Shield,
  Clock,
  Stethoscope,
  Save,
  Camera,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Palette,
  Monitor,
  Loader2
} from 'lucide-react';

const DoctorSettings = () => {
  const { user, linkGoogleCalendar, unlinkGoogleCalendar } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [calBusy, setCalBusy] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: (user as any)?.phone || '',
    specialty: '',
    experience: '',
    license: '',
    clinic: '',
    address: ''
  });

  const [notifications, setNotifications] = useState({
    newPatients: true,
    sessionReminders: true,
    emergencyAlerts: true,
    weeklyReports: true,
    patientFeedback: true,
    systemUpdates: false
  });

  const [availability, setAvailability] = useState({
    monday: { enabled: true, start: '09:00', end: '17:00' },
    tuesday: { enabled: true, start: '09:00', end: '17:00' },
    wednesday: { enabled: true, start: '09:00', end: '17:00' },
    thursday: { enabled: true, start: '09:00', end: '17:00' },
    friday: { enabled: true, start: '09:00', end: '17:00' },
    saturday: { enabled: true, start: '09:00', end: '13:00' },
    sunday: { enabled: false, start: '09:00', end: '17:00' }
  });

  // Load saved settings from Firestore
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.uid) return;
      try {
        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.settings) {
            if (data.settings.profile) setProfileData(prev => ({ ...prev, ...data.settings.profile }));
            if (data.settings.notifications) setNotifications(prev => ({ ...prev, ...data.settings.notifications }));
            if (data.settings.availability) setAvailability(prev => ({ ...prev, ...data.settings.availability }));
          }
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    };
    loadSettings();
  }, [user]);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          name: profileData.name,
          phone: profileData.phone,
          settings: {
            profile: profileData,
            notifications,
            availability,
          }
        });
      }
      toast({ title: t('doctor.settingsSaved'), description: t('doctor.settingsSavedDesc') });
    } catch (err) {
      console.error('Save error:', err);
      toast({ title: t('doctor.saveFailed'), description: t('doctor.saveFailedDesc'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileUpdate = () => handleSaveAll();
  const handleNotificationUpdate = () => handleSaveAll();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-primary">
            {t('doctor.settingsTitle')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('doctor.settingsDesc')}
          </p>
        </div>
        <Button className="ayur-button-accent" onClick={handleSaveAll} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {t('doctor.saveAll')}
        </Button>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 h-auto py-1">
          <TabsTrigger value="profile">{t('doctor.profile')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('doctor.notifications')}</TabsTrigger>
          <TabsTrigger value="schedule">{t('doctor.schedule')}</TabsTrigger>
          <TabsTrigger value="calendar">{t('doctor.calendar')}</TabsTrigger>
          <TabsTrigger value="preferences">{t('doctor.preferences')}</TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="ayur-card p-6 animate-slide-up">
            <div className="flex items-center space-x-4 mb-6">
              <div className="relative">
                <Avatar className="w-24 h-24">
                  <AvatarImage src="https://placehold.co/96x96/2C6E49/FFFFFF?text=SM" alt="Dr. Sargun Mehta" />
                  <AvatarFallback>SM</AvatarFallback>
                </Avatar>
                <Button size="sm" variant="outline" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0">
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
              <div>
                <h3 className="font-playfair text-2xl font-semibold">{profileData.name}</h3>
                <p className="text-muted-foreground">{profileData.specialty}</p>
                <Badge className="mt-1 bg-primary/10 text-primary">
                  <Stethoscope className="w-3 h-3 mr-1" />
                  {profileData.experience} Experience
                </Badge>
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
                  <Label htmlFor="specialty">Specialty</Label>
                  <Input
                    id="specialty"
                    value={profileData.specialty}
                    onChange={(e) => setProfileData({ ...profileData, specialty: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="experience">Years of Experience</Label>
                  <Input
                    id="experience"
                    value={profileData.experience}
                    onChange={(e) => setProfileData({ ...profileData, experience: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="license">License Number</Label>
                  <Input
                    id="license"
                    value={profileData.license}
                    onChange={(e) => setProfileData({ ...profileData, license: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="clinic">Clinic/Practice Name</Label>
                  <Input
                    id="clinic"
                    value={profileData.clinic}
                    onChange={(e) => setProfileData({ ...profileData, clinic: e.target.value })}
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
              </div>
            </div>

            <Separator className="my-6" />
            
            <div className="flex justify-end">
              <Button onClick={handleProfileUpdate} className="ayur-button-hero">
                Update Profile
              </Button>
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
              {Object.entries(notifications).map(([key, enabled]) => (
                <div key={key} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {key === 'newPatients' && 'Get notified when new patients register'}
                      {key === 'sessionReminders' && 'Reminders for upcoming sessions'}
                      {key === 'emergencyAlerts' && 'Critical patient condition alerts'}
                      {key === 'weeklyReports' && 'Weekly practice performance reports'}
                      {key === 'patientFeedback' && 'When patients submit feedback'}
                      {key === 'systemUpdates' && 'Software updates and maintenance notices'}
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

            <Separator className="my-6" />
            
            <div className="flex justify-end">
              <Button onClick={handleNotificationUpdate} className="ayur-button-hero">
                Save Preferences
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Schedule Settings */}
        <TabsContent value="schedule" className="space-y-6">
          <Card className="ayur-card p-6 animate-slide-up">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-primary" />
              Weekly Availability
            </h3>

            <div className="space-y-4">
              {Object.entries(availability).map(([day, schedule]) => (
                <div key={day} className="flex items-center justify-between py-3 border-b last:border-b-0">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="w-20">
                      <div className="font-medium capitalize">{day}</div>
                    </div>
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(checked) => 
                        setAvailability({
                          ...availability,
                          [day]: { ...schedule, enabled: checked }
                        })
                      }
                    />
                  </div>
                  
                  {schedule.enabled && (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <Input
                          type="time"
                          value={schedule.start}
                          onChange={(e) => 
                            setAvailability({
                              ...availability,
                              [day]: { ...schedule, start: e.target.value }
                            })
                          }
                          className="w-24"
                        />
                      </div>
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={schedule.end}
                        onChange={(e) => 
                          setAvailability({
                            ...availability,
                            [day]: { ...schedule, end: e.target.value }
                          })
                        }
                        className="w-24"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <Card className="ayur-card p-6 animate-slide-up max-w-2xl">
            <h3 className="font-playfair text-xl font-semibold mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Google Calendar
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Connect your primary calendar so approved sessions sync with your reminders. Patients link their own accounts separately.
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {user?.calendarSyncConnected ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline">Not connected</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                className="ayur-button-accent"
                disabled={calBusy || user?.calendarSyncConnected}
                onClick={async () => {
                  setCalBusy(true);
                  try {
                    await linkGoogleCalendar();
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : 'Could not start linking';
                    toast({ title: 'Calendar link failed', description: msg, variant: 'destructive' });
                    setCalBusy(false);
                  }
                }}
              >
                {user?.calendarSyncConnected ? 'Already connected' : 'Connect Google Calendar'}
              </Button>
              <Button
                variant="outline"
                disabled={calBusy || !user?.calendarSyncConnected}
                onClick={async () => {
                  setCalBusy(true);
                  try {
                    await unlinkGoogleCalendar();
                    toast({ title: 'Disconnected', description: 'Google Calendar is no longer linked.' });
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : 'Disconnect failed';
                    toast({ title: 'Error', description: msg, variant: 'destructive' });
                  } finally {
                    setCalBusy(false);
                  }
                }}
              >
                {calBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Disconnect
              </Button>
            </div>
          </Card>
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
                    <div className="font-medium">Compact Layout</div>
                    <div className="text-sm text-muted-foreground">Reduce spacing and padding</div>
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
              </div>
            </Card>

            <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-primary" />
                Security & Privacy
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Two-Factor Authentication</div>
                    <div className="text-sm text-muted-foreground">Enhanced account security</div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Session Timeout</div>
                    <div className="text-sm text-muted-foreground">Auto-logout after inactivity</div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Data Export</div>
                    <div className="text-sm text-muted-foreground">Allow data download</div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </Card>

            <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
                <Monitor className="w-5 h-5 mr-2 text-primary" />
                System
              </h3>

              <div className="space-y-4">
                <div>
                  <Label>Default Session Duration</Label>
                  <Input type="number" placeholder="90" className="mt-1" />
                  <div className="text-xs text-muted-foreground mt-1">Minutes</div>
                </div>

                <div>
                  <Label>Reminder Timing</Label>
                  <Input type="number" placeholder="24" className="mt-1" />
                  <div className="text-xs text-muted-foreground mt-1">Hours before session</div>
                </div>

                <div>
                  <Label>Auto-save Interval</Label>
                  <Input type="number" placeholder="5" className="mt-1" />
                  <div className="text-xs text-muted-foreground mt-1">Minutes</div>
                </div>
              </div>
            </Card>

            <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-primary" />
                Advanced
              </h3>

              <div className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  Export Patient Data
                </Button>

                <Button variant="outline" className="w-full justify-start">
                  Import Treatment Templates
                </Button>

                <Button variant="outline" className="w-full justify-start">
                  Reset to Default Settings
                </Button>

                <Separator />

                <div className="text-sm text-muted-foreground">
                  <div>App Version: 2.1.0</div>
                  <div>Last Updated: Sept 28, 2025</div>
                  <div>Database: Connected</div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DoctorSettings;