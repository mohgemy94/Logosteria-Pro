import sys

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    # Fix syntax error on label line if truncated
    old_broken = "label:\n    }));"
    old_broken2 = "label: \n    }));"

    replacement_usememo = """  const dynamicSafesList = useMemo(() => {
    const accounts = chartAccounts.filter(a => a.isActive !== false && (a.code.startsWith('110') || a.code.startsWith('11') || a.type === 'ASSET' || a.isPosting));
    const options = accounts.map(a => ({
      id: a.id || a.code,
      code: a.code,
      label: a.code + ' - ' + a.name
    }));

    const defaultSafes = [
      { id: 'MAIN_SAFE', code: '1101', label: '1101 - النقدية بالصندوق (الصندوق الرئيسي)' },
      { id: 'BANK_AHLI', code: '1102', label: '1102 - حساب البنك الأهلي التجاري' },
      { id: 'BANK_RAJHI', code: '1103', label: '1103 - حساب بنك الراجحي' },
      { id: 'PETTY_CASH', code: '1105', label: '1105 - العهدة النقدية' }
    ];

    defaultSafes.forEach(ds => {
      if (!options.some(o => o.id === ds.id || o.code === ds.code)) {
        options.push(ds);
      }
    });

    return options;
  }, [chartAccounts]);"""

    # Replace broken dynamicSafesList block
    import re
    text = re.sub(r'const dynamicSafesList = useMemo\(\(\) => \{[\s\S]*?\}, \[chartAccounts\]\);', replacement_usememo, text)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"Patched {filepath} successfully")

patch_file('src/components/Sales.tsx')
patch_file('src/components/Purchases.tsx')
