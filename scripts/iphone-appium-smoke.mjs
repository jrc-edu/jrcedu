#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { remote } from "webdriverio";

const DATA_DIR = path.join(os.homedir(), "Documents", "JRC-iPhone-Agent");
const SCREENSHOT_PATH = path.join(DATA_DIR, "appium-smoke-screenshot.png");
const UDID = process.env.JRC_IPHONE_UDID || "00008120-000A5D1C2E5BC01E";
const SHOW_XCODE_LOG = process.env.JRC_SHOW_XCODE_LOG === "1";
const WDA_LAUNCH_TIMEOUT = Number(process.env.JRC_WDA_LAUNCH_TIMEOUT || 180000);
const WEBDRIVER_TIMEOUT = Number(process.env.JRC_WEBDRIVER_TIMEOUT || WDA_LAUNCH_TIMEOUT + 60000);
const USE_NEW_WDA = process.env.JRC_USE_NEW_WDA !== "0";

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const driver = await remote({
    protocol: "http",
    hostname: "127.0.0.1",
    port: 4723,
    path: "/wd/hub",
    logLevel: "warn",
    connectionRetryTimeout: WEBDRIVER_TIMEOUT,
    connectionRetryCount: 0,
    capabilities: {
      platformName: "iOS",
      "appium:automationName": "XCUITest",
      "appium:udid": UDID,
      "appium:deviceName": "程志豪的iPhone",
      "appium:platformVersion": "26.5",
      "appium:noReset": true,
      "appium:newCommandTimeout": 120,
      "appium:showXcodeLog": SHOW_XCODE_LOG,
      "appium:usePrebuiltWDA": false,
      "appium:useNewWDA": USE_NEW_WDA,
      "appium:wdaLaunchTimeout": WDA_LAUNCH_TIMEOUT,
      "appium:wdaStartupRetries": 2,
      "appium:wdaStartupRetryInterval": 10000,
      "appium:updatedWDABundleId": process.env.JRC_WDA_BUNDLE_ID || "com.jrcedu.WebDriverAgentRunner"
    }
  });

  try {
    const orientation = await driver.getOrientation();
    const screenshot = await driver.takeScreenshot();
    await fs.writeFile(SCREENSHOT_PATH, Buffer.from(screenshot, "base64"));
    console.log("Appium 真机会话已建立");
    console.log(`屏幕方向：${orientation}`);
    console.log(`截图文件：${SCREENSHOT_PATH}`);
  } finally {
    await driver.deleteSession();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
