export interface ChannelConnectionInfo {
  pageId?: string | null;
  pageName?: string | null;
  instagramAccountId?: string | null;
  instagramUsername?: string | null;
  whatsappPhoneNumber?: string | null;
  whatsappPhoneNumberId?: string | null;
}

export interface ChannelAccountLike {
  id: string;
  type: string;
  name: string;
  status: string;
  createdAt?: string;
  externalId?: string | null;
  connection?: ChannelConnectionInfo | null;
}

export function getChannelAccountName(channel: ChannelAccountLike): string {
  switch (channel.type) {
    case "MESSENGER":
      return channel.connection?.pageName ?? channel.name;
    case "INSTAGRAM":
      return channel.connection?.instagramUsername
        ? `@${channel.connection.instagramUsername}`
        : channel.name;
    case "WHATSAPP":
      return channel.connection?.whatsappPhoneNumber ?? channel.name;
    default:
      return channel.name;
  }
}

export function getChannelAccountId(channel: ChannelAccountLike): string {
  switch (channel.type) {
    case "MESSENGER":
      return channel.connection?.pageId ?? channel.externalId ?? channel.id;
    case "INSTAGRAM":
      return channel.connection?.instagramAccountId ?? channel.externalId ?? channel.id;
    case "WHATSAPP":
      return (
        channel.connection?.whatsappPhoneNumberId ??
        channel.connection?.whatsappPhoneNumber ??
        channel.externalId ??
        channel.id
      );
    default:
      return channel.externalId ?? channel.id;
  }
}

export function getChannelFilterLabel(channel: ChannelAccountLike): string {
  const platform =
    channel.type === "MESSENGER"
      ? "Messenger"
      : channel.type === "INSTAGRAM"
        ? "Instagram"
        : channel.type === "WHATSAPP"
          ? "WhatsApp"
          : channel.type;

  return `${platform} · ${getChannelAccountName(channel)}`;
}
