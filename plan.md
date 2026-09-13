1. *Write a bash script to generate `DEEP_AUDIT_REPORT.md`.*
   - The script will use `grep` and `find` to scan the codebase for specific patterns corresponding to the 4 pillars of the audit.
   - It will format the output as a Markdown file with sections for each pillar.
   - Pillar 1 (TypeScript): search for ` any`, `@ts-ignore`, dead code (heuristic), DRY (heuristic).
   - Pillar 2 (React Logic): search for missing dependencies in hooks (heuristic), missing try/catch in fetch/IPC, prop drilling (heuristic).
   - Pillar 3 (Electron & IPC): search for missing `removeListener`, unsafe preload patterns.
   - Pillar 4 (SQLite): search for N+1 queries (loops containing `db.prepare`), missing indices.
   - I will provide detailed explanations and code snippets for a subset of critical findings to meet the prompt requirements.

2. *Run the script and generate the report.*
   - The report will be saved to the absolute root of the project as `DEEP_AUDIT_REPORT.md`.

3. *Review the generated report.*
   - Ensure the report is comprehensive, incisive, and provides actionable code snippets.
   - Manually add a few highly detailed examples if the automated script output is too generic.

4. *Complete pre commit steps.*
   - Ensure proper testing, verification, review, and reflection are done by calling pre_commit_instructions.

5. *Submit the changes.*
   - The only modified file will be `DEEP_AUDIT_REPORT.md`.
