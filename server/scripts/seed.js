import admin from 'firebase-admin';

// Override env if emulator targets exist
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'ayursutra-test' });
}
const db = admin.firestore();

const seedDatabase = async () => {
  console.log('🌱 Seeding database...');

  const docs = [
    {
      id: 'doc_1',
      name: 'Dr. Asha Sharma',
      role: 'doctor',
      clinicName: 'AyurCare Nagpur',
      clinicAddress: { city: 'Nagpur', area: 'Dharampeth' },
      geolocation: new admin.firestore.GeoPoint(21.1458, 79.0882),
      supportedTherapies: ['Virechana', 'Basti', 'Nasya'],
      gender: 'Female',
      rating: 4.8,
      email: 'doc_1@ayursutra.com'
    },
    {
      id: 'doc_2',
      name: 'Dr. Rohan Desai',
      role: 'doctor',
      clinicName: 'Holistic Wellness Pune',
      clinicAddress: { city: 'Pune', area: 'Kothrud' },
      geolocation: new admin.firestore.GeoPoint(18.5204, 73.8567),
      supportedTherapies: ['Basti', 'Shirodhara'],
      gender: 'Male',
      rating: 4.5,
      email: 'doc_2@ayursutra.com'
    },
    {
      id: 'doc_x',
      name: 'Dr. X Specialist',
      role: 'doctor',
      clinicName: 'Elite Panchakarma',
      clinicAddress: { city: 'Nagpur', area: 'Sadar' },
      geolocation: new admin.firestore.GeoPoint(21.1558, 79.0982),
      supportedTherapies: ['Virechana'],
      gender: 'Male',
      rating: 5.0,
      email: 'doc_x@ayursutra.com'
    }
  ];

  for (const doc of docs) {
    try {
      await admin.auth().createUser({ uid: doc.id, email: doc.email, password: 'doctorpass' });
    } catch(e) { if(e.code !== 'auth/uid-already-exists') console.log(e); }
    await db.collection('users').doc(doc.id).set(doc);
  }

  const patients = [
    { id: 'patient_a', name: 'Patient A', role: 'patient', constitution: 'Vata', email: 'patient_a@ayursutra.com' },
    { id: 'patient_b_emergency', name: 'Patient B', role: 'patient', constitution: 'Pitta', email: 'patient_b_emergency@ayursutra.com' }
  ];

  for (const p of patients) {
    try {
      await admin.auth().createUser({ uid: p.id, email: p.email, password: 'password123' });
    } catch(e) { if(e.code !== 'auth/uid-already-exists') console.log(e); }
    await db.collection('users').doc(p.id).set(p);
  }

  const tuesdaySlot = new Date();
  tuesdaySlot.setDate(tuesdaySlot.getDate() + (2 + 7 - tuesdaySlot.getDay()) % 7);
  
  await db.collection('appointments').add({
    doctorId: 'doc_x',
    patientId: 'patient_a',
    status: 'scheduled',
    scheduledSlots: [tuesdaySlot.toISOString()],
    totalPriorityScore: 25.0,
    baseSeverityScore: 50.0,
    waitTimeDays: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('✅ Seeding complete.');
  process.exit(0);
};

seedDatabase().catch(e => {
  console.error(e);
  process.exit(1);
});
