import express from 'express';
import { admin } from '../middleware/auth.js'; 

const db = admin.firestore();
const router = express.Router();

/**
 * Mock Geocoding Utility
 * Converts an address structured object into latitude and longitude coordinates.
 */
function mockGeocode(addressObj) {
    // Generate deterministic pseudo-random coordinates bounded generally in India region
    // for demonstration/testability purposes.
    let seed = 0;
    if (addressObj && addressObj.city) {
        for (let i = 0; i < addressObj.city.length; i++) {
            seed += addressObj.city.charCodeAt(i);
        }
    }
    
    // Base coordinates roughly somewhere in Central India (e.g. Nagpur area)
    const baseLat = 21.1458;
    const baseLng = 79.0882;
    
    // Adding variations to spread clinics out
    const latOffset = ((seed % 100) / 100) * 10 - 5; // -5 to +5 degrees
    const lngOffset = ((seed % 50) / 50) * 10 - 5;
    
    return {
        lat: Number((baseLat + latOffset).toFixed(4)),
        lng: Number((baseLng + lngOffset).toFixed(4))
    };
}

/**
 * Utility Function: Haversine Distance
 * Calculates distance between two geospatial points in km.
 */
function calculateDistanceKM(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ═══════════════════════════════════════════════════════════
// DOCTOR ONBOARDING API
// POST /api/doctors/register
// ═══════════════════════════════════════════════════════════
router.post('/register', async (req, res) => {
    try {
        // eKYC payload captured during signup flow
        const {
            uid,
            name,
            email,
            clinicName,
            clinicAddress, // { street, area, city, state, pincode }
            gender,
            yearsOfExperience,
            supportedTherapies, // e.g. ["Virechana", "Vamana", "Shirodhara"]
        } = req.body;

        if (!uid || !name || !supportedTherapies || !clinicAddress) {
            return res.status(400).json({ error: "Missing required onboarding fields" });
        }

        // Convert the detailed address into Geo-Coordinates
        const geolocation = mockGeocode(clinicAddress);

        const doctorProfile = {
            role: 'doctor',
            name,
            email,
            clinicName,
            clinicAddress,
            geolocation,
            gender,
            yearsOfExperience: Number(yearsOfExperience) || 0,
            supportedTherapies,
            rating: 5.0, // Default starting rating
            verificationStatus: 'verified', // Auto-verifying in demo
            createdAt: new Date().toISOString()
        };

        // Write to Firebase overriding any existing temp shell
        await db.collection('users').doc(uid).set(doctorProfile, { merge: true });

        res.status(201).json({ 
            success: true, 
            message: "Doctor Multi-Tenant Clinic Registered", 
            geolocation 
        });

    } catch (e) {
        console.error("Doctor Registration Error:", e);
        res.status(500).json({ error: "Failed to onboard doctor profile" });
    }
});

// ═══════════════════════════════════════════════════════════
// PATIENT SMART DOCTOR SEARCH API
// GET /api/doctors/search
// ═══════════════════════════════════════════════════════════
router.get('/search', async (req, res) => {
    try {
        const { 
            requiredTherapy,  // Enforced constraint (from ML)
            city,             // Text match fallback
            lat, lng,         // Patient geolocation 
            radiusKm = 50,    // Spatial expansion limit
            gender,           // Patient preference
            minRating         // Quality constraint filter
        } = req.query;

        // Base Query: Must be a verified doctor
        let queryRef = db.collection('users').where('role', '==', 'doctor');

        // Note: Firebase Firestore allows only one array-contains or IN per query.
        // It's highly optimized to filter the exact therapy first since therapy availability is a hard stop constraint.
        if (requiredTherapy) {
            // Check if the doctor's supported skill array has the ML-suggested treatment
            queryRef = queryRef.where('supportedTherapies', 'array-contains', requiredTherapy);
        }

        // Filter Gender cleanly
        if (gender && gender !== 'Any') {
            queryRef = queryRef.where('gender', '==', gender);
        }

        const snapshot = await queryRef.get();
        let doctors = [];

        snapshot.forEach(doc => {
            const data = doc.data();

            // Software filtering for compound constraints
            
            // 1. Min Rating
            if (minRating && data.rating < Number(minRating)) return;

            // 2. City Text-Match Filter (if specific coordinates aren't used)
            if (city && data.clinicAddress && data.clinicAddress.city !== city) {
                // Allows partial case-insensitive match just in case
                if (!data.clinicAddress.city.toLowerCase().includes(city.toLowerCase())) return;
            }

            let distance = null;

            // 3. Radius Geolocation filtering
            if (lat && lng && data.geolocation) {
                distance = calculateDistanceKM(
                    Number(lat), Number(lng),
                    data.geolocation.lat, data.geolocation.lng
                );

                if (distance > Number(radiusKm)) return;
            }

            doctors.push({
                doctorId: doc.id,
                name: data.name,
                clinicName: data.clinicName || 'AyurSutra Network Clinic',
                address: data.clinicAddress,
                distanceKm: distance ? Number(distance.toFixed(1)) : null,
                rating: data.rating,
                experience: data.yearsOfExperience,
                gender: data.gender,
                therapies: data.supportedTherapies
            });
        });

        // Final Sort by Proximity (or rating if no proximity provided)
        doctors.sort((a, b) => {
            if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
            return b.rating - a.rating;
        });

        res.json({ success: true, count: doctors.length, doctors });

    } catch (e) {
        console.error("Doctor Smart Search Error:", e);
        res.status(500).json({ error: "Failed to search network" });
    }
});

export default router;
