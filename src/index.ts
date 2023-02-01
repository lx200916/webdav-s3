/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { AwsClient } from "./awsfetch";
import { Router } from "itty-router";
import { Get } from "./aws/get";
import { PropFind } from "./aws/propfind";
import { Put } from "./aws/put";
import { Delete } from "./aws/delete";
import { APIERROR } from "./aws/api";
import { Options, MkCol } from "./aws/options";
import { Head } from "./aws/head";
import { Copy, Move } from "./aws/copy";
export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
  BUCKET_BASEURL: string;
  AccessKeyId: string;
  SecretAccessKey: string;
  Auth: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
	const auth = request.headers.get('authorization');
	console.log(auth);
	if (auth == null) return new Response(null,{status:401,headers:{'DAV':'1','WWW-Authenticate':'Basic realm="WebDAV Gateway Worker"'},});
	if (auth != `Basic ${env.Auth}`) return new Response(null,{status:401,headers:{'DAV':'1','WWW-Authenticate':'Basic realm="WebDAV Gateway Worker"'},});
    let aws = new AwsClient({
      accessKeyId: env.AccessKeyId,
      secretAccessKey: env.SecretAccessKey,
      service: "s3",
      region: "",
    });

    //get URL PATH from whole url
    let path = request.url.substring(request.url.lastIndexOf("//") + 2);
    path = path.substring(path.indexOf("/"));
    console.log(path);

    try {
      switch (request.method) {
        case "GET":
          return Get(aws, env, request, path);
        case "PROPFIND":
          return PropFind(aws, env, request, path);
        case "PROPPATCH":
          // we dont support patching properties
          return new Response(null, { status: 403 });
        case "PUT":
          return Put(aws, env, request, path);
        case "DELETE":
          return Delete(aws, env, request, path);
        case "OPTIONS":
          return Options(aws, env, request, path);
        case "MKCOL":
          return MkCol(aws, env, request, path);
        case "HEAD":
          return Head(aws, env, request, path);
        case "COPY":
          return Copy(aws, env, request, path);
        case "MOVE":
          return Move(aws, env, request, path);

        default:
          return new Response(null, { status: 405 });
      }
    } catch (e) {
      if (e instanceof APIERROR) {
        console.error(e.status, e.message);
        return new Response(e.message, { status: e.status });
      } else {
        throw e;
      }
    }

    let resp = await aws.fetch(`${env.BUCKET_BASEURL}?list-type=2&prefix=/`);
    return resp;
  },
};
