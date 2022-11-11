import { users } from "@clerk/clerk-sdk-node";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type Stripe from "stripe";
import { headers, getStripe } from "./common";
import emailError from "./common/emailError";

const normalizeHeaders = (hdrs: APIGatewayProxyEvent["headers"]) =>
  Object.fromEntries(
    Object.entries(hdrs).map(([h, v]) => [h.toLowerCase(), v])
  );

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { ["stripe-signature"]: sig } = normalizeHeaders(event.headers);
  const { body } = JSON.parse(event.body || "{}");
  const dev = !JSON.parse(body).livemode;
  const stripe = getStripe(dev);
  try {
    const stripeEvent = stripe.webhooks.constructEvent(
      body,
      sig || "",
      (dev
        ? process.env.STRIPE_DEV_CHECKOUT_SECRET
        : process.env.STRIPE_CHECKOUT_SECRET) || ""
    );
    const { userId, extension } = (
      stripeEvent.data.object as Stripe.Checkout.Session
    ).metadata as {
      extension: string;
      userId: string;
    };

    if (!userId) {
      return {
        statusCode: 400,
        body: "UserId is required",
        headers,
      };
    }
    const { publicMetadata } = await users.getUser(userId);
    if (publicMetadata[extension]) {
      return {
        statusCode: 204,
        body: "",
        headers,
      };
    }

    await users.updateUser(userId, {
      publicMetadata: {
        ...publicMetadata,
        [extension]: {},
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers,
    };
  } catch (err) {
    console.error(err);
    return emailError("Failed to finish subscription", err).then((s) => ({
      statusCode: 400,
      body: `Webhook Error: ${s}`,
    }));
  }
};
