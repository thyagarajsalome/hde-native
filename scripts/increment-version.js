const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
if (!fs.existsSync(appJsonPath)) {
  console.error("app.json not found!");
  process.exit(1);
}

try {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  // 1. Increment versionCode
  const oldVersionCode = appJson.expo.android.versionCode;
  const newVersionCode = oldVersionCode + 1;
  appJson.expo.android.versionCode = newVersionCode;

  // 2. Increment versionName (patch version, e.g. 1.0.10 -> 1.0.11)
  const oldVersionName = appJson.expo.version;
  const versionParts = oldVersionName.split('.');
  if (versionParts.length === 3) {
    const patch = parseInt(versionParts[2], 10);
    versionParts[2] = (patch + 1).toString();
    appJson.expo.version = versionParts.join('.');
  } else {
    appJson.expo.version = `${oldVersionName}.1`;
  }

  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
  console.log(`Successfully incremented version in app.json:`);
  console.log(`  versionCode: ${oldVersionCode} -> ${newVersionCode}`);
  console.log(`  versionName: ${oldVersionName} -> ${appJson.expo.version}`);
} catch (error) {
  console.error("Error updating app.json:", error);
  process.exit(1);
}
