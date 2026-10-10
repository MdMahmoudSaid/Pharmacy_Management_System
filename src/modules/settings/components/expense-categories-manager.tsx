'use client';

import {Plus, Trash2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState, useState} from 'react';

import {ConfirmForm} from '@/components/confirm-form';
import type {ExpenseCategory} from '@/modules/expenses/categories';
import {
  createCategoryAction,
  deleteCategoryAction,
  renameCategoryAction,
  type CategoryActionState
} from '@/modules/expenses/category-actions';

function errorMessage(t: ReturnType<typeof useTranslations<'Settings'>>, state: CategoryActionState) {
  if (!state || state.ok) return null;
  const code = ['CONFLICT', 'VALIDATION_ERROR', 'FORBIDDEN', 'NOT_FOUND'].includes(state.code) ? state.code : 'INTERNAL_ERROR';
  return <small className="form-error" role="alert">{t(`errors.${code as 'CONFLICT'}`)}</small>;
}

function CategoryRow({category, locale}: {category: ExpenseCategory; locale: 'ar' | 'fr'}) {
  const t = useTranslations('Settings');
  const [renameState, rename, renaming] = useActionState<CategoryActionState, FormData>(renameCategoryAction, undefined);
  const [deleteState, remove, deleting] = useActionState<CategoryActionState, FormData>(deleteCategoryAction, undefined);
  return (
    <li>
      <form action={rename} className="category-rename">
        <input type="hidden" name="id" value={category.id} />
        <input type="hidden" name="locale" value={locale} />
        <input name="name" defaultValue={category.name} aria-label={t('newCategory')} maxLength={80} required />
        <button className="secondary-action" disabled={renaming}>{t('rename')}</button>
      </form>
      <ConfirmForm action={remove} message={t('deleteConfirm', {name: category.name})}>
        <input type="hidden" name="id" value={category.id} />
        <input type="hidden" name="locale" value={locale} />
        <button className="category-delete" disabled={deleting} aria-label={`${t('deleteCategory')} ${category.name}`}>
          <Trash2 size={17} aria-hidden="true" />
          <span>{t('deleteCategory')}</span>
        </button>
      </ConfirmForm>
      {errorMessage(t, renameState) ?? errorMessage(t, deleteState)}
      {renameState?.ok ? <small className="form-success" role="status">{t('categorySaved')}</small> : null}
    </li>
  );
}

export function ExpenseCategoriesManager({categories, locale}: {categories: ExpenseCategory[]; locale: 'ar' | 'fr'}) {
  const t = useTranslations('Settings');
  const [state, create, pending] = useActionState<CategoryActionState, FormData>(createCategoryAction, undefined);
  // A new key after each success clears the form; a failed attempt keeps what was typed.
  const [formKey, setFormKey] = useState(0);
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) setFormKey((key) => key + 1);
  }

  return (
    <section className="settings-card expense-categories" aria-labelledby="expense-categories-title">
      <header>
        <h2 id="expense-categories-title">{t('categoriesTitle')}</h2>
        <p>{t('categoriesHint')}</p>
      </header>
      <form key={formKey} action={create} className="category-create">
        <input type="hidden" name="locale" value={locale} />
        <input name="name" placeholder={t('newCategory')} aria-label={t('newCategory')} maxLength={80} required />
        <button className="primary-action" disabled={pending}><Plus size={18} aria-hidden="true" />{t('addCategory')}</button>
      </form>
      {errorMessage(t, state)}
      {categories.length ? (
        <ul className="category-list">
          {categories.map((category) => <CategoryRow key={category.id} category={category} locale={locale} />)}
        </ul>
      ) : <p className="category-empty">{t('noCategories')}</p>}
    </section>
  );
}
