#!/usr/bin/env ts-node
/**
 * Build Script
 * Compiles TypeScript to JavaScript
 */

import { execSync } from 'child_process';
import { join } from 'path';

console.log('🔨 Starting build process...');

try {
  // Run NestJS build
  console.log('📦 Compiling TypeScript...');
  execSync('nest build', { stdio: 'inherit', cwd: join(__dirname, '..') });
  
  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
