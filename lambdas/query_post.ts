import type {
  APIGatewayProxyEventHeaders,
  APIGatewayProxyResult,
} from "aws-lambda";
import https from "https";
import headers from "roamjs-components/backend/headers";

const normalize = (data: unknown): unknown => {
  if (Array.isArray(data)) {
    return data.map(normalize);
  } else if (data === null) {
    return null;
  } else if (typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [`:${k}`, normalize(v)])
    );
  } else {
    return data;
  }
};

export const handler = async (event: {
  headers: APIGatewayProxyEventHeaders;
  body: string;
}) => {
  const { query, graph } = JSON.parse(event.body);
  if (!graph) {
    return {
      statusCode: 400,
      body: "`graph` is required",
      headers,
    };
  }
  if (!query) {
    return {
      statusCode: 400,
      body: "`query` is required",
      headers,
    };
  }
  const args = {
    method: "POST",
    headers: {
      Authorization: event.headers.Authorization || event.headers.authorization,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
  return new Promise<APIGatewayProxyResult>((resolve, reject) => {
    const req = https
      .request(
        `https://api.roamresearch.com/api/graph/${graph}/q`,
        args,
        (res) => {
          if (res.statusCode === 307) {
            const redirect = https.request(
              res.headers.location,
              args,
              (redirectRes) => {
                redirectRes.setEncoding("utf8");
                let body = "";
                redirectRes.on("data", (data) => {
                  body += data;
                });
                redirectRes.on("end", () => {
                  if (!redirectRes.statusCode) reject("Missing Status Code");
                  else if (
                    redirectRes.statusCode >= 200 &&
                    redirectRes.statusCode < 400
                  ) {
                    resolve({
                      headers,
                      body: JSON.stringify({
                        result: normalize(JSON.parse(body).result),
                      }),
                      statusCode: redirectRes.statusCode,
                    });
                  } else {
                    const err = new Error(body);
                    err.name = `${redirectRes.statusCode}`;
                    reject(err);
                  }
                });
                res.on("error", reject);
              }
            );
            redirect.write(JSON.stringify({ query }));
            redirect.end();
          } else {
            reject(
              new Error(
                `Expected an immediate redirect (307), got: ${res.statusCode}`
              )
            );
          }
        }
      )
      .on("error", reject);
    req.write(JSON.stringify({ query }));
    req.end();
  }).catch((e) => ({
    statusCode: Number(e.name) || 500,
    body: e.message,
    headers,
  }));
};
