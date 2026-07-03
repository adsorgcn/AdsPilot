type ScenarioInput = {
  tokenConsumption: number;
  adSpend: number;
  teamMembers: number;
};

export type PlanCode = 'trial' | 'pro' | 'max' | 'elite';

type PlanInfo = {
  code: PlanCode;
  label: string;
  basePrice: number;
  includedTokens: number;
  overagePrice: number;
  maxSeats: number;
  description: string;
};

const Plans: PlanInfo[] = [
  {
    code: 'trial',
    label: 'Starter',
    basePrice: 0,
    includedTokens: 10_000,
    overagePrice: 0.002,
    maxSeats: 2,
    description: '适合初创团队的基础套餐',
  },
  {
    code: 'pro',
    label: 'Growth',
    basePrice: 149,
    includedTokens: 120_000,
    overagePrice: 0.0018,
    maxSeats: 10,
    description: '适合中小团队的进阶套餐',
  },
  {
    code: 'max',
    label: 'Scale',
    basePrice: 349,
    includedTokens: 320_000,
    overagePrice: 0.0015,
    maxSeats: 25,
    description: '面向多渠道投放的规模化套餐',
  },
  {
    code: 'elite',
    label: 'Enterprise',
    basePrice: 699,
    includedTokens: 700_000,
    overagePrice: 0.0012,
    maxSeats: 50,
    description: '企业级多团队协作与支持',
  },
];

type EstimateResult = {
  plan: PlanInfo;
  monthlyCost: number;
  tokenOverage: number;
  paygCost: number;
};

export function estimateTokenCosts(input: ScenarioInput): EstimateResult {
  const { tokenConsumption, adSpend, teamMembers } = input;

  // 假设广告预算与 Token 消耗有 1:100 的比例影响，适当增加消耗估算
  const adjustedTokenNeed = Math.max(0, tokenConsumption + adSpend * 100);

  // 需要额外考虑团队成员可能的加成（超过免费席位后按比例增加）-- 简化为 seatsFactor
  const seatsFactor = Math.max(1, teamMembers / 3);
  const normalizedTokenNeed = adjustedTokenNeed * seatsFactor;

  // Pay-as-you-go 简单估算
  const paygCost = normalizedTokenNeed * 0.0022;

  const evaluatedPlans = Plans.map((plan) => {
    const overage = Math.max(0, normalizedTokenNeed - plan.includedTokens);
    const overageBills = overage * plan.overagePrice;
    const total = plan.basePrice + overageBills;

    return {
      plan,
      monthlyCost: Number(total.toFixed(2)),
      tokenOverage: Math.max(0, Math.round(overage)),
      paygCost: Number(paygCost.toFixed(2)),
    };
  });

  // 根据是否超过座位数过滤不可行的套餐
  const feasiblePlans = evaluatedPlans.filter(
    ({ plan }) => teamMembers <= plan.maxSeats,
  );

  const sortedByCost = (feasiblePlans.length ? feasiblePlans : evaluatedPlans).sort(
    (a, b) => a.monthlyCost - b.monthlyCost,
  );

  return sortedByCost[0];
}
