import {sql} from 'drizzle-orm';
import Decimal from 'decimal.js';

import {db} from '@/db/client';
import {capitalMovements} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {appendAudit} from '@/modules/audit/service';
import {authorize, type PermissionActor} from '@/modules/permissions/service';
import {capitalMovementInputSchema} from './schemas';
import {getCashSnapshot, lockCashLedger} from './cash';

export async function recordCapitalMovement(
  actor: PermissionActor,
  rawInput: {
    type: 'ADDITION' | 'WITHDRAWAL';
    amount: string;
    source?: 'PROFIT' | 'CAPITAL';
    allowCapitalFallback?: boolean;
    note?: string;
    occurredAt?: Date;
  }
) {
  authorize(actor, 'accounts.manage.all');
  const input = capitalMovementInputSchema.parse(rawInput);
  return db.transaction(async (tx) => {
    // Capital has a single global balance. The advisory transaction lock keeps
    // two simultaneous withdrawals from both validating against the same sum.
    await tx.execute(sql`select pg_advisory_xact_lock(820241024)`);
    await lockCashLedger(tx);
    let profitPortion = '0.00';
    let capitalPortion = '0.00';
    if (input.type === 'WITHDRAWAL') {
      const snapshot = await getCashSnapshot(tx);
      const amount = new Decimal(input.amount);
      const availableProfit = new Decimal(snapshot.withdrawableProfit);
      const availableCapital = new Decimal(snapshot.capital);
      const source = input.source ?? 'PROFIT';

      if (source === 'CAPITAL') {
        if (amount.greaterThan(availableCapital)) throw new AppError('INSUFFICIENT_CAPITAL');
        capitalPortion = amount.toFixed(2);
      } else if (amount.lessThanOrEqualTo(availableProfit)) {
        profitPortion = amount.toFixed(2);
      } else {
        const remainder = amount.minus(availableProfit);
        if (remainder.greaterThan(availableCapital)) throw new AppError('INSUFFICIENT_PROFIT');
        if (!input.allowCapitalFallback) throw new AppError('CAPITAL_CONFIRMATION_REQUIRED');
        profitPortion = availableProfit.toFixed(2);
        capitalPortion = remainder.toFixed(2);
      }

      if (amount.greaterThan(snapshot.cash)) throw new AppError('INSUFFICIENT_CASH');
    }
    const [movement] = await tx
      .insert(capitalMovements)
      .values({
        type: input.type,
        amount: input.amount,
        note: input.note,
        profitPortion,
        capitalPortion,
        occurredAt: input.occurredAt ?? new Date(),
        operatorId: actor.id
      })
      .returning();
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'capital_movements',
      entityId: movement.id,
      action: 'CREATE',
      newValues: {
        type: movement.type,
        amount: movement.amount,
        profitPortion: movement.profitPortion,
        capitalPortion: movement.capitalPortion
      },
      relatedTransactionType: 'CAPITAL_MOVEMENT',
      relatedTransactionId: movement.id
    });
    return movement;
  });
}
