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

// 3. Adjust Grid columns from lg:grid-cols-5 to lg:grid-cols-6
content = content.replace(
  /className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3"/,
  'className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3"'
);

// 4. Insert the Level Filter UI right before Category Filter
const categoryFilterStr = `          {/* Category Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">تصنيف الحساب</label>`;

const levelFilterStr = `          {/* Level Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">مستوى الحساب</label>
            <select
              value={maxLevel}
              onChange={(e) => setMaxLevel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-blue-500 text-slate-800 font-bold"
            >
              <option value="ALL">كل المستويات (مفصل)</option>
              <option value="1">المستوى 1 (إجمالي الأبواب)</option>
              <option value="2">المستوى 2 (مجموعات رئيسية)</option>
              <option value="3">المستوى 3 (حسابات عامة)</option>
              <option value="4">المستوى 4 (حسابات فرعية)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-1 block">تصنيف الحساب</label>`;

content = content.replace(categoryFilterStr, levelFilterStr);

fs.writeFileSync(p, content);
