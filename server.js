require("dotenv").config();
const path = require("path");
const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const HTMLtoDOCX = require("html-to-docx");
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
  processPdf,
  processDoc,
  getMimeTypeForExt,
  //processExcelBlob,
} = require("./helper");
const { utils, write } = require("./sheetjs/xlsx");
const PORT = process.env.PORT || 5000;

app.use(bodyParser.urlencoded({ extended: false, limit: "50mb" }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: "*",
  })
);
app.engine(".hbs", engine({ extname: ".hbs" }));
app.set("view engine", ".hbs");
app.set("views", "./views");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_req, res) => {
  res.send("Welcome to SForce Editor!");
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

    if (ext === "docx" || ext === "doc") {
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
    } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      //                                processExcelBlob
      let { template, options } = await processExcel(
        resp,
        name,
        ext,
        contentDocumentId
      );
      renderTemplate = template;
      renderOptions = options;
    } else if (ext === "pdf") {
      let { template, options } = await processPdf(
        resp,
        name,
        ext,
        contentDocumentId
      );
      renderTemplate = template;
      renderOptions = options;
    } else {
      res.render("error", {
        script: `<script>
        setAlert('Files of type .${ext} are not supported.', 'danger');
        const save = document.querySelector('#save-custom');
        const saveAndClose = document.querySelector('#saveAndClose-custom');
        save.disabled = true;
        saveAndClose.disabled = true;
        </script>`,
      });
      return;
    }
    res.render(renderTemplate, renderOptions);
  } catch (error) {
    console.log(error);
    res.statusCode = 501;
    res.json({ error: error.message });
  }
});

app.post("/saveXlsx", async (req, res) => {
  let aoa = req.body.data;
  console.log("aoa => ", aoa);
  let { ext, name, conDocId } = req.body;
  const ws = utils.aoa_to_sheet(aoa);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = write(wb, { type: "buffer", bookType: ext });
  console.log(buf);
  try {
    await insertVersionData(req, res, buf, name, conDocId);
    res.send(req.body);
  } catch (error) {
    console.log(err);
    res.status(500).send({ error: err.message });
  }
});

app.post("/saveSheetData", express.raw({ type: "*/*" }), async (req, res) => {
  let { base64Blob, ext, name, conDocId } = req.body;
  base64Blob = base64Blob.substr(base64Blob.indexOf(",") + 1);
  console.log("base64Blob: ", base64Blob);
  let buf = Buffer.from(base64Blob, "base64");

  // await insertVersionData(req, res, buf, name, conDocId);
  res.send({ message: "Success" });
});

app.post("/saveTextData", async (req, res) => {
  let data = req.body.data;
  let { ext, name, conDocId } = req.body;
  try {
    await insertVersionData(req, res, data, name, conDocId);
    res.send(req.body);
  } catch (error) {
    console.log(err);
    res.status(500).send({ error: err.message });
  }
});

app.post("/saveDocData", async (req, res) => {
  let data = req.body.data;
  let preHtml = "<html><head><meta charset='utf-8'></head><body>";
  let postHtml = "</body></html>";
  data = preHtml + data + postHtml;
  let htmltodocxResult = await HTMLtoDOCX(data);
  let { ext, name, conDocId } = req.body;
  let mimeType = getMimeTypeForExt(ext);
  let blob = new Blob(["\ufeff", htmltodocxResult], {
    type: mimeType,
  });
  try {
    let arrBuf = await blob.arrayBuffer();
    let buf = Buffer.from(arrBuf);
    await insertVersionData(req, res, buf, name, conDocId);
    res.send(req.body);
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: err.message });
  }
});

app.post("/savePdfData", async (req, res) => {
  let data = req.body.data;
  let { ext, name, conDocId } = req.body;
  try {
    await insertVersionData(req, res, data, name, conDocId);
    res.send(req.body);
  } catch (error) {
    console.log(err);
    res.status(500).send({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
