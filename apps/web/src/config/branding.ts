export const BRAND = {
  name: "Torio",
  shortName: "Torio",
  description: "AI-Powered Omnichannel Messaging Platform",
  tagline: "Manage Messenger, Instagram and WhatsApp from one unified inbox.",

  meta: {
    title: "Torio",
    metaTitle: "Torio – AI Messaging Platform for eCommerce",
    metaDescription:
      "Torio helps businesses manage Messenger, Instagram and WhatsApp conversations from a single inbox with AI-powered support.",
    keywords: [
      "Torio",
      "AI Messaging Platform",
      "Messenger Inbox",
      "Instagram Inbox",
      "WhatsApp Inbox",
      "Customer Support Software",
      "eCommerce Messaging",
    ],
  },

  auth: {
    loginTitle: "Welcome Back to Torio",
    loginSubtitle: "Sign in to manage your omnichannel inbox",
    signupTitle: "Create Your Torio Account",
    signupSubtitle: "Set up your business workspace in minutes",
    forgotPasswordTitle: "Reset Your Torio Password",
    forgotPasswordSubtitle: "We'll email you a secure reset link",
    resetPasswordTitle: "Reset Your Torio Password",
    resetPasswordSubtitle: "Choose a strong password for your account",
    verifyTitle: "Verify Your Torio Account",
  },

  pages: {
    dashboard: "Torio Dashboard",
    analytics: "Torio Analytics",
    inbox: "Torio Inbox",
    customers: "Torio Customers",
    brain: "Torio Brain",
    settings: "Torio Settings",
    settingsAi: "Torio AI Settings",
    settingsTeam: "Torio Team Settings",
    settingsBilling: "Torio Billing",
    settingsOrganization: "Torio Organization Settings",
    settingsChannels: "Torio Channel Settings",
    settingsTags: "Torio Tags",
  },

  nav: {
    dashboard: "Dashboard",
    inbox: "Inbox",
    customers: "Customers",
    analytics: "Analytics",
    settings: "Settings",
  },

  onboarding: {
    welcome: "Welcome to Torio",
    subtitle: "Let's get your business connected",
    channelsTitle: "Connect your communication channels",
    channelsDescription: "Link Messenger, Instagram and WhatsApp to Torio",
    completeTitle: "Your Torio account is ready",
    completeDescription:
      "Your workspace is ready. Connect channels and start messaging customers.",
  },

  notifications: {
    welcome: "Welcome to Torio",
    accountReady: "Your Torio account is ready",
    channelConnected: "Channel connected successfully",
  },

  emptyStates: {
    inbox: {
      title: "No conversations yet",
      description: "Connect Messenger, Instagram or WhatsApp to start using Torio.",
    },
  },

  footer: "© Torio. All rights reserved.",
  poweredBy: "Powered by Torio",
} as const;

export type BrandConfig = typeof BRAND;
