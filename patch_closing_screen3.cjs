const fs = require('fs');
const p = 'src/components/YearEndClosingScreen.tsx';
let content = fs.readFileSync(p, 'utf-8');

// I'll just remove isLoading entirely to satisfy tsc, or use it somewhere.
content = content.replace(
  /\/\/ eslint-disable-next-line @typescript-eslint\/no-unused-vars\n  const \[isLoading, setIsLoading\] = useState\(true\);/,
  ""
);
content = content.replace(/setIsLoading\(true\);/, "");
content = content.replace(/setIsLoading\(false\);/, "");

fs.writeFileSync(p, content);
