#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { spawn } from "node:child_process";

const DATA_DIR = path.join(os.homedir(), "Documents", "JRC-iPhone-Agent");
const STATUS_PATH = path.join(DATA_DIR, "latest-status.json");
const SCREENSHOT_PATH = path.join(DATA_DIR, "latest-iphone-screenshot.png");

function nowIso() {
  return new Date().toISOString();
}

function run(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({
        ok: false,
        code: -1,
        stdout,
        stderr: `${stderr}${error.message}`
      });
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

async function commandExists(command) {
  const result = await run("zsh", ["-lc", `command -v ${command}`]);
  return result.ok ? result.stdout : "";
}

async function readDeviceValue(key, udid) {
  const args = udid ? ["-u", udid, "-k", key] : ["-k", key];
  const result = await run("ideviceinfo", args);
  return result.ok ? result.stdout : "";
}

function splitLines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

async function collectStatus() {
  const tools = {
    idevice_id: await commandExists("idevice_id"),
    ideviceinfo: await commandExists("ideviceinfo"),
    idevicescreenshot: await commandExists("idevicescreenshot"),
    ideviceimagemounter: await commandExists("ideviceimagemounter"),
    appium: await commandExists("appium")
  };

  const xcodeSelect = await run("xcode-select", ["-p"]);
  const xcodebuild = await run("xcodebuild", ["-version"]);
  const appiumVersion = tools.appium ? await run("appium", ["-v"]) : null;
  const driverList = tools.appium ? await run("appium", ["driver", "list", "--installed"]) : null;
  const driverListText = [driverList?.stdout, driverList?.stderr].filter(Boolean).join("\n");
  const xcuitestInstalled = /xcuitest@|xcuitest.*installed/i.test(driverListText);
  const devicesResult = tools.idevice_id ? await run("idevice_id", ["-l"]) : { ok: false, stdout: "", stderr: "idevice_id not installed" };
  const devices = devicesResult.ok ? splitLines(devicesResult.stdout) : [];
  const udid = devices[0] || "";

  const device = udid
    ? {
        udid,
        name: await readDeviceValue("DeviceName", udid),
        productType: await readDeviceValue("ProductType", udid),
        productVersion: await readDeviceValue("ProductVersion", udid),
        deviceClass: await readDeviceValue("DeviceClass", udid)
      }
    : null;

  const developerMode = udid && tools.ideviceimagemounter
    ? await run("ideviceimagemounter", ["-u", udid, "devmodestatus"])
    : null;

  const status = {
    checkedAt: nowIso(),
    tools,
    xcode: {
      selectedPath: xcodeSelect.ok ? xcodeSelect.stdout : "",
      xcodebuildOk: xcodebuild.ok,
      xcodebuild: xcodebuild.ok ? xcodebuild.stdout : xcodebuild.stderr
    },
    appium: {
      version: appiumVersion?.ok ? appiumVersion.stdout : "",
      xcuitestInstalled,
      driverList: driverListText
    },
    devices,
    device,
    developerMode: developerMode
      ? {
          ok: developerMode.ok,
          output: developerMode.ok ? developerMode.stdout : developerMode.stderr
        }
      : null,
    ready: {
      paired: Boolean(device),
      xcode: xcodebuild.ok,
      appium: Boolean(appiumVersion?.ok),
      xcuitest: xcuitestInstalled,
      developerMode: Boolean(developerMode?.ok)
    }
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  return status;
}

function printStatus(status) {
  printSection("iPhone 采集器状态");
  console.log(`状态文件：${STATUS_PATH}`);
  console.log(`设备连接：${status.ready.paired ? "已连接" : "未连接"}`);
  if (status.device) {
    console.log(`设备名称：${status.device.name || "未读取到"}`);
    console.log(`设备型号：${status.device.productType || "未读取到"}`);
    console.log(`系统版本：${status.device.productVersion || "未读取到"}`);
    console.log(`UDID：${status.device.udid}`);
  }

  printSection("自动化条件");
  console.log(`完整 Xcode：${status.ready.xcode ? "已就绪" : "未就绪"}`);
  console.log(`Appium：${status.ready.appium ? `已安装 ${status.appium.version}` : "未安装"}`);
  console.log(`XCUITest 驱动：${status.ready.xcuitest ? "已安装" : "未安装"}`);
  console.log(`开发者模式：${status.ready.developerMode ? "可用" : "未启用或不可用"}`);

  if (!status.ready.xcode) {
    console.log("\n下一步：安装完整 Xcode，并打开一次 Xcode 完成初始化。");
  }
  if (!status.ready.developerMode) {
    console.log("下一步：在 iPhone 设置 -> 隐私与安全性 -> 开发者模式 中打开开发者模式，并按提示重启。");
  }
  if (status.ready.paired && status.ready.xcode && status.ready.xcuitest && status.ready.developerMode) {
    console.log("\n可以进入截图、点击、滑动测试。");
  }
}

async function screenshot() {
  const status = await collectStatus();
  printStatus(status);
  if (!status.device) {
    throw new Error("没有检测到已配对 iPhone。请保持手机解锁、重新插线，并确认信任此电脑。");
  }
  const result = await run("idevicescreenshot", ["-u", status.device.udid, SCREENSHOT_PATH]);
  if (!result.ok) {
    console.log("\n截图失败：");
    console.log(result.stderr || result.stdout);
    console.log("\n通常原因：未安装完整 Xcode、未启用开发者模式，或开发者镜像未挂载。");
    process.exitCode = 1;
    return;
  }
  console.log(`\n截图已保存：${SCREENSHOT_PATH}`);
}

async function doctor() {
  const status = await collectStatus();
  printStatus(status);
  if (!status.ready.appium) {
    console.log("\nAppium 未安装，先执行：npm install -g appium @appium/doctor");
    process.exitCode = 1;
    return;
  }
  printSection("Appium XCUITest 诊断");
  const result = await run("appium", ["driver", "doctor", "xcuitest"]);
  console.log(result.stdout || result.stderr);
  if (!result.ok) {
    process.exitCode = result.code || 1;
  }
}

async function main() {
  const action = process.argv[2] || "check";
  if (action === "check") {
    const status = await collectStatus();
    printStatus(status);
    return;
  }
  if (action === "screenshot") {
    await screenshot();
    return;
  }
  if (action === "doctor") {
    await doctor();
    return;
  }
  console.log("用法：npm run iphone:check | npm run iphone:screenshot | npm run iphone:doctor");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
