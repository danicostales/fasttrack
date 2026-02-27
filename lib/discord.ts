"use server"

import { REST } from "@discordjs/rest"
import { APIGuildMember, Routes } from "discord-api-types/v10"

const rest = new REST({
  version: "10"
}).setToken(process.env.DISCORD_BOT_TOKEN!)

export async function getMembers(): Promise<Map<string, string>> {
  const members = (await rest.get(
    Routes.guildMembers(process.env.DISCORD_GUILD_ID!),
    {
      query: new URLSearchParams("limit=1000")
    }
  )) as APIGuildMember[]

  return new Map(
    members.map((member) => [member.user.username, member.user.id])
  )
}

let memberMap: Map<string, string> | null
export async function sendMessage(message: string, participants: string[]) {
  if (!memberMap) {
    memberMap = await getMembers()
  }

  const mention = participants.map((p) => `<@${memberMap!.get(p)}>`)

  const craftedMessage = `${message}\n${mention.join("\n")}`

  rest.post(Routes.channelMessages(process.env.DISCORD_CHANNEL!), {
    body: {
      content: craftedMessage
    }
  })
}
