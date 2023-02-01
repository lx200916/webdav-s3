import { Env } from "..";
import { AwsClient } from "../awsfetch";

export async function Options(aws: AwsClient, env: Env, request: Request, path: string) {
  return new Response(null, {
    status: 200,
    headers: {
      "DAV": "1",
      "Allow": "OPTIONS,GET,HEAD,POST,PUT,DELETE,PROPFIND,PROPPATCH,MKCOL,COPY,MOVE",
      "MS-Author-Via": "DAV",
    },
  });
}
//S3 does not support Folders, so we just return 204
export function MkCol(aws: AwsClient, env: Env, request: Request, path: string) {
  return new Response(null, { status: 204, headers: { DAV: "1" } });
}
