import { users } from "@clerk/clerk-sdk-node";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  getStripe,
  headers,
  getStripePriceId,
  authenticateUser,
  idToCamel,
  invalidTokenResponse,
  getExtensionUserId,
  getUser,
} from "./common";
import sendEmail from "aws-sdk-plus/dist/sendEmail";
import emailCatch from "roamjs-components/backend/emailCatch";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { extensionId = "", dev = false } = JSON.parse(event.body || "{}") as {
    extensionId: string;
    dev: boolean;
  };
  const token =
    event.headers.Authorization || event.headers.authorization || "";
  return authenticateUser(token, dev)
    .then(async (user) => {
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
      const userEmail = user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress;
      const developer = await getExtensionUserId(extensionId, dev);
      const developerEmail = await getUser(developer, dev)
        .then(
          (u) =>
            u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
              ?.emailAddress
        )
        .catch((e) =>
          emailCatch(
            `Failed to find developer ${developer} for extension ${extensionId}`
          )(e).then(() => "")
        );
      await sendEmail({
        to: developerEmail || "support@roamjs.com",
        from: "support@roamjs.com",
        subject: `User unsubscribed from extension from within Roam`,
        body: `User ${userEmail} has unsubscribed from the ${extensionId} extension.`,
        replyTo: userEmail,
      });
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
