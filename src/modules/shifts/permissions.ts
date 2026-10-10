import type {PermissionActor} from '@/modules/permissions/service';
import {authorize} from '@/modules/permissions/service';

export const authorizeShiftView = (
  actor: PermissionActor,
  ownerId: number
) => authorize(actor, 'shifts.view.own', ownerId);
