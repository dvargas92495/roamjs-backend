import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { authenticateUser, invalidTokenResponse } from "./common";
import AWS from "aws-sdk";
import headers from "roamjs-components/backend/headers";
import emailError from "roamjs-components/backend/emailError";

const s3 = new AWS.S3();

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const {
    extension = "",
    dev = "false",
    path = "",
  } = event.queryStringParameters || {};
  const token =
    event.headers.Authorization || event.headers.authorization || "";
  return authenticateUser(token, dev === "true").then(async (user) => {
    if (!user) {
      return invalidTokenResponse;
    }
    const Key = `${extension}/files/${path}`;
    return s3
      .headObject({
        Bucket: "roamjs-data",
        Key,
      })
      .promise()
      .then((r) => {
        const allowedUser = r.Metadata?.["user"];
        if (allowedUser !== user.id) {
          return {
            statusCode: 403,
            headers,
            body: `User not allowed to access file ${path}`,
          };
        }
        return s3
          .getObject({ Bucket: "roamjs-data", Key })
          .promise()
          .then((r) => ({ statusCode: 200, body: r.Body.toString(), headers }));
      })
      .catch((e) => {
        if (e.statusCode === 404) {
          return {
            statusCode: 404,
            headers,
            body: `File ${path} doesn't exist.`,
          };
        }
        return emailError("User failed to download error", e).then((body) => ({
          statusCode: 500,
          body,
          headers,
        }));
      });
  });
};
