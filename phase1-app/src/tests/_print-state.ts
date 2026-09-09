/**
 * Helper for instance-adapter integration tests.
 * Reads the runtime + Java from env, runs readState(), prints the JSON
 * to stdout. The test process parses this stdout.
 */
import { readState } from '../main/instance-adapter';

const runtime = process.env.MCPUBG_RUNTIME;
const java = process.env.MCPUBG_JAVA;
if (!runtime || !java) {
  console.error('MCPUBG_RUNTIME and MCPUBG_JAVA must be set');
  process.exit(1);
}

const state = readState(runtime, java, '17.0.20');
process.stdout.write(JSON.stringify(state));
