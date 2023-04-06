import { users } from "@clerk/clerk-sdk-node";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getUsersByEmail, headers } from "./common";
import randomstring from "randomstring";
import AES from "crypto-js/aes";

const generateToken = (): { encrypted: string; value: string } => {
  const value = randomstring.generate(16);
  return {
    encrypted: AES.encrypt(value, process.env.ENCRYPTION_SECRET).toString(),
    value,
  };
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { email } = JSON.parse(event.body);
  if (!email) {
    return {
      statusCode: 400,
      body: "Missing email",
      headers,
    };
  }
  const [user] = await getUsersByEmail(email);
  if (!user) {
    return {
      statusCode: 401,
      body: `No Active User with email ${email}`,
      headers,
    };
  }

  const id = user.id;
  const privateMetadata = user.privateMetadata as {
    [key: string]: Record<string, unknown>;
  };

  if (privateMetadata.token) {
    return {
      statusCode: 401,
      body: `Token already exists for email ${email}`,
      headers,
    };
  }

  const { value, encrypted } = generateToken();
  return users
    .updateUser(id, {
      privateMetadata: {
        ...privateMetadata,
        token: encrypted,
      },
    })
    .then(() => ({
      statusCode: 200,
      body: JSON.stringify({ token: value }),
      headers,
    }));
};
