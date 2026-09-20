import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  Edit3, 
  X
} from 'lucide-react';
import { Employee } from '../../types/payroll';
import { saveStoredEmployees } from '../../data/mockPayroll';

interface DocumentAlertsTabProps {
  employees: Employee[];
  onRefresh: () => void;
}

interface DocumentItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  docType: 'IQAMA' | 'CONTRACT' | 'PASSPORT' | 'INSURANCE';
  docTypeName: string;
  expiryDate: string;
  daysRemaining: number;
  status: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'GOOD';
}

export default function DocumentAlertsTab({ employees, onRefresh }: DocumentAlertsTabProps) {
  const [filterType, setFilterType] = useState<'ALL' | 'EXPIRED' | 'CRITICAL' | 'WARNING'>('ALL');
  const [editingDocEmp, setEditingDocEmp] = useState<Employee | null>(null);

  // Compute all document items across all employees
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const documentItems: DocumentItem[] = [];

  employees.forEach(emp => {
    // 1. National ID / Iqama
    const iqamaDate = emp.idExpiryDate || emp.contractExpiryDate || '2025-12-31';
    const iqamaDiff = Math.ceil((new Date(iqamaDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    let iqamaStatus: DocumentItem['status'] = 'GOOD';
    if (iqamaDiff < 0) iqamaStatus = 'EXPIRED';
    else if (iqamaDiff <= 30) iqamaStatus = 'CRITICAL';
    else if (iqamaDiff <= 60) iqamaStatus = 'WARNING';

    documentItems.push({
      id: `${emp.id}-iqama`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.code,
      docType: 'IQAMA',
      docTypeName: emp.nationalityType === 'SAUDI' ? 'الهوية الوطنية' : 'الإقامة النظامية',
      expiryDate: iqamaDate,
      daysRemaining: iqamaDiff,
      status: iqamaStatus
    });

    // 2. Contract
    const contractDate = emp.contractExpiryDate || '2025-10-15';
    const contractDiff = Math.ceil((new Date(contractDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    let contractStatus: DocumentItem['status'] = 'GOOD';
    if (contractDiff < 0) contractStatus = 'EXPIRED';
    else if (contractDiff <= 30) contractStatus = 'CRITICAL';
    else if (contractDiff <= 60) contractStatus = 'WARNING';

    documentItems.push({
      id: `${emp.id}-contract`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.code,
      docType: 'CONTRACT',
      docTypeName: 'عقد العمل الموحد',
      expiryDate: contractDate,
      daysRemaining: contractDiff,
      status: contractStatus
    });

    // 3. Medical Insurance
    const insuranceDate = emp.insuranceExpiryDate || '2025-11-20';
    const insuranceDiff = Math.ceil((new Date(insuranceDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    let insuranceStatus: DocumentItem['status'] = 'GOOD';
    if (insuranceDiff < 0) insuranceStatus = 'EXPIRED';
    else if (insuranceDiff <= 30) insuranceStatus = 'CRITICAL';
    else if (insuranceDiff <= 60) insuranceStatus = 'WARNING';

    documentItems.push({
      id: `${emp.id}-insurance`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.code,
      docType: 'INSURANCE',
      docTypeName: 'التأمين الطبي (مجلس الضمان)',
      expiryDate: insuranceDate,
      daysRemaining: insuranceDiff,
      status: insuranceStatus
    });
  });

  const expiredCount = documentItems.filter(d => d.status === 'EXPIRED').length;
  const criticalCount = documentItems.filter(d => d.status === 'CRITICAL').length;
  const warningCount = documentItems.filter(d => d.status === 'WARNING').length;

  const filteredDocs = documentItems.filter(doc => {
    if (filterType === 'EXPIRED') return doc.status === 'EXPIRED';
    if (filterType === 'CRITICAL') return doc.status === 'CRITICAL';
    if (filterType === 'WARNING') return doc.status === 'WARNING';
    return true;
  });

  const handleUpdateEmployeeDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDocEmp) return;

    const updatedEmployees = employees.map(emp => 
      emp.id === editingDocEmp.id ? editingDocEmp : emp
    );

    saveStoredEmployees(updatedEmployees);
    setEditingDocEmp(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="text-rose-600" size={22} />
            <span>نظام تنبيهات ومراقبة انتهاء الوثائق والعقود والإقامات</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة فورية لصلاحية الإقامات، تجديد عقود العمل، التأمين الطبي، وجوازات السفر
          </p>
        </div>
      </div>

      {/* KPI Alert Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs">
          <div className="flex justify-between items-center text-rose-600 mb-1">
            <span className="text-xs font-bold text-rose-900">وثائق منتهية الصلاحية</span>
            <AlertTriangle size={18} />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700">
            {expiredCount} <span className="text-xs font-normal text-rose-500">وثيقة</span>
          </div>
          <div className="text-[11px] text-rose-600 mt-1">تتطلب تجديداً فورياً لتفادي الغرامات</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex justify-between items-center text-amber-600 mb-1">
            <span className="text-xs font-bold text-amber-900">تنتهي خلال 30 يوماً</span>
            <Clock size={18} />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700">
            {criticalCount} <span className="text-xs font-normal text-amber-500">وثيقة</span>
          </div>
          <div className="text-[11px] text-amber-600 mt-1">حرجة ويجب البدء في إجراءات التجديد</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs">
          <div className="flex justify-between items-center text-blue-600 mb-1">
            <span className="text-xs font-bold text-blue-900">تنتهي خلال 60 يوماً</span>
            <Calendar size={18} />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-700">
            {warningCount} <span className="text-xs font-normal text-blue-500">وثيقة</span>
          </div>
          <div className="text-[11px] text-blue-600 mt-1">تحذير مبكر للجدولة الزمنية</div>
        </div>
      </div>

      {/* 3D Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="p-1 bg-slate-100 rounded-xl border border-slate-200/80 shadow-inner flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === 'ALL' 
                ? 'bg-gradient-to-b from-slate-700 to-slate-900 text-white shadow-xs border-b-2 border-slate-950 active:translate-y-0.5' 
                : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 border-b-2 border-b-slate-300 shadow-2xs hover:bg-slate-50'
            }`}
          >
            جميع الوثائق ({documentItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('EXPIRED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === 'EXPIRED' 
                ? 'bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-xs border-b-2 border-rose-900 active:translate-y-0.5' 
                : 'bg-white text-rose-800 hover:text-rose-900 border border-rose-200 border-b-2 border-b-rose-300 shadow-2xs hover:bg-rose-50'
            }`}
          >
            منتهية ({expiredCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('CRITICAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === 'CRITICAL' 
                ? 'bg-gradient-to-b from-amber-500 to-amber-700 text-white shadow-xs border-b-2 border-amber-900 active:translate-y-0.5' 
                : 'bg-white text-amber-800 hover:text-amber-900 border border-amber-200 border-b-2 border-b-amber-300 shadow-2xs hover:bg-amber-50'
            }`}
          >
            خلال 30 يوماً ({criticalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('WARNING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === 'WARNING' 
                ? 'bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-xs border-b-2 border-blue-900 active:translate-y-0.5' 
                : 'bg-white text-blue-800 hover:text-blue-900 border border-blue-200 border-b-2 border-b-blue-300 shadow-2xs hover:bg-blue-50'
            }`}
          >
            خلال 60 يوماً ({warningCount})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5">الموظف</th>
                <th className="p-3.5">نوع الوثيقة</th>
                <th className="p-3.5">تاريخ الانتهاء</th>
                <th className="p-3.5">المدة المتبقية</th>
                <th className="p-3.5">مستوى التنبيه</th>
                <th className="p-3.5 text-center">تحديث وتجديد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.map(doc => {
                const emp = employees.find(e => e.id === doc.employeeId);
                return (
                  <tr key={doc.id} className="hover:bg-slate-50/70">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{doc.employeeName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{doc.employeeCode}</div>
                    </td>
                    <td className="p-3.5 font-medium text-slate-800">
                      {doc.docTypeName}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-700">
                      {doc.expiryDate}
                    </td>
                    <td className="p-3.5 font-mono">
                      {doc.daysRemaining < 0 ? (
                        <span className="text-rose-600 font-bold">منتهية منذ {Math.abs(doc.daysRemaining)} يوم</span>
                      ) : (
                        <span className="text-slate-800 font-bold">متبقي {doc.daysRemaining} يوم</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {doc.status === 'EXPIRED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <AlertTriangle size={12} />
                          منتهية الصلاحية
                        </span>
                      ) : doc.status === 'CRITICAL' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock size={12} />
                          تنبيه حرج (أقل من 30 يوم)
                        </span>
                      ) : doc.status === 'WARNING' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          <Calendar size={12} />
                          تنبيه مبكر (أقل من 60 يوم)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} />
                          سارية
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => emp && setEditingDocEmp(emp)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs border-b-2 border-blue-900 active:border-b active:translate-y-0.5 cursor-pointer mx-auto"
                      >
                        <Edit3 size={13} className="text-blue-100" />
                        <span>تحديث التاريخ</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    لا توجد تنبيهات وثائق في هذا التصنيف
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: UPDATE DATES FOR EMPLOYEE */}
      {editingDocEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تحديث تواريخ وصلاحيات الوثائق</h3>
                  <p className="text-[11px] text-slate-400">الموظف: {editingDocEmp.name} ({editingDocEmp.code})</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingDocEmp(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployeeDates} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">تاريخ انتهاء الهوية / الإقامة:</label>
                <input
                  type="date"
                  value={editingDocEmp.idExpiryDate || ''}
                  onChange={(e) => setEditingDocEmp({...editingDocEmp, idExpiryDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">تاريخ انتهاء / تجديد عقد العمل:</label>
                <input
                  type="date"
                  value={editingDocEmp.contractExpiryDate || ''}
                  onChange={(e) => setEditingDocEmp({...editingDocEmp, contractExpiryDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">تاريخ انتهاء التأمين الطبي:</label>
                <input
                  type="date"
                  value={editingDocEmp.insuranceExpiryDate || ''}
                  onChange={(e) => setEditingDocEmp({...editingDocEmp, insuranceExpiryDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">تاريخ انتهاء جواز السفر:</label>
                <input
                  type="date"
                  value={editingDocEmp.passportExpiryDate || ''}
                  onChange={(e) => setEditingDocEmp({...editingDocEmp, passportExpiryDate: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDocEmp(null)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 border-b-2 border-b-slate-300 text-slate-700 rounded-xl font-bold transition-all shadow-xs active:translate-y-0.5 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl font-bold transition-all shadow-md shadow-blue-600/30 border-b-[3px] border-blue-900 active:border-b active:translate-y-0.5 cursor-pointer"
                >
                  حفظ وتحديث الصلاحيات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
