do $$
begin
  create role pharmacy_app nologin;
exception
  when duplicate_object then null;
end
$$;
--> statement-breakpoint
grant pharmacy_app to current_user;
--> statement-breakpoint
grant usage on schema public to pharmacy_app;
--> statement-breakpoint
grant select, insert, update, delete on all tables in schema public to pharmacy_app;
--> statement-breakpoint
grant usage, select on all sequences in schema public to pharmacy_app;
--> statement-breakpoint
revoke update, delete on table audit_logs, stock_movements from pharmacy_app;
--> statement-breakpoint
alter default privileges in schema public
  grant select, insert, update, delete on tables to pharmacy_app;
--> statement-breakpoint
alter default privileges in schema public
  grant usage, select on sequences to pharmacy_app;
