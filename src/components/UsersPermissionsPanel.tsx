import { useState } from 'react';
import { Shield, Plus, Trash2 } from 'lucide-react';
import { UserPermission } from '../types/accounting';

interface UsersPermissionsPanelProps {
  users: UserPermission[];
  onUsersChange: (users: UserPermission[]) => void;
}

const ROLE_LABELS: Record<UserPermission['role'], { label: string; color: string; desc: string }> = {
  ADMIN: { label: 'مدير النظام (Admin)', color: 'bg-purple-100 text-purple-800 border-purple-200', desc: 'صلاحيات كاملة وغير مقيدة على كافة وحدات وإعدادات النظام' },
  ACCOUNTANT: { label: 'محاسب عام (Accountant)', color: 'bg-blue-100 text-blue-800 border-blue-200', desc: 'إدخال ومراجعة القيود والفواتير وترحيل السندات والتقارير' },
  CASHIER: { label: 'كاشير مبيعات (Cashier)', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', desc: 'إصدار فواتير المبيعات وسندات القبض الفورية والطباعة' },
  STOREKEEPER: { label: 'أمين مستودع (Storekeeper)', color: 'bg-amber-100 text-amber-800 border-amber-200', desc: 'أذونات الإضافة والصرف المخزني وإدارة بطاقات الأصناف' },
  AUDITOR: { label: 'مدقق مالي (Auditor)', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', desc: 'استعراض التقارير وتصدير كشوف الحسابات والمراجعة دون تعديل' },
};

export default function UsersPermissionsPanel({ users, onUsersChange }: UsersPermissionsPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<UserPermission['role']>('ACCOUNTANT');
  const [newBranch, setNewBranch] = useState('الفرع الرئيسي');

  const handleTogglePermission = (userId: string, permKey: keyof Omit<UserPermission, 'id' | 'username' | 'displayName' | 'role' | 'branch' | 'isActive'>) => {
    const updated = users.map(u => {
      if (u.id === userId) {
        if (u.role === 'ADMIN' && permKey === 'canDelete') {
          // Admin keeps all permissions
        }
        return { ...u, [permKey]: !u[permKey] };
      }
      return u;
    });
    onUsersChange(updated);
  };

  const handleToggleStatus = (userId: string) => {
    const updated = users.map(u => {
      if (u.id === userId) {
        if (u.role === 'ADMIN' && users.filter(x => x.role === 'ADMIN' && x.isActive).length <= 1 && u.isActive) {
          alert('يجب الإبقاء على مدير نظام واحد نشط على الأقل');
          return u;
        }
        return { ...u, isActive: !u.isActive };
      }
      return u;
    });
    onUsersChange(updated);
  };

  const handleAddUser = () => {
    if (!newUsername.trim() || !newDisplayName.trim()) {
      alert('يرجى كتابة اسم المستخدم والاسم الظاهر');
      return;
    }

    const usernameClean = newUsername.trim().toLowerCase();
    if (users.some(u => u.username.toLowerCase() === usernameClean)) {
      alert('اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم مستخدم آخر');
      return;
    }

    const defaultPermsByRole = {
      ADMIN: { canCreate: true, canEdit: true, canDelete: true, canPost: true, canPrint: true, canExport: true },
      ACCOUNTANT: { canCreate: true, canEdit: true, canDelete: false, canPost: true, canPrint: true, canExport: true },
      CASHIER: { canCreate: true, canEdit: false, canDelete: false, canPost: false, canPrint: true, canExport: false },
      STOREKEEPER: { canCreate: true, canEdit: true, canDelete: false, canPost: false, canPrint: true, canExport: true },
      AUDITOR: { canCreate: false, canEdit: false, canDelete: false, canPost: false, canPrint: true, canExport: true },
    }[newRole];

    const newUser: UserPermission = {
      id: `usr-${Date.now()}`,
      username: usernameClean,
      displayName: newDisplayName.trim(),
      role: newRole,
      branch: newBranch.trim() || 'الفرع الرئيسي',
      ...defaultPermsByRole,
      isActive: true,
    };

    onUsersChange([...users, newUser]);
    setNewUsername('');
    setNewDisplayName('');
    setNewRole('ACCOUNTANT');
    setShowAddModal(false);
  };

  const handleDeleteUser = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (target?.role === 'ADMIN' && users.filter(x => x.role === 'ADMIN').length <= 1) {
      alert('لا يمكن حذف حساب مدير النظام الرئيسي');
      return;
    }
    if (confirm(`هل أنت متأكد من حذف المستخدم (${target?.displayName})؟`)) {
      onUsersChange(users.filter(u => u.id !== userId));
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Info */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
          <Shield size={18} />
        </div>
        <div className="flex-1 text-xs text-purple-900 leading-relaxed">
          <p className="font-bold text-sm text-purple-950 mb-0.5">
            إدارة المستخدمين ومصفوفة الصلاحيات الدقيقة (Users & RBAC Permissions Matrix)
          </p>
          <p className="text-slate-600">
            يمكنك تخصيص الأدوار والصلاحيات الدقيقة لكل مستخدم في النظام (إضافة، تعديل، حذف، ترحيل القيود، الطباعة، وتصدير التقارير) لضمان أعلى مستويات الرقابة الداخلية وحماية البيانات المالية.
          </p>
        </div>
      </div>

      {/* Users & Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-800">حسابات مستخدمي النظام</span>
            <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">
              {users.length} مستخدمين
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="btn-3d btn-3d-purple px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5"
          >
            <Plus size={14} />
            إضافة مستخدم جديد
          </button>
        </div>

        {/* Add User Modal */}
        {showAddModal && (
          <div className="p-4 bg-purple-50/60 border-b border-purple-200 flex flex-wrap items-end gap-3 animate-in fade-in">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الدخول (Username)</label>
              <input
                type="text"
                placeholder="مثال: ahmad_acc"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                className="w-36 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الاسم الكامل / الظاهر</label>
              <input
                type="text"
                placeholder="مثال: أحمد عبد الله"
                value={newDisplayName}
                onChange={e => setNewDisplayName(e.target.value)}
                className="w-48 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الدور الوظيفي</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as any)}
                className="w-44 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold"
              >
                <option value="ADMIN">مدير النظام (Admin)</option>
                <option value="ACCOUNTANT">محاسب عام (Accountant)</option>
                <option value="CASHIER">كاشير / بائع (Cashier)</option>
                <option value="STOREKEEPER">أمين مستودع (Storekeeper)</option>
                <option value="AUDITOR">مدقق مالي (Auditor)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الفرع / الموقع</label>
              <input
                type="text"
                placeholder="الفرع الرئيسي"
                value={newBranch}
                onChange={e => setNewBranch(e.target.value)}
                className="w-36 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddUser}
                className="btn-3d btn-3d-emerald px-4 py-1.5 text-xs font-bold"
              >
                إضافة وحفظ
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn-3d btn-3d-white px-3 py-1.5 text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">المستخدم والفرع</th>
                <th className="p-3">الدور الوظيفي</th>
                <th className="p-3 text-center">إضافة (Create)</th>
                <th className="p-3 text-center">تعديل (Edit)</th>
                <th className="p-3 text-center">حذف (Delete)</th>
                <th className="p-3 text-center">ترحيل (Post)</th>
                <th className="p-3 text-center">طباعة (Print)</th>
                <th className="p-3 text-center">تصدير (Export)</th>
                <th className="p-3 text-center">الحالة</th>
                <th className="p-3 text-center">حذف الحساب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => {
                const roleMeta = ROLE_LABELS[user.role] || { label: user.role, color: 'bg-slate-100 text-slate-800' };
                const isAdmin = user.role === 'ADMIN';

                return (
                  <tr key={user.id} className={`hover:bg-slate-50/80 transition-colors ${!user.isActive ? 'opacity-50 bg-slate-50/50' : ''}`}>
                    <td className="p-3">
                      <div>
                        <p className="font-bold text-slate-900 flex items-center gap-1.5">
                          {user.displayName}
                          {isAdmin && <Shield size={13} className="text-purple-600 inline" />}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">@{user.username} • {user.branch}</p>
                      </div>
                    </td>

                    <td className="p-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleMeta.color}`}>
                        {roleMeta.label}
                      </span>
                    </td>

                    {/* Permissions Toggles */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={user.canCreate}
                        disabled={isAdmin}
                        onChange={() => handleTogglePermission(user.id, 'canCreate')}
                        className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={user.canEdit}
                        disabled={isAdmin}
                        onChange={() => handleTogglePermission(user.id, 'canEdit')}
                        className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={user.canDelete}
                        disabled={isAdmin}
                        onChange={() => handleTogglePermission(user.id, 'canDelete')}
                        className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={user.canPost}
                        disabled={isAdmin}
                        onChange={() => handleTogglePermission(user.id, 'canPost')}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={user.canPrint}
                        disabled={isAdmin}
                        onChange={() => handleTogglePermission(user.id, 'canPrint')}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={user.canExport}
                        disabled={isAdmin}
                        onChange={() => handleTogglePermission(user.id, 'canExport')}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>

                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(user.id)}
                        className={`btn-3d text-[10px] px-2.5 py-0.5 font-bold ${
                          user.isActive
                            ? 'btn-3d-emerald'
                            : 'btn-3d-white text-slate-500'
                        }`}
                      >
                        {user.isActive ? 'نشط' : 'معطل'}
                      </button>
                    </td>

                    <td className="p-3 text-center">
                      {!isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user.id)}
                          className="btn-3d btn-3d-danger-soft p-1.5"
                          title="حذف المستخدم"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">أساسي</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
