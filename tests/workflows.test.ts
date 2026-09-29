import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('GitHub Actions Workflow Linter & Local Pre-flight Verification', async (t) => {
  const workflowsDir = path.resolve(process.cwd(), '.github/workflows');
  assert.ok(fs.existsSync(workflowsDir), '.github/workflows directory must exist');

  const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  assert.ok(files.length > 0, 'Must have at least one workflow defined');

  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const availableScripts = Object.keys(pkg.scripts || {});

  for (const file of files) {
    const filePath = path.join(workflowsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    await t.test(`Workflow syntax and semantics: ${file}`, () => {
      // 1. Basic structure
      assert.ok(content.includes('name:'), `${file} must define a name`);
      assert.ok(content.includes('on:'), `${file} must define triggers (on:)`);
      assert.ok(content.includes('jobs:'), `${file} must define jobs:`);

      // 2. Secret safety: Ensure secrets context is NEVER referenced in a job-level 'if:'
      // Regex detects: 'if:' on a line, followed by 'secrets.' before any 'steps:' block or next job
      const lines = content.split('\n');
      let inJobLevel = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s{2}[a-zA-Z0-9_-]+:\s*$/.test(line) && !line.includes('jobs:')) {
          inJobLevel = true;
        }
        if (/^\s{4}steps:\s*$/.test(line)) {
          inJobLevel = false;
        }
        if (inJobLevel && /^\s{4}if:/.test(line)) {
          // Check subsequent lines until next key
          let ifBlock = line;
          let j = i + 1;
          while (j < lines.length && /^\s{6,}/.test(lines[j])) {
            ifBlock += '\n' + lines[j];
            j++;
          }
          assert.ok(
            !ifBlock.includes('secrets.'),
            `Forbidden secret reference in job-level 'if' in ${file} around line ${i + 1}. Secrets cannot be accessed in job-level 'if' conditions.`
          );
        }
      }

      // 3. Action references: Every 'uses:' must be properly formatted: owner/repo@tag
      const usesMatches = content.matchAll(/uses:\s*([^\s#]+)/g);
      for (const m of usesMatches) {
        const actionRef = m[1];
        if (actionRef.startsWith('./') || actionRef.startsWith('docker://')) continue;

        assert.ok(
          actionRef.includes('@'),
          `Action reference '${actionRef}' in ${file} must include a pinned tag or version (@)`
        );

        const [repoPath, tag] = actionRef.split('@');
        const parts = repoPath.split('/');
        assert.ok(
          parts.length >= 2,
          `Action reference '${actionRef}' in ${file} must be in owner/repo format`
        );
        assert.ok(
          tag && tag.length > 0,
          `Action reference '${actionRef}' in ${file} has an empty tag`
        );
      }

      // 4. Script references: Verify any 'npm run <script>' exists in package.json
      const npmRunMatches = content.matchAll(/npm\s+run\s+([a-zA-Z0-9:_-]+)/g);
      for (const m of npmRunMatches) {
        const scriptName = m[1];
        assert.ok(
          availableScripts.includes(scriptName),
          `Workflow ${file} executes 'npm run ${scriptName}', but '${scriptName}' is not defined in package.json scripts!`
        );
      }
    });
  }

  await t.test('Workflow concurrency configuration', () => {
    // Both build.yml and qc.yml should have concurrency configured to avoid wasting runners
    for (const f of ['build.yml', 'qc.yml']) {
      const p = path.join(workflowsDir, f);
      if (fs.existsSync(p)) {
        const text = fs.readFileSync(p, 'utf8');
        assert.ok(text.includes('concurrency:'), `${f} must configure concurrency`);
        assert.ok(text.includes('cancel-in-progress: true'), `${f} must configure cancel-in-progress to terminate redundant runs`);
      }
    }
  });
});
