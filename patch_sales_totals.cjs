const fs = require('fs');
let content = fs.readFileSync('src/components/Sales.tsx', 'utf8');

const oldTotals = `
    const grandTotal = subtotal + taxTotal;
    const grossProfit = subtotal - totalCost;
    const profitMargin = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;
    const cleanPaid = Math.max(0, Math.min(grandTotal, Number(paidAmount) || 0));
    const remainingBalance = Math.max(0, grandTotal - cleanPaid);

    return {
      subtotal,
      taxTotal,
      grandTotal,
      grossProfit,
      profitMargin,
      totalCost,
      cleanPaid,
      remainingBalance
    };
  }, [items, classification, paidAmount, itemsCatalog]);
`;

const newTotals = `
    const discountAmount = Number(discount) || 0;
    const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
    const effectiveSubtotal = subtotal - discountAmount;
    const effectiveTaxTotal = taxTotal * (1 - discountRatio);

    const grandTotal = effectiveSubtotal + effectiveTaxTotal;
    const grossProfit = effectiveSubtotal - totalCost;
    const profitMargin = effectiveSubtotal > 0 ? (grossProfit / effectiveSubtotal) * 100 : 0;
    const cleanPaid = Math.max(0, Math.min(grandTotal, Number(paidAmount) || 0));
    const remainingBalance = Math.max(0, grandTotal - cleanPaid);

    return {
      subtotal: effectiveSubtotal + discountAmount, // pure subtotal before discount
      taxTotal: effectiveTaxTotal,
      discountTotal: discountAmount,
      grandTotal,
      grossProfit,
      profitMargin,
      totalCost,
      cleanPaid,
      remainingBalance
    };
  }, [items, classification, paidAmount, itemsCatalog, discount]);
`;

if(content.includes('const grandTotal = subtotal + taxTotal;')) {
  // We need to replace exactly
  content = content.replace(
    /const grandTotal = subtotal \+ taxTotal;[\s\S]*?}, \[items, classification, paidAmount, itemsCatalog\]\);/,
    newTotals.trim()
  );
  fs.writeFileSync('src/components/Sales.tsx', content);
  console.log('patched totals');
} else {
  console.log('Could not find totals block');
}
