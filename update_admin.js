import bcrypt from "bcryptjs";
import { query } from "./src/config/db.js";

async function updateAdmin() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash("@Kiran2025", salt);
    await query("UPDATE users SET password = $1 WHERE username = $2", [hash, "admin"]);
    console.log("Password updated!");
  } catch (err) {
    console.error(err);
  }
}
updateAdmin();
