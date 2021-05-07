const { app, BrowserWindow, ipcMain, session } = require("electron");
const settings = require("./settings");
const fs = require("fs");
const path = require("path");
const jws = require("jws");
const bcrypt = (() => {
  try {
    return require("bcrypt");
  } catch (e) {
    return require("bcryptjs");
  }
})();

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "1";

let windows = {};

function parseCookieString(setCookieValue, decodeValues = false) {
  if (!setCookieValue) return null;
  function isNonEmptyString(str) {
    return typeof str === "string" && !!str.trim();
  }
  var parts = setCookieValue.split(";").filter(isNonEmptyString);
  var nameValue = parts.shift().split("=");
  var name = nameValue.shift();
  // everything after the first =, joined by a "=" if there was more than one part
  var value = nameValue.join("=");
  var cookie = {
    // grab everything before the first =
    name: name,
    // decode cookie value
    value: decodeValues ? decodeURIComponent(value) : value,
  };

  parts.forEach(function (part) {
    var sides = part.split("=");
    var key = sides.shift().trimLeft().toLowerCase();
    var value = sides.join("=");
    if (key === "expires") {
      cookie.expires = new Date(value);
    } else if (key === "max-age") {
      cookie.maxAge = parseInt(value, 10);
    } else if (key === "secure") {
      cookie.secure = true;
    } else if (key === "httponly") {
      cookie.httpOnly = true;
    } else if (key === "samesite") {
      cookie.sameSite = value;
    } else {
      cookie[key] = value;
    }
  });

  return cookie;
}

function getCredential(path) {
  if (path) {
    return fs.readFileSync(path, "utf8");
  }
  return null;
}
const publicKey = getCredential(settings.robot_public_key);

function verifySignature(secretKey, signature, callback) {
  if (publicKey) {
    const stream = jws.createVerify({
      algorithm: "RS256",
      publicKey,
      signature,
    });
    stream.on("done", function (verified, obj) {
      if (verified) {
        callback(obj.payload === secretKey);
        return;
      }
      callback(false);
    });
    stream.on("error", function (err) {
      console.error(err);
      callback(false);
    });
  } else {
    callback(bcrypt.compareSync(secretKey, signature));
  }
}

const isValidKey = (req, res, next) => {
  if (!publicKey) {
    return next();
  }
  const unauthorized = () => {
    res.statusCode = 401;
    res.end("Unauthorized\n");
  };
  if ("body" in req && "user_id" in req.body && "signature" in req.body) {
    verifySignature(req.body.user_id, req.body.signature, (verified) => {
      if (verified) {
        return next();
      }
      unauthorized();
    });
    return;
  }
  unauthorized();
};

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    //app.quit()
  }
});

app.on("activate", function () {});

const express = require("express");

const PORT = process.env.PORT || 5000;

const wapp = express();
wapp.use(express.json({ type: "application/json" }));

const createWindow = (name, fullscreen = false) => {
  console.log(`createWindow ${name}`);
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    fullscreen,
    autoHideMenuBar: true,
    webPreferences: {
      partition: "persist:DoraEngineApp",
      defaultFontFamily: {
        standard: "Noto Sans CJK JP",
        serif: "Noto Sans CJK JP",
        sansSerif: "Noto Sans CJK JP",
        monospace: "Noto Sans Mono CJK JP",
      },
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "renderer.js"),
    },
  });

  const ses = window.webContents.session;

  ses.webRequest.onBeforeSendHeaders({ urls: [] }, (details, callback) => {
    if (details.method == "POST") {
      session.defaultSession.cookies.get({}, (error, cookies) => {
        details.requestHeaders.Cookie = cookies
          .map((v) => `${v.name}=${v.value}`)
          .join("; ");
        callback({ cancel: false, requestHeaders: details.requestHeaders });
      });
    } else {
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  });

  ses.webRequest.onHeadersReceived({ urls: [] }, (details, callback) => {
    if (details.method == "POST") {
      try {
        const currentURL = details.url ? new URL(details.url) : null;
        const cookies = (() => {
          const cookie = details.responseHeaders["set-cookie"];
          if (cookie && Array.isArray(cookie)) {
            return cookie.map((str) => parseCookieString(str));
          }
          return [];
        })().map((v) => {
          if (currentURL) {
            if (typeof v.url === "undefined")
              v.url = `${currentURL.protocol}//${currentURL.hostname}`;
            if (typeof v.domain === "undefined") v.domain = currentURL.hostname;
          }
          return v;
        });
        const setCookieLoop = (callback) => {
          if (cookies.length <= 0) {
            return callback();
          }
          const details = cookies.shift();
          session.defaultSession.cookies.set(details, (error) => {
            if (error) console.error(error);
            setCookieLoop(callback);
          });
        };
        setCookieLoop(() => {
          callback({ cancel: false, requestHeaders: details.requestHeaders });
        });
      } catch (err) {
        callback({ cancel: false, requestHeaders: details.requestHeaders });
      }
    } else {
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  });
  return window;
};

const openWindow = (req) => {
  const { name } = req.params;
  let fullscreen = false;
  if ("fullscreen" in req.body) {
    fullscreen = req.body.fullscreen == "true" ? true : false;
  }
  if (!windows[name]) {
    windows[name] = createWindow(name, fullscreen);
  }
  const window = windows[name];
  if (window) {
    if ("fullscreen" in req.body) {
      window.setFullScreen(fullscreen);
    }
  }
  window.on("closed", () => {
    delete windows[name];
  });
  if ("timeout" in req.body) {
    setTimeout(() => {
      window.close();
      delete windows[name];
    }, req.body.timeout);
  }
  return window;
};

const loadWindow = (req, res) => {
  const { name } = req.params;
  const window = openWindow(req);
  if (window) {
    try {
      window.setTitle(name);
      const openURL = (url) => {
        if (window.webContents.getURL() !== url) {
          window.loadURL(url);
        }
      };
      if ("url" in req.body) {
        const { url } = req.body;
        openURL(url);
      }
      if ("file" in req.body) {
        const { file } = req.body;
        if (path.normalize(file) === file) {
          openURL(`file://${__dirname}/public/${file}`);
        }
      }
      window.show();
    } catch (err) {
      delete windows[name];
    }
    res.send("OK\n");
  } else {
    res.statusCode = 400;
    res.end(`Missing window ${name}\n`);
  }
};

wapp.post("/create/:name", isValidKey, (req, res) => {
  loadWindow(req, res);
});

wapp.post("/load/:name", isValidKey, (req, res) => {
  loadWindow(req, res);
});

wapp.post("/open/:name", isValidKey, (req, res) => {
  loadWindow(req, res);
});

wapp.post("/reload/:name", isValidKey, (req, res) => {
  const { name } = req.params;
  const window = openWindow(req);
  if (window) {
    try {
      window.setTitle(name);
      const openURL = (url) => {
        if (window.webContents.getURL() !== url) {
          window.loadURL(url);
        }
      };
      if ("url" in req.body) {
        const { url } = req.body;
        openURL(url);
      }
      if ("file" in req.body) {
        const { file } = req.body;
        if (path.normalize(file) === file) {
          openURL(`file://${__dirname}/public/${file}`);
        }
      }
      window.reload();
    } catch (err) {
      window.reload();
    }
    res.send("OK\n");
  } else {
    res.statusCode = 400;
    res.end(`Missing window ${name}\n`);
  }
});

wapp.post("/closeAll", isValidKey, (req, res) => {
  const win = { ...windows };
  windows = {};
  Object.keys(win).forEach((name) => {
    win[name].close();
  });
  res.send("OK\n");
});

wapp.post("/close/:name", isValidKey, (req, res) => {
  const { name } = req.params;
  const window = openWindow(req);
  if (window) {
    window.close();
    delete windows[name];
    res.send("OK\n");
  } else {
    res.statusCode = 400;
    res.end(`Missing window ${name}\n`);
  }
});

wapp.post("/hide/:name", isValidKey, (req, res) => {
  const { name } = req.params;
  const window = openWindow(req);
  if (window) {
    window.hide();
    res.send("OK\n");
  } else {
    res.statusCode = 400;
    res.end(`Missing window ${name}\n`);
  }
});

wapp.post("/showInactive/:name", isValidKey, (req, res) => {
  const { name } = req.params;
  const window = openWindow(req);
  if (window) {
    window.showInactive();
    res.send("OK\n");
  } else {
    res.statusCode = 400;
    res.end(`Missing window ${name}\n`);
  }
});

wapp.post("/show/:name", isValidKey, (req, res) => {
  const { name } = req.params;
  const window = openWindow(req);
  if (window) {
    window.show();
    res.send("OK\n");
  } else {
    res.statusCode = 400;
    res.end(`Missing window ${name}\n`);
  }
});

wapp.post("/print/:name", isValidKey, (req, res) => {
  const { name } = req.params;
  const window = openWindow(req);
  if (window) {
    let contents = window.webContents;
    contents.print(
      {
        silent: true,
        printBackground: false,
        deviceName: process.env.ROBOT_PRINTER_NAME,
      },
      (success) => {
        if (success) {
          res.send("OK\n");
        } else {
          res.send("NG\n");
        }
      }
    );
  } else {
    res.statusCode = 400;
    res.end(`Missing window ${name}\n`);
  }
});

wapp.post("/printToPDF/:name", isValidKey, (req, res) => {
  const { name } = req.params;
  const { filename } = req.body;
  const window = openWindow(req);
  if (window) {
    const p = path.normalize(path.join(settings.picture_directory, filename));
    if (p.indexOf(settings.picture_directory) !== 0) {
      console.log("invalid filename");
      return res.send("NG");
    }
    let contents = window.webContents;
    contents.printToPDF(
      {
        pageSize: "A4",
        landscape: true,
      },
      (error, data) => {
        if (error) {
          res.send("NG\n");
        } else {
          fs.writeFile(p, data, (error) => {
            if (error) {
              res.send("NG\n");
            } else {
              res.send("OK\n");
            }
          });
        }
      }
    );
  } else {
    res.statusCode = 400;
    res.end(`Missing window ${name}\n`);
  }
});

wapp.post("/fullscreen/:name", isValidKey, (req, res) => {
  const { name } = req.params;
  const window = openWindow(req);
  if (window) {
    if ("flag" in req.body) {
      const { flag } = req.body;
      if (window) {
        window.setFullScreen(flag);
      }
    } else {
      if (window) {
        window.setFullScreen(true);
      }
    }
    res.send(`${window.isFullScreen()}\n`);
  } else {
    res.statusCode = 400;
    res.end(`Missing window ${name}\n`);
  }
});

wapp.post("/isLoading/:name", isValidKey, (req, res) => {
  const { name } = req.params;
  const window = openWindow(req);
  if (window) {
    res.send(window.webContents.isLoading());
  } else {
    res.statusCode = 400;
    res.end(`Missing window ${name}\n`);
  }
});

function capture(req, res, params) {
  const { name, format } = params;
  const { filename } = req.body;
  const window = openWindow(req);
  if (window) {
    const p = path.normalize(path.join(settings.picture_directory, filename));
    if (p.indexOf(settings.picture_directory) !== 0) {
      console.log("invalid filename");
      return res.send("NG");
    }
    window.capturePage((image) => {
      const buffer = format === "png" ? image.toPNG() : image.toJPEG(100);
      fs.writeFile(p, buffer, (err) => {
        res.send("OK");
      });
    });
  } else {
    res.statusCode = 400;
    res.end(`Missing window ${name}\n`);
  }
}

wapp.post("/capture/:name", isValidKey, (req, res) => {
  const { name } = req.params;
  capture(req, res, { name, format: "jpeg" });
});

wapp.post("/capture/:format/:name", isValidKey, (req, res) => {
  capture(req, res, req.params);
});

const server = require("http").Server(wapp);
server.listen(PORT, () =>
  console.log(`dora-browser server listening on port ${PORT}!`)
);
