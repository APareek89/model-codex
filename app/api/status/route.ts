import { PROVIDERS, getEnvironmentKey } from "@/lib/providers";

export const runtime = "edge";

export async function GET() {
  const configured = Object.fromEntries(
    Object.keys(PROVIDERS).map((provider) => [
      provider,
      Boolean(getEnvironmentKey(provider as keyof typeof PROVIDERS)),
    ]),
  );
  return Response.json({ configured });
}
