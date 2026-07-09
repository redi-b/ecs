export async function requestMedusa(fetcher: typeof fetch, input: URL, init: RequestInit) {
  try {
    return await fetcher(input, init);
  } catch {
    return Response.json({}, { status: 503 });
  }
}


export function getAdminHeaders(adminApiToken: string) {
  return {
    accept: "application/json",
    authorization: `Basic ${adminApiToken}`,
    "content-type": "application/json",
  };
}


export function missingCredentials() {
  return {
    ok: false,
    error: "commerce_credentials_missing",
    status: 503,
  } as const;
}

