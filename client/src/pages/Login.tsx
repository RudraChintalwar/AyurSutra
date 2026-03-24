import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Leaf,
  User,
  Stethoscope,
  ArrowLeft,
  ArrowRight,
  Shield,
  CheckCircle2,
  Calendar,
  MapPin
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";

// Keep libraries as a static constant to prevent re-renders
const GOOGLE_MAPS_LIBRARIES: ("places")[] = ["places"];

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════
const DOCTOR_CODE = "AyurSutraDoc7898";

type UserRole = "patient" | "doctor";

// Steps: role → (doctor-code) → details → google-signup
type SignupStep = "role" | "doctor-code" | "details";

// ═══════════════════════════════════════════════════════
//  GOOGLE SVG ICON
// ═══════════════════════════════════════════════════════
const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

// ═══════════════════════════════════════════════════════
//  LOGIN PAGE
// ═══════════════════════════════════════════════════════
const Login = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const navigate = useNavigate();
  const { user, signInWithGoogle, registerWithGoogle, updateUserProfile, devTestLogin } =
    useAuth() as any;
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);

  // ─── Signup state ─────────────────────────────────
  const [signupStep, setSignupStep] = useState<SignupStep>("role");
  const [selectedRole, setSelectedRole] = useState<UserRole>("patient");
  const [doctorCode, setDoctorCode] = useState("");
  const [doctorCodeError, setDoctorCodeError] = useState("");

  // Profile details
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  // Doctor-specific
  const [license, setLicense] = useState("");
  const [specialization, setSpecialization] = useState("");
  
  // Location
  const [locationAddress, setLocationAddress] = useState("");
  const [geolocation, setGeolocation] = useState<{lat: number, lng: number} | null>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  const onLoadAutocomplete = (autocompleteObj: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteObj);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      const addressName = place.formatted_address || place.name || "";
      setLocationAddress(addressName);
      if (place.geometry?.location) {
        setGeolocation({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        });
      }
    }
  };

  // ─── Redirect if already logged in ────────────────
  useEffect(() => {
    if (user && user.role) {
      navigate(
        user.role === "doctor" ? "/doctor-dashboard" : "/patient-dashboard",
        { replace: true }
      );
    }
  }, [user, navigate]);

  // ═══════════════════════════════════════════════════
  //  LOGIN HANDLER (Google only)
  // ═══════════════════════════════════════════════════
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.isNewUser) {
        // No account found — redirect to signup
        setMode("signup");
        setSignupStep("role");
        toast({
          title: "No account found",
          description: "It looks like you don't have an account yet. Please sign up first.",
        });
        return;
      }
      toast({ title: "Welcome back! 🌿", description: "Signed in with Google." });
      setTimeout(() => navigate("/dashboard", { replace: true }), 500);
    } catch (error: any) {
      toast({
        title: "Google Sign-In Failed",
        description: error?.message || "Could not sign in with Google.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════
  //  SIGNUP NAVIGATION
  // ═══════════════════════════════════════════════════
  const goToNextStep = () => {
    if (signupStep === "role") {
      if (selectedRole === "doctor") {
        setSignupStep("doctor-code");
      } else {
        setSignupStep("details");
      }
    } else if (signupStep === "doctor-code") {
      if (doctorCode !== DOCTOR_CODE) {
        setDoctorCodeError("Invalid verification code. Please contact admin.");
        return;
      }
      setDoctorCodeError("");
      setSignupStep("details");
    }
  };

  const goToPrevStep = () => {
    if (signupStep === "details") {
      if (selectedRole === "doctor") {
        setSignupStep("doctor-code");
      } else {
        setSignupStep("role");
      }
    } else if (signupStep === "doctor-code") {
      setSignupStep("role");
    }
  };

  // ═══════════════════════════════════════════════════
  //  SIGNUP SUBMIT (Google popup + profile save)
  // ═══════════════════════════════════════════════════
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }

    if (selectedRole === "doctor" && !license.trim()) {
      toast({
        title: "License required",
        description: "Please enter your medical license number.",
        variant: "destructive",
      });
      return;
    }

    if (!locationAddress.trim()) {
      toast({ title: "Location required", description: "Please provide your location.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await registerWithGoogle(selectedRole, {
        name,
        age: age ? parseInt(age) : undefined,
        gender: gender || undefined,
        phone: phone || undefined,
        location: locationAddress || undefined,
        geolocation: geolocation || undefined,
        ...(selectedRole === "doctor" ? { clinicAddress: locationAddress, license, specialization } : {}),
      });

      if (result.alreadyExists) {
        // Account already exists — redirect to login
        setMode("login");
        toast({
          title: "Account already exists! 🌿",
          description: "You already have an account. We've signed you in.",
        });
        // The user is already signed in from registerWithGoogle
        setTimeout(() => navigate("/dashboard", { replace: true }), 500);
        return;
      }

      toast({
        title: "Account created! 🌿",
        description: `Welcome to AyurSutra, ${name}! Your Google Calendar is now connected.`,
      });

      navigate(
        selectedRole === "doctor" ? "/doctor-dashboard" : "/patient-dashboard",
        { replace: true }
      );
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error?.message || "Could not create account.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════
  //  STEP INDICATORS
  // ═══════════════════════════════════════════════════
  const stepNumber =
    signupStep === "role"
      ? 1
      : signupStep === "doctor-code"
        ? 2
        : selectedRole === "doctor"
          ? 3
          : 2;

  const totalSteps = selectedRole === "doctor" ? 3 : 2;

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ayur-earth-beige via-white to-ayur-cream p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-ayur-sage/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-1">
            <Leaf className="w-8 h-8 text-primary" />
            <h1 className="font-playfair text-3xl font-bold text-primary">
              AyurSutra
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Ancient Wisdom, Modern Healing
          </p>
        </div>

        <Card className="p-6 shadow-xl border-primary/10 backdrop-blur-sm bg-white/90">
          {/* ─── MODE TOGGLE ──────────────────────── */}
          <div className="flex rounded-lg bg-muted p-1 mb-6">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "login"
                ? "bg-white shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
              onClick={() => {
                setMode("login");
                setSignupStep("role");
              }}
            >
              Sign In
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "signup"
                ? "bg-white shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
              onClick={() => setMode("signup")}
            >
              Sign Up
            </button>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/*  LOGIN MODE (Google only)              */}
          {/* ═══════════════════════════════════════ */}
          {mode === "login" && (
            <div className="animate-fade-in space-y-5">
              <div className="text-center">
                <h3 className="font-playfair text-lg font-semibold mb-1">
                  Welcome Back
                </h3>
                <p className="text-sm text-muted-foreground">
                  Sign in with your Google account to continue
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full h-12 text-base font-medium border-2 hover:bg-primary/5 hover:border-primary/40 transition-all"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    <GoogleIcon />
                    Sign in with Google
                  </>
                )}
              </Button>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Your Google Calendar will be synced for therapy scheduling
                </p>
              </div>

              {/* TEST BYPASS FOR AUTOMATED E2E AGENTS */}
              <div className="pt-4 border-t border-muted/50 mt-4 space-y-2">
                <p className="text-xs text-center text-muted-foreground">Automated Testing Bypass</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => devTestLogin('patient', 1)}>Test Patient</Button>
                  <Button variant="outline" size="sm" onClick={() => devTestLogin('doctor', 1)}>Test Doctor</Button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/*  SIGNUP MODE                           */}
          {/* ═══════════════════════════════════════ */}
          {mode === "signup" && (
            <div className="animate-fade-in">
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded-full transition-all duration-300 ${i + 1 <= stepNumber
                      ? "w-8 bg-primary"
                      : "w-4 bg-muted"
                      }`}
                  />
                ))}
                <span className="text-xs text-muted-foreground ml-2">
                  {stepNumber}/{totalSteps}
                </span>
              </div>

              {/* ─── STEP: ROLE SELECTION ─────────── */}
              {signupStep === "role" && (
                <div className="space-y-4">
                  <div className="text-center mb-2">
                    <h3 className="font-playfair text-lg font-semibold">
                      I am a...
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Choose your account type
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedRole("patient")}
                      className={`relative p-6 rounded-xl border-2 transition-all duration-300 hover:shadow-md ${selectedRole === "patient"
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-muted hover:border-primary/40"
                        }`}
                    >
                      {selectedRole === "patient" && (
                        <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-primary" />
                      )}
                      <User className="w-10 h-10 mx-auto mb-3 text-primary" />
                      <div className="font-semibold text-sm">Patient</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Seek Ayurvedic healing
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole("doctor")}
                      className={`relative p-6 rounded-xl border-2 transition-all duration-300 hover:shadow-md ${selectedRole === "doctor"
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-muted hover:border-primary/40"
                        }`}
                    >
                      {selectedRole === "doctor" && (
                        <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-primary" />
                      )}
                      <Stethoscope className="w-10 h-10 mx-auto mb-3 text-primary" />
                      <div className="font-semibold text-sm">Doctor</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Manage patients & therapies
                      </p>
                    </button>
                  </div>

                  <Button
                    className="w-full bg-primary hover:bg-primary/90 mt-4"
                    onClick={goToNextStep}
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}

              {/* ─── STEP: DOCTOR VERIFICATION CODE ── */}
              {signupStep === "doctor-code" && (
                <div className="space-y-4">
                  <button
                    onClick={goToPrevStep}
                    className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </button>

                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-50 flex items-center justify-center">
                      <Shield className="w-8 h-8 text-amber-600" />
                    </div>
                    <h3 className="font-playfair text-lg font-semibold">
                      Doctor Verification
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter the special access code provided by the AyurSutra
                      administration
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="doctor-code">Verification Code</Label>
                    <Input
                      id="doctor-code"
                      type="password"
                      placeholder="Enter doctor access code"
                      value={doctorCode}
                      onChange={(e) => {
                        setDoctorCode(e.target.value);
                        setDoctorCodeError("");
                      }}
                      className={doctorCodeError ? "border-destructive" : ""}
                    />
                    {doctorCodeError && (
                      <p className="text-sm text-destructive">
                        {doctorCodeError}
                      </p>
                    )}
                  </div>

                  <Button
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={goToNextStep}
                  >
                    Verify & Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}

              {/* ─── STEP: PROFILE DETAILS + GOOGLE SIGNUP ───── */}
              {signupStep === "details" && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <button
                    type="button"
                    onClick={goToPrevStep}
                    className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </button>

                  <div className="text-center mb-2">
                    <h3 className="font-playfair text-lg font-semibold">
                      Your Details
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedRole === "doctor"
                        ? "Complete your practitioner profile"
                        : "Tell us about yourself"}
                    </p>
                  </div>

                  {/* Common fields */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="signup-name"
                      placeholder={
                        selectedRole === "doctor"
                          ? "Dr. Sharma"
                          : "Asha Nair"
                      }
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="signup-age">Age</Label>
                      <Input
                        id="signup-age"
                        type="number"
                        placeholder="25"
                        min="1"
                        max="120"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-gender">Gender</Label>
                      <select
                        id="signup-gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Phone (optional)</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-location">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-primary" />
                        {selectedRole === "doctor" ? "Clinic Address" : "Locality / City"} <span className="text-destructive">*</span>
                      </div>
                    </Label>
                    {isLoaded ? (
                      <Autocomplete onLoad={onLoadAutocomplete} onPlaceChanged={onPlaceChanged}>
                        <Input
                          id="signup-location"
                          type="text"
                          placeholder="Search for your location..."
                          value={locationAddress}
                          onChange={(e) => setLocationAddress(e.target.value)}
                          required
                        />
                      </Autocomplete>
                    ) : (
                      <Input
                        id="signup-location"
                        type="text"
                        placeholder="Loading maps..."
                        disabled
                        required
                      />
                    )}
                  </div>

                  {/* Doctor-specific fields */}
                  {selectedRole === "doctor" && (
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-3">
                      <div className="flex items-center gap-2 text-primary text-sm font-medium">
                        <Stethoscope className="w-4 h-4" />
                        Practitioner Details
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-license">
                          Medical License No.{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="signup-license"
                          placeholder="BAMS-2024-XXXX"
                          value={license}
                          onChange={(e) => setLicense(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-spec">Specialization</Label>
                        <Input
                          id="signup-spec"
                          placeholder="Panchakarma, Ayurvedic Medicine..."
                          value={specialization}
                          onChange={(e) => setSpecialization(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Google Calendar info */}
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                    <p className="text-xs text-blue-700">
                      Google Calendar will be connected for therapy scheduling & reminders
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 h-12"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Creating account...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <GoogleIcon />
                        Create Account with Google
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </form>
              )}
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          By continuing, you agree to AyurSutra's Terms of Service and Privacy
          Policy.
        </p>
      </div>
    </div>
  );
};

export default Login;