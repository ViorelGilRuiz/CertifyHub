const api = () => new URL("/analysis", process.env.API_URL ?? "http://127.0.0.1:8000");

async function forward(method: "GET" | "POST") {
  try {
    const response = await fetch(api(), {
      method,
      headers: { "X-CertifyHub-Local": "1" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json({ detail: "El servicio de análisis no responde." }, { status: 503 });
  }
}

export const GET = () => forward("GET");

export function POST(request: Request) {
  if (request.headers.get("x-certifyhub-local") !== "1" || request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ detail: "Solicitud de análisis inválida." }, { status: 403 });
  }
  return forward("POST");
}
