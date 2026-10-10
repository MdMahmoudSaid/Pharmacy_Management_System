'use client';

import {useTranslations} from 'next-intl';

import {SearchSelect} from '@/components/search-select';
import type {ExpenseCategory} from '../categories';
import {quickCreateExpenseCategory} from '../category-actions';

export function CategoryPicker({categories, defaultValue, canCreate, locale, name = 'categoryId'}: {
  categories: ExpenseCategory[];
  defaultValue?: number | null;
  canCreate: boolean;
  locale: 'ar' | 'fr';
  name?: string;
}) {
  const t = useTranslations('Expenses');
  return (
    <SearchSelect
      name={name}
      options={categories.map(({id, name: label}) => ({id, label}))}
      defaultValue={defaultValue}
      label={t('category')}
      placeholder={t('categoryPlaceholder')}
      emptyText={canCreate ? t('noCategories') : t('noMatch')}
      noMatchText={t('noMatch')}
      invalidText={t('pickCategory')}
      create={canCreate ? {
        label: (text) => t('createCategory', {name: text}),
        sort: (left, right) => left.label.localeCompare(right.label, locale),
        run: async (text) => {
          const result = await quickCreateExpenseCategory(text, locale);
          if (result?.ok && result.data) return {option: {id: result.data.id, label: result.data.name}};
          return {error: t(`errors.${result?.ok === false ? result.code : 'INTERNAL_ERROR'}`)};
        }
      } : undefined}
    />
  );
}
