import {UserRoundX} from 'lucide-react';
import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {DataState} from '@/components/data-state';
import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {can} from '@/modules/permissions/service';
import {EmployeeActions} from '@/modules/users/components/employee-actions';
import {EmployeeEditForm} from '@/modules/users/components/employee-edit-form';
import {EmployeeForm} from '@/modules/users/components/employee-form';
import {PermissionEditor} from '@/modules/users/components/permission-editor';
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
  const permissionMap = new Map<number, string[]>();
  if (canManagePermissions) {
    await Promise.all(
      employees
        .filter(({role}) => role === 'EMPLOYEE')
        .map(async ({id}) => {
          permissionMap.set(id, await getEmployeePermissions(actor, id));
        })
    );
  }

  return (
    <main className="page-content">
      <header className="page-heading">
        <div>
          <p>{t('kicker')}</p>
          <h1>{t('title')}</h1>
          <span>{t('subtitle')}</span>
        </div>
      </header>
      <div className="employees-layout">
        {can(actor, 'employees.create.all') ? (
          <EmployeeForm locale={locale} />
        ) : null}
        <section className="employee-list" aria-label={t('list')}>
          {employees.length === 0 ? (
            <DataState
              icon={<UserRoundX />}
              title={t('empty')}
              description={t('emptyDescription')}
            />
          ) : (
            employees.map((employee) => (
              <article className="employee-card" key={employee.id}>
                <div className="employee-summary">
                  <span className="avatar">{employee.name.slice(0, 1)}</span>
                  <div>
                    <h2>{employee.name}</h2>
                    <p dir="ltr">{employee.phoneE164}</p>
                  </div>
                  <span className={employee.isActive ? 'status-active' : 'status-archived'}>
                    {employee.isActive ? t('active') : t('archived')}
                  </span>
                </div>
                {employee.role === 'EMPLOYEE' ? (
                  <div className="employee-controls">
                    {can(actor, 'employees.update.all') ? (
                      <EmployeeEditForm employee={employee} locale={locale} />
                    ) : null}
                    {canManagePermissions ? (
                      <PermissionEditor
                        employeeId={employee.id}
                        selected={permissionMap.get(employee.id) ?? []}
                        locale={locale}
                      />
                    ) : null}
                    {can(actor, employee.isActive ? 'employees.archive.all' : 'employees.restore.all') ||
                    can(actor, 'employees.reset_pin.all') ? (
                      <EmployeeActions
                        employeeId={employee.id}
                        locale={locale}
                        active={employee.isActive}
                        canChangeActive={can(
                          actor,
                          employee.isActive
                            ? 'employees.archive.all'
                            : 'employees.restore.all'
                        )}
                        canResetPin={can(actor, 'employees.reset_pin.all')}
                      />
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
