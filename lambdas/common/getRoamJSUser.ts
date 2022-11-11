import { APIGatewayProxyResult, APIGatewayProxyHandler } from "aws-lambda";
import { headers } from ".";
import { handler, RoamJSUser } from "../backend-common";

const getRoamJSUser = ({
  token,
  extensionId = process.env.ROAMJS_EXTENSION_ID || "",
  dev = process.env.NODE_ENV === "development",
}: {
  token: string;
  extensionId?: string;
  email?: string;
  dev?: boolean;
  params?: Record<string, string>;
}): Promise<RoamJSUser> => {
  return handler({
    method: "GET_USER",
    token,
    dev,
    extension: extensionId,
  }).then((u) => {
    if (typeof u === "string") throw new Error(u);
    return u as RoamJSUser;
  });
};

export const awsGetRoamJSUser =
  <T = Record<string, unknown>>(
    handler: (
      u: RoamJSUser & { token: string },
      body: T
    ) => Promise<APIGatewayProxyResult>,
    params?: Record<string, string>
  ): APIGatewayProxyHandler =>
  (event) => {
    const token =
      event.headers.Authorization || event.headers.authorization || "";
    return getRoamJSUser({ token, params })
      .then((u) =>
        handler({ ...u, token }, {
          ...event.queryStringParameters,
          ...JSON.parse(event.body || "{}"),
        } as T)
      )
      .catch((e) => ({
        statusCode: Number(e.name) || 500,
        body: e.message,
        headers,
      }));
  };

export default getRoamJSUser;
