import { APIGatewayProxyHandler } from "aws-lambda";
import axios from "axios";

const samepageRedirect =
  ({
    path,
    headers = {},
  }: {
    path: string;
    headers?: Record<string, string>;
  }): APIGatewayProxyHandler =>
  async (event) => {
    const data = JSON.parse(event.body || "{}");
    headers["Authorization"] = event.headers.Authorization || event.headers.authorization || "";
    headers["Origin"] = event.headers.Origin || event.headers.origin || "";
    return axios
      .post(`https://api.samepage.network/extensions/${path}`, data, {
        headers,
      })
      .then((r) => ({
        statusCode: 200,
        body: JSON.stringify(r.data),
        headers: r.headers,
      }))
      .catch((e) => {
        console.log(e);
        return {
          statusCode: e.response?.status || 500,
          body: JSON.stringify(e.response?.data || { message: e.message }),
          headers: e.response?.headers || {},
        };
      });
  };

export default samepageRedirect;
