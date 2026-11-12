import { execFileSync } from 'node:child_process';

// Run git without a shell; large buffer for big diffs.
export const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

export const tryGit = (args, cwd) => {
  try { return git(args, cwd).trim(); } catch { return null; }
};
