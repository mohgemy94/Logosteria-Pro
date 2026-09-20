import { PayrollRecord } from '../types/payroll';
import { getSystemSettings } from './settings';

export function exportWpsPayrollCsv(
  payrollRecords: PayrollRecord[], 
  monthStr: string
): void {
  const settings = getSystemSettings();
  const companyName = settings.company?.nameAr || 'الشركة';
  const taxOrCrNumber = settings.company?.commercialRegister || settings.company?.taxNumber || '1010000000';
  
  // CSV Headers conforming to WPS / SARI standard
  const headers = [
    'كود الموظف',
    'اسم الموظف',
    'رقم الهوية / الإقامة',
    'اسم البنك',
    'رقم الآيبان (IBAN)',
    'الراتب الأساسي',
    'بدل السكن',
    'بدل الانتقال',
    'البدلات الأخرى',
    'المكافآت والإضافي',
    'إجمالي الاستحقاق (Gross)',
    'الاستقطاعات والتأمينات والسلف',
    'صافي الراتب المحول (Net)',
    'شهر الاستحقاق',
    'مرجع المنشأة'
  ];

  const rows = payrollRecords.map(rec => {
    return [
      `"${rec.employeeCode}"`,
      `"${rec.employeeName.replace(/"/g, '""')}"`,
      `"${rec.nationalId || ''}"`,
      `"${rec.bankName || 'مصرف الراجحي'}"`,
      `"${rec.iban || ''}"`,
      rec.basicSalary.toFixed(2),
      rec.housingAllowance.toFixed(2),
      rec.transportAllowance.toFixed(2),
      rec.otherAllowances.toFixed(2),
      rec.bonusesAmount.toFixed(2),
      rec.grossSalary.toFixed(2),
      rec.deductionsAmount.toFixed(2),
      rec.netSalary.toFixed(2),
      `"${rec.month}"`,
      `"${companyName} - ${taxOrCrNumber}"`
    ].join(',');
  });

  // UTF-8 BOM for Arabic support in Excel
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `WPS_Payroll_${monthStr}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
