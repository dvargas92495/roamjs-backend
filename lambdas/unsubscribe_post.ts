import { users } from "@clerk/clerk-sdk-node";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios from "axios";
import {
  getUserFromEvent,
  getStripe,
  headers,
  getStripePriceId,
  authenticateUser,
} from "./common";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { extensionId = "", dev = false } = JSON.parse(event.body || "{}") as {
    extensionId: string;
    dev: boolean;
  };
  const token =
    event.headers.Authorization || event.headers.authorization || "";
  return Promise.all([
    getUserFromEvent(token, extensionId, dev),
    authenticateUser(token, dev)
  ])
    .then(async ([userV2, legacyUser]) => {
      const user = userV2 || legacyUser;
      if (!user) {
        return {
          statusCode: 401,
          body: "Invalid token",
          headers,
        };
      }
      const customer = user.privateMetadata.stripeId as string;
      const stripe = getStripe(dev);
      const priceId = await getStripePriceId(extensionId, dev);
      const subscriptionId = await stripe.subscriptions
        .list({ customer })
        .then(
          (s) =>
            s.data
              .flatMap((ss) =>
                ss.items.data.map((si) => ({ priceId: si.price.id, id: ss.id }))
              )
              .find(({ priceId: id }) => priceId === id)?.id
        );
      if (!subscriptionId) {
        return {
          statusCode: 409,
          body: `Current user is not subscribed to ${extensionId}`,
          headers,
        };
      }
      const { success, message } = await stripe.subscriptions
        .del(subscriptionId)
        .then(() => ({ success: true, message: "" }))
        .catch((r) => ({
          success: false,
          message: r.response.data || r.message,
        }));
      if (!success) {
        return {
          statusCode: 500,
          body: `Failed to cancel RoamJS subscription: ${message}`,
          headers,
        };
      }
      const serviceCamelCase = extensionId
        .split("-")
        .map((s, i) =>
          i == 0 ? s : `${s.substring(0, 1).toUpperCase()}${s.substring(1)}`
        )
        .join("");

      const { [serviceCamelCase]: serviceField, ...rest } =
        user.publicMetadata as {
          [key: string]: string;
        };
      if (serviceField) {
        await users.updateUser(user.id, {
          publicMetadata: rest,
        });
      } else {
        console.warn("No metadata value to clear for field", serviceField);
      }
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
        }),
        headers,
      };
    })
    .catch((e) => ({
      statusCode: e.status || 500,
      body: e.response.data || e.message,
      headers,
    }));
};
