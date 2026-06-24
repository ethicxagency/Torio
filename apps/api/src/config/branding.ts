export const BRAND = {
  name: "Torio",
  shortName: "Torio",
  description: "AI-Powered Omnichannel Messaging Platform",
  emails: {
    verifySubject: "Verify Your Torio Account",
    resetPasswordSubject: "Reset Your Torio Password",
    invitationSubject: (organizationName: string) =>
      `Invitation to Join ${organizationName} on Torio`,
    welcomeHtml: (name: string, link: string) =>
      `<p>Hi ${name},</p><p>Welcome to Torio! Verify your email to get started:</p><p><a href="${link}">Verify Your Torio Account</a></p>`,
    resetPasswordHtml: (link: string) =>
      `<p>Reset your Torio password:</p><p><a href="${link}">Reset Your Torio Password</a></p><p>This link expires in 24 hours.</p>`,
  },
  notifications: {
    welcome: "Welcome to Torio",
    accountReady: "Your Torio account is ready",
    channelConnected: "Channel connected successfully",
  },
} as const;
