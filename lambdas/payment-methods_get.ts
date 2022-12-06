import type { Stripe } from "stripe";
import { roamjsHeaders as headers, getStripe } from "./common";
import { awsGetRoamJSUser } from "./common/getRoamJSUser";

export const handler = awsGetRoamJSUser(async (user) => {
  if (!user) {
    return {
      statusCode: 401,
      body: "No Active Session",
      headers,
    };
  }
  const { customer } = user;
  if (!customer) {
    return {
      statusCode: 409,
      body: "There is no payment record attached to your account. Reach out to support@roamjs.com for assistance.",
      headers,
    };
  }
  const stripe = getStripe();
  const defaultPaymentMethod = await stripe.customers
    .retrieve(customer, {
      expand: ["invoice_settings.default_payment_method"],
    })
    .then(
      (c) =>
        (c as Stripe.Customer).invoice_settings
          .default_payment_method as Stripe.PaymentMethod
    );
  const paymentMethods = await stripe.paymentMethods
    .list({ customer, type: "card" })
    .then((r) =>
      r.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
      }))
    );
  return {
    statusCode: 200,
    body: JSON.stringify({
      paymentMethods,
      defaultPaymentMethod: defaultPaymentMethod && {
        id: defaultPaymentMethod.id,
        brand: defaultPaymentMethod.card?.brand,
        last4: defaultPaymentMethod.card?.last4,
      },
    }),
    headers,
  };
});
