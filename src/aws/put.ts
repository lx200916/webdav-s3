import { Env } from "..";
import { AwsClient } from "../awsfetch";
import { PutObject } from "./api";

export async function Put(aws: AwsClient, env: Env, request: Request, path: string) :Promise<Response> {
    const body = await request.clone().arrayBuffer();
    const contentType = request.headers.get("content-type") ?? "application/octet-stream";
    if(body == null) {
        return new Response(null, {status: 204, headers: {'DAV': '1'}});
    }
   return await PutObject(aws, env, path, body,contentType);
    
}
export{}