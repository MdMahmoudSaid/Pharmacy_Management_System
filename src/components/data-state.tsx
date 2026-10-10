import type {ReactNode} from 'react';

export function DataState({
  icon,
  title,
  description
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="data-state">
      {icon}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
