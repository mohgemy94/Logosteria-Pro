const fs = require('fs');
const p = 'src/components/DashboardScreen.tsx';
let content = fs.readFileSync(p, 'utf-8');

// The issue might just be that the api was unaccessible due to a CORS/preflight issue or the app restarting.
// Actually, AI Studio apps run in an iframe, and `window.location.origin` might be `null` or a sandbox origin, 
// so the relative url `/api/...` should hit the same host the app is served from.
// Let's just use `/api/...` without origin.
content = content.replace(
  /const apiUrl = window\.location\.origin\.includes\('localhost'\) \? 'http:\/\/localhost:3000\/api\/dashboard\/kpis\?year=' \+ selectedYear : '\/api\/dashboard\/kpis\?year=' \+ selectedYear;\n        const res = await fetch\(apiUrl, \{ headers: \{ 'Accept': 'application\/json' \} \}\);/,
  "const res = await fetch('/api/dashboard/kpis?year=' + selectedYear, { headers: { 'Accept': 'application/json' } });"
);

fs.writeFileSync(p, content);
