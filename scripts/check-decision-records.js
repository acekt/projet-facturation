const fs = require('fs');
const path = require('path');

const root = process.cwd();
const decisionsDir = path.join(root, 'docs', 'decisions');
const templateFile = 'TEMPLATE.md';

const requiredHeadings = [
  '# ADR-',
  '## Status',
  '## Scope',
  '## Documentation Source',
  '## Context',
  '## Decision',
  '## Risks',
  '## Verification'
];

const forbiddenPlaceholders = [
  'Short Decision Title',
  'Alternative 1:',
  'Alternative 2:',
  'Describe the implementation problem',
  'Describe the chosen approach'
];

function fail(message) {
  console.error(`[decision-check] ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(decisionsDir)) {
  fail(`Missing decision directory: ${path.relative(root, decisionsDir)}`);
  process.exit();
}

const decisionFiles = fs
  .readdirSync(decisionsDir)
  .filter((file) => file.endsWith('.md') && file !== templateFile)
  .sort();

if (decisionFiles.length === 0) {
  fail('No decision records found in docs/decisions.');
  process.exit();
}

for (const file of decisionFiles) {
  const absolute = path.join(decisionsDir, file);
  const content = fs.readFileSync(absolute, 'utf8');
  const label = path.relative(root, absolute);

  if (!/^\d{4}-[a-z0-9-]+\.md$/.test(file)) {
    fail(`${label} must use the format 0000-short-title.md.`);
  }

  for (const heading of requiredHeadings) {
    if (!content.includes(heading)) {
      fail(`${label} is missing required heading: ${heading}`);
    }
  }

  for (const placeholder of forbiddenPlaceholders) {
    if (content.includes(placeholder)) {
      fail(`${label} still contains template placeholder: ${placeholder}`);
    }
  }
}

if (!process.exitCode) {
  console.log(`[decision-check] ${decisionFiles.length} decision record(s) valid.`);
}
