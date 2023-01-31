import axios, { AxiosError } from "axios";
import type { APIGatewayProxyHandler } from "aws-lambda";
import AES from "crypto-js/aes";
import encutf8 from "crypto-js/enc-utf8";
import { nanoid } from "nanoid";
import getRoamJSUser from "./common/getRoamJSUser";
import putRoamJSUser from "./common/putRoamJSUser";

const API_BASE_URL = "https://otter.ai/forward/api/v1";
const CSRF_COOKIE_NAME = "csrftoken";

export type OtterSpeech = {
  speech_id: string;
  title: string;
  created_at: number;
  summary: string;
  otid: string;
  id: string;
};
export type OtterSpeechInfo = {
  speech_id: string;
  title: string;
  created_at: number;
  summary: string;
  otid: string;
  id: string;
  transcripts: {
    transcript: string;
    start_offset: number;
    end_offset: number;
    speaker_id: string;
  }[];
  speakers: { speaker_id: string; speaker_name: string; id: string }[];
};

const getCookieValueAndHeader = (cookieHeader: string, cookieName: string) => {
  const match = cookieHeader.match(new RegExp(`${cookieName}=(?<value>.*?);`));
  if (!match) return { cookieHeader: "", cookieValue: "" };
  return { cookieValue: match[1], cookieHeader: match[0] };
};
class OtterApi {
  private options: { email: string; password: string };
  private user: { id?: string };
  constructor(options: { email: string; password: string }) {
    this.options = options;
    this.user = {};
  }

  init = async () => {
    await this.login();
  };

  login = async () => {
    const { email, password } = this.options;

    if (!email || !password) {
      throw new Error(
        "Email and/or password were not given. Can't perform authentication to otter.ai"
      );
    }
    const csrfResponse = await axios({
      method: "GET",
      url: `${API_BASE_URL}/login_csrf`,
    });
    const { cookieValue: csrfToken, cookieHeader: csrfCookie } =
      getCookieValueAndHeader(
        csrfResponse.headers["set-cookie"][0],
        CSRF_COOKIE_NAME
      );

    const response = await axios({
      method: "GET",
      url: `${API_BASE_URL}/login`,
      params: {
        username: email,
      },
      headers: {
        authorization: `Basic ${Buffer.from(`${email}:${password}`).toString(
          "base64"
        )}`,
        "x-csrftoken": csrfToken,
        cookie: csrfCookie,
      },
      withCredentials: true,
    }).catch(() => {
      console.log(
        "csrfToken:",
        csrfToken,
        "csrfCookie:",
        csrfCookie,
        "cookie headers:",
        csrfResponse.headers["set-cookie"],
        "email:",
        email,
        "password:",
        `****${password.slice(-4)} (${password.length})`
      );
      return Promise.reject(new Error("Failed to log in to otter"));
    });

    const cookieHeader = response.headers["set-cookie"]
      .map((s: string) => `${s}`)
      .join("; ");

    this.user = response.data.user;

    axios.defaults.headers.common.cookie = cookieHeader;

    console.log("Successfuly logged in to Otter.ai");

    return response;
  };

  getSpeeches = async (
    params: string
  ): Promise<{
    speeches: OtterSpeech[];
    end_of_list: boolean;
    last_load_ts: number;
    last_modified_at: number;
  }> => {
    const { data } = await axios({
      method: "GET",
      url: `${API_BASE_URL}/speeches?page_size=10${params}`,
      params: {
        userid: this.user.id,
      },
    });

    return data as {
      speeches: OtterSpeech[];
      end_of_list: boolean;
      last_load_ts: number;
      last_modified_at: number;
    };
  };

  getSpeech = async (speech_id: string) => {
    const { data } = await axios({
      method: "GET",
      url: `${API_BASE_URL}/speech`,
      params: {
        speech_id,
        userid: this.user.id,
      },
    });

    return data.speech;
  };
}

const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Credentials": true,
};

const catchError = (e: AxiosError) => {
  console.error(e.response?.data || e.message);
  return {
    headers,
    statusCode: 500,
    body: e.response?.data?.message || e.response?.data || e.message,
  };
};

const transform = (s: OtterSpeech) => ({
  title: s.title,
  id: s.speech_id,
  createdDate: s.created_at,
  summary: s.summary,
  link: `https://otter.ai/u/${s.otid}`,
});

const getApi = ({
  email,
  password,
  token,
}: {
  email: string;
  password: string;
  token: string;
}) =>
  getRoamJSUser({ token, extensionId: "otter" })
    .then((data) => AES.decrypt(password, data.key as string).toString(encutf8))
    .then((password) => {
      return new OtterApi({
        email,
        password,
      });
    });

export const handler: APIGatewayProxyHandler = async (event) => {
  const { email, password, operation, params } = JSON.parse(event.body || "{}");
  const token =
    event.headers.Authorization || event.headers.authorization || "";
  if (operation === "ENCRYPT_PASSWORD") {
    const inited = await axios
      .get(
        `https://lambda.roamjs.com/check?extensionId=otter${
          process.env.NODE_ENV === "development" ? "&dev=true" : ""
        }`,
        { headers: { Authorization: token } }
      )
      .then((r) => r.data.success)
      .catch(() => false);
    if (!inited) {
      const error = await axios
        .post(
          `https://lambda.roamjs.com/user?extensionId=otter`,
          {},
          {
            headers: {
              Authorization: `Bearer ${Buffer.from(
                `${process.env.ROAMJS_EMAIL}:${process.env.ROAMJS_DEVELOPER_TOKEN}`
              ).toString("base64")}`,
              "x-roamjs-token": token,
              "x-roamjs-extension": "otter",
              ...(process.env.NODE_ENV === "development"
                ? {
                    "x-roamjs-dev": "true",
                  }
                : {}),
            },
          }
        )
        .then(() => false)
        .catch((e) => e);
      if (error) {
        return {
          statusCode: error.response?.status || 500,
          body:
            typeof error.response?.data === "object"
              ? JSON.stringify(error.response?.data)
              : error.response?.data || error.response?.message,
          headers,
        };
      }
    }

    const encryptionSecret = nanoid();
    const output = AES.encrypt(password, encryptionSecret).toString();
    return putRoamJSUser({
      token,
      data: { key: encryptionSecret },
      extensionId: "otter",
    })
      .then(() => ({
        statusCode: 200,
        body: JSON.stringify({ output }),
        headers,
      }))
      .catch((e) => ({
        statusCode: e.response?.status || 500,
        body:
          typeof e.response?.data === "object"
            ? JSON.stringify(e.response?.data)
            : e.response?.data || e.message,
        headers,
      }));
  } else if (operation === "GET_SPEECHES") {
    return getApi({ email, password, token })
      .then((otterApi) =>
        otterApi
          .init()
          .then(() =>
            otterApi
              .getSpeeches(
                params?.lastLoad && params?.lastModified
                  ? `&modified_after=${params.lastModified}&last_load_ts=${params.lastLoad}`
                  : ""
              )
              .catch((e) =>
                Promise.reject(
                  new Error(
                    `An error was thrown from Otter itself: ${e.message}`
                  )
                )
              )
          )
      )
      .then(({ speeches, last_load_ts, last_modified_at, end_of_list }) => ({
        statusCode: 200,
        body: JSON.stringify({
          speeches: speeches.map(transform),
          lastLoad: last_load_ts,
          lastModified: last_modified_at,
          isEnd: end_of_list,
        }),
        headers,
      }))
      .catch(catchError);
  } else if (operation === "GET_SPEECH") {
    return getApi({ email, password, token })
      .then((otterApi) =>
        otterApi.init().then(() => otterApi.getSpeech(params.id))
      )
      .then((speech: OtterSpeechInfo) => ({
        statusCode: 200,
        body: JSON.stringify({
          transcripts: speech.transcripts.map((t) => ({
            text: t.transcript,
            start: t.start_offset,
            end: t.end_offset,
            speaker:
              speech.speakers.find((s) => s.id === t.speaker_id)
                ?.speaker_name || "Unknown",
          })),
          ...transform(speech),
        }),
        headers,
      }))
      .catch(catchError);
  } else {
    return {
      statusCode: 400,
      body: `Unsupported operation ${operation}`,
      headers: {
        "Access-Control-Allow-Origin": "https://roamresearch.com",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Credentials": true,
      },
    };
  }
};
