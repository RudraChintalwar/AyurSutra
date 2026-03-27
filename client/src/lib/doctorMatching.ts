type Geo = { lat: number; lng: number } | null | undefined;

export type MatchDoctorInput = {
  id?: string;
  doctorId?: string;
  geolocation?: { lat?: number; lng?: number };
  expertiseSymptoms?: string[];
  specialization?: string | string[];
  supportedTherapies?: string[];
  therapiesOffered?: string[];
  therapies?: string[];
  [k: string]: any;
};

const symptomMap: Record<string, string[]> = {
  bloating: ["digestive issues", "gas", "acidity", "gut"],
  stress: ["anxiety", "mental stress", "mind"],
  fatigue: ["low energy", "tiredness", "exhaustion"],
  headache: ["migraine", "head pain"],
  insomnia: ["sleep issues", "sleeplessness"],
  "joint stiffness": ["joint pain", "joint pains", "arthritis", "bones"],
  "digestive issues": ["bloating", "acidity", "indigestion", "gut"],
};

const normalize = (text: string) => text?.toLowerCase().trim();

export function calculateDistanceKM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p = 0.017453292519943295;
  const c = Math.cos;
  const a =
    0.5 -
    (c((lat2 - lat1) * p) / 2) +
    c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p)) / 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

export function rankDoctorsByClinicalMatch(
  doctors: MatchDoctorInput[],
  opts: {
    symptoms: string[];
    requiredTherapy?: string;
    patientGeo?: Geo;
    radiusKm: number;
    includeUnknownDistance?: boolean;
  }
) {
  const { symptoms, requiredTherapy = "", patientGeo, radiusKm, includeUnknownDistance = false } = opts;

  const withDistance = doctors.map((doc) => {
    let distanceKm: number | null = null;
    if (patientGeo?.lat && patientGeo?.lng && doc.geolocation?.lat && doc.geolocation?.lng) {
      distanceKm = calculateDistanceKM(
        patientGeo.lat,
        patientGeo.lng,
        Number(doc.geolocation.lat),
        Number(doc.geolocation.lng)
      );
    }
    return { ...doc, distanceKm };
  });

  const inRadius = withDistance.filter((doc) => {
    if (doc.distanceKm === null) return includeUnknownDistance;
    return doc.distanceKm <= radiusKm;
  });

  const ranked = inRadius
    .map((doc) => {
      let score = 0;
      let expertise: string[] = [];
      if ((doc.expertiseSymptoms || []).length > 0) {
        expertise = (doc.expertiseSymptoms || []).map(normalize);
      } else if (doc.specialization) {
        const specs =
          typeof doc.specialization === "string"
            ? doc.specialization.split(",")
            : doc.specialization;
        expertise = (specs || []).map((s: string) => normalize(s));
      }

      const therapies = (
        doc.therapies ||
        doc.therapiesOffered ||
        doc.supportedTherapies ||
        []
      ).map((t: string) => normalize(t));

      symptoms.forEach((symptom) => {
        const normalizedSymptom = normalize(symptom);
        if (expertise.includes(normalizedSymptom)) score += 3;
        const related = symptomMap[normalizedSymptom] || [];
        if (related.some((r) => expertise.includes(normalize(r)))) score += 2;
        if (expertise.some((e) => e.includes(normalizedSymptom))) score += 1;
      });

      if (requiredTherapy) {
        const nt = normalize(requiredTherapy);
        if (therapies.some((t: string) => t.includes(nt)) || expertise.some((e) => e.includes(nt))) {
          score += 5;
        }
      }

      if (doc.distanceKm !== null) {
        if (doc.distanceKm <= 5) score += 3;
        else if (doc.distanceKm <= 15) score += 2;
        else if (doc.distanceKm <= 30) score += 1;
      }

      return { ...doc, matchScore: score };
    })
    .filter((d) => d.matchScore > 0)
    .sort((a, b) => {
      if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      return 0;
    });

  return ranked;
}
