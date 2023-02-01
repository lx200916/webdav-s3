import { Env } from "..";
import { AwsClient } from "../awsfetch";
import { guessIsFolder } from "../utils";
import { CopyObject, DeleteObject } from "./api";

export async function Copy(aws:AwsClient,env:Env,request:Request,path:string) {
    let destination = request.headers.get('destination');
    if (destination == null) return new Response(null,{status:400,headers:{'DAV':'1'}});
    if (destination.startsWith('http')){
        const url = new URL(destination);
        destination = url.pathname;
    }
    return guessIsFolder(path)?new Response(null,{status:403,headers:{'DAV':'1'}}):await CopyObject(aws,env,path,destination);; 
}
// async function copyObject(aws:AwsClient,env:Env,request:Request,path:string) {
//     return guessIsFolder(path)?new Response(null,{status:403,headers:{'DAV':'1'}}):new Response(null,{status:403,headers:{'DAV':'1'}}); 
// }
export async function Move(aws:AwsClient,env:Env,request:Request,path:string) {
    let destination = request.headers.get('destination');
    if (destination == null) return new Response(null,{status:400,headers:{'DAV':'1'}});
    if (destination.startsWith('http')){
        const url = new URL(destination);
        destination = url.pathname;
    }
    if (guessIsFolder(path)) return new Response(null,{status:403,headers:{'DAV':'1'}})
     await CopyObject(aws,env,path,destination);
     await DeleteObject(aws,env,path);
     return new Response(null,{status:204,headers:{'DAV':'1'}});
}