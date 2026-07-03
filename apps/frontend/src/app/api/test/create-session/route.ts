import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 仅在测试/开发环境启用
const ENABLE_TEST_API = process.env.ENABLE_TEST_API === 'true' || process.env.NODE_ENV === 'development'

// Supabase配置
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

export async function POST(request: NextRequest) {
  // 安全检查：仅在测试环境启用
  if (!ENABLE_TEST_API) {
    return NextResponse.json(
      { error: 'Test API is disabled in production' },
      { status: 403 }
    )
  }

  // 验证service_role_key是否配置
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { email, role = 'user' } = body

    // 验证参数
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // 验证测试邮箱格式
    if (!email.endsWith('@autoads.dev')) {
      return NextResponse.json(
        { error: 'Only @autoads.dev test emails are allowed' },
        { status: 400 }
      )
    }

    // 创建Supabase Admin客户端
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 1. 查找或创建测试用户
    const { data: existingUser } = await supabase.auth.admin.listUsers()

    let userId: string

    const testUser = existingUser?.users?.find(u => u.email === email)

    if (testUser) {
      // 用户已存在
      userId = testUser.id
      console.log(`[Test API] Found existing test user: ${email} (${userId})`)
    } else {
      // 创建新的测试用户
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true, // 自动确认邮箱
        user_metadata: {
          full_name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
          avatar_url: '',
        },
        app_metadata: {
          role: role === 'admin' ? 'super-admin' : 'user',
          provider: 'test',
        },
      })

      if (createError || !newUser.user) {
        console.error('[Test API] Failed to create user:', createError)
        return NextResponse.json(
          { error: 'Failed to create test user', details: createError?.message },
          { status: 500 }
        )
      }

      userId = newUser.user.id
      console.log(`[Test API] Created new test user: ${email} (${userId})`)
    }

    // 2. 生成admin session link (one-time use OTP link)
    // Redirect to /auth/confirm for client-side hash fragment handling
    const { data: otpData, error: otpError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/confirm`,
      }
    })

    if (otpError || !otpData) {
      console.error('[Test API] Failed to generate OTP link:', otpError)
      return NextResponse.json(
        { error: 'Failed to generate auth link', details: otpError?.message },
        { status: 500 }
      )
    }

    // 提取hash fragment中的tokens
    // Supabase magic links格式: ...#access_token=xxx&refresh_token=yyy&...
    const actionLink = otpData.properties.action_link
    const hashPart = actionLink.split('#')[1] || ''
    const hashParams = new URLSearchParams(hashPart)

    const access_token = hashParams.get('access_token') || otpData.properties.hashed_token
    const refresh_token = hashParams.get('refresh_token') || `test-refresh-${userId}`

    if (!access_token) {
      console.error('[Test API] No access_token in response:', { actionLink, hashPart })
      return NextResponse.json(
        { error: 'Failed to extract access token', action_link: actionLink },
        { status: 500 }
      )
    }

    console.log(`[Test API] Generated session for ${email}, access_token length: ${access_token.length}`)

    // 3. 返回session信息 (包含action_link用于测试)
    return NextResponse.json({
      access_token,
      refresh_token,
      user_id: userId,
      email,
      role,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1小时后过期
      action_link: actionLink, // 完整的OTP认证链接
      instructions: 'Use action_link to complete authentication in Playwright tests',
    })

  } catch (error: any) {
    console.error('[Test API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// 健康检查端点
export async function GET() {
  if (!ENABLE_TEST_API) {
    return NextResponse.json({ enabled: false, message: 'Test API is disabled' })
  }

  return NextResponse.json({
    enabled: true,
    message: 'Test session creation API is active',
    endpoint: 'POST /api/test/create-session',
    example: {
      email: 'test-user@autoads.dev',
      role: 'user', // or 'admin'
    }
  })
}
