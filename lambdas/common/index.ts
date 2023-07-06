import Stripe from "stripe";
import { setClerkApiKey, users, User } from "@clerk/clerk-sdk-node";
import type { APIGatewayProxyHandler } from "aws-lambda";
import AWS from "aws-sdk";
import AES from "crypto-js/aes";
import encutf8 from "crypto-js/enc-utf8";

export const ses = new AWS.SES({ apiVersion: "2010-12-01" });
export const dynamo = new AWS.DynamoDB({ apiVersion: "2012-08-10" });

export const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
};

export const roamjsHeaders = {
  "Access-Control-Allow-Origin": "https://roamjs.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
};

export const invalidTokenResponse = {
  statusCode: 401,
  body: "Invalid user token. Please make sure you've added your token from https://roamjs.com/user/#Extensions to Roam by entering `Set RoamJS Token` in the command palette. Also make sure that you are logged in to Roam with the same email that is registered with RoamJS.",
  headers,
};

export const getStripe = () =>
  new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2020-08-27",
  });

const TableName = "RoamJSExtensions";

export const getExtensionUserId = (extension: string): Promise<string> =>
  dynamo
    .getItem({
      TableName,
      Key: { id: { S: extension } },
    })
    .promise()
    .then((r) => r.Item.user?.S);

export const setupClerk = (dev?: boolean | string) => {
  if (dev) {
    setClerkApiKey(process.env.CLERK_DEV_API_KEY);
  } else {
    setClerkApiKey(process.env.CLERK_API_KEY);
  }
};

const normalizeHeaders = (hdrs: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(hdrs).map(([k, v]) => [k.toLowerCase(), v])
  );

export const getUsersByEmail = (email: string, dev?: boolean) => {
  setupClerk(dev);
  return users.getUserList({ emailAddress: [email] });
};

export const getUser = (id: string, dev?: boolean) => {
  setupClerk(dev);
  return users.getUser(id);
};

export const authenticateUser = (
  Authorization: string,
  dev?: boolean
): Promise<User> => {
  const encryptionSecret = dev
    ? process.env.ENCRYPTION_SECRET_DEV
    : process.env.ENCRYPTION_SECRET;
  const [email, token] = Buffer.from(
    Authorization.replace(/^Bearer /, ""),
    "base64"
  )
    .toString()
    .split(":");
  return getUsersByEmail(email, dev)
    .then((us) => {
      return us.find((u) => {
        const stored = AES.decrypt(
          u.privateMetadata.token as string,
          encryptionSecret
        ).toString(encutf8);
        return stored && stored === token;
      });
    })
    .catch((e) => {
      console.error(e);
      return undefined;
    });
};

export const authenticateDeveloper =
  (handler: APIGatewayProxyHandler): APIGatewayProxyHandler =>
  (event, ctx, callback) => {
    const Authorization =
      event.headers.Authorization || event.headers.authorization || "";

    return authenticateUser(Authorization).then(async (user) => {
      if (!user) {
        return {
          statusCode: 401,
          body: "Invalid developer token",
          headers,
        };
      }

      event.requestContext.authorizer = { user };
      const result = handler(event, ctx, callback);
      if (!result) {
        return {
          statusCode: 204,
          body: "",
          headers,
        };
      }
      return result.catch((e) => ({
        statusCode: 500,
        body: e.message,
        headers,
      }));
    });
  };

export const idToCamel = (extensionId: string) =>
  extensionId
    .split("-")
    .map((s, i) =>
      i == 0 ? s : `${s.substring(0, 1).toUpperCase()}${s.substring(1)}`
    )
    .join("");
