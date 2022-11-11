import https from "https";
import { headers } from ".";
import { handler } from "../backend-common";

const putRoamJSUser = ({
  token,
  data,
  extensionId = process.env.ROAMJS_EXTENSION_ID || "",
  dev = process.env.NODE_ENV === "development",
}: {
  token: string;
  data: { [k: string]: unknown };
  extensionId?: string;
  email?: string;
  dev?: boolean;
}) => handler({ method: "PUT_USER", data, dev, extension: extensionId, token });

export const awsPutRoamJSUser = (
  event: { headers: { [k: string]: string } },
  data: Record<string, unknown>
) =>
  putRoamJSUser({
    token: event.headers.Authorization || event.headers.authorization || "",
    data,
  })
    .then((data) => ({
      statusCode: 200,
      body: JSON.stringify(data),
      headers,
    }))
    .catch((e: Error) => ({
      statusCode: Number(e.name) || 500,
      body: e.message,
      headers,
    }));

export default putRoamJSUser;
