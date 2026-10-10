import {authorize, type PermissionActor} from '@/modules/permissions/service';

export const authorizeSaleCreation = (actor: PermissionActor) =>
  authorize(actor, 'sales.create.own', actor.id);

export const authorizePriceOverride = (actor: PermissionActor) =>
  authorize(actor, 'sales.price_override.all');
