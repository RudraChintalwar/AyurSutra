Cypress.Commands.add('login', (email, password) => {
  cy.visit('/login');
  if (email.includes('doc')) {
    cy.get('button').contains('Test Doctor').click();
  } else {
    cy.get('button').contains('Test Patient').click();
  }
  cy.url().should('not.include', '/login');
});
