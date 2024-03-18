# Hoops Web Viewer Simple Azure Server

## Introduction

This package contains a example node + express server that provides a SC server with the means to interact with Azure blobs.
This is meant as an example, since how SC data is stored in blobs can vary from implementation to implementation. The example works
best with models in SCZ format, owing to the flat nature of blob storage, but SCs in directory form can be used so long as the
server is made aware of them ahead of the time, which you can read about in the source.

This example was written for Windows but is trivial to get working for Linux or Mac.

## Notes for the Node SC server
When using this with the Node server included in the communicator package there are two config options you must set:
* `modelDirs` must have `C:\\models` as an entry (preferably the only entry)
* `restFileserver` must be set to the address this server runs on. `"localhost:3000"` by default.

## The API

The server implements this REST API:

| end point            | params       | descriptions                                                                                                                          |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| /read/:path          | offset, size | Reads a `size` number of bytes from the blob at `path` starting at `offset`                                                           |
| /exists/:path        | None         | Checks if a blob exists at `path`. Returns `{ exists: boolean }`                                                                      |
| /size/:path          | None         | Gets the size of a blob at `path`. Returns `{ size : number }`                                                                        |
| /isDir/:path         | None         | Checks if `path` represents a directory. Returns `{ isDir: boolean }`                                                                 |
| /isRegularFile/:path | None         | Checks if `path` represents a regular file (e.g. not a directory or symlink). Returns `{ isRegularFile: boolean }`                    |
| /isSymlink/:path     | None         | Checks if `path` represents a symlink. Returns `{ isSymlink: boolean }`                                                               |
| /isEmpty/:path       | None         | Checks if `path` represents something that is empty (either an empty directory or a file with size 0). Returns `{ isEmpty: boolean }` |
| /getChildren/:path   | None         | Gets the names of any children of `path` if `path` is a directory. Returns `{ children: string[] }`                                   | 

## How to run this code

> In order to run this code the user must have node installed.  
> The user must also have azure cli installed and have logged in from the cli using `az login` in a terminal.  
> Any problem regarding one of the other of these technologies might be answered in their own documentation https://nodejs.org/ and https://learn.microsoft.com/cli/azure/install-azure-cli

### First install the dependencies:

```bash

# With NPM

npm install

# OR With yarn

yarn

```

### Add your env file

You can copy `example.env` and rename it `.env` and adapt it to your configuration.

Basically this file contains these lines:

```env
SERVER_PORT=3000
AZURE_STORAGE_ACCOUNT_NAME=ts3dpochcblob
AZURE_STORAGE_CONTAINER_NAME=hc-container-poc
MODEL_ROOT_DIR=C:\models
```

### Finally you can run the code

```bash

npm run start

# OR

yarn start

```
