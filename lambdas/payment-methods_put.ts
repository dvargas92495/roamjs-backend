import { headers, getStripe } from "./common";
import { awsGetRoamJSUser } from "./common/getRoamJSUser";

export const handler = awsGetRoamJSUser(async (user, { id }) => {
  if (!user) {
    return {
      statusCode: 401,
      body: "No Active Session",
      headers,
    };
  }
  const { customer } = user;
  if (!id) {
    return {
      statusCode: 400,
      body: "id is required",
      headers,
    };
  }

  const stripe = getStripe();
  return stripe.paymentMethods.retrieve(id as string).then((pm) => {
    if (!pm.customer) {
      return {
        statusCode: 400,
        body: "No customer attached to payment method",
        headers,
      };
    }
    if (pm.customer !== customer) {
      return {
        statusCode: 400,
        body: "Payment method not attached to the current user",
        headers,
      };
    }
    return stripe.customers
      .update(pm.customer as string, {
        invoice_settings: {
          default_payment_method: pm.id,
        },
      })
      .then(() => ({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers,
      }));
  });
});
