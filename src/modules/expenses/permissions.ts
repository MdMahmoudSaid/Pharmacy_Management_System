import {authorize, type PermissionActor} from '@/modules/permissions/service';

export const authorizeExpenseCreation = (actor: PermissionActor) =>
  authorize(actor, 'expenses.create.own', actor.id);
export const authorizeExpenseView = (actor: PermissionActor, operatorId: number) =>
  authorize(actor, 'expenses.view.own', operatorId);
export const authorizeExpenseCorrection = (
  actor: PermissionActor,
  operatorId: number
) => authorize(actor, 'expenses.correct.own', operatorId);
export const authorizeExpenseCancellation = (
  actor: PermissionActor,
  operatorId: number
) => authorize(actor, 'expenses.cancel.own', operatorId);
