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
};

export const getStripe = (dev?: boolean | string) =>
  new Stripe(
    (dev ? process.env.STRIPE_DEV_SECRET_KEY : process.env.STRIPE_SECRET_KEY) ||
      "",
    {
      apiVersion: "2020-08-27",
    }
  );

export const getTableName = (dev: boolean) =>
  dev ? "RoamJSExtensionsDev" : "RoamJSExtensions";

export const getStripePriceId = (
  extension: string,
  dev: boolean
): Promise<string> =>
  dynamo
    .getItem({
      TableName: getTableName(dev),
      Key: { id: { S: extension } },
    })
    .promise()
    .then((r) => {
      if (r.Item) return r.Item.premium?.S;
      else {
        throw new Error(`No Extension exists with id ${extension}`);
      }
    });

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

const findUser = async (predicate: (u: User) => boolean): Promise<User> => {
  let offset = 0;
  while (offset < 10000) {
    const us = await users.getUserList({ limit: 100, offset });
    const user = us.find(predicate);
    if (user) {
      return user;
    }
    if (us.length < 100) {
      return;
    }
    offset += us.length;
  }
};

export const getUserFromEvent = (
  Authorization: string,
  service: string,
  dev?: boolean
): Promise<User> => {
  if (dev) {
    setClerkApiKey(process.env.CLERK_DEV_API_KEY);
  } else {
    setClerkApiKey(process.env.CLERK_API_KEY);
  }
  const [userId, token] =
    Authorization.length === 32 || Authorization.includes(":")
      ? // the old ways of generating tokens did not have user id encoded, so we query all users
        [
          null,
          Authorization.split(":").slice(-1)[0],
          Authorization.split(":").slice(-1)[0],
        ]
      : [
          Buffer.from(Authorization, "base64").toString().split(":")[0],
          Authorization,
          Buffer.from(Authorization, "base64").toString().split(":")[1],
        ];

  return userId
    ? users
        .getUser(`user_${userId}`)
        .then((user) =>
          (user.publicMetadata as { [s: string]: { token: string } })?.[service]
            ?.token === token
            ? user
            : undefined
        )
        .catch(() => {
          return undefined;
        })
    : findUser(
        (user) =>
          (user.publicMetadata as { [s: string]: { token: string } })?.[service]
            ?.token === token
      );
};

export const getUsersByEmail = (email: string, dev?: boolean) => {
  if (dev) {
    setClerkApiKey(process.env.CLERK_DEV_API_KEY);
  } else {
    setClerkApiKey(process.env.CLERK_API_KEY);
  }
  return users.getUserList({ emailAddress: [email] });
};

export const getUser = (id: string, dev?: boolean) => {
  if (dev) {
    setClerkApiKey(process.env.CLERK_DEV_API_KEY);
  } else {
    setClerkApiKey(process.env.CLERK_API_KEY);
  }
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
    .then((us) =>
      us.find((u) => {
        const stored = AES.decrypt(
          u.privateMetadata.token as string,
          encryptionSecret
        ).toString(encutf8);
        return stored && stored === token;
      })
    )
    .catch(() => undefined);
};

export const authenticateUserShim = (
  Authorization: string,
  service: string,
  dev?: boolean
) =>
  Promise.all([
    authenticateUser(Authorization, dev),
    getUserFromEvent(Authorization, service, dev),
  ]).then(([userV2, legacyUser]) => userV2 || legacyUser);

export const authenticate =
  (handler: APIGatewayProxyHandler): APIGatewayProxyHandler =>
  (event, ctx, callback) => {
    const Authorization =
      event.headers.Authorization || event.headers.authorization || "";

    return authenticateUserShim(Authorization, "developer").then((user) => {
      if (!user) {
        return {
          statusCode: 401,
          body: "Invalid developer token",
          headers,
        };
      }

      const { paths } = user.publicMetadata["developer"] as { paths: string[] };
      event.headers = normalizeHeaders(event.headers);
      const extension =
        event.headers["x-roamjs-extension"] ||
        event.headers["x-roamjs-service"];
      if (!paths.includes(extension)) {
        return {
          statusCode: 403,
          body: `Developer does not have access to data for extension ${extension}`,
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
