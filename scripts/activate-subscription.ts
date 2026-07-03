// scripts/activate-subscription.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = {
  pro: {
    planId: 'pro',
    planName: 'Pro',
    tokens: 10000,
  },
  max: {
    planId: 'max',
    planName: 'Max',
    tokens: 100000,
  },
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error('Usage: ts-node scripts/activate-subscription.ts <user_email> <plan_id>');
    process.exit(1);
  }

  const [userEmail, planId] = args;

  if (planId !== 'pro' && planId !== 'max') {
    console.error('Invalid plan_id. Must be "pro" or "max".');
    process.exit(1);
  }

  const plan = plans[planId];

  try {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      console.error(`User with email ${userEmail} not found.`);
      process.exit(1);
    }

    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // 1. Activate Subscription
    const subscription = await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        planId: plan.planId,
        planName: plan.planName,
        status: 'active',
        currentPeriodEnd: nextMonth,
        trialEndsAt: null,
      },
      create: {
        id: `sub_${user.id}_${Date.now()}`,
        userId: user.id,
        planId: plan.planId,
        planName: plan.planName,
        status: 'active',
        currentPeriodEnd: nextMonth,
      },
    });
    console.log(`Successfully activated "${plan.planName}" subscription for ${userEmail}.`);

    // 2. Add Tokens
    const userToken = await prisma.userToken.upsert({
        where: { userId: user.id },
        update: {
            balance: {
                increment: plan.tokens,
            },
        },
        create: {
            userId: user.id,
            balance: BigInt(plan.tokens),
        },
    });

    console.log(`Added ${plan.tokens} tokens to ${userEmail}. New balance: ${userToken.balance}.`);

  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
