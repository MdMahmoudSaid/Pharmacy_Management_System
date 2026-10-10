'use client';

import {Check, ChevronDown, Plus} from 'lucide-react';
import {useId, useRef, useState, useTransition, type KeyboardEvent} from 'react';

export type SearchSelectOption = {id: number; label: string; hint?: string};

type Row = {kind: 'option'; option: SearchSelectOption} | {kind: 'create'; label: string};

/**
 * A text field that opens a filterable list; the chosen option's id is submitted under `name`.
 * With `create`, typing a name that is not in the list offers to add it.
 */
export function SearchSelect({
  options: initial,
  name,
  defaultValue,
  label,
  placeholder,
  emptyText,
  noMatchText,
  invalidText,
  create
}: {
  options: SearchSelectOption[];
  name: string;
  defaultValue?: number | null;
  label: string;
  placeholder: string;
  emptyText: string;
  noMatchText: string;
  invalidText: string;
  create?: {
    label: (text: string) => string;
    run: (text: string) => Promise<{option: SearchSelectOption} | {error: string}>;
    sort?: (left: SearchSelectOption, right: SearchSelectOption) => number;
  };
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState(initial);
  const [selected, setSelected] = useState<SearchSelectOption | null>(
    () => initial.find(({id}) => id === defaultValue) ?? null
  );
  const [query, setQuery] = useState(selected?.label ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreating] = useTransition();

  const search = query.trim().toLocaleLowerCase();
  const showAll = selected !== null && query === selected.label;
  const matches = showAll || !search
    ? options
    : options.filter((option) => `${option.label} ${option.hint ?? ''}`.toLocaleLowerCase().includes(search));
  const exact = options.some((option) => option.label.toLocaleLowerCase() === search);
  const rows: Row[] = [
    ...matches.map((option) => ({kind: 'option' as const, option})),
    ...(create && search && !exact ? [{kind: 'create' as const, label: query.trim()}] : [])
  ];

  const validate = (option: SearchSelectOption | null, text: string) => {
    inputRef.current?.setCustomValidity(option || !text.trim() ? '' : invalidText);
  };

  const choose = (option: SearchSelectOption) => {
    setSelected(option);
    setQuery(option.label);
    setOpen(false);
    setError(null);
    validate(option, option.label);
  };

  const add = (text: string) => {
    if (!create) return;
    startCreating(async () => {
      const result = await create.run(text);
      if ('option' in result) {
        setOptions((current) => [...current, result.option].sort(create.sort));
        choose(result.option);
      } else {
        setError(result.error);
      }
    });
  };

  const pick = (row: Row) => (row.kind === 'option' ? choose(row.option) : add(row.label));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (rows.length ? (index + step + rows.length) % rows.length : 0));
    } else if (event.key === 'Enter' && open && rows[active]) {
      event.preventDefault();
      pick(rows[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="search-select" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <input type="hidden" name={name} value={selected?.id ?? ''} />
      <div className="search-select-field">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
          aria-label={label}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          required
          disabled={creating}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            const text = event.target.value;
            setQuery(text);
            setOpen(true);
            setActive(0);
            const match = options.find((option) => option.label === text) ?? null;
            setSelected(match);
            validate(match, text);
          }}
          onKeyDown={onKeyDown}
        />
        <ChevronDown size={18} aria-hidden="true" />
      </div>
      {open ? (
        <ul id={listId} role="listbox" className="search-select-list">
          {rows.map((row, index) => (
            <li
              key={row.kind === 'option' ? row.option.id : 'create'}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={row.kind === 'option' && row.option.id === selected?.id}
              className={[index === active ? 'is-active' : '', row.kind === 'create' ? 'is-create' : ''].join(' ').trim() || undefined}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(row)}
            >
              {row.kind === 'option' ? (
                <>
                  <span>{row.option.label}</span>
                  {row.option.hint ? <small>{row.option.hint}</small> : null}
                  {row.option.id === selected?.id ? <Check size={16} aria-hidden="true" /> : null}
                </>
              ) : (
                <>
                  <Plus size={16} aria-hidden="true" />
                  <span>{create?.label(row.label)}</span>
                </>
              )}
            </li>
          ))}
          {!rows.length ? (
            <li className="search-select-empty" role="presentation">
              {options.length ? noMatchText : emptyText}
            </li>
          ) : null}
        </ul>
      ) : null}
      {error ? <small className="form-error">{error}</small> : null}
    </div>
  );
}
