const fs = require('fs');
let content = fs.readFileSync('src/components/Sales.tsx', 'utf8');

content = content.replace(
  "safe: string;\n  items: InvoiceItem[];",
  "safe: string;\n  serviceType?: string;\n  items: InvoiceItem[];"
);

content = content.replace(
  "taxTotal: number;",
  "taxTotal: number;\n    discountTotal?: number;"
);

content = content.replace(
  "const [safe, setSafe] = useState<string>('MAIN_SAFE');",
  "const [safe, setSafe] = useState<string>('MAIN_SAFE');\n  const [serviceType, setServiceType] = useState<string>('');\n  const [discount, setDiscount] = useState<number>(0);"
);

content = content.replace(
  "setSafe(inv.safe || 'MAIN_SAFE');",
  "setSafe(inv.safe || 'MAIN_SAFE');\n    setServiceType(inv.serviceType || '');\n    setDiscount(inv.totals?.discountTotal || 0);"
);

content = content.replace(
  "const totals = useMemo(() => {",
  "const totals = useMemo(() => {"
);

fs.writeFileSync('src/components/Sales.tsx', content);
