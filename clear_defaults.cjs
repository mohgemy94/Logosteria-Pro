const fs = require('fs');

function fixArray(file, arrayName, typeAnnotation = '') {
    let content = fs.readFileSync(file, 'utf8');
    const regex = new RegExp(`export const ${arrayName}${typeAnnotation.replace(/\[/g, '\\\\[').replace(/\]/g, '\\\\]')} = \\[\\];`);
    content = content.replace(regex, `export const ${arrayName}${typeAnnotation} = [];`);
    fs.writeFileSync(file, content, 'utf8');
}

fixArray('src/utils/itemsStore.ts', 'DEFAULT_INITIAL_ITEMS', ': Item[]');
fixArray('src/utils/salesStore.ts', 'DEFAULT_INITIAL_SALES_INVOICES', ': StoredSalesInvoice[]');
fixArray('src/utils/trialBalanceStore.ts', 'DEFAULT_JOURNAL_ENTRIES', ': JournalEntry[]');
fixArray('src/utils/partnerLedger.ts', 'DEFAULT_CUSTOMERS_LIST', ': Partner[]');
fixArray('src/utils/partnerLedger.ts', 'DEFAULT_VENDORS_LIST', ': Partner[]');
fixArray('src/utils/partnerLedger.ts', 'DEFAULT_RECEIPT_VOUCHERS', ': StoredVoucherRecord[]');
fixArray('src/utils/partnerLedger.ts', 'DEFAULT_PAYMENT_VOUCHERS', ': StoredVoucherRecord[]');
fixArray('src/data/mockPayroll.ts', 'INITIAL_EMPLOYEES', ': Employee[]');
fixArray('src/data/mockManufacturing.ts', 'INITIAL_WORK_CENTERS', ': WorkCenter[]');
fixArray('src/data/mockManufacturing.ts', 'INITIAL_BOMS', ': BillOfMaterials[]');
fixArray('src/data/mockManufacturing.ts', 'INITIAL_MANUFACTURING_ORDERS', ': ManufacturingOrder[]');
fixArray('src/data/mockInstallments.ts', 'INITIAL_INSTALLMENT_CONTRACTS', ': InstallmentContract[]');
fixArray('src/data/mockInstallments.ts', 'INITIAL_PROMISSORY_NOTES', ': PromissoryNote[]');

console.log('Defaults fixed.');
