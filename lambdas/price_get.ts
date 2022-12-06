import { APIGatewayEvent } from "aws-lambda";
import type { Stripe } from "stripe";
import { getStripe, getStripePriceId, headers } from "./common";

export const handler = async (event: APIGatewayEvent) => {
  const { id = "", extensionId = "" } = event.queryStringParameters || {};
  const stripe = getStripe();
  const priceId = extensionId ? await getStripePriceId(extensionId) : id;
  return stripe.prices
    .retrieve(priceId, { expand: ["product"] })
    .then((p) => ({
      statusCode: 200,
      body: JSON.stringify({
        id: p.id,
        price: p.unit_amount,
        isMonthly: p.type === "recurring",
        perUse: p.recurring?.usage_type === "metered",
        quantity: p.transform_quantity?.divide_by || 1,
        description: (p.product as Stripe.Product).description,
      }),
      headers,
    }))
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
