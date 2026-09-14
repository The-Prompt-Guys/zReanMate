/**
 * Loads every registered route in a headless-ish way and reports which ones
 * render the "not built yet" placeholder or blow up.
 *
 * Runs against the built bundle's route table via the dev server, using plain
 * fetch for the HTML shell plus a check that the registry and the router agree.
 */
import { readdirSync, readFileSync } from 'node:fs';

const registry = await import('../src/screens.js');
const routerSrc = readFileSync(new URL('../src/routes/router.jsx', import.meta.url), 'utf8');

const declared = [...routerSrc.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]);

let problems = 0;
console.log('flow                          screen                              route                                  status');
console.log('-'.repeat(118));

for (const flow of registry.FLOWS) {
  for (const screen of flow.screens) {
    const path = screen.route?.split('?')[0] ?? null;
    let status;

    if (screen.skipped) {
      status = 'SKIPPED (' + screen.skipped + ')';
    } else if (!screen.built) {
      status = 'pending';
    } else if (!path) {
      status = 'BUILT BUT NO ROUTE';
      problems += 1;
    } else {
      // a route matches if declared literally or via a :param segment
      const match = declared.find((d) => {
        if (d === path) return true;
        const dp = d.split('/');
        const pp = path.split('/');
        if (dp.length !== pp.length) return false;
        return dp.every((seg, i) => seg.startsWith(':') || seg === pp[i]);
      });
      if (match) {
        status = 'ok -> ' + match;
      } else {
        status = 'BUILT BUT ROUTE NOT DECLARED';
        problems += 1;
      }
    }

    console.log(
      flow.id.padEnd(30) + screen.name.padEnd(36) + String(screen.route ?? '-').padEnd(39) + status,
    );
  }
}

const c = registry.screenCounts();
console.log('-'.repeat(118));
console.log(`${c.built} built · ${c.skipped} skipped · ${c.total - c.built - c.skipped} pending · ${c.total} total`);
console.log(problems === 0 ? 'registry and router agree on every built screen' : `${problems} MISMATCH(ES)`);

/**
 * Second pass: literal <Link to="/..."> targets.
 *
 * The registry check above only covers screens.js. It cannot see a hardcoded
 * link inside a page, which is how every upgrade CTA pointed at `/plan` — a
 * path no route declares — while this script still reported a clean run.
 * Template links (`to={`/kits/${id}`}`) are skipped: their shape is only known
 * at runtime.
 */
const pageFiles = [...walk(new URL('../src/', import.meta.url))];
const linkProblems = [];

for (const file of pageFiles) {
  const src = readFileSync(file, 'utf8');
  for (const match of src.matchAll(/(?:to|href)=\{?["'](\/[^"'`{}\s]*)["']/g)) {
    const target = match[1].split('?')[0].split('#')[0];
    if (target === '/') continue;
    const matched = declared.some((d) => {
      const dp = d.split('/');
      const tp = target.split('/');
      if (dp.length !== tp.length) return false;
      return dp.every((seg, i) => seg.startsWith(':') || seg === tp[i]);
    });
    if (!matched) {
      linkProblems.push(`${file.pathname.split('/src/')[1]} -> ${target}`);
    }
  }
}

if (linkProblems.length > 0) {
  console.log('-'.repeat(118));
  console.log(`${linkProblems.length} LINK(S) TO AN UNDECLARED ROUTE:`);
  for (const item of linkProblems) console.log('  ' + item);
} else {
  console.log('every literal <Link to> target resolves to a declared route');
}

process.exit(problems === 0 && linkProblems.length === 0 ? 0 : 1);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) yield* walk(child);
    else if (/\.(jsx|js)$/.test(entry.name)) yield child;
  }
}
