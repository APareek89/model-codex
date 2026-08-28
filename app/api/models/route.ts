import {
  ProviderError,
  isProviderId,
  listProviderModels,
  resolveKey,
} from "@/lib/providers";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!isProviderId(body.provider)) {
      return Response.json({ error: "Choose a supported provider." }, { status: 400 });
    }
    const key = resolveKey(body.provider, body.sessionKey);
    const models = await listProviderModels(body.provider, key);
    return Response.json({ models });
  } catch (error) {
    if (error instanceof ProviderError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Could not load models from this provider." }, { status: 500 });
  }
}
