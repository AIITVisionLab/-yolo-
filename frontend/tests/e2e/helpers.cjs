const { expect } = require("@playwright/test");

const FRONTEND_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.PLANT_FRONTEND_BASE_URL || "http://127.0.0.1:5500";
const ADMIN_USERNAME = process.env.PLAYWRIGHT_ADMIN_USERNAME || process.env.PLANT_ADMIN_USERNAME || process.env.BOOTSTRAP_ADMIN_USERNAME || "root";
const explicitAdminPassword =
  process.env.PLAYWRIGHT_ADMIN_PASSWORD || process.env.PLANT_ADMIN_PASSWORD || process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
const ADMIN_PASSWORD_CANDIDATES = explicitAdminPassword ? [explicitAdminPassword] : ["change_me", "root"];

const SAMPLE_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5X6VoAAAAASUVORK5CYII=";
const SAMPLE_ANNOTATION_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAPAAAACgCAIAAAC9uXYyAAADLklEQVR4nO3cwW1bBxBF0e/AnaSbVJAKUoYXLsMVpII04Cq8cBOuIAsBhDemSEgmZ+4/Z01Qj8DFfHKjD99+fD2g4o9nD4D3JGhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE2KoEkRNCmCJkXQpAiaFEGTImhSBE3Kx2cP4Jr/vv/77Am3+uvPv5894ThcaGIETYqgSTnjd+jPXz5ff8Gnfz49Zgnv7ixBvxrxr14s7l3iQd/V8fV3UPYKzaDf3vGV91T2ZMEfhb+j5ke+P2+RutAPS+3lDznVA3Uu9OMPp1M9UOFCPzEsp3qa9Rd6wpmcsIEXu4OeU9KcJSe3OOhpDU3bc05bg55Zz8xVp7Iy6MndTN52BvuCnl/M/IVh+4KGK5YFveX4bdnZsynoXZXsWpuxKWh41ZqgNx68jZu32xH03jL2Ll9qR9BwI0GTsiDo7U/t7ft3WRA03E7QpEwPuvG8bnyKFaYHDXcRNCmCJmV00KWvnqXPMtnooOFegiZF0KQImhRBkyJoUgRNiqBJETQpgiZldNClfyRe+iyTjQ4a7iVoUgRNyvSgG189G59ihelBw10ETcqCoLc/r7fv32VB0HA7QZOyI+i9T+29y5faEfSxs4yNm7dbEzTcYlPQuw7errUZm4I+9lSyZWfPsqDhun1Bzz9+8xeG7Qv6mF3M5G1nsDLoY2o3M1edytagj3n1TNtzTouDPiY1NGfJye0O+phR0oQNvPj47AHv4KWnp/xHcSlPs/5CXzy+LTUPVLjQFw871VIeq3OhL353bWqeLHWhLy7NveO11vEKzaAv3l62jneJB33xc5evxi3ivc4S9M/0Ghb8UciZCZoUQZMiaFIETYqgSRE0KYImRdCkfPj24+uzN8C7caFJETQpgiZF0KQImhRBkyJoUgRNiqBJETQpgiZF0KQImhRBkyJoUgRNiqBJETQpgiZF0KQImhRBkyJoUgRNiqBJETQpgiZF0KQImhRBkyJoUgRNiqBJETQpgiZF0KQImhRBkyJoUgRNyv93eZTXQzywhQAAAABJRU5ErkJggg==";

function sampleImageFile() {
  return {
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(SAMPLE_IMAGE_BASE64, "base64"),
  };
}

function sampleAnnotationImageFile() {
  return {
    name: "annotation-sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(SAMPLE_ANNOTATION_IMAGE_BASE64, "base64"),
  };
}

async function loginAsAdmin(page) {
  await page.goto(`${FRONTEND_BASE_URL}/?workspace=recognition`, { waitUntil: "networkidle" });
  await expect(page.getByRole("dialog", { name: "登录账号" })).toBeVisible();
  await page.locator('input[autocomplete="username"]').fill(ADMIN_USERNAME);

  const passwordInput = page.locator('input[autocomplete="current-password"]');
  let lastErrorText = "";
  for (const password of ADMIN_PASSWORD_CANDIDATES) {
    await passwordInput.fill(password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    try {
      await expect(page.locator(".native-workspace--recognition")).toBeVisible({ timeout: 8000 });
      await expect(page.locator(".topbar__user")).toContainText("管理员");
      return;
    } catch (error) {
      const errorLocator = page.locator(".auth-form__error");
      if (await errorLocator.count()) {
        lastErrorText = await errorLocator.first().innerText();
      }
    }
  }

  throw new Error(`Admin login failed for ${ADMIN_USERNAME}${lastErrorText ? `: ${lastErrorText}` : ""}`);
}

module.exports = {
  FRONTEND_BASE_URL,
  loginAsAdmin,
  sampleAnnotationImageFile,
  sampleImageFile,
};
