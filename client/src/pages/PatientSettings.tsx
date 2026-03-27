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
  FileText,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const PatientSettings = () => {
  const { user, updateUserProfile, linkGoogleCalendar, unlinkGoogleCalendar } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const currentPatient = user as any;
  const [sessionCount, setSessionCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [calBusy, setCalBusy] = useState(false);

  useEffect(() => {
    const fetchSessionCount = async () => {
      if (!user?.uid) return;
      try {
        const q = query(collection(db, 'sessions'), where('patient_id', '==', user.uid));
        const snap = await getDocs(q);
        setSessionCount(snap.size);
      } catch (err) {
        console.error('Error fetching sessions:', err);
      }
    };
    fetchSessionCount();
  }, [user]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) return;
        const data: any = snap.data();
        setProfileData(prev => ({
          ...prev,
          name: data.name || prev.name,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
          gender: data.gender || prev.gender,
          address: data.location || prev.address,
          ...data.settings?.profile,
        }));
        if (data.settings?.notifications) {
          setNotifications(prev => ({ ...prev, ...data.settings.notifications }));
        }
        if (data.settings?.preferences) {
          setPreferences(prev => ({ ...prev, ...data.settings.preferences }));
        }
      } catch (err) {
        console.error('Error loading patient settings:', err);
      }
    };
    loadSettings();
  }, [user?.uid]);

  const [profileData, setProfileData] = useState({
    name: currentPatient?.name || '',
    email: currentPatient?.email || '',
    phone: currentPatient?.phone || '',
    dob: '',
    gender: currentPatient?.gender || '',
    address: '',
    emergencyContact: '',
    emergencyName: ''
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

  const handleProfileUpdate = async () => {
    try {
      await updateUserProfile({ name: profileData.name, phone: profileData.phone, gender: profileData.gender });
      toast({ title: t('patient.profileUpdated'), description: t('patient.profileUpdatedDesc') });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive' });
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await updateUserProfile({
        name: profileData.name,
        phone: profileData.phone,
        gender: profileData.gender,
        location: profileData.address,
      } as any);
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          settings: {
            profile: profileData,
            notifications,
            preferences,
          },
        });
      }
      toast({ title: t('patient.settingsSaved'), description: t('patient.settingsSavedDesc') });
    } catch (err) {
      console.error('Save error:', err);
      toast({ title: t('patient.saveFailed'), description: t('patient.saveFailedDesc'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotificationUpdate = () => {
    handleSaveAll();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-primary">
            {t('patient.settingsTitle')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('patient.settingsDesc')}
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
          <TabsTrigger value="calendar">{t('doctor.calendar')}</TabsTrigger>
          <TabsTrigger value="privacy">{t('common.privacy')}</TabsTrigger>
          <TabsTrigger value="preferences">{t('doctor.preferences')}</TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="ayur-card p-6 animate-slide-up">
            <div className="flex items-start space-x-6 mb-6">
              <div className="relative">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={currentPatient?.avatar} alt={currentPatient?.name} />
                  <AvatarFallback>
                    {currentPatient?.name?.split(' ').map((n: string) => n[0]).join('') || 'AN'}
                  </AvatarFallback>
                </Avatar>
                <Button size="sm" variant="outline" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0">
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1">
                <h3 className="font-playfair text-2xl font-semibold">{profileData.name}</h3>
                <p className="text-muted-foreground">{t("patient.patientId", { id: user?.uid?.slice(0, 8) || 'N/A' })}</p>
                <div className="flex items-center space-x-3 mt-2">
                  <Badge className="dosha-vata px-3 py-1">
                    {currentPatient?.dosha} Constitution
                  </Badge>
                  <Badge variant="outline">
                    <Heart className="w-3 h-3 mr-1" />
                    {language === "hi" ? "सक्रिय रोगी" : "Active Patient"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">{language === "hi" ? "पूरा नाम" : "Full Name"}</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="email">{language === "hi" ? "ईमेल पता" : "Email Address"}</Label>
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
                  <Label htmlFor="phone">{language === "hi" ? "फोन नंबर" : "Phone Number"}</Label>
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
                  <Label htmlFor="dob">{language === "hi" ? "जन्म तिथि" : "Date of Birth"}</Label>
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
                  <Label htmlFor="gender">{language === "hi" ? "लिंग" : "Gender"}</Label>
                  <Input
                    id="gender"
                    value={profileData.gender}
                    onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="address">{language === "hi" ? "पता" : "Address"}</Label>
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
                  <Label htmlFor="emergencyName">{language === "hi" ? "आपातकालीन संपर्क नाम" : "Emergency Contact Name"}</Label>
                  <Input
                    id="emergencyName"
                    value={profileData.emergencyName}
                    onChange={(e) => setProfileData({ ...profileData, emergencyName: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="emergencyContact">{language === "hi" ? "आपातकालीन संपर्क फोन" : "Emergency Contact Phone"}</Label>
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
                {language === "hi" ? "प्रोफाइल अपडेट करें" : "Update Profile"}
              </Button>
            </div>
          </Card>

          {/* Health Summary */}
          <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <Heart className="w-5 h-5 mr-2 text-primary" />
              {language === "hi" ? "स्वास्थ्य सारांश" : "Health Summary"}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-primary/5 rounded-lg text-center">
                <div className="text-lg font-bold text-primary">
                  {currentPatient?.dosha}
                </div>
                <div className="text-sm text-muted-foreground">{language === "hi" ? "शारीरिक प्रकृति" : "Body Constitution"}</div>
              </div>

              <div className="p-4 bg-accent/5 rounded-lg text-center">
                <div className="text-lg font-bold text-accent">
                  {currentPatient?.llm_recommendation?.therapy || 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">{language === "hi" ? "वर्तमान उपचार" : "Current Treatment"}</div>
              </div>

              <div className="p-4 bg-green-100 rounded-lg text-center">
                <div className="text-lg font-bold text-green-600">
                  {currentPatient?.llm_recommendation?.priority_score || currentPatient?.healthScore || 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">{language === "hi" ? "स्वास्थ्य स्कोर" : "Health Score"}</div>
              </div>
            </div>

            <div className="mt-4">
              <Label className="text-sm font-medium text-muted-foreground">{language === "hi" ? "मुख्य शिकायत" : "Chief Complaint"}</Label>
              <p className="text-sm mt-1">{currentPatient?.reason_for_visit}</p>
            </div>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="ayur-card p-6 animate-slide-up">
            <h3 className="font-playfair text-xl font-semibold mb-4 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-primary" />
              {language === "hi" ? "सूचना वरीयताएं" : "Notification Preferences"}
            </h3>

            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-4">{language === "hi" ? "उपचार सूचनाएं" : "Treatment Notifications"}</h4>
                <div className="space-y-4">
                  {Object.entries(notifications).slice(0, 5).map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between py-2">
                      <div>
                        <div className="font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {key === 'sessionReminders' && (language === "hi" ? 'निर्धारित सत्रों से पहले सूचना पाएं' : 'Get notified before scheduled sessions')}
                          {key === 'medicationAlerts' && (language === "hi" ? 'हर्बल उपचार और दवाओं के लिए रिमाइंडर' : 'Reminders for herbal treatments and medicines')}
                          {key === 'appointmentUpdates' && (language === "hi" ? 'आपके अपॉइंटमेंट शेड्यूल में बदलाव' : 'Changes to your appointment schedule')}
                          {key === 'healthTips' && (language === "hi" ? 'दैनिक आयुर्वेदिक स्वास्थ्य टिप्स' : 'Daily Ayurvedic health tips and advice')}
                          {key === 'doctorMessages' && (language === "hi" ? 'आपके चिकित्सक के संदेश' : 'Messages from your practitioner')}
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
                <h4 className="font-medium mb-4">{language === "hi" ? "डिलीवरी तरीके" : "Delivery Methods"}</h4>
                <div className="space-y-4">
                  {Object.entries(notifications).slice(5).map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between py-2">
                      <div>
                        <div className="font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {key === 'systemUpdates' && (language === "hi" ? 'ऐप अपडेट और मेंटेनेंस सूचनाएं' : 'App updates and maintenance notices')}
                          {key === 'smsNotifications' && (language === "hi" ? 'SMS द्वारा सूचनाएं प्राप्त करें' : 'Receive notifications via SMS')}
                          {key === 'emailNotifications' && (language === "hi" ? 'ईमेल द्वारा सूचनाएं प्राप्त करें' : 'Receive notifications via email')}
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
                {language === "hi" ? "वरीयताएं सहेजें" : "Save Preferences"}
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
                {language === "hi" ? "गोपनीयता और सुरक्षा" : "Privacy & Security"}
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{language === "hi" ? "डेटा शेयरिंग" : "Data Sharing"}</div>
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
                    <div className="font-medium">{language === "hi" ? "रिसर्च भागीदारी" : "Research Participation"}</div>
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
                  <Button variant="outline" className="w-full justify-start" onClick={() => {
                    try {
                      const myData = {
                        profile: profileData,
                        dosha: currentPatient?.dosha,
                        symptoms: currentPatient?.symptoms,
                        recommendation: currentPatient?.llm_recommendation,
                        sessions: sessionCount,
                        exported_at: new Date().toISOString(),
                      };
                      const blob = new Blob([JSON.stringify(myData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `ayursutra_data_${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: 'Data Downloaded \u2705', description: 'Your data has been exported.' });
                    } catch (err) {
                      toast({ title: 'Download Failed', variant: 'destructive' });
                    }
                  }}>
                    <Download className="w-4 h-4 mr-2" />
                    Download My Data
                  </Button>

                  <Button variant="outline" className="w-full justify-start" onClick={() => {
                    toast({ title: 'Privacy Policy', description: 'Opening privacy policy page...' });
                  }}>
                    <FileText className="w-4 h-4 mr-2" />
                    Privacy Policy
                  </Button>

                  <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700" onClick={() => {
                    toast({ title: '\u26a0\ufe0f Account Deletion', description: 'Please contact support to delete your account.', variant: 'destructive' });
                  }}>
                    Delete Account
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="ayur-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <h3 className="font-playfair text-xl font-semibold mb-4">{language === "hi" ? "डेटा अवलोकन" : "Data Overview"}</h3>
              
              <div className="space-y-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{language === "hi" ? "मेडिकल रिकॉर्ड" : "Medical Records"}</span>
                    <span className="text-sm text-muted-foreground">3 documents</span>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{language === "hi" ? "सत्र इतिहास" : "Session History"}</span>
                    <span className="text-sm text-muted-foreground">
                      {sessionCount} sessions
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{language === "hi" ? "लक्षण ट्रैकिंग" : "Symptom Tracking"}</span>
                    <span className="text-sm text-muted-foreground">
                      {currentPatient?.symptoms?.length || 0} symptoms tracked
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{language === "hi" ? "खाता निर्माण" : "Account Created"}</span>
                    <span className="text-sm text-muted-foreground">
                      Aug 15, 2025
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <Card className="ayur-card p-6 animate-slide-up max-w-2xl">
            <h3 className="font-playfair text-xl font-semibold mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Google Calendar
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Link your primary Google Calendar so confirmed sessions appear there with email and popup reminders. Each user links their own account — events are not shared between calendars.
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {user?.calendarSyncConnected ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline">{language === "hi" ? "कनेक्ट नहीं" : "Not connected"}</Badge>
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
                    <div className="font-medium">{language === "hi" ? "डार्क मोड" : "Dark Mode"}</div>
                    <div className="text-sm text-muted-foreground">{language === "hi" ? "डार्क थीम टॉगल करें" : "Toggle dark theme"}</div>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{language === "hi" ? "बड़ा टेक्स्ट" : "Large Text"}</div>
                    <div className="text-sm text-muted-foreground">{language === "hi" ? "टेक्स्ट आकार बढ़ाएं" : "Increase text size"}</div>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{language === "hi" ? "एनिमेशन" : "Animations"}</div>
                    <div className="text-sm text-muted-foreground">{language === "hi" ? "UI एनिमेशन सक्षम करें" : "Enable UI animations"}</div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{language === "hi" ? "हाई कॉन्ट्रास्ट" : "High Contrast"}</div>
                    <div className="text-sm text-muted-foreground">{language === "hi" ? "पठनीयता बेहतर करें" : "Improve readability"}</div>
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
                  <Label>{t("lang.label")}</Label>
                  <Input value="English" className="mt-1" />
                </div>

                <div>
                  <Label>{language === "hi" ? "समय क्षेत्र" : "Timezone"}</Label>
                  <Input value="Asia/Kolkata (IST)" className="mt-1" />
                </div>

                <div>
                  <Label>{language === "hi" ? "मापन इकाइयां" : "Measurement Units"}</Label>
                  <Input value="Metric (kg, cm)" className="mt-1" />
                </div>

                <div>
                  <Label>{language === "hi" ? "रिमाइंडर समय" : "Reminder Time"}</Label>
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