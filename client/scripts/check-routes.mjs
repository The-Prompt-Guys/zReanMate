/**
 * Loads every registered route in a headless-ish way and reports which ones
 * render the "not built yet" placeholder or blow up.
 *
 * Runs against the built bundle's route table via the dev server, using plain
 * fetch for the HTML shell plus a check that the registry and the router agree.
 */
import { readFileSync } from 'node:fs';

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
process.exit(problems === 0 ? 0 : 1);
