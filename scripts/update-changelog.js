import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const changelogPath = path.resolve('CHANGELOG.md');
const today = new Date().toISOString().split('T')[0];

console.log(`Generating changelog for ${today}...`);

try {
    // Get today's commits
    const commits = execSync(`git log --since="midnight" --oneline --no-merges`).toString().trim();

    if (!commits) {
        console.log('No new commits today. Skipped changelog update.');
        process.exit(0);
    }

    const features = [];
    const fixes = [];
    const others = [];

    commits.split('\n').forEach(line => {
        // Extract everything after the short hash
        const msg = line.substring(line.indexOf(' ') + 1).trim();
        const msgLower = msg.toLowerCase();

        // Categorize
        if (msgLower.match(/^(feat|added|implement|new|update)/)) {
            features.push(`- ${msg}`);
        } else if (msgLower.match(/^(fix|bug|resolve|patch|debug)/)) {
            fixes.push(`- ${msg}`);
        } else {
            others.push(`- ${msg}`);
        }
    });

    let newEntry = `\n## [${today}]\n\n`;

    if (features.length) {
        newEntry += `### Features Implemented 🚀\n${features.join('\n')}\n\n`;
    }
    if (fixes.length) {
        newEntry += `### Issues Fixed 🛠️\n${fixes.join('\n')}\n\n`;
    }
    if (others.length) {
        newEntry += `### General Updates 🔄\n${others.join('\n')}\n\n`;
    }

    let currentChangelog = '';
    if (fs.existsSync(changelogPath)) {
        currentChangelog = fs.readFileSync(changelogPath, 'utf8');
    } else {
        currentChangelog = '# CHANGELOG\n\nAll notable features implemented and issues fixed for **SIMPLISH Talks** will be documented in this file.\n';
    }

    const headerIndex = currentChangelog.indexOf('\n## ');

    // Checking if today is already present so we don't accidentally duplicate headers
    if (headerIndex !== -1 && currentChangelog.includes(`## [${today}]`)) {
        console.log('Changelog for today has already been generated. Aborting to avoid duplicates.');
        process.exit(0);
    }

    let updatedChangelog;
    if (headerIndex !== -1) {
        updatedChangelog = currentChangelog.slice(0, headerIndex) + newEntry + currentChangelog.slice(headerIndex);
    } else {
        updatedChangelog = currentChangelog + newEntry;
    }

    fs.writeFileSync(changelogPath, updatedChangelog);
    console.log('✅ Successfully updated CHANGELOG.md!');

} catch (error) {
    // Graceful fail if no git repo or no commits since midnight
    if (error.stdout && !error.stdout.toString().trim()) {
        console.log('No git commits found today or not a git repository yet.');
    } else {
        console.error("Failed to generate changelog:", error.message);
    }
}
