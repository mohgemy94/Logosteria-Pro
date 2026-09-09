const fs = require('fs');
let content = fs.readFileSync('src/components/Sales.tsx', 'utf8');

content = content.replace(
  "const [safe,\n      serviceType, setSafe] = useState<string>('MAIN_SAFE');",
  "const [safe, setSafe] = useState<string>('MAIN_SAFE');"
);

fs.writeFileSync('src/components/Sales.tsx', content);
