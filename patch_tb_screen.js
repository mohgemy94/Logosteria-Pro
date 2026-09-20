const fs = require('fs');
const p = 'src/components/TrialBalanceScreen.tsx';
let content = fs.readFileSync(p, 'utf-8');

// 1. Add state for maxLevel
content = content.replace(
  /const \[accountTypeFilter, setAccountTypeFilter\] = useState<string>\('ALL'\);/,
  "const [accountTypeFilter, setAccountTypeFilter] = useState<string>('ALL');\n  const [maxLevel, setMaxLevel] = useState<string>('ALL');"
);

// 2. Add level filter logic to filteredRows
const oldFilteredRows = `  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter(r => 
      r.account.code.toLowerCase().includes(q) ||
      r.account.name.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);`;

const newFilteredRows = `  const filteredRows = useMemo(() => {
    let result = rows;
    
    if (maxLevel !== 'ALL') {
      const targetLevel = Number(maxLevel);
      result = result.filter(r => {
        const len = r.account.code.length;
        let level = 5;
        if (len === 1) level = 1;
        else if (len === 2) level = 2;
        else if (len === 4) level = 3;
        else if (len === 6) level = 4;
        return level <= targetLevel;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        r.account.code.toLowerCase().includes(q) ||
        r.account.name.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [rows, searchQuery, maxLevel]);`;

content = content.replace(oldFilteredRows, newFilteredRows);

// 3. Add UI select for maxLevel
// Let's find where the accountTypeFilter select is.
const searchFilter = `<select
                    value={accountTypeFilter}
                    onChange={(e) => setAccountTypeFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 font-bold"
                  >
                    <option value="ALL">جميع أنواع الحسابات</option>`;

// We will insert the new select right before or after it. But wait, I need to know the exact HTML structure.
