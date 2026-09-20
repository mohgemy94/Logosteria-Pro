const fs = require('fs');
const p = 'src/components/YearEndClosingScreen.tsx';
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(
  /const \[isLoading, setIsLoading\] = useState\(true\);/,
  "// eslint-disable-next-line @typescript-eslint/no-unused-vars\n  const [isLoading, setIsLoading] = useState(true);"
);

fs.writeFileSync(p, content);
