#!/usr/bin/env node

/**
 * FinalAdapter Coverage Verification Script
 * 验证所有服务FinalAdapter统一化覆盖情况
 *
 * This script verifies that all services are using the FinalAdapter pattern
 * instead of the legacy adapter methods.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ServiceResult {
  serviceName: string;
  hasGoFiles: boolean;
  usesFinalAdapter: boolean;
  usesLegacyAdapter: boolean;
  filesWithFinalAdapter: string[];
  filesWithLegacyAdapter: string[];
  status: 'compliant' | 'non-compliant' | 'no-go-files';
}

interface VerificationReport {
  totalServices: number;
  compliantServices: number;
  nonCompliantServices: number;
  servicesWithoutGoFiles: number;
  complianceRate: number;
  services: ServiceResult[];
}

function findServiceDirectories(projectRoot: string): string[] {
  const servicesDir = path.join(projectRoot, 'services');

  if (!fs.existsSync(servicesDir)) {
    throw new Error('Services directory not found');
  }

  return fs.readdirSync(servicesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .filter(dirent => !['internal', 'functions'].includes(dirent.name))
    .map(dirent => dirent.name)
    .sort();
}

function findGoFiles(servicePath: string): string[] {
  try {
    const result = execSync(`find "${servicePath}" -name "*.go" -type f`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return result.trim().split('\n').filter(file => file.length > 0);
  } catch (error) {
    return [];
  }
}

function analyzeAdapterUsage(filePath: string): { usesFinal: boolean; usesLegacy: boolean } {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    const usesFinal = /database\.GetFinalAdapterForService\s*\(/.test(content);
    const usesLegacy = /database\.(GetAdapterForService|GetPGXCompatibleAdapterForService)\s*\(/.test(content);

    return { usesFinal, usesLegacy };
  } catch (error) {
    return { usesFinal: false, usesLegacy: false };
  }
}

function analyzeService(serviceName: string, projectRoot: string): ServiceResult {
  const servicePath = path.join(projectRoot, 'services', serviceName);
  const goFiles = findGoFiles(servicePath);

  if (goFiles.length === 0) {
    return {
      serviceName,
      hasGoFiles: false,
      usesFinalAdapter: false,
      usesLegacyAdapter: false,
      filesWithFinalAdapter: [],
      filesWithLegacyAdapter: [],
      status: 'no-go-files'
    };
  }

  const filesWithFinalAdapter: string[] = [];
  const filesWithLegacyAdapter: string[] = [];

  for (const file of goFiles) {
    const { usesFinal, usesLegacy } = analyzeAdapterUsage(file);

    if (usesFinal) {
      filesWithFinalAdapter.push(path.relative(servicePath, file));
    }

    if (usesLegacy) {
      filesWithLegacyAdapter.push(path.relative(servicePath, file));
    }
  }

  const status = filesWithLegacyAdapter.length === 0 ? 'compliant' : 'non-compliant';

  return {
    serviceName,
    hasGoFiles: true,
    usesFinalAdapter: filesWithFinalAdapter.length > 0,
    usesLegacyAdapter: filesWithLegacyAdapter.length > 0,
    filesWithFinalAdapter,
    filesWithLegacyAdapter,
    status
  };
}

function generateReport(services: ServiceResult[]): VerificationReport {
  const totalServices = services.length;
  const compliantServices = services.filter(s => s.status === 'compliant').length;
  const nonCompliantServices = services.filter(s => s.status === 'non-compliant').length;
  const servicesWithoutGoFiles = services.filter(s => s.status === 'no-go-files').length;
  const complianceRate = totalServices > 0 ? (compliantServices / totalServices) * 100 : 0;

  return {
    totalServices,
    compliantServices,
    nonCompliantServices,
    servicesWithoutGoFiles,
    complianceRate,
    services
  };
}

function printReport(report: VerificationReport): void {
  console.log('\n🔍 FinalAdapter Coverage Verification Report');
  console.log('='.repeat(50));

  console.log(`\n📊 Summary:`);
  console.log(`   Total Services: ${report.totalServices}`);
  console.log(`   ✅ Compliant: ${report.compliantServices}`);
  console.log(`   ❌ Non-Compliant: ${report.nonCompliantServices}`);
  console.log(`   ⚠️  No Go Files: ${report.servicesWithoutGoFiles}`);
  console.log(`   📈 Compliance Rate: ${report.complianceRate.toFixed(1)}%`);

  console.log(`\n📋 Service Details:`);

  for (const service of report.services) {
    const statusIcon = service.status === 'compliant' ? '✅' :
                      service.status === 'non-compliant' ? '❌' : '⚠️';

    console.log(`\n   ${statusIcon} ${service.serviceName}`);

    if (!service.hasGoFiles) {
      console.log(`      └─ No Go files found`);
      continue;
    }

    console.log(`      ├─ Go Files: ${service.filesWithFinalAdapter.length + service.filesWithLegacyAdapter.length}`);
    console.log(`      ├─ FinalAdapter Usage: ${service.usesFinalAdapter ? 'Yes' : 'No'}`);
    console.log(`      └─ Legacy Adapter Usage: ${service.usesLegacyAdapter ? 'Yes' : 'No'}`);

    if (service.filesWithLegacyAdapter.length > 0) {
      console.log(`        └─ Files with legacy adapters:`);
      service.filesWithLegacyAdapter.forEach(file => {
        console.log(`           • ${file}`);
      });
    }

    if (service.filesWithFinalAdapter.length > 0) {
      console.log(`        └─ Files using FinalAdapter:`);
      service.filesWithFinalAdapter.slice(0, 3).forEach(file => {
        console.log(`           • ${file}`);
      });
      if (service.filesWithFinalAdapter.length > 3) {
        console.log(`           ... and ${service.filesWithFinalAdapter.length - 3} more`);
      }
    }
  }

  // Overall assessment
  console.log(`\n🎯 Overall Assessment:`);
  if (report.complianceRate >= 90) {
    console.log(`   ✅ Excellent: FinalAdapter adoption is ${report.complianceRate.toFixed(1)}%`);
    console.log(`   🚀 System is ready for production deployment`);
  } else if (report.complianceRate >= 75) {
    console.log(`   ⚠️  Good: FinalAdapter adoption is ${report.complianceRate.toFixed(1)}%`);
    console.log(`   🔧 Some services need migration to FinalAdapter`);
  } else {
    console.log(`   ❌ Needs Improvement: FinalAdapter adoption is ${report.complianceRate.toFixed(1)}%`);
    console.log(`   🚨 Immediate action required for legacy adapter migration`);
  }

  // Recommendations
  if (report.nonCompliantServices > 0) {
    console.log(`\n💡 Recommendations:`);
    console.log(`   1. Priority migration for non-compliant services`);
    console.log(`   2. Update build scripts to check for legacy adapters`);
    console.log(`   3. Add linting rules to prevent legacy adapter usage`);
    console.log(`   4. Document migration process for remaining services`);
  }
}

function main(): void {
  const projectRoot = process.cwd();

  try {
    console.log('🔍 Analyzing FinalAdapter coverage...');

    const serviceNames = findServiceDirectories(projectRoot);
    console.log(`📁 Found ${serviceNames.length} services`);

    const services = serviceNames.map(name => analyzeService(name, projectRoot));
    const report = generateReport(services);

    printReport(report);

    // Exit with appropriate code
    process.exit(report.nonCompliantServices > 0 ? 1 : 0);

  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }
}

main();