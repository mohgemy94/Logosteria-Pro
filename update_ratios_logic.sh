sed -i "s/useState<'INCOME' | 'BALANCE' | null>/useState<'INCOME' | 'BALANCE' | 'RATIOS' | null>/g" src/components/FinancialReportsScreen.tsx
sed -i 's/} from '"'"'lucide-react'"'"';/  Activity,\n  Percent,\n  Target\n} from '"'"'lucide-react'"'"';/g' src/components/FinancialReportsScreen.tsx

# Insert calculations after totalLiabilitiesAndEquity
sed -i '/const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;/a \
\
  // Financial Ratios Calculations\
  const currentAssets = assets.filter(r => r.account.code.startsWith("11")).reduce((sum, r) => sum + (r.endingDebit - r.endingCredit), 0);\
  const currentLiabilities = liabilities.filter(r => r.account.code.startsWith("21")).reduce((sum, r) => sum + (r.endingCredit - r.endingDebit), 0);\
\
  const netProfitMargin = totalRevenues > 0 ? (netIncome / totalRevenues) * 100 : 0;\
  const grossProfitMargin = totalOpRevs > 0 ? (grossProfit / totalOpRevs) * 100 : 0;\
  const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities) : (currentAssets > 0 ? Infinity : 0);\
  const roe = totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0;\
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;' src/components/FinancialReportsScreen.tsx
