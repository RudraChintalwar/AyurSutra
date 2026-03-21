import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Star, User, Stethoscope, Filter, ArrowLeft, Building, ArrowRight } from 'lucide-react';

const DoctorDiscoveryView = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Use AI Recommendation constraints implicitly as filters
  const [filters, setFilters] = useState({
    requiredTherapy: state?.aiRecommendation?.therapy || '',
    radiusKm: 50,
    minRating: 4.0,
    gender: 'Any'
  });

  // Hardware Mock Patient Location (Defaulting realistically inside India)
  const patientLocation = { lat: 21.1458, lng: 79.0882 };

  useEffect(() => {
    // If user hit URL directly bypassing Patient AI wizard.
    if (!state?.patientData) {
        toast({ title: "Incomplete Setup", description: "You need an active Triage profile. Redirecting..." });
        navigate('/patient/sessions');
        return;
    }

    fetchEligibleDoctors();
  }, [filters]);

  const fetchEligibleDoctors = async () => {
    setLoading(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      const queryParams = new URLSearchParams({
        requiredTherapy: filters.requiredTherapy,
        lat: patientLocation.lat.toString(),
        lng: patientLocation.lng.toString(),
        radiusKm: filters.radiusKm.toString(),
        minRating: filters.minRating.toString(),
        gender: filters.gender
      });

      const response = await fetch(`${BACKEND_URL}/api/doctors/search?${queryParams.toString()}`);
      const data = await response.json();

      if (data.success) {
        setDoctors(data.doctors);
      } else {
        throw new Error("Failed to load doctors");
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Network Unreachable",
        description: "Failed to map clinic network. Trying again later.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBookingClick = (doctorId: string, clinicName: string) => {
    toast({
      title: "Clinic Matched",
      description: `Forwarding ${state.patientData.name}'s prioritized triage to ${clinicName}. Booking finalized.`,
    });
    // Normally we'd navigate back to a confirmation screen or dispatch an API POST to book here.
    // For now we will return them to dashboard.
    navigate('/patient-dashboard');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Context Link */}
      <div className="flex items-center space-x-4 mb-8 text-primary cursor-pointer hover:underline" onClick={() => navigate('/patient/sessions')}>
         <ArrowLeft className="w-4 h-4" />
         <span className="font-semibold">Back to Triage Diagnostics</span>
      </div>
      
      <div className="mb-8">
        <h1 className="font-playfair text-3xl md:text-4xl text-primary font-bold">Discover Care</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
           Our algorithmic mapping system has pre-selected doctors highly skilled in fulfilling your AI-assigned protocol: <span className="text-accent underline">{state?.aiRecommendation?.therapy || 'Panchakarma Detox'}</span>. Customize your constraints below.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* FILTERS SIDEBAR */}
        <Card className="lg:col-span-1 p-6 h-fit ayur-card sticky top-20">
          <div className="flex items-center mb-6 space-x-2 border-b pb-4">
             <Filter className="w-5 h-5 text-primary" />
             <h2 className="text-xl font-playfair font-semibold">Preferences</h2>
          </div>

          <div className="space-y-6">
             {/* Radius Filter */}
             <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold text-foreground">Max Distance</Label>
                    <span className="text-xs text-muted-foreground">{filters.radiusKm} km</span>
                </div>
                <Slider 
                   value={[filters.radiusKm]} 
                   max={250} step={10} min={10} 
                   onValueChange={(val) => setFilters(p => ({...p, radiusKm: val[0]}))}
                />
             </div>

            {/* Rating Filter */}
             <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold text-foreground">Min Star Rating</Label>
                    <span className="text-xs font-semibold text-ayur-soft-gold flex items-center">
                        <Star className="w-3 h-3 mr-1 fill-current" /> {filters.minRating}.0+
                    </span>
                </div>
                <Slider 
                   value={[filters.minRating]} 
                   max={5} step={0.5} min={3} 
                   onValueChange={(val) => setFilters(p => ({...p, minRating: val[0]}))}
                />
             </div>

             {/* Gender Filter */}
             <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">Physician Gender</Label>
                <div className="flex space-x-2">
                    {['Any', 'Male', 'Female'].map(g => (
                        <Badge 
                           key={g} 
                           variant={filters.gender === g ? "default" : "outline"}
                           className="cursor-pointer px-3 py-1"
                           onClick={() => setFilters(p => ({...p, gender: g}))}
                        >
                            {g}
                        </Badge>
                    ))}
                </div>
             </div>

             {/* Implicit Triage Display */}
             <div className="mt-8 p-4 bg-primary/5 rounded border border-primary/20">
                <div className="text-xs text-primary font-semibold mb-2">CRITICAL REQUIREMENT</div>
                <Badge variant="outline" className="w-full justify-center border-accent text-accent bg-accent/5">
                   {filters.requiredTherapy} Capability
                </Badge>
             </div>
          </div>
        </Card>

        {/* RESULTS GRID */}
        <div className="lg:col-span-3">
            {loading ? (
                <div className="flex flex-col items-center justify-center p-24 text-primary">
                   <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
                   <p className="font-playfair text-xl">Connecting with clinics...</p>
                </div>
            ) : doctors.length === 0 ? (
                <Card className="p-16 text-center ayur-card border-dashed">
                    <Stethoscope className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-2xl font-playfair mb-2">No Matching Physicians Found</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        We could not find any clinics within {filters.radiusKm}km specialized in {filters.requiredTherapy}. Try expanding your search radius.
                    </p>
                    <Button variant="outline" className="mt-6" onClick={() => setFilters(p => ({...p, radiusKm: 250}))}>
                        Expand Search to 250km
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {doctors.map(doc => (
                        <Card key={doc.doctorId} className="p-6 transition-transform hover:scale-[1.02] ayur-card flex flex-col h-full bg-white shadow-sm border border-gray-100 hover:shadow-md hover:border-primary/30 group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                                        <User className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-playfair text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">{doc.name}</h3>
                                        <p className="text-sm text-gray-500 font-medium">{doc.experience} Years Experience</p>
                                    </div>
                                </div>
                                <div className="flex items-center bg-green-50 px-2 py-1 rounded text-green-700 text-sm font-semibold">
                                    <Star className="w-3 h-3 mr-1 fill-current" /> {doc.rating}
                                </div>
                            </div>
                            
                            <div className="space-y-3 flex-grow border-t border-gray-100 pt-4">
                                <div className="flex items-start text-sm text-gray-600">
                                    <Building className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-accent" />
                                    <div>
                                        <span className="font-medium">{doc.clinicName}</span><br />
                                        <span className="text-xs text-gray-500">{doc.address?.area}, {doc.address?.city}</span>
                                    </div>
                                </div>
                                <div className="flex items-center text-sm text-gray-600">
                                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0 text-gray-400" />
                                    <span className="font-medium text-gray-700">{doc.distanceKm} km away</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-6 border-t border-gray-100 pt-5">
                                <Button variant="outline" className="w-full rounded-md font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 border-gray-200">
                                    View Profile
                                </Button>
                                <Button className="w-full ayur-button-accent rounded-md" onClick={() => handleBookingClick(doc.doctorId, doc.clinicName)}>
                                    Select Clinic <ArrowRight className="w-3 h-3 ml-2" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default DoctorDiscoveryView;
