import { users } from "@clerk/clerk-sdk-node";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  getUserFromEvent,
  getStripePriceId,
  headers,
  getStripe,
  authenticateUser,
  idToCamel,
} from "./common";
import type Stripe from "stripe";

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
    authenticateUser(token, dev),
  ]).then(async ([userV2, legacyUser]) => {
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
    const paymentMethod = await stripe.customers
      .retrieve(customer)
      .then((c) => c as Stripe.Customer)
      .then((c) => c.invoice_settings?.default_payment_method);
    const line_items = [{ price: priceId, quantity: 1 }];
    const extensionField = idToCamel(extensionId);

    const { active, url, id } = paymentMethod
      ? await stripe.subscriptions
          .create({
            customer,
            items: line_items,
            metadata: {
              project: 'RoamJS'
            },
          })
          .then((s) => ({ active: true, id: s.id, url: undefined }))
          .catch(() => ({ active: false, id: undefined, url: undefined }))
      : await stripe.checkout.sessions
          .create({
            customer,
            payment_method_types: ["card"],
            line_items,
            mode: "subscription",
            success_url: `https://roamjs.com/extensions/${extensionId}?success=true`,
            cancel_url: `https://roamjs.com/extensions/${extensionId}?cancel=true`,
            subscription_data: {
              metadata: {
                project: 'RoamJS'
              }
            },
            metadata: {
              service: extensionField,
              userId: user.id,
              callback: `https://lambda.roamjs.com/finish-subscription`,
            },
          })
          .then((session) => ({ url: session.url, active: false, id: undefined }))
          .catch(() => ({ active: false, url: undefined, id: undefined }));

    if (!active) {
      if (url) {
        return {
          statusCode: 200,
          body: JSON.stringify({ url }),
          headers,
        };
      } else {
        return {
          statusCode: 500,
          body: "Failed to subscribe to RoamJS extension. Contact support@roamjs.com for help!",
          headers,
        };
      }
    }

    await users.updateUser(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        [extensionField]: {},
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers,
    };
  });
};
