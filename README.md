<div align="center">

# S3 WebDAV Worker
A `naive` WebDAV Gateway for S3 Compatible Services powered by Cloudflare Worker. 

一个不怎么样的将WebDAV的少部分调用转换为S3 REST API调用的网关,仅实现了一部分功能子集.

</div>

## 用途
用来间接使某些仅支持WebDAV协议的同步服务支持S3存储.在这里我的测试应用是 `Zotero`,大部分调用实现也是以它测试.

## 协议实现情况
本项目的WebDAV兼容层级为 `1`,不兼容 LOCK/UNLOCK 调用和相关功能.
> 以下是本项目对WebDAV调用的支持情况,每个调用有对文件(F)和集合(C)资源两种调用,我们暂且根据RFC文档将以`\`结尾的URL视为对集合(文件夹)的调用.
> 标有 `-` 的为目前不需要考虑实现的调用,标 `X` 为可能需要实现但是目前没有很好的办法实现的调用.Notes一栏简单说明了原因.
> 本项目没有对错误的返回做处理,未知错误或未实现调用一律返回403.
| **WebDAV**     | **S3 REST**                     | **Notes**                                                                           |
|:--------------:|:-------------------------------:|:-----------------------------------------------------------------------------------:|
| GET (F)        | GetObject                       |                                                                                     |
| GET (C)        | -                               | Undefined Behavior(UB)                                                              |
| PUT (F)        | PutObject                       |                                                                                     |
| PUT(C)         | -                               | UB                                                                                  |
| PROPFIND(F)    | HeadObject                      |                                                                                     |
| PROPFIND(C)    | ListObejctsV2                   |                                                                                     |
| PROPPATCH(F/C) | -                               | S3 not Support <br> Custom Metadata                                                    |
| DELETE(F)      | DeleteObject                    |                                                                                     |
| DELETE(C)      | ListObjectsV2 then DeleteObject |                                                                                     |
| MKCOL          | -                               | S3 has a flat structure instead of a hierarchy like one,<br>  no need to create prefix.  |
| COPY(F)        | CopyObject                      |                                                                                     |
| COPY(C)        | X                               | No S3 API to Copy Batch <br>  & Copy one-by-one  with CopyObject seems INSANE              |
| MOVE           | COPY&DELETE                     | No S3 API to atomic MOVE <br> & `no collection support either.`                          |
| HEAD(C)        | -                               | Prefix always exists and just return 200                                            |
| HEAD(F)        | HeadObject                      |                                                                                     |

## 局限性
* 不适用于挂载等高频调用场景.会超出API Limit.
* 未实现 ETag,Lock等相关功能,依赖这些功能的客户端可能工作不正常(如macOS的`访达`)
* PUT调用只能上传小于 100M/500M(付费套餐) 的文件数据,这是Cloudflare Worker的限制.
* Get调用目前仍采用服务端转发,可能会导致极高延迟(部分客户端对307等状态码兼容性不好).
* Cloudflare的地理位置带来的连通性问题(目前腾讯云等厂商的云函数服务似乎暂不支持如 `PROPFIND` 等HTTP 拓展方法,无法部署)

