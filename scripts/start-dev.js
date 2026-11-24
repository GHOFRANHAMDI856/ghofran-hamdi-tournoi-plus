import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [
  spawn(npmCommand, ['run', 'start'], {
    cwd: 'backend',
    stdio: 'inherit',
  }),
  spawn(npmCommand, ['start'], {
    cwd: 'frontend',
    stdio: 'inherit',
  }),
];

function stopAll() {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(130);
});

process.on('SIGTERM', () => {
  stopAll();
  process.exit(143);
});

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (!signal && code !== 0) {
      stopAll();
      process.exitCode = code ?? 1;
    }
  });
}
