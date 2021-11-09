import { authenticate, getUserFromEvent, headers } from "./common";
import type { EmailAddress } from "@clerk/clerk-sdk-node";

const normalize = (hdrs: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(hdrs).map(([k, v]) => [k.toLowerCase(), v])
  );

export const handler = authenticate(async (event) => {
  const hs = normalize(event.headers);
  const service = hs["x-roamjs-service"];
  const token = hs["x-roamjs-token"];
  const dev = !!hs["x-roamjs-dev"];
  return getUserFromEvent(token, service, dev)
    .then((user) => {
      if (!user) {
        return {
          statusCode: 401,
          body: "Invalid token",
          headers,
        };
      }
      const {
        token: storedToken,
        authenticated,
        ...data
      } = (
        user.publicMetadata as {
          [s: string]: { token: string; authenticated: boolean };
        }
      )?.[service] || ({} as { token: string; authenticated: boolean });
      return {
        statusCode: 200,
        body: JSON.stringify({
          ...data,
          email: user.emailAddresses.find(
            (e) => e.id === user.primaryEmailAddressId
          )?.emailAddress,
        }),
        headers,
      };
    })
    .catch((e) => ({
      statusCode: e.status || 500,
      body: e.response.data || e.message,
      headers,
    }));
});
