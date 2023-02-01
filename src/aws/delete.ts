import { Env } from "..";
import { AwsClient } from "../awsfetch";
import { guessIsFolder } from "../utils";
import { APIERROR, DeleteObject, DeleteObjects, FileInfo, ListObjectV2 } from "./api";

async function deleteObject(aws:AwsClient,env:Env,path:string) :Promise<Response> {
    try{
        return DeleteObject(aws,env,path);
    }catch (err){
        if(err instanceof APIERROR){
            // const resp  =`<?xml version="1.0" encoding="utf-8" ?> 
            // <d:multistatus xmlns:d="DAV:"> 
            //     <d:response> 
            //         <d:href>${path}</d:href> 
            //         <d:status>HTTP/1.1 403 ${err.message}</d:status> 
            //     </d:response> 
            // </d:multistatus> `;
            // return new Response(resp,{status:207})
            return new Response(null,{status:403,headers:{'DAV':'1'}})
        }else{
            throw err;
        }
    }
}
async function deleteFolder(aws:AwsClient,env:Env,path:string) :Promise<Response> {
    const files = await ListObjectV2(aws,env,path);
    try{
        return await DeleteObjects(aws,env,files.map((file)=>file.get("key")).filter((key)=>key.length>0));
    }catch(err){
        if(err instanceof APIERROR){
            const resp  =`<?xml version="1.0" encoding="utf-8" ?> 
            <d:multistatus xmlns:d="DAV:"> 
                <d:response> 
                    <d:href>${err.message}</d:href> 
                    <d:status>HTTP/1.1 403</d:status> 
                </d:response> 
            </d:multistatus> `;
            return new Response(resp,{status:207,headers:{'DAV':'1'}})
        }else{
            throw err;
        }
    }
}
export async function Delete(aws:AwsClient,env:Env,request:Request,path:string) :Promise<Response> {
    return guessIsFolder(path)? await deleteFolder(aws,env,path):deleteObject(aws,env,path);
}