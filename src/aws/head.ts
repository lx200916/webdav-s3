import { Env } from "..";
import { AwsClient } from "../awsfetch";
import { guessIsFolder } from "../utils";
import { APIERROR, HeadObject } from "./api";

export async function Head(
  aws: AwsClient,
  env: Env,
  request: Request,
  path: string
) {
  if (guessIsFolder(path))
    return new Response(null, { status: 200, headers: { DAV: "1" } });
  try {
    const resp = await HeadObject(aws, env, path);
    return new Response(null, { status: 200, headers: { DAV: "1" } });
  } catch (err) {
    if (err instanceof APIERROR)
      return new Response(null, { status: err.status, headers: { DAV: "1" } });
    else throw err;
  }
}
