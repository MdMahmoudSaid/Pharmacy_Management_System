'use client';

import {useTranslations} from 'next-intl';
import {useState} from 'react';

import type {ReportFilterKey} from '../catalog';

type Values = {
  preset: string;
  from: string;
  to: string;
  employee: string;
  status: string;
  category: string;
  type: string;
  level: string;
};

export function ReportFilterForm({filters, values, presets, employees, categories, movementTypes}: {
  filters: readonly ReportFilterKey[];
  values: Values;
  presets: readonly string[];
  employees: {id: number; name: string}[];
  categories: {id: number; name: string}[];
  movementTypes: readonly string[];
}) {
  const t = useTranslations('Reports');
  const [preset, setPreset] = useState(values.preset);
  if (!filters.length) return null;
  const has = (key: ReportFilterKey) => filters.includes(key);
  return (
    <form className="rpt-filters no-print">
      {has('period') ? (
        <>
          <label className="rpt-field-wide">
            <span>{t('filters.period')}</span>
            <select name="preset" value={preset} onChange={(event) => setPreset(event.target.value)}>
              {presets.map((key) => <option key={key} value={key}>{t(`presets.${key}` as 'presets.today')}</option>)}
              <option value="custom">{t('presets.custom')}</option>
            </select>
          </label>
          <label>
            <span>{t('filters.from')}</span>
            <input type="date" name="from" defaultValue={values.from} onChange={() => setPreset('custom')} />
          </label>
          <label>
            <span>{t('filters.to')}</span>
            <input type="date" name="to" defaultValue={values.to} onChange={() => setPreset('custom')} />
          </label>
        </>
      ) : null}
      {has('employee') && employees.length ? (
        <label>
          <span>{t('filters.employee')}</span>
          <select name="employee" defaultValue={values.employee}>
            <option value="">{t('filters.all')}</option>
            {employees.map(({id, name}) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      ) : null}
      {has('saleStatus') ? (
        <label>
          <span>{t('filters.status')}</span>
          <select name="status" defaultValue={values.status}>
            <option value="">{t('filters.all')}</option>
            <option value="COMPLETED">{t('statuses.COMPLETED')}</option>
            <option value="CANCELLED">{t('statuses.CANCELLED')}</option>
          </select>
        </label>
      ) : null}
      {has('category') ? (
        <label>
          <span>{t('filters.category')}</span>
          <select name="category" defaultValue={values.category}>
            <option value="">{t('filters.all')}</option>
            {categories.map(({id, name}) => <option key={id} value={id}>{name}</option>)}
            <option value="none">{t('uncategorized')}</option>
          </select>
        </label>
      ) : null}
      {has('movementType') ? (
        <label>
          <span>{t('filters.movementType')}</span>
          <select name="type" defaultValue={values.type}>
            <option value="">{t('filters.all')}</option>
            {movementTypes.map((type) => <option key={type} value={type}>{t(`movementTypes.${type}` as 'movementTypes.SALE')}</option>)}
          </select>
        </label>
      ) : null}
      {has('stockLevel') ? (
        <label>
          <span>{t('filters.stockLevel')}</span>
          <select name="level" defaultValue={values.level}>
            <option value="">{t('filters.all')}</option>
            <option value="available">{t('levels.ok')}</option>
            <option value="low">{t('levels.low')}</option>
            <option value="out">{t('levels.out')}</option>
          </select>
        </label>
      ) : null}
      <button className="primary-action">{t('filters.apply')}</button>
    </form>
  );
}
