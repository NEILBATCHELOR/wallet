// src/tests/security/index.ts
/**
 * Security Testing Suite Index
 * 
 * This file exports all the security-related tests to provide a centralized entry point
 * for the security testing suite. It's organized by module functionality.
 */

// Core Security Services
export * from './SecureKeyService.test';
export * from './KeyRecoveryService.test';
export * from './SecureVaultService.test';

// Wallet Security
export * from './HardwareWalletSecurity.test';
export * from './MultiSigService.test';

// Integration Tests
export * from '../integration/SecurityIntegrationTest.test';

/**
 * To run all security tests:
 * npm run test -- src/tests/security
 * 
 * To run a specific test file:
 * npm run test -- src/tests/security/SecureKeyService.test.ts
 * 
 * To run integration tests only:
 * npm run test -- src/tests/integration/SecurityIntegrationTest.test.ts
 */