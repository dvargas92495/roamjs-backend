import { APIGatewayProxyHandler } from "aws-lambda";
import axios from "axios";
import { headers } from "./common";

export const handler: APIGatewayProxyHandler = async (event) => {
  const data = JSON.parse(event.body || "{}");
  return axios
    .post(
      `https://api.samepage.network/extensions/google/auth`,
      data,
      {
        headers: {
          "x-google-client-id":
            "950860433572-rvt5aborg8raln483ogada67n201quvh.apps.googleusercontent.com",
          "x-google-client-secret": process.env.GOOGLE_CLIENT_SECRET,
          "x-google-redirect-uri": "https://roamjs.com/oauth?auth=true",
        },
      }
    )
    .then((r) => ({
      statusCode: 200,
      body: JSON.stringify(r.data),
      headers,
    }))
    .catch((e) => ({
      statusCode: 500,
      body: JSON.stringify(e.response?.data || { message: e.message }),
      headers,
    }));
};
