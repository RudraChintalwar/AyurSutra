describe('Doctor Discovery & Booking Flows', () => {

  beforeEach(() => {
    // Cy.login is a custom command bypassing Firebase Auth UI for tokens
    cy.login('patient_a@ayursutra.com', 'password123');
  });

  // ==========================================
  // Scenario 3.1: Discovery to Booking (Happy Path)
  // ==========================================
  it('navigates triage -> AI constraint -> discovery -> booking', () => {
    // 1. Intercept the ML Server to guarantee 'Basti' suggestion
    cy.intercept('POST', '**/api/scheduling/predict', {
      statusCode: 200,
      body: {
        therapy: 'Basti',
        base_severity_score_float: 60.5,
        sessions_recommended: 3,
        spacing_days: 7
      }
    }).as('mlPredict');

    cy.visit('/patient/sessions');
    
    // Quick Schedule Wizard
    cy.get('button').contains('Schedule New Session').click();
    cy.get('textarea#reason').type('Chronic back pain and digestion issues');
    cy.get('button').contains('Next Step').click();
    
    // Symptoms
    cy.get('label').contains('Joint Pain').click();
    cy.get('button').contains('Next Step').click();
    cy.wait('@mlPredict');

    // Assert AI View
    cy.contains('AI Treatment Recommendation').should('be.visible');
    cy.contains('Basti').should('be.visible');

    // Transition to Discovery
    cy.get('button').contains('Find Connecting Specialists').click();
    cy.url().should('include', '/discover-doctors');

    // 2. Doctor Discovery UI Context Intercept
    cy.contains('Basti Capability').should('be.visible');
    cy.get('.w-full > span[role="slider"]').first().type('{leftarrow}{leftarrow}'); 

    cy.get('.ayur-card').contains('Dr. Asha Sharma').should('exist');
    cy.get('button').contains('Select Clinic').first().click();

    cy.contains('Booking finalized').should('be.visible');
    cy.url().should('include', '/patient-dashboard');
  });

  // ==========================================
  // Scenario 4.1: Edge Case - Empty Search Results
  // ==========================================
  it('gracefully handles empty discovery results without crashing', () => {
    cy.visit('/discover-doctors', {
      state: {
         patientData: { name: 'Patient A' },
         aiRecommendation: { therapy: 'Quantum Healing' } 
      }
    });

    cy.contains('No Matching Physicians Found', { timeout: 10000 }).should('be.visible');
    cy.contains('We could not find any clinics').should('be.visible');
    cy.get('button').contains('Expand Search').should('be.enabled');
  });
});

describe('Clinic Queue Collision & Bump Flows', () => {
  it('bumps low-priority Patient A from Doctor X for high-priority Patient B', () => {
    cy.login('patient_b_emergency@ayursutra.com', 'password123'); 
    
    cy.intercept('POST', '**/api/scheduling/predict', {
      body: { therapy: 'Virechana', base_severity_score_float: 95.0, sessions_recommended: 1 }
    });

    cy.visit('/discover-doctors', { state: { patientData: {}, aiRecommendation: { therapy: 'Virechana' } } });
    cy.get('button').contains('Select Clinic').click();

    cy.intercept('POST', '**/api/scheduling/book').as('bookSlot');
    cy.get('.slot-tuesday').click();
    cy.get('button').contains('Confirm').click();
    
    cy.wait('@bookSlot').then((interception) => {
      expect(interception.response.body.bumpedPatient).to.exist;
      expect(interception.response.body.bumpedPatient.patientId).to.eq('patient_a');
      expect(interception.response.body.status).to.eq('confirmed');
    });
  });
});

describe('Doctor Dashboard Override', () => {
  it('allows doctors to view the LLM summary and override the ML therapy', () => {
    cy.login('doc_1@ayursutra.com', 'doctorpass'); 
    cy.visit('/doctor-dashboard');

    cy.contains('Patient A').click();
    cy.contains('AI Clinical Summary').should('be.visible');

    cy.get('button').contains('Modify Treatment Plan').click();
    cy.get('select#therapy').select('Nasya');
    cy.get('button').contains('Approve & Confirm').click();

    cy.contains('Status updated to confirmed').should('be.visible');
    cy.contains('Nasya').should('be.visible');
  });
});

describe('System Resilience', () => {
  it('gracefully degraded to manual selection if Python ML times out', () => {
    cy.login('patient_a@ayursutra.com', 'password123');
    
    cy.intercept('POST', '**/api/scheduling/predict', (req) => {
      req.on('response', (res) => { res.setDelay(6000); });
    }).as('slowPredict');

    cy.visit('/patient/sessions');
    cy.get('button').contains('Schedule New Session').click();
    cy.get('button').contains('Next Step').click();
    
    cy.contains('AI Service Unreachable', { timeout: 7000 }).should('be.visible');
    cy.get('select#manualTherapy').should('exist'); 
  });
});
