import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const trackerPath = path.resolve('dev_tracker.md');
const today = new Date().toISOString().split('T')[0];

console.log(`Generating dev tracker update for ${today}...`);

try {
    // Get today's commits
    const commits = execSync(`git log --since="midnight" --oneline --no-merges`).toString().trim();

    if (!commits) {
        console.log('No new commits today. Skipped dev tracker update.');
        process.exit(0);
    }

    const issues = [];
    const modifications = [];
    const features = [];

    // Parse and categorize commits
    commits.split('\n').forEach(line => {
        // Extract everything after the short hash
        const msg = line.substring(line.indexOf(' ') + 1).trim();
        const msgLower = msg.toLowerCase();

        // Categorize based on keywords
        if (msgLower.match(/^(feat|added|implement|new)/)) {
            features.push(`- **Feature**: ${msg}`);
        } else if (msgLower.match(/^(update|refactor|modify|change|remove|chore)/)) {
            modifications.push(`- **Modification/Task**: ${msg}`);
        } else if (msgLower.match(/^(fix|bug|resolve|patch|debug)/)) {
            issues.push(`- **Issue/Fix**: ${msg}`);
        } else {
            // Default bucket
            modifications.push(`- **Task**: ${msg}`);
        }
    });

    // Build the new daily entry
    let newEntry = `\n## [${today}]\n\n`;

    if (issues.length > 0) {
        newEntry += `### 1. Issues Reported / Fixed\n${issues.join('\n')}\n\n`;
    }
    if (modifications.length > 0) {
        newEntry += `### 2. Modification Requests\n${modifications.join('\n')}\n\n`;
    }
    if (features.length > 0) {
        newEntry += `### 3. Features Implemented\n${features.join('\n')}\n\n`;
    }

    let currentTracker = '';
    if (fs.existsSync(trackerPath)) {
        currentTracker = fs.readFileSync(trackerPath, 'utf8');
    } else {
        currentTracker = '# Development Tracker\nThis file is for local development tracking only. It is not committed to the repository.\n';
    }

    // Checking if today is already present so we don't accidentally duplicate
    if (currentTracker.includes(`## [${today}]`)) {
        console.log('Dev tracker for today has already been updated. Aborting to avoid duplicates.');
        process.exit(0);
    }

    // Insert the new entry right after the introduction paragraph, before older entries
    const firstSectionIndex = currentTracker.indexOf('\n## ');

    let updatedTracker;
    if (firstSectionIndex !== -1) {
        updatedTracker = currentTracker.slice(0, firstSectionIndex) + newEntry + currentTracker.slice(firstSectionIndex);
    } else {
        updatedTracker = currentTracker + newEntry;
    }

    fs.writeFileSync(trackerPath, updatedTracker);
    console.log('✅ Successfully updated dev_tracker.md!');

} catch (error) {
    if (error.stdout && !error.stdout.toString().trim()) {
        console.log('No git commits found today, or not a git repository yet.');
    } else {
        console.error("Failed to generate dev tracker update:", error.message);
    }
}
