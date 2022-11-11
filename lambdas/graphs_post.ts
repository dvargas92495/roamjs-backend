import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import AWS from "aws-sdk";
import { headers } from "./common";
import emailCatch from "./common/emailCatch";

const s3 = new AWS.S3();

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { extension = "", graph = "" } = JSON.parse(event.body || "{}");
  const Key = `${extension}/graphs/${graph}`;
  return s3
    .putObject({
      Bucket: "roamjs-data",
      Key,
      Body: "null",
      ContentType: "text/plain",
    })
    .promise()
    .then(() => ({
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers,
    }))
    .catch(emailCatch("Failed to count graph"));
};
