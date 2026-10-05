import { withSupabase, type SupabaseContext } from "npm:@supabase/server@1";

const allowedFields = new Set([
  "name",
  "slug",
  "email",
  "telefone",
  "whatsapp",
  "logo_url",
]);

type ProvisioningInput = {
  name: string;
  slug: string;
  email: string;
  telefone: string;
  whatsapp: string;
  logo_url: string;
};

type AttemptStatus =
  | "auth_creation_unknown"
  | "compensation_required"
  | "compensated"
  | "database_commit_unknown"
  | "notification_pending"
  | "notified";

type AdminClient = SupabaseContext["supabaseAdmin"];

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function parseAllowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("PROVISIONING_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function normalizeSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function optionalText(value: unknown, field: string, maxLength: number): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new Error(`invalid_${field}`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`invalid_${field}`);
  return trimmed;
}

function validateInput(value: unknown): ProvisioningInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_body");
  }

  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error("invalid_body");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new Error("invalid_body");
  }

  if (typeof input.name !== "string" || typeof input.slug !== "string" ||
    typeof input.email !== "string") {
    throw new Error("invalid_body");
  }

  const name = input.name.trim();
  const slug = normalizeSlug(input.slug.trim());
  const email = input.email.trim().toLowerCase();
  if (!name || name.length > 160) throw new Error("invalid_name");
  if (!slug || slug.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("invalid_slug");
  }
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("invalid_email");
  }

  const telefone = optionalText(input.telefone, "telefone", 40);
  const whatsapp = optionalText(input.whatsapp, "whatsapp", 40);
  const logo_url = optionalText(input.logo_url, "logo_url", 2048);
  if (logo_url) {
    let url: URL;
    try {
      url = new URL(logo_url);
    } catch {
      throw new Error("invalid_logo_url");
    }
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      throw new Error("invalid_logo_url");
    }
  }

  return { name, slug, email, telefone, whatsapp, logo_url };
}

async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("invalid_content_type");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_body");
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > 16_384) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function randomPassword(): string {
  const random = new Uint8Array(48);
  crypto.getRandomValues(random);
  return btoa(String.fromCharCode(...random))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

async function updateAttempt(
  adminClient: AdminClient,
  attemptId: string,
  status: AttemptStatus,
  authUserId: string | null = null,
): Promise<boolean> {
  const { error } = await adminClient.rpc("set_restaurant_provision_status", {
    target_attempt_id: attemptId,
    target_status: status,
    target_auth_user_id: authUserId,
  });
  return !error;
}

async function compensateAuthUser(
  adminClient: AdminClient,
  attemptId: string,
  authUserId: string,
): Promise<void> {
  let deletionFailed: boolean;
  try {
    const { error } = await adminClient.auth.admin.deleteUser(authUserId);
    deletionFailed = Boolean(error);
  } catch {
    deletionFailed = true;
  }
  await updateAttempt(
    adminClient,
    attemptId,
    deletionFailed ? "compensation_required" : "compensated",
    authUserId,
  );
}

async function sendOwnerAccessEmail(
  email: string,
  actionLink: string,
  resendApiKey: string,
  from: string,
): Promise<boolean> {
  const safeLink = escapeHtml(actionLink);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Configure o acesso ao painel do seu restaurante",
      text: `Use este link para entrar no painel e definir sua senha: ${actionLink}`,
      html: `<p>Seu restaurante está pronto. Use o link abaixo para entrar no painel e definir sua senha:</p><p><a href="${safeLink}">Acessar painel</a></p>`,
    }),
  });
  return response.ok;
}

const provisionRequest = withSupabase(
  { auth: "user", cors: "disabled" },
  async (request, ctx): Promise<Response> => {
  const userId = ctx.userClaims?.id;
  if (!userId) {
    return jsonResponse({ error: "Autenticação obrigatória." }, 401);
  }

  const { data: isPlatformAdmin, error: authorizationError } = await ctx.supabaseAdmin.rpc(
    "is_platform_admin",
    { target_user_id: userId },
  );
  if (authorizationError) {
    return jsonResponse({ error: "Serviço temporariamente indisponível." }, 500);
  }
  if (!isPlatformAdmin) {
    return jsonResponse({ error: "Acesso não autorizado." }, 403);
  }

  if (request.method === "GET") {
    return jsonResponse({ status: "platform_admin" }, 200);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom = Deno.env.get("PROVISIONING_EMAIL_FROM");
  const redirectUrl = Deno.env.get("PROVISIONING_REDIRECT_URL");
  const allowedOrigins = parseAllowedOrigins();
  if (!resendApiKey || !emailFrom || !redirectUrl) {
    return jsonResponse({ error: "Serviço temporariamente indisponível." }, 500);
  }
  try {
    const parsedRedirectUrl = new URL(redirectUrl);
    if (
      parsedRedirectUrl.protocol !== "https:" ||
      !allowedOrigins.has(parsedRedirectUrl.origin)
    ) {
      throw new Error("invalid_redirect_url");
    }
  } catch {
    return jsonResponse({ error: "Serviço temporariamente indisponível." }, 500);
  }

  let rawBody: unknown;
  try {
    rawBody = await readJsonBody(request);
  } catch {
    return jsonResponse({ error: "Dados inválidos." }, 400);
  }

  let input: ProvisioningInput;
  try {
    input = validateInput(rawBody);
  } catch {
    return jsonResponse({ error: "Dados inválidos. Verifique os campos informados." }, 400);
  }

  const attemptId = crypto.randomUUID();
  const { error: beginError } = await ctx.supabaseAdmin.rpc("begin_restaurant_provision", {
    target_attempt_id: attemptId,
    target_platform_admin_user_id: userId,
    target_email: input.email,
  });
  if (beginError) {
    return jsonResponse({ error: "Não foi possível iniciar o provisionamento." }, 500);
  }

  const { data: createdAuth, error: createAuthError } = await ctx.supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: {},
  });
  if (createAuthError || !createdAuth.user) {
    await updateAttempt(ctx.supabaseAdmin, attemptId, "auth_creation_unknown");
    return jsonResponse({
      error: "Provisionamento pendente de reconciliação.",
      requestId: attemptId,
    }, 502);
  }

  const authUserId = createdAuth.user.id;
  const { error: recordUserError } = await ctx.supabaseAdmin.rpc(
    "record_restaurant_provision_auth_user",
    { target_attempt_id: attemptId, target_auth_user_id: authUserId },
  );
  if (recordUserError) {
    await compensateAuthUser(ctx.supabaseAdmin, attemptId, authUserId);
    return jsonResponse({
      error: "Não foi possível concluir o provisionamento.",
      requestId: attemptId,
    }, 500);
  }

  const { error: finalizeError } = await ctx.supabaseAdmin.rpc("finalize_restaurant_provision", {
    target_attempt_id: attemptId,
    target_name: input.name,
    target_slug: input.slug,
    target_telefone: input.telefone,
    target_whatsapp: input.whatsapp,
    target_logo_url: input.logo_url,
  });
  if (finalizeError) {
    const { data: attemptStates, error: stateError } = await ctx.supabaseAdmin.rpc(
      "get_restaurant_provision_status",
      { target_attempt_id: attemptId },
    );
    const attemptState = Array.isArray(attemptStates) ? attemptStates[0] : null;

    if (stateError || !attemptState) {
      await updateAttempt(ctx.supabaseAdmin, attemptId, "database_commit_unknown", authUserId);
      return jsonResponse({
        status: "provisioning_reconciliation_required",
        requestId: attemptId,
      }, 202);
    }

    if (attemptState.status === "completed" && attemptState.restaurant_id) {
      // The transaction committed but its response was lost; do not delete its owner.
    } else if (attemptState.status === "auth_created") {
      await compensateAuthUser(ctx.supabaseAdmin, attemptId, authUserId);
      return jsonResponse({
        error: finalizeError.code === "23505"
          ? "Não foi possível provisionar: o slug pode já estar em uso."
          : "Não foi possível concluir o provisionamento.",
        requestId: attemptId,
      }, finalizeError.code === "23505" ? 409 : 500);
    } else {
      return jsonResponse({
        status: "provisioning_reconciliation_required",
        requestId: attemptId,
      }, 202);
    }
  }

  let actionLink: string | undefined;
  try {
    const { data: linkData, error: linkError } = await ctx.supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: input.email,
      options: { redirectTo: redirectUrl },
    });
    if (linkError) throw new Error("link_generation_failed");
    actionLink = linkData.properties.action_link;
    if (!actionLink) throw new Error("link_generation_failed");

    const sent = await sendOwnerAccessEmail(input.email, actionLink, resendApiKey, emailFrom);
    if (!sent) throw new Error("email_delivery_failed");
  } catch {
    await updateAttempt(ctx.supabaseAdmin, attemptId, "notification_pending", authUserId);
    return jsonResponse({
      status: "provisioned_notification_pending",
      requestId: attemptId,
    }, 202);
  }

  await updateAttempt(ctx.supabaseAdmin, attemptId, "notified", authUserId);
  return jsonResponse({ status: "provisioned", requestId: attemptId }, 201);
});

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin");
  const allowedOrigins = parseAllowedOrigins();
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ error: "Origem não autorizada." }, 403);
  }
  if (request.method === "OPTIONS") {
    if (origin && allowedOrigins.has(origin)) {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-retry-count",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Vary": "Origin",
        },
      });
    }
    return new Response(null, { status: 204 });
  }
  if (request.method !== "POST" && request.method !== "GET") {
    const response = jsonResponse({ error: "Método não permitido." }, 405);
    if (origin && allowedOrigins.has(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Vary", "Origin");
    }
    return response;
  }

  const response = await provisionRequest(request);
  if (!origin || !allowedOrigins.has(origin)) return response;

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info, x-retry-count");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
