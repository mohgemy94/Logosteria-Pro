const fs = require('fs');
const p = 'src/components/DashboardScreen.tsx';
let content = fs.readFileSync(p, 'utf-8');

// The error message from the client might be due to Vite server restarting or not running when they opened it.
// We'll leave the alert in there for debugging if it happens again.
// Wait, the user error is "Failed to fetch dashboard KPIs Failed to fetch" which is literally the error message from the try-catch block:
// console.error("Failed to fetch dashboard KPIs", e);
// e.message for network errors is usually "Failed to fetch".

// Let's add a retry mechanism.
content = content.replace(
  /const res = await fetch\('\/api\/dashboard\/kpis\?year=' \+ selectedYear, \{ headers: \{ 'Accept': 'application\/json' \} \}\);/,
  `let res = null;
        try {
          res = await fetch('/api/dashboard/kpis?year=' + selectedYear, { headers: { 'Accept': 'application/json' } });
        } catch (err) {
          console.warn("First fetch failed, retrying in 1s...");
          await new Promise(r => setTimeout(r, 1000));
          res = await fetch('/api/dashboard/kpis?year=' + selectedYear, { headers: { 'Accept': 'application/json' } });
        }`
);

fs.writeFileSync(p, content);
