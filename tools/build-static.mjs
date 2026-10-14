import { promises as fs } from 'node:fs';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { transform } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const PROGRAM_ROOT = path.join(ROOT, 'public', 'Program');
const BUILD_ROOT = path.join(ROOT, '.platform-build');
const ASSET_DIR = 'assets';
const HASH_LENGTH = 10;

const args = new Set(process.argv.slice(2));

const FRONTENDS = [
  { key: 'general', mount: '/', source: path.join(PROGRAM_ROOT, 'General', 'frontend') },
  { key: 'weapons', mount: '/weapons', source: path.join(PROGRAM_ROOT, 'Weapons', 'frontend') },
  { key: 'renewal', mount: '/renewal', source: path.join(PROGRAM_ROOT, 'Renewal', 'frontend') },
  { key: 'report', mount: '/report', source: path.join(PROGRAM_ROOT, 'Report', 'public') },
  { key: 'request', mount: '/request', source: path.join(PROGRAM_ROOT, 'Request', 'frontend') },
  { key: 'accept', mount: '/accept', source: path.join(PROGRAM_ROOT, 'Accept', 'frontend') },
  { key: 'seized', mount: '/seized', source: path.join(PROGRAM_ROOT, 'Seized', 'Frontend') },
  { key: 'storage', mount: '/storage', source: path.join(PROGRAM_ROOT, 'Storage', 'frontend') },
  { key: 'company', mount: '/company', source: path.join(PROGRAM_ROOT, 'Company', 'Frontend') }
];

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'tmp',
  'logs',
  'backend',
  'data',
  'quarantine',
  'transactions',
  'purge-staging',
  'backup',
  'DoNotTouchCopilot'
]);

const DYNAMIC_ROOT_SCRIPTS = new Set(['/reference-runtime.js', '/reference-data.js']);
const STATIC_SKIP_EXTENSIONS = new Set(['.zip', '.7z', '.rar']);

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

function trimLeadingSlash(value) {
  return String(value || '').replace(/^\/+/, '');
}

function stripQuery(value) {
  return String(value || '').split('#')[0].split('?')[0];
}

function isExternalUrl(value) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(value)
    || /^data:/i.test(value)
    || /^mailto:/i.test(value)
    || /^tel:/i.test(value);
}

function splitUrlSuffix(value) {
  const text = String(value || '');
  const index = text.search(/[?#]/);
  if (index < 0) return { clean: text, suffix: '' };
  return { clean: text.slice(0, index), suffix: text.slice(index) };
}

function rewriteCssAssetUrls(css, sourceRelativePath, outputRelativePath) {
  const sourceDir = toPosix(path.dirname(sourceRelativePath));
  const outputDir = toPosix(path.dirname(outputRelativePath));
  const normalizedSourceDir = sourceDir === '.' ? '' : sourceDir;
  const normalizedOutputDir = outputDir === '.' ? '' : outputDir;
  const localUrlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

  return String(css || '').replace(localUrlPattern, (match, quote, rawUrl) => {
    const value = String(rawUrl || '').trim();
    if (
      !value
      || value.startsWith('#')
      || value.startsWith('/')
      || value.startsWith('var(')
      || isExternalUrl(value)
    ) {
      return match;
    }

    const { clean, suffix } = splitUrlSuffix(value);
    const targetRelative = toPosix(path.posix.normalize(path.posix.join(normalizedSourceDir || '.', clean)));
    if (!targetRelative || targetRelative.startsWith('..')) {
      return match;
    }

    let rewritten = toPosix(path.posix.relative(normalizedOutputDir || '.', targetRelative));
    if (!rewritten || rewritten === '.') {
      rewritten = path.posix.basename(targetRelative);
    }
    return `url(${quote || ''}${rewritten}${suffix}${quote || ''})`;
  });
}

function hashContent(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex').slice(0, HASH_LENGTH);
}

function cacheUrlFor(frontend, assetRelativePath) {
  const clean = toPosix(assetRelativePath).replace(/^\/+/, '');
  if (frontend.mount === '/') return `/${clean}`;
  return `${frontend.mount}/${clean}`;
}

function outputDirFor(frontend) {
  return path.join(BUILD_ROOT, frontend.key);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function walkFiles(dir) {
  const out = [];
  async function visit(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || ['data', 'uploads', 'backups', 'backup', 'photos', 'certs', '.demo-data'].includes(entry.name.toLowerCase())) continue;
        await visit(path.join(current, entry.name));
        continue;
      }
      if (entry.isFile() && ['.js', '.css', '.html'].includes(path.extname(entry.name).toLowerCase())) out.push(path.join(current, entry.name));
    }
  }
  await visit(dir);
  return out;
}

async function gzipFile(filePath, contents) {
  if (!/\.(?:js|css)$/i.test(filePath)) return;
  await fs.writeFile(`${filePath}.gz`, zlib.gzipSync(contents, { level: 9 }));
}

async function buildCodeAsset(frontend, sourceFile, sourceRoot, manifest) {
  const ext = path.extname(sourceFile).toLowerCase();
  const relative = toPosix(path.relative(sourceRoot, sourceFile));
  const parsed = path.parse(relative);
  const loader = ext === '.css' ? 'css' : 'js';
  const source = await fs.readFile(sourceFile, 'utf8');
  const result = await transform(source, {
    loader,
    minify: loader === 'css',
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: loader === 'css',
    charset: 'utf8',
    legalComments: 'none',
    target: ['es2018']
  });
  const outputDirRelative = toPosix(path.join(ASSET_DIR, parsed.dir));
  const preliminaryOutputRelative = toPosix(path.join(
    outputDirRelative,
    `${parsed.name}${ext}`
  ));
  const sourceCssContent = result.code;
  const code = ext === '.css'
    ? rewriteCssAssetUrls(result.code, relative, preliminaryOutputRelative)
    : result.code;
  const contents = Buffer.from(code, 'utf8');
  const hash = hashContent(contents);
  const assetRelative = toPosix(path.join(
    ASSET_DIR,
    parsed.dir,
    `${parsed.name}.${hash}${ext}`
  ));
  const outputPath = path.join(outputDirFor(frontend), assetRelative);
  await ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, contents);
  await gzipFile(outputPath, contents);

  const publicUrl = cacheUrlFor(frontend, assetRelative);
  manifest.assets[`${frontend.key}:${relative}`] = {
    source: relative,
    output: assetRelative,
    url: publicUrl,
    bytes: contents.length
  };
  return {
    relative,
    output: assetRelative,
    url: publicUrl,
    cssContent: ext === '.css'
      ? { code: sourceCssContent, sourceRelative: relative, frontendKey: frontend.key }
      : null
  };
}

async function copyStaticFile(frontend, sourceFile, sourceRoot, manifest) {
  const relative = toPosix(path.relative(sourceRoot, sourceFile));
  const outputPath = path.join(outputDirFor(frontend), relative);
  await ensureDir(path.dirname(outputPath));
  await fs.copyFile(sourceFile, outputPath);
  manifest.files[`${frontend.key}:${relative}`] = {
    source: relative,
    output: relative,
    url: cacheUrlFor(frontend, relative)
  };
}

function normalizeRelativeReference(htmlRelativePath, rawUrl) {
  const clean = stripQuery(rawUrl);
  if (!clean || isExternalUrl(clean) || clean.startsWith('#')) return null;
  if (clean.startsWith('/')) return trimLeadingSlash(clean);
  const htmlDir = toPosix(path.dirname(htmlRelativePath));
  return toPosix(path.normalize(path.join(htmlDir === '.' ? '' : htmlDir, clean)));
}

function findAssetUrl(frontend, htmlRelativePath, rawUrl, localAssetMap, rootAssetMap) {
  const clean = stripQuery(rawUrl);
  if (!clean || isExternalUrl(clean) || clean.startsWith('#')) return null;
  if (DYNAMIC_ROOT_SCRIPTS.has(clean)) return clean;

  if (clean.startsWith('/')) {
    const rootRelative = trimLeadingSlash(clean);
    if (frontend.mount === '/' && localAssetMap.has(rootRelative)) {
      return localAssetMap.get(rootRelative);
    }
    return rootAssetMap.get(rootRelative) || null;
  }

  const relative = normalizeRelativeReference(htmlRelativePath, clean);
  if (!relative) return null;
  return localAssetMap.get(relative) || null;
}

function collapseReferenceRuntimeScripts(html) {
  return html
    .replace(/\s*<script\b([^>]*?)\bsrc=["']\/reference-data\.js["']([^>]*)><\/script>\s*<script\b([^>]*?)\bsrc=["']\/shared-reference-data\.js["']([^>]*)><\/script>/gi, '\n  <script src="/reference-runtime.js" defer></script>\n')
    .replace(/\s*<script\b([^>]*?)\bsrc=["']\/shared-reference-data\.js["']([^>]*)><\/script>/gi, '');
}

function addAssetMapEntry(map, key, url, options = {}) {
  const cleanKey = toPosix(key).replace(/^\/+/, '');
  const includeAbsolute = options.includeAbsolute !== false;
  if (!cleanKey || !url) return;
  map[cleanKey] = url;
  if (includeAbsolute) {
    map[`/${cleanKey}`] = url;
  }
}

function buildPlatformAssetUrlMap(frontend, localAssetMap, rootAssetMap) {
  const map = {};
  for (const [relative, url] of rootAssetMap.entries()) {
    addAssetMapEntry(map, relative, url);
  }
  for (const [relative, url] of localAssetMap.entries()) {
    addAssetMapEntry(map, relative, url, { includeAbsolute: frontend.mount === '/' });
    if (frontend.mount !== '/') {
      addAssetMapEntry(map, `${frontend.mount}/${relative}`, url);
    }
  }
  return map;
}

function escapeScriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function buildPlatformAssetRuntime(assetMap) {
  if (!assetMap || !Object.keys(assetMap).length) return '';
  return `<script>(function(){var incoming=${escapeScriptJson(assetMap)};var target=window.__PLATFORM_ASSET_URLS__=Object.assign(window.__PLATFORM_ASSET_URLS__||{},incoming);if(!window.resolvePlatformAsset){window.resolvePlatformAsset=function(src){if(!src)return src;var raw=String(src);if(/^(?:[a-z][a-z0-9+.-]*:)?\\/\\//i.test(raw)||/^data:/i.test(raw))return raw;var splitIndex=raw.search(/[?#]/);var clean=splitIndex>=0?raw.slice(0,splitIndex):raw;var suffix=splitIndex>=0?raw.slice(splitIndex):'';var bare=clean.replace(/^\\/+/, '');var mapped=target[clean]||target[bare]||target['/'+bare];return mapped?mapped+suffix:raw;};}})();</script>`;
}

function injectPlatformAssetRuntime(html, assetMap) {
  const runtime = buildPlatformAssetRuntime(assetMap);
  if (!runtime) return html;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (match) => `${match}\n  ${runtime}`);
  }
  return `${runtime}\n${html}`;
}

async function buildHtml(frontend, sourceFile, sourceRoot, localAssetMap, rootAssetMap, manifest, cssContentMap = new Map()) {
  const relative = toPosix(path.relative(sourceRoot, sourceFile));
  const source = injectPlatformAssetRuntime(
    collapseReferenceRuntimeScripts(await fs.readFile(sourceFile, 'utf8')),
    buildPlatformAssetUrlMap(frontend, localAssetMap, rootAssetMap)
  );
  const root = parse(source, {
    blockTextElements: {
      script: true,
      noscript: true,
      style: true,
      pre: true
    }
  });

  root.querySelectorAll('script[src]').forEach((node) => {
    const src = node.getAttribute('src');
    const nextUrl = findAssetUrl(frontend, relative, src, localAssetMap, rootAssetMap);
    if (nextUrl) node.setAttribute('src', nextUrl);
    if (!node.hasAttribute('async') && !node.getAttribute('type')) {
      node.setAttribute('defer', '');
    }
  });

  root.querySelectorAll('link[href]').forEach((node) => {
    const rel = String(node.getAttribute('rel') || '').toLowerCase();
    if (!rel.split(/\s+/).includes('stylesheet')) return;
    const href = node.getAttribute('href');
    const nextUrl = findAssetUrl(frontend, relative, href, localAssetMap, rootAssetMap);
    if (!nextUrl) return;
    const inlineCss = cssContentMap.get(nextUrl);
    if (inlineCss != null && inlineCss.frontendKey === frontend.key) {
      const htmlRelativePath = relative;
      const css = rewriteCssAssetUrls(inlineCss.code, inlineCss.sourceRelative, htmlRelativePath);
      node.replaceWith(`<style>${css}</style>`);
    } else {
      node.setAttribute('href', nextUrl);
    }
  });

  const outputPath = path.join(outputDirFor(frontend), relative);
  await ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, root.toString(), 'utf8');
  manifest.html[`${frontend.key}:${relative}`] = {
    source: relative,
    output: relative,
    url: cacheUrlFor(frontend, relative)
  };
}

async function buildFrontend(frontend, rootAssetMap, manifest, rootCssContentMap = new Map()) {
  const sourceRoot = frontend.source;
  if (!fsSync.existsSync(sourceRoot)) {
    console.warn(`Skipping missing frontend: ${frontend.key}`);
    return { localAssetMap: new Map(), cssContentMap: new Map() };
  }

  const files = await walkFiles(sourceRoot);
  const localAssetMap = new Map();
  const cssContentMap = new Map(rootCssContentMap);
  const htmlFiles = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (STATIC_SKIP_EXTENSIONS.has(ext)) {
      continue;
    }
    if (ext === '.html') {
      htmlFiles.push(file);
      continue;
    }
    if (ext === '.js' || ext === '.css') {
      const built = await buildCodeAsset(frontend, file, sourceRoot, manifest);
      localAssetMap.set(built.relative, built.url);
      if (built.cssContent != null) cssContentMap.set(built.url, built.cssContent);
      continue;
    }
    await copyStaticFile(frontend, file, sourceRoot, manifest);
  }

  for (const htmlFile of htmlFiles) {
    await buildHtml(frontend, htmlFile, sourceRoot, localAssetMap, rootAssetMap, manifest, cssContentMap);
  }

  return { localAssetMap, cssContentMap };
}

function mountForUrl(urlPath) {
  const clean = stripQuery(urlPath);
  const candidates = FRONTENDS
    .filter((frontend) => frontend.mount !== '/' && (clean === frontend.mount || clean.startsWith(`${frontend.mount}/`)))
    .sort((a, b) => b.mount.length - a.mount.length);
  return candidates[0] || FRONTENDS.find((frontend) => frontend.key === 'general');
}

function filePathForBuiltUrl(urlPath, htmlDir) {
  if (!urlPath || isExternalUrl(urlPath) || urlPath.startsWith('#')) return null;
  const clean = stripQuery(urlPath);
  if (DYNAMIC_ROOT_SCRIPTS.has(clean)) return null;
  if (clean.startsWith('/')) {
    const frontend = mountForUrl(clean);
    if (!frontend) return null;
    const relative = frontend.mount === '/'
      ? trimLeadingSlash(clean)
      : trimLeadingSlash(clean.slice(frontend.mount.length));
    return path.join(outputDirFor(frontend), relative);
  }
  return path.resolve(htmlDir, clean);
}

async function checkBuild() {
  const manifestPath = path.join(BUILD_ROOT, 'manifest.json');
  if (!fsSync.existsSync(manifestPath)) {
    throw new Error('Build manifest not found. Run npm run build first.');
  }
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const missing = [];
  void manifest;

  for (const frontend of FRONTENDS) {
    const outDir = outputDirFor(frontend);
    if (!fsSync.existsSync(outDir)) continue;
    const htmlFiles = (await walkFiles(outDir)).filter((file) => path.extname(file).toLowerCase() === '.html');
    for (const htmlFile of htmlFiles) {
      const root = parse(await fs.readFile(htmlFile, 'utf8'));
      const htmlDir = path.dirname(htmlFile);
      const refs = [
        ...root.querySelectorAll('script[src]').map((node) => node.getAttribute('src')),
        ...root.querySelectorAll('link[href]')
          .filter((node) => String(node.getAttribute('rel') || '').toLowerCase().split(/\s+/).includes('stylesheet'))
          .map((node) => node.getAttribute('href'))
      ];
      for (const ref of refs) {
        const refPath = filePathForBuiltUrl(ref, htmlDir);
        if (refPath && !fsSync.existsSync(refPath)) {
          missing.push(`${path.relative(ROOT, htmlFile)} -> ${ref}`);
        }
      }
    }
  }
  if (missing.length) {
    throw new Error(`Missing built references:\n${missing.join('\n')}`);
  }
  console.log(`Build check OK: ${Object.keys(manifest.html || {}).length} HTML files verified.`);
}

async function cleanBuild() {
  await fs.rm(BUILD_ROOT, { recursive: true, force: true });
}

// Matches <script src="...js" ...></script> — only used by bundleHtmlScripts
const LOCAL_SCRIPT_RE = /<script\b[^>]*?\bsrc=(["'])([^"']+\.js)\1[^>]*><\/script>/gi;

async function bundleHtmlScripts(frontend, manifest) {
  const outDir = outputDirFor(frontend);
  if (!fsSync.existsSync(outDir)) return;

  const htmlFiles = (await walkFiles(outDir)).filter((f) => path.extname(f).toLowerCase() === '.html');

  for (const htmlFile of htmlFiles) {
    let html = await fs.readFile(htmlFile, 'utf8');
    const htmlDir = path.dirname(htmlFile);

    // Collect consecutive local deferred JS script groups in source order.
    // Dynamic runtime scripts must stay between groups because app code can depend
    // on globals they define, especially /reference-runtime.js.
    const scriptGroups = [];
    let currentGroup = [];
    const flushGroup = () => {
      if (currentGroup.length) {
        scriptGroups.push(currentGroup);
        currentGroup = [];
      }
    };

    LOCAL_SCRIPT_RE.lastIndex = 0;
    let m;
    while ((m = LOCAL_SCRIPT_RE.exec(html)) !== null) {
      const src = m[2];
      const clean = stripQuery(src);
      if (DYNAMIC_ROOT_SCRIPTS.has(clean) || isExternalUrl(clean)) {
        flushGroup();
        continue;
      }
      const filePath = filePathForBuiltUrl(clean, htmlDir);
      if (!filePath || !fsSync.existsSync(filePath)) {
        flushGroup();
        continue;
      }
      currentGroup.push({ tag: m[0], filePath });
    }
    flushGroup();

    const bundleGroups = scriptGroups.filter((group) => group.length > 1);
    if (!bundleGroups.length) continue;

    for (const localScripts of bundleGroups) {
      // Concatenate each consecutive group in HTML order.
      const parts = [];
      for (const s of localScripts) {
        parts.push(await fs.readFile(s.filePath, 'utf8'));
      }

      const bundleContent = Buffer.from(parts.join(';\n'), 'utf8');
      const bundleHash = hashContent(bundleContent);
      const bundleRelPath = toPosix(path.join(ASSET_DIR, `bundle.${bundleHash}.js`));
      const bundleFilePath = path.join(outDir, bundleRelPath);

      await ensureDir(path.dirname(bundleFilePath));
      await fs.writeFile(bundleFilePath, bundleContent);
      await gzipFile(bundleFilePath, bundleContent);

      const bundleUrl = cacheUrlFor(frontend, bundleRelPath);

      // Replace first script in this consecutive group with the bundle tag, remove the rest.
      let first = true;
      for (const s of localScripts) {
        const replacement = first ? `<script src="${bundleUrl}" defer></script>` : '';
        html = html.split(s.tag).join(replacement);
        first = false;
      }

      manifest.assets[`${frontend.key}:${bundleRelPath}`] = {
        source: bundleRelPath,
        output: bundleRelPath,
        url: bundleUrl,
        bytes: bundleContent.length,
        bundled: localScripts.length
      };
    }

    await fs.writeFile(htmlFile, html, 'utf8');
  }
}

async function build() {
  await cleanBuild();
  await ensureDir(BUILD_ROOT);

  const manifest = {
    generatedAt: new Date().toISOString(),
    buildRoot: '.platform-build',
    frontends: FRONTENDS.map(({ key, mount, source }) => ({ key, mount, source: path.relative(ROOT, source) })),
    assets: {},
    files: {},
    html: {}
  };

  const rootFrontend = FRONTENDS.find((frontend) => frontend.key === 'general');
  const { localAssetMap: rootAssetMap, cssContentMap: rootCssContentMap } = await buildFrontend(rootFrontend, new Map(), manifest);
  await bundleHtmlScripts(rootFrontend, manifest);
  for (const frontend of FRONTENDS.filter((entry) => entry.key !== 'general')) {
    await buildFrontend(frontend, rootAssetMap, manifest, rootCssContentMap);
    await bundleHtmlScripts(frontend, manifest);
  }

  await fs.writeFile(path.join(BUILD_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Built ${Object.keys(manifest.assets).length} optimized assets and ${Object.keys(manifest.html).length} HTML files.`);
}

try {
  if (args.has('--clean')) {
    await cleanBuild();
    console.log('Removed .platform-build.');
  } else if (args.has('--check')) {
    await checkBuild();
  } else {
    await build();
  }
} catch (error) {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
}
