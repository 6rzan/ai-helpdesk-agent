import { connectDb, disconnectDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { Category } from "../models/category.js";
import { Guide } from "../models/guide.js";
import { MANDATED_CATEGORIES } from "../models/enums.js";

interface SeedCategory {
  name: (typeof MANDATED_CATEGORIES)[number];
  displayName: string;
  classificationDescription: string;
  steps: { instruction: string; successHint: string }[];
}

// R1: seed data only. Never overwrites a newer guide version or an
// already-existing category — upserts by name, idempotent on rerun.
const SEED_CATEGORIES: SeedCategory[] = [
  {
    name: "password_login",
    displayName: "Password & Login",
    classificationDescription: "passwords, account lockouts, sign-in failures",
    steps: [
      {
        instruction: "Double-check that Caps Lock is off and re-type your password carefully.",
        successHint: "You are able to sign in normally.",
      },
      {
        instruction: "Use the \"Forgot password\" link on the sign-in page to reset your password.",
        successHint: "You receive a reset email and can set a new password.",
      },
      {
        instruction: "Wait 15 minutes for any temporary account lockout to clear, then try signing in again.",
        successHint: "The lockout message no longer appears and sign-in succeeds.",
      },
    ],
  },
  {
    name: "network",
    displayName: "Network & Connectivity",
    classificationDescription:
      "any connectivity problem — no internet (even for a whole floor or office), Wi-Fi, VPN, connection timeouts, network drives failing to connect or map",
    steps: [
      {
        instruction: "Check that Wi-Fi or the network cable is connected and airplane mode is off.",
        successHint: "Your device shows a connected network with internet access.",
      },
      {
        instruction: "Restart your router or reconnect to the Wi-Fi network from the network menu.",
        successHint: "Pages load normally in your browser again.",
      },
      {
        instruction: "Disconnect and reconnect the VPN, or restart the VPN client application.",
        successHint: "The VPN shows as connected and internal resources are reachable.",
      },
    ],
  },
  {
    name: "printer",
    displayName: "Printer & Scanner",
    classificationDescription: "printers, printing, or scanners/copiers attached to printers",
    steps: [
      {
        instruction: "Check that the printer is powered on and has paper and ink/toner.",
        successHint: "The printer's display shows it is ready, with no error lights.",
      },
      {
        instruction: "Cancel any stuck print jobs from the print queue, then try printing again.",
        successHint: "The document prints successfully.",
      },
      {
        instruction: "Restart the printer by powering it off, waiting 10 seconds, then powering it back on.",
        successHint: "The printer reconnects and appears available to your device.",
      },
    ],
  },
  {
    name: "peripherals",
    displayName: "Peripherals",
    classificationDescription:
      "mice, keyboards, monitors, headsets, or other attached input/display devices (never printers or scanners)",
    steps: [
      {
        instruction: "Unplug the device and plug it back into a different USB port.",
        successHint: "The device responds normally when used.",
      },
      {
        instruction: "If the device is wireless, replace or recharge its batteries and re-pair it.",
        successHint: "The device reconnects and responds without lag.",
      },
      {
        instruction: "Restart your computer to let it re-detect the device.",
        successHint: "The device is recognized and works correctly after restart.",
      },
    ],
  },
  {
    name: "performance",
    displayName: "System Performance",
    classificationDescription: "the whole machine running slow, freezing, or crashing — not a single device",
    steps: [
      {
        instruction: "Close any applications you are not currently using.",
        successHint: "The system feels noticeably more responsive.",
      },
      {
        instruction: "Save your work and restart your computer.",
        successHint: "The machine boots up and runs smoothly with no lag.",
      },
      {
        instruction: "Check for and install any pending operating system updates.",
        successHint: "Updates complete and performance improves after the next restart.",
      },
    ],
  },
  {
    name: "service_status",
    displayName: "Service Status",
    classificationDescription:
      "asking whether a hosted service or application (email, portal, shared drive) is down or degraded for everyone — the service itself is out while connectivity otherwise works",
    steps: [
      {
        instruction: "Refresh the page or fully close and reopen the application.",
        successHint: "The service loads and responds normally.",
      },
      {
        instruction: "Try accessing the service from a different device or network to rule out a local issue.",
        successHint: "The service works on the other device, confirming the issue was local.",
      },
      {
        instruction: "Check with a coworker whether they are experiencing the same issue with this service.",
        successHint: "You can confirm whether this is isolated to you or affecting others.",
      },
    ],
  },
];

async function seed(): Promise<void> {
  await connectDb();

  for (const seedCategory of SEED_CATEGORIES) {
    const category = await Category.findOneAndUpdate(
      { name: seedCategory.name },
      {
        $setOnInsert: {
          name: seedCategory.name,
          displayName: seedCategory.displayName,
          classificationDescription: seedCategory.classificationDescription,
          mandated: true,
          retired: false,
          createdBy: "seed-guides",
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
    logger.info({ category: category.name }, "category seeded");

    const existingGuide = await Guide.findOne({ categoryName: seedCategory.name });
    if (existingGuide) {
      logger.info({ category: seedCategory.name }, "guide already exists, skipping");
      continue;
    }

    await Guide.create({
      categoryName: seedCategory.name,
      version: 1,
      steps: seedCategory.steps,
      active: true,
      changedBy: "seed-guides",
      changedAt: new Date(),
      changeNote: "Initial seed",
    });
    logger.info({ category: seedCategory.name }, "guide v1 seeded");
  }

  await disconnectDb();
}

seed()
  .then(() => {
    logger.info("seed-guides complete");
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err }, "seed-guides failed");
    process.exit(1);
  });
