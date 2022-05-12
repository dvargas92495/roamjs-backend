import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { authenticateUser, invalidTokenResponse } from "./common";
import AWS from "aws-sdk";
import headers from "roamjs-components/backend/headers";

const s3 = new AWS.S3();

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const {
    extension = "",
    dev = false,
    path = "",
    body,
  } = JSON.parse(event.body || "{}");
  const token =
    event.headers.Authorization || event.headers.authorization || "";
  return authenticateUser(token, dev).then(async (user) => {
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
          .putObject({
            Bucket: "roamjs-data",
            Key,
            Body: body,
            Metadata: { user: user.id },
          })
          .promise()
          .then((r) => ({
            statusCode: 200,
            body: JSON.stringify({ success: true, etag: r.ETag }),
            headers,
          }));
      });
  });
};
