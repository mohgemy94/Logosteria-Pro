import re

def update_sales():
    with open('src/components/Sales.tsx', 'r', encoding='utf-8') as f:
        text = f.read()

    # 1. Update toolbar buttons
    old_toolbar = '''              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setShowPrintPreview(true);
                }}
                className="h-8 px-3 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 border border-indigo-200 rounded-md text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                title="معاينة الفاتورة قبل الطباعة"
              >
                <Eye size={14} className="text-indigo-600" />
                <span>معاينة</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-slate-900 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="طباعة مباشرة (Ctrl+P)"
              >
                <Printer size={14} className="text-slate-600" />
                <span>طباعة</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-rose-700 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="تصدير ملف PDF"
              >
                <FileDown size={14} className="text-rose-600" />
                <span>PDF</span>
              </button>'''

    new_toolbar = '''              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setPreviewAutoPrint(false);
                  setPreviewAutoPdf(false);
                  setShowPrintPreview(true);
                }}
                className="h-8 px-3 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 border border-indigo-200 rounded-md text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                title="معاينة الفاتورة قبل الطباعة"
              >
                <Eye size={14} className="text-indigo-600" />
                <span>معاينة</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setPreviewAutoPrint(true);
                  setPreviewAutoPdf(false);
                  setShowPrintPreview(true);
                }}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-slate-900 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="طباعة الفاتورة مباشرة (Ctrl+P)"
              >
                <Printer size={14} className="text-slate-600" />
                <span>طباعة</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomPreviewData(null);
                  setPreviewAutoPrint(false);
                  setPreviewAutoPdf(true);
                  setShowPrintPreview(true);
                }}
                className="h-8 px-2.5 hover:bg-white text-slate-700 hover:text-rose-700 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="تصدير ملف PDF مباشرة"
              >
                <FileDown size={14} className="text-rose-600" />
                <span>PDF</span>
              </button>'''

    if old_toolbar in text:
        text = text.replace(old_toolbar, new_toolbar)
        print('Updated toolbar buttons in Sales.tsx')
    else:
        print('Warning: old_toolbar not found in Sales.tsx')

    # 2. Update handleDelete & confirmExecuteDelete
    idx_del = text.find('const handleDelete = () => {')
    idx_sc = text.find('// Global Keyboard Shortcuts (Ctrl+S, Ctrl+P', idx_del)
    if idx_del != -1 and idx_sc != -1:
        new_del_code = '''const handleDelete = () => {
    const isExisting = editingInvoiceId || savedInvoices.some(i => i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === invoiceNumber.trim().toLowerCase());
    const targetInv = savedInvoices.find(i => (editingInvoiceId && i.id === editingInvoiceId) || (i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === invoiceNumber.trim().toLowerCase()));
    const isPostedInvoice = status === 'POSTED' || (targetInv && targetInv.status === 'POSTED');

    setDeleteModal({
      isOpen: true,
      invoiceId: editingInvoiceId || undefined,
      invoiceNumber: invoiceNumber.trim() || 'المسودة الحالية',
      isNewDraft: !isExisting,
      isPosted: isPostedInvoice
    });
  };

  const confirmExecuteDelete = () => {
    if (!deleteModal) return;
    if (deleteModal.isNewDraft) {
      handleNewInvoice();
      setDeleteModal(null);
      showToast({
        type: 'info',
        title: 'تم إفراغ وإعادة ضبط المسودة',
        message: 'تمت إفراغ الحقول والبدء بفاتورة جديدة فارغة.'
      });
      return;
    }

    const targetNumber = deleteModal.invoiceNumber;
    const targetId = deleteModal.invoiceId;
    const targetInv = savedInvoices.find(i => (targetId && i.id === targetId) || (i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()));

    // If invoice is POSTED, automatically revert stock and ledger
    if (targetInv && targetInv.status === 'POSTED' && targetInv.items && targetInv.items.length > 0) {
      const restored = restoreItemsStockOnSaleUnpost(targetInv.items);
      if (restored.length > 0) {
        setItemsCatalog(restored);
      }
    }

    const updated = savedInvoices.filter(i => {
      if (targetId && i.id === targetId) return false;
      if (i.invoiceNumber && i.invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()) return false;
      return true;
    });

    setSavedInvoices(updated);
    try {
      localStorage.setItem(DB_SALES_INVOICES_KEY, JSON.stringify(updated));
      notifyDataChanged();
      dispatchPartnerLedgerUpdated();
    } catch (err) {
      console.error(err);
    }

    if (editingInvoiceId === targetId || invoiceNumber.trim().toLowerCase() === targetNumber.trim().toLowerCase()) {
      handleNewInvoice(updated);
    }

    showToast({
      type: 'success',
      title: `تم حذف الفاتورة رقم (${targetNumber}) بنجاح!`,
      message: 'تم تحديث سجل الفواتير والمخزون وحسابات العملاء بنجاح.'
    });
    setDeleteModal(null);
  };

  '''
        text = text[:idx_del] + new_del_code + text[idx_sc:]
        print('Updated handleDelete and confirmExecuteDelete in Sales.tsx')

    # 3. Update modal pass props: autoPrint & autoExportPdf
    old_modal = '''      {/* Print Preview & PDF Modal */}
      {showPrintPreview && (
        <PrintPreviewModal
          isOpen={showPrintPreview}
          onClose={() => {
            setShowPrintPreview(false);
            setCustomPreviewData(null);
          }}
          data={customPreviewData || currentInvoicePreviewData}
        />
      )}'''

    new_modal = '''      {/* Print Preview & PDF Modal */}
      {showPrintPreview && (
        <PrintPreviewModal
          isOpen={showPrintPreview}
          onClose={() => {
            setShowPrintPreview(false);
            setCustomPreviewData(null);
            setPreviewAutoPrint(false);
            setPreviewAutoPdf(false);
          }}
          data={customPreviewData || currentInvoicePreviewData}
          autoPrint={previewAutoPrint}
          autoExportPdf={previewAutoPdf}
        />
      )}'''

    if old_modal in text:
        text = text.replace(old_modal, new_modal)
        print('Updated PrintPreviewModal call in Sales.tsx')

    # 4. In history drawer table: remove disabled={inv.status === 'POSTED'} and remove # before invoiceNumber
    text = text.replace('disabled={inv.status === \'POSTED\'}', '')
    text = text.replace('<td className="py-2.5 font-mono font-bold text-blue-600">#{inv.invoiceNumber}</td>', '<td className="py-2.5 font-mono font-bold text-blue-600">{inv.invoiceNumber}</td>')
    text = text.replace('رقم الفاتورة: #{invoiceNumber}', 'رقم الفاتورة: {invoiceNumber}')
    text = text.replace('رقم الفاتورة: #{deleteModal.invoiceNumber}', 'رقم الفاتورة: {deleteModal.invoiceNumber}')

    # 5. Quantity column width increased and Price column reduced in table header and row
    old_th_qty_price = '''                  <th className="py-2.5 px-2 w-28 sm:w-32 text-center border-l border-blue-950 text-slate-100">الكمية</th>
                  <th className="py-2.5 px-2.5 w-28 sm:w-32 lg:w-36 text-left border-l border-blue-950 text-blue-200 font-bold">سعر البيع</th>'''
    new_th_qty_price = '''                  <th className="py-2.5 px-2 w-36 sm:w-40 lg:w-44 text-center border-l border-blue-950 text-slate-100 font-bold">الكمية</th>
                  <th className="py-2.5 px-2.5 w-24 sm:w-28 lg:w-32 text-left border-l border-blue-950 text-blue-200 font-bold">سعر البيع</th>'''
    if old_th_qty_price in text:
        text = text.replace(old_th_qty_price, new_th_qty_price)
        print('Updated Quantity and Price th widths in Sales.tsx')

    old_td_qty = '{/* الكمية (Quantity) */}\n                    <td className="py-2 px-2 text-center border-l border-slate-300">'
    new_td_qty = '{/* الكمية (Quantity) */}\n                    <td className="py-2 px-2 text-center border-l border-slate-300 w-36 sm:w-40 lg:w-44">'
    if old_td_qty in text:
        text = text.replace(old_td_qty, new_td_qty)
        print('Updated Quantity td width in Sales.tsx')

    old_td_price = '{/* سعر البيع (Unit Price) */}\n                    <td className="py-2 px-2 text-left border-l border-slate-300 w-36 sm:w-40 lg:w-48">'
    new_td_price = '{/* سعر البيع (Unit Price) */}\n                    <td className="py-2 px-2 text-left border-l border-slate-300 w-24 sm:w-28 lg:w-32">'
    if old_td_price in text:
        text = text.replace(old_td_price, new_td_price)
        print('Updated Price td width in Sales.tsx')

    with open('src/components/Sales.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Sales.tsx complete!')

update_sales()
