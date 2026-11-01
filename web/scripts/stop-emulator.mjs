// On Windows the Firestore emulator's Java process can outlive `firebase emulators:exec`,
// and then blocks port 8080 on the next run. This stops it, but ONLY if it is the Firebase
// Firestore emulator (its command line contains "cloud-firestore-emulator"). Other programs are left alone.
import { execFileSync } from "node:child_process";

if (process.platform !== "win32") process.exit(0);

const ps = `
Get-CimInstance Win32_Process -Filter "Name='java.exe'" |
  Where-Object { $_.CommandLine -like '*cloud-firestore-emulator*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force; "stopped firestore emulator pid $($_.ProcessId)" }
`;
try {
  const out = execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { encoding: "utf8" }).trim();
  if (out) console.log(out);
} catch {
  /* nothing to stop, or PowerShell unavailable: not an error for the tests */
}
