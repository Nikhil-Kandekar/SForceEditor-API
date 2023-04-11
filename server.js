require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
// const { getSheetData, uploadFileToDrive } = require("./googleAuth");
const {
  redirectToSalesforceLogin,
  getAccessToken,
  getUserDetails,
  queryVersionData,
  insertVersionData,
} = require("./salesforceAuth");
const { engine } = require("express-handlebars");
const {
  processExcel,
  processText,
  htmlToText,
  processDoc,
  getMimeTypeForExt,
} = require("./helper");
const { utils, write } = require("./sheetjs/xlsx");
const PORT = process.env.PORT || 5000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "*",
  })
);
app.engine(".hbs", engine({ extname: ".hbs" }));
app.set("view engine", ".hbs");
app.set("views", "./views");

app.get("/", (_req, res) => {
  res.send("Hey");
});

// ------------- Google Auth ------------------

app.get("/getSheetData", async (_req, res) => {
  const data = await getSheetData();
  console.log(data);
  res.send(data);
});

// ------------- Salesforce Auth ------------------

app.get("/salesforceAuth", async (req, res) => {
  req.query && req.query.fileId ? res.cookie("fileId", req.query.fileId) : null;
  res.cookie("Revert Uri", req.query.revertUri);
  await redirectToSalesforceLogin(req, res);
});

app.get("/getAccessToken", async (req, res) => {
  const response = await getAccessToken(req, res);
  let revert;
  if (req.cookies["fileId"] !== undefined) {
    revert = "/getData?fileId=" + req.cookies["fileId"];
  } else {
    revert = "/getData";
  }

  res.clearCookie("Revert Uri");
  res.cookie("Instance Url", response.INSTANCE_URL);
  res.cookie("Access Token", response.ACCESS_TOKEN).redirect(revert);
});

app.get("/userData", async (req, res) => {
  const deets = await getUserDetails(req, res);
  res.json(deets);
});

app.get("/getData", async (req, res) => {
  let fileId = req.query.fileId; // /getData?fileId=xxxx
  const deets = await queryVersionData(req, res, fileId);
  // get file data
  let urlStr = deets.records[0].VersionData;
  let name = deets.records[0].PathOnClient;
  let contentDocumentId = deets.records[0].ContentDocumentId;
  let ext = name.split(".").reverse()[0]; // txt or doc or xls ...
  try {
    const resp = await fetch(req.cookies["Instance Url"] + urlStr, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + req.cookies["Access Token"],
      },
    });

    let renderTemplate;
    let renderOptions;

    if (ext === "docx") {
      let { template, options } = await processDoc(
        resp,
        ext,
        name,
        contentDocumentId
      );
      renderTemplate = template;
      renderOptions = options;
    } else if (ext === "txt") {
      let { template, options } = await processText(
        resp,
        name,
        ext,
        contentDocumentId
      );
      renderTemplate = template;
      renderOptions = options;
    } else if (ext === "xlsx" || ext === "xls") {
      let { template, options } = await processExcel(
        resp,
        name,
        ext,
        contentDocumentId
      );
      renderTemplate = template;
      renderOptions = options;
    } else {
      res.render("error", {
        message: `Files of type .${ext} are not supported.`,
      });
      return;
    }
    res.render(renderTemplate, renderOptions);
  } catch (error) {
    console.log(error);
    res.json({ error: error.message });
  }
});

app.post("/saveSheetData", async (req, res) => {
  let aoo = req.body.data;
  let { ext, name, conDocId } = req.body;
  const ws = utils.json_to_sheet(aoo);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = write(wb, { type: "buffer", bookType: ext });
  console.log(buf);
  await insertVersionData(req, res, buf, name, conDocId);
  res.send(req.body);
});

app.post("/saveTextData", async (req, res) => {
  let data = req.body.data;
  let textData = htmlToText(data);
  let { ext, name, conDocId } = req.body;
  await insertVersionData(req, res, textData, name, conDocId);
  res.send(req.body);
});

app.post("/saveDocData", async (req, res) => {
  let data = req.body.data;
  let preHtml =
    "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>";
  let postHtml = "</body></html>";
  data = preHtml + data + postHtml;
  let { ext, name, conDocId } = req.body;
  let mimeType = getMimeTypeForExt(ext);
  let blob = new Blob(["\ufeff", data], {
    type: mimeType,
  });
  let arrBuf = await blob.arrayBuffer();
  let buf = Buffer.from(arrBuf);

  await insertVersionData(req, res, buf, name, conDocId);
  res.send(req.body);
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
