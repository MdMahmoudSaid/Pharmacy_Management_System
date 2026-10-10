'use client';

import {ChevronDown, Search} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useDeferredValue, useState} from 'react';

import {EmployeeActions} from './employee-actions';
import {EmployeeEditForm} from './employee-edit-form';
import {PermissionEditor} from './permission-editor';

type Employee = {
  id: number;
  name: string;
  phoneE164: string;
  role: 'ADMIN' | 'EMPLOYEE';
  isActive: boolean;
  permissions: string[] | null;
};

type Capabilities = {
  canEdit: boolean;
  canManagePermissions: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canResetPin: boolean;
};

const FILTERS = ['active', 'archived'] as const;
type Filter = (typeof FILTERS)[number];
const filterLabel = {active: 'filterActive', archived: 'filterArchived'} as const;
type Tab = 'info' | 'permissions' | 'security';

// "+22222334455" → "+222 22 33 44 55"
export const formatPhone = (phone: string) =>
  phone.startsWith('+222') && phone.length === 12
    ? `+222 ${phone.slice(4).replace(/(\d{2})(?=\d)/g, '$1 ')}`
    : phone;

function EmployeePanel({employee, locale, can}: {employee: Employee; locale: 'ar' | 'fr'; can: Capabilities}) {
  const t = useTranslations('Employees');
  const canChangeActive = employee.isActive ? can.canArchive : can.canRestore;
  const tabs = ([
    employee.isActive && can.canEdit ? 'info' : null,
    employee.isActive && can.canManagePermissions ? 'permissions' : null,
    canChangeActive || (employee.isActive && can.canResetPin) ? 'security' : null
  ] as const).filter((tab): tab is Tab => tab !== null);
  const [tab, setTab] = useState<Tab | undefined>(tabs[0]);
  if (!tabs.length || !tab) return null;
  const tabLabel = {info: t('tabInfo'), permissions: t('permissions'), security: t('tabSecurity')};

  return (
    <details className="employee-panel">
      <summary><span>{t('manage')}</span><ChevronDown size={18} aria-hidden="true" /></summary>
      <div className="panel-tabs" role="tablist">
        {tabs.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {tabLabel[value]}
          </button>
        ))}
      </div>
      {/* Hidden rather than unmounted so typed values survive switching tabs. */}
      <div role="tabpanel" hidden={tab !== 'info'}>
        {tabs.includes('info') ? <EmployeeEditForm employee={employee} locale={locale} /> : null}
      </div>
      <div role="tabpanel" hidden={tab !== 'permissions'}>
        {tabs.includes('permissions') ? (
          <PermissionEditor employeeId={employee.id} selected={employee.permissions ?? []} locale={locale} />
        ) : null}
      </div>
      <div role="tabpanel" hidden={tab !== 'security'}>
        {tabs.includes('security') ? (
          <EmployeeActions
            employeeId={employee.id}
            name={employee.name}
            locale={locale}
            active={employee.isActive}
            canChangeActive={canChangeActive}
            canResetPin={can.canResetPin}
          />
        ) : null}
      </div>
    </details>
  );
}

export function EmployeeList({employees, currentUserId, locale, can}: {
  employees: Employee[];
  currentUserId: number;
  locale: 'ar' | 'fr';
  can: Capabilities;
}) {
  const t = useTranslations('Employees');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const search = useDeferredValue(query.trim().toLocaleLowerCase());
  const digits = search.replace(/\D/g, '');
  const counts = {
    active: employees.filter(({isActive}) => isActive).length,
    archived: employees.filter(({isActive}) => !isActive).length
  };
  const visible = employees.filter((employee) =>
    employee.isActive === (filter === 'active') &&
    (employee.name.toLocaleLowerCase().includes(search) || (digits !== '' && employee.phoneE164.includes(digits)))
  );

  return (
    <section className="catalog" aria-label={t('list')}>
      <div className="catalog-toolbar">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} aria-label={t('search')} />
        </label>
        <div className="filter-pills" role="group" aria-label={t('list')}>
          {FILTERS.map((key) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {t(filterLabel[key])}<span>{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>
      {visible.length ? (
        <div className="medicine-rows">
          {visible.map((employee) => {
            const isAdmin = employee.role === 'ADMIN';
            return (
              <article key={employee.id} className={`employee-row${employee.isActive ? '' : ' is-archived'}`}>
                <span className="avatar" aria-hidden="true">{employee.name.trim().slice(0, 1).toLocaleUpperCase()}</span>
                <div className="medicine-row-main">
                  <strong>
                    <bdi>{employee.name}</bdi>
                    {employee.id === currentUserId ? <em className="you-badge">{t('you')}</em> : null}
                  </strong>
                  <small dir="ltr">{formatPhone(employee.phoneE164)}</small>
                </div>
                <div className="employee-badges">
                  <span className={`role-badge${isAdmin ? ' is-admin' : ''}`}>
                    {isAdmin ? t('roleAdmin') : t('roleEmployee')}
                  </span>
                  {isAdmin ? (
                    <span className="permission-count">{t('allPermissions')}</span>
                  ) : employee.permissions ? (
                    <span className="permission-count">{t('permissionCount', {count: employee.permissions.length})}</span>
                  ) : null}
                  {employee.isActive ? null : <span className="stock-badge is-archived">{t('archived')}</span>}
                </div>
                {isAdmin ? null : <EmployeePanel employee={employee} locale={locale} can={can} />}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="catalog-empty">{employees.length ? t('noResults') : t('emptyDescription')}</p>
      )}
    </section>
  );
}
