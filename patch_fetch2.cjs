const fs = require('fs');
const p = 'src/components/DashboardScreen.tsx';
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(
  /const res = await fetch\('\/api\/dashboard\/kpis\?year=' \+ selectedYear, \{ headers: \{ 'Accept': 'application\/json' \} \}\);/,
  "const res = await fetch(window.location.origin + '/api/dashboard/kpis?year=' + selectedYear, { headers: { 'Accept': 'application/json' } });"
);

fs.writeFileSync(p, content);
