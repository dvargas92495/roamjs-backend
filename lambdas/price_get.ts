import { APIGatewayEvent } from "aws-lambda";
import type { Stripe } from "stripe";
import { getStripe } from "./common";

const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "POST",
};

export const handler = async (event: APIGatewayEvent) => {
  const { id = "", dev } = event.queryStringParameters || {};
  const stripe = getStripe(dev);
  return stripe.prices
    .retrieve(id, { expand: ["product"] })
    .then((p) => ({
      statusCode: 200,
      body: JSON.stringify({
        id: p.id,
        price: p.unit_amount,
        isMonthly: p.type === "recurring",
        perUse: p.recurring?.usage_type === "metered",
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
