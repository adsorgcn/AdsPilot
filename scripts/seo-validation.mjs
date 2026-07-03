#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Configuration
const PAGES_DIR = join(projectRoot, 'apps/frontend/src/app');
const LOCALES_DIR = join(projectRoot, 'apps/frontend/public/locales');
const SEO_FILES = [
  'sitemap.ts',
  'robots.ts',
  'lib/structured-data.ts'
];

const PAGES_TO_CHECK = [
  '(site)/page.tsx',
  '(site)/features/page.tsx',
  '(site)/case-studies/page.tsx',
  '(site)/high-value-offers/page.tsx',
  '(site)/about/page.tsx',
  '(site)/contact/page.tsx',
  '(site)/pricing/page.tsx',
];

const SEO_FILES_TO_CHECK = [
  'docs/SEO/README.md',
  'docs/SEO/ROUTE_MIGRATION_GUIDE.md',
];

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n🔍 ${title}`, 'blue');
  log('='.repeat(50), 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

// Check if file exists
function fileExists(filePath) {
  try {
    statSync(filePath);
    return true;
  } catch {
    return false;
  }
}

// Read file content
function readFile(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

// Check if page has generateMetadata function
function hasGenerateMetadata(content) {
  return content?.includes('export async function generateMetadata') ||
         content?.includes('export function generateMetadata');
}

// Check if page has structured data
function hasStructuredData(content) {
  return content?.includes('StructuredDataProvider') ||
         content?.includes('SeoStructuredData') ||
         content?.includes('buildStructuredData');
}

// Check if page uses proper layout
function hasProperLayout(content) {
  return content?.includes('MarketingPageLayout') ||
         content?.includes('DashboardPageLayout') ||
         content?.includes('SettingsPageLayout');
}

// Check if content uses i18n
function usesI18n(content) {
  return content?.includes('getFixedT') && content?.includes('i18n');
}

// Check SEO translation entries
function checkSeoTranslations() {
  logSection('SEO Translation Files');

  const locales = ['en', 'zh-CN'];
  let allGood = true;

  for (const locale of locales) {
    const seoFile = join(LOCALES_DIR, locale, 'seo.json');

    if (fileExists(seoFile)) {
      const content = readFile(seoFile);
      if (content) {
        try {
          const seoData = JSON.parse(content);
          const requiredKeys = ['default', 'features', 'caseStudies', 'highValueOffers'];
          const missingKeys = requiredKeys.filter(key => !seoData[key]);

          if (missingKeys.length === 0) {
            logSuccess(`SEO translations for ${locale}: Complete`);
          } else {
            logError(`SEO translations for ${locale}: Missing keys ${missingKeys.join(', ')}`);
            allGood = false;
          }
        } catch (e) {
          logError(`SEO translations for ${locale}: Invalid JSON`);
          allGood = false;
        }
      }
    } else {
      logError(`SEO translations for ${locale}: File not found`);
      allGood = false;
    }
  }

  return allGood;
}

// Check marketing translations
function checkMarketingTranslations() {
  logSection('Marketing Translation Files');

  const locales = ['en', 'zh-CN'];
  let allGood = true;

  for (const locale of locales) {
    const marketingFile = join(LOCALES_DIR, locale, 'marketing.json');

    if (fileExists(marketingFile)) {
      const content = readFile(marketingFile);
      if (content) {
        const hasCaseStudies = content.includes('caseStudies');
        const hasHighValueOffers = content.includes('highValueOffers');

        if (hasCaseStudies && hasHighValueOffers) {
          logSuccess(`Marketing translations for ${locale}: Complete`);
        } else {
          const missing = [];
          if (!hasCaseStudies) missing.push('caseStudies');
          if (!hasHighValueOffers) missing.push('highValueOffers');
          logWarning(`Marketing translations for ${locale}: Missing sections ${missing.join(', ')}`);
        }
      }
    } else {
      logError(`Marketing translations for ${locale}: File not found`);
      allGood = false;
    }
  }

  return allGood;
}

// Check individual pages
function checkPages() {
  logSection('Individual Page SEO');

  let results = {
    withMetadata: 0,
    withStructuredData: 0,
    withLayout: 0,
    withI18n: 0,
    totalPages: 0
  };

  for (const pagePath of PAGES_TO_CHECK) {
    const fullPath = join(PAGES_DIR, pagePath);

    if (fileExists(fullPath)) {
      const content = readFile(fullPath);
      results.totalPages++;

      logInfo(`Checking: ${pagePath}`);

      if (hasGenerateMetadata(content)) {
        results.withMetadata++;
        logSuccess('  ✅ Has generateMetadata()');
      } else {
        logWarning('  ⚠️  Missing generateMetadata()');
      }

      if (hasStructuredData(content)) {
        results.withStructuredData++;
        logSuccess('  ✅ Has structured data');
      } else {
        logWarning('  ⚠️  Missing structured data');
      }

      if (hasProperLayout(content)) {
        results.withLayout++;
        logSuccess('  ✅ Uses proper layout');
      } else {
        logWarning('  ⚠️  Missing or incorrect layout');
      }

      if (usesI18n(content)) {
        results.withI18n++;
        logSuccess('  ✅ Uses i18n');
      } else {
        logWarning('  ⚠️  Missing i18n implementation');
      }
    } else {
      logError(`Page not found: ${pagePath}`);
    }
  }

  return results;
}

// Check SEO infrastructure files
function checkSeoInfrastructure() {
  logSection('SEO Infrastructure Files');

  let allGood = true;

  // Check sitemap
  const sitemapFile = join(PAGES_DIR, 'sitemap.ts');
  if (fileExists(sitemapFile)) {
    logSuccess('sitemap.ts: Exists');
  } else {
    logError('sitemap.ts: Missing');
    allGood = false;
  }

  // Check robots.txt
  const robotsFile = join(PAGES_DIR, 'robots.ts');
  if (fileExists(robotsFile)) {
    logSuccess('robots.ts: Exists');
  } else {
    logError('robots.ts: Missing');
    allGood = false;
  }

  // Check structured data utility
  const structuredDataFile = join(PAGES_DIR, 'lib/structured-data.ts');
  if (fileExists(structuredDataFile)) {
    logSuccess('lib/structured-data.ts: Exists');
  } else {
    // Try alternative path
    const altStructuredDataFile = join(PAGES_DIR, '../lib/structured-data.ts');
    if (fileExists(altStructuredDataFile)) {
      logSuccess('lib/structured-data.ts: Exists');
    } else {
      logError('lib/structured-data.ts: Missing');
      allGood = false;
    }
  }

  // Check SEO documentation
  for (const docFile of SEO_FILES_TO_CHECK) {
    const fullPath = join(projectRoot, docFile);
    if (fileExists(fullPath)) {
      logSuccess(`${docFile}: Exists`);
    } else {
      logWarning(`${docFile}: Missing`);
    }
  }

  return allGood;
}

// Main validation function
function runValidation() {
  log('🚀 Google-Monetize SEO Validation Report', 'bold');
  log('='.repeat(60), 'blue');

  let overallScore = 0;
  let maxScore = 0;

  // Check SEO infrastructure
  const infraScore = checkSeoInfrastructure() ? 1 : 0;
  overallScore += infraScore;
  maxScore += 1;

  // Check translations
  const seoTransScore = checkSeoTranslations() ? 1 : 0;
  overallScore += seoTransScore;
  maxScore += 1;

  const marketingTransResult = checkMarketingTranslations();
  const marketingTransScore = marketingTransResult ? 1 : 0.5;
  overallScore += marketingTransScore;
  maxScore += 1;

  // Check pages
  const pageResults = checkPages();
  const pageScore = (pageResults.withMetadata + pageResults.withStructuredData + pageResults.withLayout + pageResults.withI18n) / (pageResults.totalPages * 4);
  overallScore += pageScore;
  maxScore += 1;

  // Calculate final score
  const finalScore = Math.round((overallScore / maxScore) * 100);

  logSection('SEO Optimization Score');
  log(`Overall Score: ${finalScore}%`, finalScore >= 80 ? 'green' : finalScore >= 60 ? 'yellow' : 'red');

  logSection('Detailed Results');
  logInfo(`Pages with generateMetadata(): ${pageResults.withMetadata}/${pageResults.totalPages}`);
  logInfo(`Pages with structured data: ${pageResults.withStructuredData}/${pageResults.totalPages}`);
  logInfo(`Pages with proper layout: ${pageResults.withLayout}/${pageResults.totalPages}`);
  logInfo(`Pages with i18n: ${pageResults.withI18n}/${pageResults.totalPages}`);

  logSection('Recommendations');

  if (finalScore >= 80) {
    logSuccess('🎉 Excellent SEO optimization! Your site is well-optimized for search engines.');
  } else if (finalScore >= 60) {
    logWarning('👍 Good SEO optimization, but there are still improvements to make.');
    if (pageResults.withMetadata < pageResults.totalPages) {
      logInfo('- Add generateMetadata() to remaining pages');
    }
    if (pageResults.withStructuredData < pageResults.totalPages) {
      logInfo('- Add structured data to improve rich snippets');
    }
  } else {
    logError('⚠️  SEO optimization needs significant improvement.');
    logInfo('- Focus on adding generateMetadata() to all pages');
    logInfo('- Implement structured data for better search visibility');
    logInfo('- Ensure all pages use proper layouts and i18n');
  }

  logSection('Next Steps');
  logInfo('1. Test your sitemap at: https://your-domain.com/sitemap.xml');
  logInfo('2. Test your robots.txt at: https://your-domain.com/robots.txt');
  logInfo('3. Use Google Rich Results Test to validate structured data');
  logInfo('4. Submit sitemap to Google Search Console');
  logInfo('5. Monitor Core Web Vitals and search performance');

  log('\n✨ Validation complete!', 'bold');
}

// Run the validation
runValidation();