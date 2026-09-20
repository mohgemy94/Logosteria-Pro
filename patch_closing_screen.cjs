const fs = require('fs');
const p = 'src/components/YearEndClosingScreen.tsx';
let content = fs.readFileSync(p, 'utf-8');

const importStr = `import { useState } from 'react';`;
const newImportStr = `import { useState, useEffect } from 'react';`;
content = content.replace(importStr, newImportStr);

const stateAndFetch = `  const [isClosing, setIsClosing] = useState(false);
  const [closeSuccess, setCloseSuccess] = useState(false);

  // Mock data for preview before closing
  const previewData = {
    totalRevenue: 150000,
    totalExpenses: 90000,
    netProfit: 60000,
    retainedEarningsAccount: '3201 - الأرباح والخسائر المدورة'
  };

  const handleCloseYear = () => {
    if (confirm(\`هل أنت متأكد من إقفال السنة المالية \${selectedYear}؟ لا يمكن التراجع عن هذه العملية.\`)) {
      setIsClosing(true);
      // Simulate API call
      setTimeout(() => {
        setIsClosing(false);
        setCloseSuccess(true);
      }, 2000);
    }
  };`;

const newStateAndFetch = `  const [isClosing, setIsClosing] = useState(false);
  const [closeSuccess, setCloseSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [previewData, setPreviewData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    retainedEarningsAccount: '3201 - الأرباح المبقاة (Retained Earnings)'
  });

  useEffect(() => {
    const fetchKPIs = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/dashboard/kpis?year=' + selectedYear, { headers: { 'Accept': 'application/json' } });
        const json = await res.json();
        if (json.success && json.data) {
          const rev = json.data.sales || 0;
          const exp = json.data.expenses || 0;
          setPreviewData({
            totalRevenue: rev,
            totalExpenses: exp,
            netProfit: rev - exp,
            retainedEarningsAccount: '3201 - الأرباح المبقاة (Retained Earnings)'
          });
        }
      } catch (err) {
        console.error('Failed to load KPIs for closing', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchKPIs();
  }, [selectedYear]);

  const handleCloseYear = async () => {
    if (confirm(\`هل أنت متأكد من إقفال السنة المالية \${selectedYear}؟ سيتم إنشاء قيد تصفير للإيرادات والمصروفات، ولا يمكن التراجع.\`)) {
      setIsClosing(true);
      try {
        const res = await fetch('/api/year-end/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year: selectedYear, tenantId: 'tenant_default' })
        });
        const json = await res.json();
        if (json.success) {
          setCloseSuccess(true);
        } else {
          alert('فشل الإقفال: ' + json.error);
        }
      } catch (err) {
        alert('خطأ في الاتصال بالسيرفر');
      } finally {
        setIsClosing(false);
      }
    }
  };`;

content = content.replace(stateAndFetch, newStateAndFetch);
fs.writeFileSync(p, content);
