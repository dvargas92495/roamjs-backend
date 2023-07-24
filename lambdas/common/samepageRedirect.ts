import { APIGatewayProxyHandler } from "aws-lambda";
import axios from "axios";

const samepageRedirect =
  ({
    path,
    headers = {},
    method = "post",
  }: {
    path: string;
    headers?: Record<string, string>;
    method?: "post" | "get" | "put";
  }): APIGatewayProxyHandler =>
  async (event) => {
    headers["Authorization"] =
      event.headers.Authorization || event.headers.authorization || "";
    headers["Origin"] = event.headers.Origin || event.headers.origin || "";
    const base = `https://api.samepage.network/${path}`;
    const args =
      method === "get"
        ? ([
            `${base}?${new URLSearchParams(
              event.queryStringParameters
            ).toString()}`,
            { headers },
          ] as const)
        : ([base, JSON.parse(event.body || "{}"), { headers }] as const);
    return axios[method](args[0], args[1], args[2])
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
