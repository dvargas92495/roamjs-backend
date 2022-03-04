import { users } from "@clerk/clerk-sdk-node";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  getStripe,
  headers,
  getStripePriceId,
  authenticateUser,
  idToCamel,
  invalidTokenResponse,
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
  return authenticateUser(token, dev).then(async (user) => {
      if (!user) {
        return invalidTokenResponse;
      }
      const customer = user.privateMetadata.stripeId as string;
      const stripe = getStripe(dev);
      const priceId = await getStripePriceId(extensionId, dev);
      const subscriptionItem = await stripe.subscriptions
        .list({ customer })
        .then((s) =>
          s.data
            .flatMap((ss) =>
              ss.items.data.map((si) => ({
                priceId: si.price.id,
                count: ss.items.data.length,
                id: si.id,
                subscriptionId: ss.id,
              }))
            )
            .find(({ priceId: id }) => priceId === id)
        );
      if (!subscriptionItem) {
        return {
          statusCode: 409,
          body: `Current user is not subscribed to ${extensionId}`,
          headers,
        };
      }
      const { success, message } = await (subscriptionItem.count > 1
        ? stripe.subscriptionItems.del(subscriptionItem.id)
        : stripe.subscriptions.del(subscriptionItem.subscriptionId)
      )
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
      const serviceCamelCase = idToCamel(extensionId);

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
