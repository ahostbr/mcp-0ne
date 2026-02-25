const { spawnSync } = require("node:child_process");
const path = require("node:path");

module.exports = async (context) => {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const appInfo = context.packager.appInfo;
  const exeName = `${appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(context.packager.info.projectDir, "resources", "ico.ico");
  const appBuilderPath = path.join(
    context.packager.info.projectDir,
    "node_modules",
    "app-builder-bin",
    "win",
    "x64",
    "app-builder.exe"
  );

  const args = [
    exePath,
    "--set-version-string",
    "FileDescription",
    appInfo.description || appInfo.productName,
    "--set-version-string",
    "ProductName",
    appInfo.productName,
    "--set-version-string",
    "LegalCopyright",
    appInfo.copyright,
    "--set-file-version",
    appInfo.shortVersion || appInfo.buildVersion,
    "--set-product-version",
    appInfo.shortVersionWindows || appInfo.getVersionInWeirdWindowsForm(),
    "--set-version-string",
    "InternalName",
    appInfo.productFilename,
    "--set-version-string",
    "OriginalFilename",
    exeName,
    "--set-icon",
    iconPath,
  ];

  const run = spawnSync(appBuilderPath, ["rcedit", "--args", JSON.stringify(args)], {
    stdio: "inherit",
  });

  if (run.status !== 0) {
    throw new Error(`afterPack rcedit failed with exit code ${run.status ?? "unknown"}`);
  }
};
