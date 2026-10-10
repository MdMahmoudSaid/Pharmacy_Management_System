import {authorize, type PermissionActor} from '@/modules/permissions/service';

export const authorizeSaleCreation = (actor: PermissionActor) =>
  authorize(actor, 'sales.create.own', actor.id);

export const authorizePriceOverride = (actor: PermissionActor) =>
  authorize(actor, 'sales.price_override.all');

export const authorizeSaleCorrection = (
  actor: PermissionActor,
  operatorId: number
) => authorize(actor, 'sales.correct.own', operatorId);

export const authorizeSaleCancellation = (
  actor: PermissionActor,
  operatorId: number
) => authorize(actor, 'sales.cancel.own', operatorId);

export const authorizeSaleView = (actor: PermissionActor, operatorId: number) =>
  authorize(actor, 'sales.view.own', operatorId);
