require("dotenv").config();
const pathtools = require('node:path');
const { BlobServiceClient } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");

const express = require("express");

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
if (!accountName) {
  throw Error("Azure Storage accountName not found");
}

const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
if (!containerName) {
  throw Error("Azure Storage containerName not found");
}

console.info(`connecting to '${accountName}'`);
const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  new DefaultAzureCredential()
);

console.info(`get container '${containerName}'`);
const containerClient = blobServiceClient.getContainerClient(containerName);

const app = express();
const port = process.env.SERVER_PORT;

app.use(express.json());

// Since blob storage is flat and SC assumes a directory structure dependent on
// the operating system it's running on we will need a say to map system path to
// blob paths.
class PathMapper {
  constructor(rootDir) {
    this._rootDir = rootDir;
    this._scPaths = new Set();
  }

  // In the case of un-bundled SCs (e.g. not an SCZ) we will need to be made aware of them ahead of time
  // so that we can "pretend" they're a directory
  addSc(sc) {
    this._scPaths.add(sc);
  }

  // Converts a system path to a blob path
  convert(inSystemPath) {
    const relativePath = pathtools.relative(this._rootDir, inSystemPath);
    if(relativePath.startsWith("..")) {
      // If this does not start with our root dir than it's not something we're interested in
      return ""
    }

    const dirname = pathtools.dirname(relativePath);
    if(this._scPaths.has(dirname)) {
      // In the case of un-bundled SCs we simply append the directory and basename without the `\`
      const basename = pathtools.basename(relativePath);
      return dirname + basename;
    }
    return relativePath;
  }

  isRoot(inSystemPath) {
    return pathtools.relative(inSystemPath, this._rootDir) == "";
  }

  // Check if a path is a directory according to our storage scheme here. Takes a system path
  isDir(inSystemPath) {
    if(this.isRoot(inSystemPath)) {
      return true;
    }
    const relativePath = pathtools.relative(this._rootDir, inSystemPath);
    return this._scPaths.has(relativePath);
  }
}

const pathMapper = new PathMapper(process.env.MODEL_ROOT_DIR);

// If you were going to use un-bundled SCs the pathMapper has to be made aware
// of them ahead of time like so:
// pathMapper.addSc("bnc")
// They can then be accessed so long as the blob storage has the required files
// prepended by the name of the model they belong to. For example: bnc_data.sci

const blobExists = async (path) => {
  const blockBlobClient = containerClient.getBlockBlobClient(path);
  return await blockBlobClient.exists();
}

const blobSize = async (path) => {
  const blockBlobClient = containerClient.getBlockBlobClient(path);
  const props = await blockBlobClient.getProperties();
  return props.contentLength;
}

const sendError = (res, e) => {
  const message = `${e.name}: ${e.code}`;
  console.error(message);
  res.status = e.statusCode;
  res.send({ message });
}

// Reads some number of bytes from the blob represented by the supplied path
app.get("/read/:path", async(req, res) => {
  const offsetStr = req.query.offset;
  const sizeStr = req.query.size;
  const offset = typeof offsetStr === "string" ? parseInt(offsetStr, 10) : 0;
  const size = typeof sizeStr === "string" ? parseInt(sizeStr, 10) : undefined;
  try {
    console.log(`Reading ${size} bytes at offset ${offset} from ${req.params.path}`);
    const blobPath = pathMapper.convert(req.params.path);
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    const downloadBlockBlobResponse = await blockBlobClient.download(offset, size);
    res.setHeader("content-type", downloadBlockBlobResponse.contentType);
    downloadBlockBlobResponse.readableStreamBody.pipe(res);
  } catch (e) {
    sendError(res, e);
  }
});

app.get("/exists/:path", async(req, res) => {
  try {
    console.log(`Checking ${req.params.path} exists`);
    if(pathMapper.isDir(req.params.path)) {
      res.send({ exists: true });
      return;
    }
    const blobPath = pathMapper.convert(req.params.path);
    const exists = blobPath === "" ? false : await blobExists(blobPath);
    res.send({ exists });
  } catch (e) {
    sendError(res, e);
  }
});

app.get("/size/:path", async(req, res) => {
  try {
    console.log(`Checking ${req.params.path} size`);
    const blobPath = pathMapper.convert(req.params.path);
    const size = await blobSize(blobPath);
    if (size !== undefined) {
      res.send({size: size});
    } else {
      res.status = 404;
      res.send({message: "Failed to get size"});
    }
  } catch (e) {
    sendError(res, e);
  }
});

app.get("/isDir/:path", async(req, res) => {
  try {
    console.log(`Checking ${req.params.path} isDir`);
    res.send({ isDir: pathMapper.isDir(req.params.path) });
  } catch (e) {
    sendError(res, e);
  }
});

app.get("/isRegularFile/:path", async(req, res) => {
  try {
    console.log(`Checking ${req.params.path} is regular file`);
    const blobPath = pathMapper.convert(req.params.path);
    const exists = await blobExists(blobPath);
    res.send({ isRegularFile: exists });
  } catch (e) {
    sendError(res, e);
  }
});

app.get("/isSymlink/:path", async(req, res) => {
  try {
    console.log(`Checking ${req.params.path} is simlink`);
    res.send({ isSymLink: false });
  } catch (e) {
    sendError(res, e);
  }
});

app.get("/isEmpty/:path", async(req, res) => {
  try {
    console.log(`Checking ${req.params.path} is empty`);
    if(pathMapper.isDir(req.params.path)) {
      // For the purposes of this demo. All our directories have stuff in them
      res.send({ isEmpty: false});
      return;
    }
    const blobPath = pathMapper.convert(req.params.path);
    const size = await blobSize(blobPath);
    res.send({ isEmpty: !size});
  } catch (e) {
    sendError(res, e);
  }
});

app.get("/getChildren/:path", async(req, res) => {
  // This shouldn't be called in this demo but normally this should
  // return an array of a directory's children
  console.log(`Checking ${req.params.path} children`);
  res.status = 500;
  res.send({ message: "Did not expect getChildren to be called in this demo" });
});

app.listen(port, async () => {
  console.log(
    `Example app listening on port ${port} connected on: ${accountName}`
  );
});
