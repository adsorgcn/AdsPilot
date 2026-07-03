/**
 * API类型验证脚本
 *
 * 用于验证前端期望的API响应格式与实际返回是否匹配
 *
 * 使用方法:
 * 1. 在浏览器Console中运行
 * 2. 或使用 ts-node scripts/validate-api-types.ts
 */

interface ValidationResult {
  endpoint: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

interface FieldDefinition {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  children?: FieldDefinition[];
}

class APIValidator {
  private results: ValidationResult[] = [];
  private baseURL: string;
  private authToken: string | null = null;

  constructor(baseURL: string = "") {
    this.baseURL = baseURL || window.location.origin;
  }

  async setAuthToken() {
    // 从Supabase获取token
    const supabase = (window as any).supabase;
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      this.authToken = data.session?.access_token || null;
    }
  }

  private async fetchAPI(
    endpoint: string,
    method: string = "GET",
    body?: any,
  ): Promise<any> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private validateField(
    data: any,
    field: FieldDefinition,
    path: string = "",
  ): string[] {
    const errors: string[] = [];
    const fullPath = path ? `${path}.${field.name}` : field.name;

    // 检查字段是否存在
    if (!(field.name in data)) {
      if (field.required) {
        errors.push(`Missing required field: ${fullPath}`);
      }
      return errors;
    }

    const value = data[field.name];

    // 检查类型
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== field.type && value !== null) {
      errors.push(
        `Type mismatch at ${fullPath}: expected ${field.type}, got ${actualType}`,
      );
    }

    // 递归检查子字段
    if (field.children && typeof value === "object" && value !== null) {
      for (const child of field.children) {
        errors.push(...this.validateField(value, child, fullPath));
      }
    }

    return errors;
  }

  async validateEndpoint(
    endpoint: string,
    expectedFields: FieldDefinition[],
    method: string = "GET",
    body?: any,
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      endpoint,
      passed: true,
      errors: [],
      warnings: [],
    };

    try {
      const data = await this.fetchAPI(endpoint, method, body);

      // 验证所有字段
      for (const field of expectedFields) {
        const fieldErrors = this.validateField(data, field);
        result.errors.push(...fieldErrors);
      }

      // 检查额外字段（警告）
      const expectedFieldNames = expectedFields.map((f) => f.name);
      const actualFieldNames = Object.keys(data);
      const extraFields = actualFieldNames.filter(
        (f) => !expectedFieldNames.includes(f),
      );

      if (extraFields.length > 0) {
        result.warnings.push(`Extra fields found: ${extraFields.join(", ")}`);
      }

      result.passed = result.errors.length === 0;
    } catch (error) {
      result.passed = false;
      result.errors.push(
        error instanceof Error ? error.message : String(error),
      );
    }

    this.results.push(result);
    return result;
  }

  printResults() {
    console.log("\n📊 API Validation Results");
    console.log("=".repeat(50));

    let passed = 0;
    let failed = 0;

    for (const result of this.results) {
      const status = result.passed ? "✅" : "❌";
      console.log(`\n${status} ${result.endpoint}`);

      if (result.errors.length > 0) {
        console.log("  Errors:");
        result.errors.forEach((err) => console.log(`    - ${err}`));
        failed++;
      } else {
        passed++;
      }

      if (result.warnings.length > 0) {
        console.log("  Warnings:");
        result.warnings.forEach((warn) => console.log(`    - ${warn}`));
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(
      `Total: ${this.results.length} | Passed: ${passed} | Failed: ${failed}`,
    );
    console.log("=".repeat(50) + "\n");

    return { total: this.results.length, passed, failed };
  }
}

// 定义API端点的期望格式
const API_SCHEMAS = {
  subscription: [
    { name: "tier", type: "string" as const, required: true },
    { name: "isActive", type: "boolean" as const, required: true },
    { name: "isElite", type: "boolean" as const, required: false },
    { name: "canUseAI", type: "boolean" as const, required: false },
    {
      name: "monthlyTokenAllocation",
      type: "number" as const,
      required: false,
    },
    { name: "currentTokenBalance", type: "number" as const, required: false },
  ],

  tokenBalance: [
    { name: "currentBalance", type: "number" as const, required: true },
    { name: "totalConsumed", type: "number" as const, required: false },
    { name: "totalGranted", type: "number" as const, required: false },
    { name: "lastUpdated", type: "string" as const, required: false },
  ],

  dashboardStats: [
    { name: "userId", type: "string" as const, required: true },
    { name: "totalOffers", type: "number" as const, required: true },
    { name: "evaluatedOffers", type: "number" as const, required: false },
    { name: "pendingEvaluations", type: "number" as const, required: false },
    { name: "tokensRemaining", type: "number" as const, required: false },
    { name: "aiEvaluationsTotal", type: "number" as const, required: false },
    { name: "recentEvaluations", type: "array" as const, required: false },
  ],

  taskStats: [
    { name: "total", type: "number" as const, required: true },
    { name: "pending", type: "number" as const, required: false },
    { name: "running", type: "number" as const, required: false },
    { name: "completed", type: "number" as const, required: false },
    { name: "failed", type: "number" as const, required: false },
  ],

  offersList: [
    { name: "items", type: "array" as const, required: true },
    { name: "total", type: "number" as const, required: true },
    { name: "totalPages", type: "number" as const, required: false },
  ],

  checkinStatus: [
    { name: "hasCheckedInToday", type: "boolean" as const, required: true },
    { name: "currentStreak", type: "number" as const, required: false },
    { name: "totalCheckins", type: "number" as const, required: false },
  ],
};

// 主函数
async function runValidation() {
  console.log("🚀 Starting API Format Validation...\n");

  const validator = new APIValidator();

  // 设置认证token
  await validator.setAuthToken();

  // 测试各个端点
  console.log("📋 Testing Billing Service APIs...");
  await validator.validateEndpoint(
    "/api/v1/billing/subscriptions/me",
    API_SCHEMAS.subscription,
  );
  await validator.validateEndpoint(
    "/api/v1/billing/tokens/balance",
    API_SCHEMAS.tokenBalance,
  );

  console.log("📋 Testing Console Service APIs...");
  await validator.validateEndpoint(
    "/api/v1/console/dashboard/stats",
    API_SCHEMAS.dashboardStats,
  );
  await validator.validateEndpoint(
    "/api/v1/console/tasks/stats",
    API_SCHEMAS.taskStats,
  );

  console.log("📋 Testing Offer Service APIs...");
  await validator.validateEndpoint("/api/v1/offers", API_SCHEMAS.offersList);

  console.log("📋 Testing UserActivity Service APIs...");
  await validator.validateEndpoint(
    "/api/v1/check-in/status",
    API_SCHEMAS.checkinStatus,
  );

  // 打印结果
  const summary = validator.printResults();

  return summary;
}

// 导出供浏览器Console使用
if (typeof window !== "undefined") {
  (window as any).validateAPIs = runValidation;
  console.log("💡 Run validateAPIs() in console to start validation");
}

// 如果是Node环境，直接运行
if (typeof window === "undefined") {
  runValidation().then((summary) => {
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}

export { runValidation, APIValidator, API_SCHEMAS };
