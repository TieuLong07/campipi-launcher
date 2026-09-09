/**
 * Forge command builder: uses @xmcl/core to generate the exact java argv
 * for Minecraft Forge 1.20.1-47.4.10.
 *
 * WHY XMCL: Hand-building JVM args for Forge 1.20.1 is error-prone due to
 * complex module system interactions (--add-modules, -DignoreList, -p, -cp).
 * XMCL has already solved all these edge cases. We delegate entirely to
 * XMCL's generateArguments() and only handle env vars + process spawn.
 *
 * PURE: no side effects, no I/O except reading version JSON for validation.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface BuildOptions {
  runtimeRoot: string;
  version: string;
  javaPath: string;
  username: string;
  uuid: string;
  accessToken: string;
  xmxMb: number;
  xmsMb: number;
  userType: 'offline' | 'microsoft' | 'azauth';
  gameDir?: string;
  extraJvmArgs?: string[];
  extraGameArgs?: string[];
  demo?: boolean;
}

export interface BuiltCommand {
  argv: string[];
  env: Record<string, string>;
  cwd: string;
  mainClass: string;
  nativesDir: string;
  cpJars: string[];
  launcherVersion: string;
}

const LAUNCHER_VERSION = '0.1.0';

/**
 * Build the full launch command for Forge 1.20.1.
 *
 * Returns { argv, env, cwd, mainClass, nativesDir, cpJars }.
 * Caller spawns: `spawn(argv[0], argv.slice(1), { env, cwd, ... })`.
 */
/**
 * Fallback command builder when XMCL fails
 * Builds Forge 1.20.1 launch command manually
 */
function buildFallbackCommand(opts: BuildOptions, runtimeRoot: string, versionId: string): string[] {
  const javaPath = opts.javaPath || 'java';
  const gameDir = opts.gameDir || runtimeRoot;
  const cpSep = process.platform === 'win32' ? ';' : ':';
  
  // Read version JSON
  const verJsonPath = join(runtimeRoot, 'versions', versionId, `${versionId}.json`);
  const verJson = JSON.parse(require('node:fs').readFileSync(verJsonPath, 'utf-8'));
  
  // Forge 1.20.1 uses argument-based classpath in arguments.jvm
  // Parse ${library_directory}/... patterns
  const libraryDir = join(runtimeRoot, 'libraries');
  let classpathJars: string[] = [];
  
  if (verJson.arguments?.jvm) {
    for (const arg of verJson.arguments.jvm) {
      if (typeof arg === 'string' && arg.includes('${library_directory}')) {
        // Parse classpath string: ${library_directory}/cpw/mods/bootstraplauncher/1.1.2/bootstraplauncher-1.1.2.jar${classpath_separator}...
        const parts = arg.split('${classpath_separator}');
        for (const part of parts) {
          const cleaned = part.replace(/\$\{library_directory\}/g, libraryDir)
            .replace(/\$\{version_name\}/g, versionId)
            .trim();
          if (cleaned.endsWith('.jar') && existsSync(cleaned)) {
            classpathJars.push(cleaned);
          }
        }
        break; // Found the classpath argument
      }
    }
  }
  
  // Fallback: parse libraries array if no argument-based classpath
  if (classpathJars.length === 0 && verJson.libraries) {
    for (const lib of verJson.libraries) {
      if (lib.name) {
        const parts = lib.name.split(':');
        if (parts.length >= 3) {
          const [group, artifact, version] = parts;
          const groupPath = group.replace(/\./g, '/');
          const jarName = `${artifact}-${version}.jar`;
          const jarPath = join(libraryDir, groupPath, artifact, version, jarName);
          if (existsSync(jarPath)) classpathJars.push(jarPath);
        }
      }
    }
  }
  
  // Add Forge client jar
  const forgeJar = join(runtimeRoot, 'versions', versionId, `${versionId}.jar`);
  if (existsSync(forgeJar)) classpathJars.push(forgeJar);
  
  const classpath = classpathJars.join(cpSep);
  
  // Build JVM args
  const jvmArgs = [
    javaPath,
    `-Xmx${opts.xmxMb || 4096}M`,
    `-Xms${opts.xmsMb || 1024}M`,
    `-Djava.library.path=${join(runtimeRoot, 'versions', versionId, 'natives')}`,
    `-cp`, classpath,
    verJson.mainClass || 'cpw.mods.bootstraplauncher.BootstrapLauncher',
  ];
  
  // Game args
  const gameArgs = [
    '--username', opts.username || 'Player',
    '--version', versionId,
    '--gameDir', gameDir,
    '--assetsDir', join(runtimeRoot, 'assets'),
    '--assetIndex', verJson.assetIndex?.id || 'unknown',
    '--uuid', opts.uuid || '0',
    '--accessToken', opts.accessToken || '0',
    '--userType', opts.userType === 'offline' ? 'legacy' : 'mojang',
    '--versionType', 'MCPubg',
    '--width', '854',
    '--height', '480',
  ];
  
  return [...jvmArgs, ...gameArgs];
}

export async function buildForgeCommand(opts: BuildOptions): Promise<BuiltCommand> {
  const runtimeRoot = opts.runtimeRoot.replace(/\\/g, '/');
  const versionId = opts.version; // e.g. '1.20.1-forge-47.4.10'

  // Validate version JSON exists
  const verJsonPath = join(runtimeRoot, 'versions', versionId, `${versionId}.json`);
  if (!existsSync(verJsonPath)) {
    throw new Error(`Version JSON not found: ${verJsonPath}`);
  }
  const verJson = JSON.parse(require('node:fs').readFileSync(verJsonPath, 'utf-8'));

  // Use XMCL to generate args (handles all JVM module edge cases)
  // Dynamic import to avoid bundling issues
  let argv: string[] = [];
  try {
    const { Version, generateArguments } = await import('@xmcl/core');
    const version = await Version.parse(runtimeRoot, versionId);
    const xmclArgs = await generateArguments({
      version,
      gamePath: opts.gameDir || runtimeRoot,
      resourcePath: runtimeRoot,
      javaPath: opts.javaPath,
      launcherName: 'MCPubg',
      launcherBrand: LAUNCHER_VERSION,
      features: {},
      demo: opts.demo ?? false,
      accessToken: opts.accessToken || '0',
      userType: opts.userType === 'offline' ? 'legacy' : 'mojang',
      maxMemory: opts.xmxMb,
      minMemory: opts.xmsMb,
      gameProfile: {
        name: opts.username,
        id: opts.uuid,
      },
    });
    argv = [...xmclArgs];
  } catch (xmclErr) {
    console.error('[ForgeCommand] XMCL failed, using fallback:', xmclErr);
    // Fallback: build command manually
    argv = buildFallbackCommand(opts, runtimeRoot, versionId);
  }

  // Extra user-supplied JVM args
  if (opts.extraJvmArgs?.length) argv.push(...opts.extraJvmArgs);

  // Extra game args
  if (opts.extraGameArgs?.length) {
    // Find the main class index and insert game args before it
    const mainClassIdx = argv.findIndex(a => a.includes('BootstrapLauncher') || a.includes('net.minecraft'));
    if (mainClassIdx >= 0) {
      argv.splice(mainClassIdx, 0, ...opts.extraGameArgs);
    } else {
      argv.push(...opts.extraGameArgs);
    }
  }

  // Extract info for caller
  const cpSep = process.platform === 'win32' ? ';' : ':';
  const cpIdx = argv.indexOf('-cp');
  const cpJars = cpIdx >= 0 ? argv[cpIdx + 1].split(cpSep) : [];
  const mainClass = verJson.mainClass || 'cpw.mods.bootstraplauncher.BootstrapLauncher';
  const nativesDir = join(runtimeRoot, 'versions', versionId, 'natives');

  // Environment
  const env: Record<string, string> = {
    PATH: process.env.PATH || '',
    APPDATA: process.env.APPDATA || '',
    USERPROFILE: process.env.USERPROFILE || '',
    JAVA_TOOL_OPTIONS: '',  // Clear to prevent interference
  };

  return {
    argv,
    env,
    cwd: opts.gameDir || runtimeRoot,
    mainClass,
    nativesDir,
    cpJars,
    launcherVersion: LAUNCHER_VERSION,
  };
}
