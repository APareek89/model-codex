import {
  ProviderError,
  createProviderTextStream,
  isProviderId,
  resolveKey,
  validateContext,
  validateMessages,
  validateModel,
} from "@/lib/providers";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 500_000) {
      return Response.json({ error: "Request is too large." }, { status: 413 });
    }

    const body = await request.json() as Record<string, unknown>;
    if (!isProviderId(body.provider)) {
      return Response.json({ error: "Choose a supported provider." }, { status: 400 });
    }

    const model = validateModel(body.model);
    const messages = validateMessages(body.messages);
    const context = validateContext(body.context);
    const key = resolveKey(body.provider, body.sessionKey);
    const stream = await createProviderTextStream({
      provider: body.provider,
      key,
      model,
      messages,
      context,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "The request body is not valid JSON." }, { status: 400 });
    }
    return Response.json({ error: "The model request failed unexpectedly." }, { status: 500 });
  }
}
