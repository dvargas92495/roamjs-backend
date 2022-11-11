import { APIGatewayProxyHandler } from "aws-lambda";
import axios from "axios";
import { headers } from "./common";

export const handler: APIGatewayProxyHandler = async (event) => {
  const data = JSON.parse(event.body || "{}");
  return axios
    .post("https://oauth2.googleapis.com/token", {
      ...data,
      client_id:
        "950860433572-rvt5aborg8raln483ogada67n201quvh.apps.googleusercontent.com",
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: "https://roamjs.com/oauth?auth=true",
    })
    .then((r) =>
      data.grant_type === "authorization_code"
        ? axios
            .get(
              `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${r.data.access_token}`
            )
            .then((u) => ({
              statusCode: 200,
              body: JSON.stringify({ ...r.data, label: u.data.email }),
              headers,
            }))
        : {
            statusCode: 200,
            body: JSON.stringify(r.data),
            headers,
          }
    )
    .catch((e) => ({
      statusCode: 500,
      body: JSON.stringify(e.response?.data || { message: e.message }),
      headers,
    }));
};
