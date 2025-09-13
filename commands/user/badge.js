// commands/user/badge.js
// Stylish Random Badge Command (Bina PNG ke, Colorful aur Emoji ke sath)

const axios = require("axios");
const Jimp = require("jimp");

module.exports.config = {
  name: "badge",
  version: "10.0.0",
  hasPerm: 0,
  description: "Profile pic par colorful stylish random badge aur stamp lagaye",
  usage: "#badge [@user|me]",
};

module.exports.run = async ({ api, threadID, cleanArgs: args, event, botState, isMaster, botID, stopBot }) => {
  const { messageID, senderID } = event;

  if (botState.eventProcessed[messageID]) {
    console.log(`[DEBUG] Skipping duplicate event: ${messageID}`);
    return;
  }
  botState.eventProcessed[messageID] = true;

  if (botState.commandCooldowns[threadID]?.badge) {
    api.sendMessage("🚫 थोड़ा रुक भाई, 10 सेकंड बाद दोबारा try kar! 🕉️", threadID, messageID);
    return;
  }

  try {
    // Mentions ya me
    const mentions = event.mentions || {};
    let targetID = senderID;
    if (Object.keys(mentions).length > 0) targetID = Object.keys(mentions)[0];

    const flat = args.filter(a => a && a.trim());
    if (flat[0] && flat[0].toLowerCase() === "me") flat.shift();

    // Random Badge selection
    const BADGES = [
      "KING", "QUEEN", "PORNSTARR", "CHHAPRII", "KIDSS", "TATTAA", "NAMOONAA", 
      "JOKARR", "ULLUU", "CHOTA TATTAA", "MURAKHH", "MAHAMURKHH", "RANDII", 
      "VESHYAA", "KINNARR", "HIJDII", "HIJDAA", "LAVDII", "AATANKWAADII"
    ];
    const chosen = BADGES[Math.floor(Math.random() * BADGES.length)];
    
    // Random year (2000-2025)
    const year = Math.floor(Math.random() * (2025 - 2000 + 1)) + 2000;

    // Username
    let userName = targetID;
    const getName = new Promise((resolve) => {
      api.getUserInfo(targetID, (err, ret) => {
        if (err || !ret[targetID]) {
          console.error(`[ERROR] Failed to get user name for ID ${targetID}: ${err?.message || 'Unknown error'}`);
          resolve(targetID);
        } else {
          resolve(ret[targetID].name || targetID);
        }
      });
    });
    userName = await getName;

    // Profile pic fetch
    async function fetchPic(id) {
      const cookie = process.env.COOKIE_BASE || "";
      const url = `https://graph.facebook.com/${id}/picture?width=1024&height=1024`;
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        headers: cookie ? { Cookie: cookie, "User-Agent": "Mozilla/5.0" } : {}
      });
      const type = res.headers["content-type"] || "";
      if (!type.startsWith("image/")) throw new Error("Locked profile pic");
      return Buffer.from(res.data, "binary");
    }

    let buffer;
    try {
      buffer = await fetchPic(targetID);
    } catch (e) {
      console.error(`[ERROR] Failed to fetch profile pic for ID ${targetID}: ${e.message}`);
      // Fallback: User ka pehla letter
      const temp = new Jimp(900, 900, "#333");
      const font = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
      temp.print(font, 0, 300, {
        text: userName[0] || "?",
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP
      }, 900, 200);
      buffer = await temp.getBufferAsync(Jimp.MIME_JPEG);
    }

    const profile = await Jimp.read(buffer);
    profile.resize(900, 900);

    // Canvas setup
    const panelH = 250;
    const canvas = new Jimp(900, 900 + panelH, 0x00000000);
    canvas.composite(profile, 0, 0);

    // Stylish Badge (Colorful Gradient)
    const badgeSize = 300;
    const badge = new Jimp(badgeSize, badgeSize, 0x00000000);
    const center = badgeSize / 2;
    for (let r = center; r > 0; r--) {
      const t = r / center;
      // Colorful gradient (Red -> Gold -> Blue)
      const red = Math.floor(255 * (1 - t));
      const green = Math.floor(200 + 55 * t);
      const blue = Math.floor(100 + 155 * t);
      const color = Jimp.rgbaToInt(red, green, blue, 255);
      badge.scan(center - r, center - r, r * 2, r * 2, (x, y, idx) => {
        const dx = x - center, dy = y - center;
        if (dx * dx + dy * dy <= r * r) {
          badge.bitmap.data[idx + 0] = (color >> 16) & 255;
          badge.bitmap.data[idx + 1] = (color >> 8) & 255;
          badge.bitmap.data[idx + 2] = color & 255;
          badge.bitmap.data[idx + 3] = 255;
        }
      });
    }

    // Glow effect
    const glow = badge.clone().resize(badgeSize + 50, badgeSize + 50).blur(20);
    glow.color([{ apply: "brighten", params: [80] }]);
    canvas.composite(glow, 900 - badgeSize - 50, 10);

    // Badge place karna
    const badgeX = 900 - badgeSize - 25;
    const badgeY = 25;
    canvas.composite(badge, badgeX, badgeY);

    // Fonts
    const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const fontBig = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);

    // Outline text function
    async function printOutline(img, font, x, y, text) {
      const offsets = [[-2, 0], [2, 0], [0, -2], [0, 2]];
      for (const [dx, dy] of offsets) {
        img.print(font, x + dx, y + dy, {
          text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
        }, badgeSize, 100);
      }
      img.print(font, x, y, {
        text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
      }, badgeSize, 100);
    }

    // Badge par text (100% VERIFIED [BADGE] 👑)
    await printOutline(canvas, fontWhite, badgeX, badgeY + badgeSize / 2 - 50, "100% VERIFIED");
    await printOutline(canvas, fontBig, badgeX, badgeY + badgeSize / 2 - 10, `${chosen} 👑`);

    // Bottom panel (Colorful semi-transparent)
    const panel = new Jimp(860, panelH - 20, Jimp.rgbaToInt(50, 50, 50, 180));
    canvas.composite(panel, 20, 900 + 15);

    const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

    // Bottom panel text
    canvas.print(fontTitle, 30, 920, {
      text: `100% VERIFIED ${chosen} 🔥`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, 840, 60);
    canvas.print(fontSmall, 30, 980, {
      text: `Nickname: ${chosen} 👑`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, 840, 40);
    canvas.print(fontSmall, 30, 1020, {
      text: userName,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, 840, 40);
    canvas.print(fontSmall, 30, 1060, {
      text: `Upadhi dharan ki ${year} • Present me verified ${chosen} hai ✨`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, 840, 40);

    // Output
    const out = await canvas.getBufferAsync(Jimp.MIME_JPEG);
    api.sendMessage({
      body: `${userName} ke liye colorful stylish random badge ready hai! 👑🔥`,
      attachment: out
    }, threadID, messageID);

  } catch (e) {
    console.error(`[ERROR] Badge generation failed for threadID=${threadID}: ${e.message}`);
    api.sendMessage(`❌ कमांड चलाने में गलती: ${e.message} 🕉️`, threadID, messageID);
  }
};
