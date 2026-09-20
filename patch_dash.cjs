const fs = require('fs');
const p = 'src/components/DashboardScreen.tsx';
let content = fs.readFileSync(p, 'utf-8');

// The error message is "Failed to fetch dashboard KPIs Failed to fetch"
// This indicates `fetch` itself is throwing an error.
// Wait, `fetch('/api/dashboard/kpis?year=...')` should work in the browser, but maybe it's missing some headers or running into a cors issue if it's hitting a different port? But it's in the same origin.
// Let's add more logging to the catch block to see the real error.

content = content.replace(
  /console.error\("Failed to fetch dashboard KPIs", e\);/,
  "console.error('Failed to fetch dashboard KPIs', e); alert('Failed to fetch dashboard KPIs: ' + (e instanceof Error ? e.message : String(e)));"
);

fs.writeFileSync(p, content);
