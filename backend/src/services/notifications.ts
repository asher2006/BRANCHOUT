export interface StaleNudgePayload {
  webhookUrl: string;
  projectName: string;
  staleBranches: Array<{
    teammateName: string;
    githubUsername: string;
    branchName: string;
    hoursInactive: number;
    ownedPaths: string[];
  }>;
}

/**
 * Sends a formatted alert message to Slack or Discord webhook.
 */
export async function sendWebhookNudge(payload: StaleNudgePayload): Promise<{ success: boolean; error?: string }> {
  if (!payload.webhookUrl || !payload.webhookUrl.startsWith("http")) {
    return { success: false, error: "Invalid webhook URL" };
  }

  const isDiscord = payload.webhookUrl.includes("discord.com");

  let body: any;

  if (isDiscord) {
    body = {
      content: `⚠️ **Branchout Activity Alert: ${payload.projectName}**`,
      embeds: [
        {
          title: `Stale Branch Notice (${payload.staleBranches.length} branch${payload.staleBranches.length > 1 ? 'es' : ''})`,
          description: `The following branches have had no commit activity past the threshold:`,
          color: 0xffb224, // Amber warning color
          fields: payload.staleBranches.map((b) => ({
            name: `${b.teammateName} (@${b.githubUsername})`,
            value: `🌿 Branch: \`${b.branchName}\`\n⏳ Inactive: **${b.hoursInactive}h**\n📁 Paths: ${b.ownedPaths.map((p) => `\`${p}\``).join(', ') || 'General'}`,
            inline: false,
          })),
          footer: { text: "Branchout Hackathon Coordinator" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  } else {
    // Slack standard format
    body = {
      text: `⚠️ *Branchout Activity Alert for ${payload.projectName}*`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `⚠️ Stale Branches Detected in ${payload.projectName}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${payload.staleBranches.length} branch${payload.staleBranches.length > 1 ? 'es' : ''}* have had no commit activity past the threshold:`,
          },
        },
        ...payload.staleBranches.map((b) => ({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• *${b.teammateName}* (@${b.githubUsername}) on \`${b.branchName}\` — *${b.hoursInactive}h inactive*`,
          },
        })),
      ],
    };
  }

  try {
    const res = await fetch(payload.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Webhook returned status ${res.status}: ${errText}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reach webhook endpoint" };
  }
}
