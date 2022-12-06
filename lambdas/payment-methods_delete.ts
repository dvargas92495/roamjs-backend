import { roamjsHeaders as headers, getStripe } from "./common";
import { awsGetRoamJSUser } from "./common/getRoamJSUser";

export const handler = awsGetRoamJSUser(async (user, { payment_method_id }) => {
  if (!user) {
    return {
      statusCode: 401,
      body: "No Active Session",
      headers,
    };
  }
  const stripe = getStripe();
  const { customer } = user;
  if (!payment_method_id) {
    return {
      statusCode: 400,
      body: "payment_method_id is required",
      headers,
    };
  }
  const paymentMethodCustomer = await stripe.paymentMethods
    .retrieve(payment_method_id as string)
    .then((r) => r.customer as string);
  if (paymentMethodCustomer !== customer) {
    return {
      statusCode: 400,
      body: "User does not have access to the provided payment method",
      headers,
    };
  }

  await stripe.paymentMethods.detach(payment_method_id as string);
  return {
    statusCode: 204,
    body: JSON.stringify({}),
    headers,
  };
});
