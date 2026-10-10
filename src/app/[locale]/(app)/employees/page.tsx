import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {can} from '@/modules/permissions/service';
import {EmployeeForm} from '@/modules/users/components/employee-form';
import {EmployeeList} from '@/modules/users/components/employee-list';
import {
  getEmployeePermissions,
  listEmployees
} from '@/modules/users/queries';

export default async function EmployeesPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  const [t, employees] = await Promise.all([
    getTranslations('Employees'),
    listEmployees(actor)
  ]);
  const canManagePermissions = can(actor, 'permissions.manage.all');
  const rows = await Promise.all(
    employees.map(async (employee) => ({
      id: employee.id,
      name: employee.name,
      phoneE164: employee.phoneE164,
      role: employee.role,
      isActive: employee.isActive,
      permissions:
        canManagePermissions && employee.role === 'EMPLOYEE'
          ? await getEmployeePermissions(actor, employee.id)
          : null
    }))
  );

  return (
    <main className="page-content catalog-page">
      <header className="page-heading">
        <p>{t('kicker')}</p>
        <h1>{t('title')}</h1>
        <span>{t('subtitle')}</span>
      </header>
      {can(actor, 'employees.create.all') ? <EmployeeForm locale={locale} /> : null}
      <EmployeeList
        employees={rows}
        currentUserId={actor.id}
        locale={locale}
        can={{
          canEdit: can(actor, 'employees.update.all'),
          canManagePermissions,
          canArchive: can(actor, 'employees.archive.all'),
          canRestore: can(actor, 'employees.restore.all'),
          canResetPin: can(actor, 'employees.reset_pin.all')
        }}
      />
    </main>
  );
}
